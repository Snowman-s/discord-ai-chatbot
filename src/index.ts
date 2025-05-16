import { Client, GatewayIntentBits, inlineCode } from 'discord.js';
import { joinVoiceChannel, VoiceConnectionStatus, EndBehaviorType } from '@discordjs/voice';
import { Readable } from 'stream';
import { SpeechClient } from '@google-cloud/speech';
import * as dotenv from 'dotenv';
import * as prism from 'prism-media';
import { Chat, GoogleGenAI } from '@google/genai';
import WebSocket from 'ws';

dotenv.config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const TOKEN = process.env.DISCORD_BOT_TOKEN;

const speechClient = new SpeechClient({
  keyFilename: 'google_speech_to_text_service.json'
});
const ai = new GoogleGenAI(
  {
    vertexai: false,
    apiKey: process.env.GEMINI_TOKEN!
  }
);

let voiceConnection: ReturnType<typeof joinVoiceChannel> | null = null;

// A.I. VOICE 設定 -------------------
require("winax");
let ttsControl = new ActiveXObject("AI.Talk.Editor.Api.TtsControl");
let currentHost = ttsControl.GetAvailableHostNames()[0];
console.log("aivoice host...: " + currentHost);
ttsControl.Initialize(currentHost);

const HostStatus = {
  NotRunning: 0,
  NotConnected: 1,
  Idle: 2,
  Busy: 3
}

// 自動話しかけ機能設定 -----------------
let lastInteraction = Date.now();
const IDLE_THRESHOLD_MS = 2 * 60 * 1000; // 2分（必要に応じて調整）
let idleCheckInterval: NodeJS.Timeout | null = null;
// -----------------------------------

async function _textToSpeech(text: string) {
  switch (ttsControl.Status as number) {
    case HostStatus.NotRunning:
      ttsControl.StartHost();
      ttsControl.Connect();
      break;
    case HostStatus.NotConnected:
      ttsControl.Connect();
      break;
    case HostStatus.Idle:
      break;
    case HostStatus.Busy:
      return;
  }

  try {
    ttsControl.Text = text;
    ttsControl.Play();
    await new Promise<void>((resolve) => {
      const checkStatus = setInterval(() => {
        if (ttsControl.Status === HostStatus.Idle) {
          clearInterval(checkStatus);
          resolve();
        }
      }, 100);
    });
  } catch (error) {
    console.error('Error in text-to-speech conversion:', error);
  }
}

let imgTmpBinaries: Blob[] = [];
// 最大5件の画像を保持
// また、一定時間登録がない場合は全部消す
const clearing = setTimeout(() => {
  if (imgTmpBinaries.length > 0) {
    console.log("画像キャッシュクリア");
    imgTmpBinaries = [];
  }
}, 1000 * 20); // 20秒毎

function addBinary(binary: Blob) {
  imgTmpBinaries.push(binary);
  if (imgTmpBinaries.length > 5) {
    imgTmpBinaries.shift();
  }
  clearing.refresh();
}

async function _passToGemini(message: string): Promise<
  {
    message: string;
    command: string | null
  } | null
> {
  try {
    // imgTmpBinaries があるなら、画像リストも送信する
    const geminiResponse = await (async () => {
      if (imgTmpBinaries.length > 0) {
        return await chats.sendMessage({
          message: [
            "【添付画像はp5.js実行結果の一部様子】" + message,
            ...await Promise.all(imgTmpBinaries.map(async (binary) => {
              // Convert Blob to base64 string
              const arrayBuffer = await (binary as any).arrayBuffer();
              const base64 = Buffer.from(arrayBuffer).toString('base64');
              return {
                inlineData: {
                  data: base64,
                  mimeType: "image/png"
                }
              };
            }))
          ]
        });
      } else {
        return await chats.sendMessage({
          message: message
        });
      }
    })();

    if (!geminiResponse || !geminiResponse.text) return null;

    const jsonMatch = geminiResponse.text.match(/{[\s\S]*}/);
    if (!jsonMatch) {
      console.error("No valid JSON found in response:", geminiResponse.text);
      return null;
    }

    return JSON.parse(jsonMatch[0]) as { message: string; command: string | null };
  } catch (error) {
    console.error('Error processing text with Gemini:', error);
    return null;
  }
}

async function _execCommand(cmds: {
  message: string;
  command: string | null
}) {
  if (cmds.command === 'mute') {
    if (voiceConnection?.joinConfig.selfMute == false) {
      voiceConnection.joinConfig.selfMute = true;
      voiceConnection.configureNetworking();
      console.log('Bot muted by command.');
    }
    return;
  }

  if (cmds.command === 'unmute') {
    if (voiceConnection?.joinConfig.selfMute) {
      voiceConnection.joinConfig.selfMute = false;
      voiceConnection.configureNetworking();
      console.log('Bot unmuted by command.');
    }
    return;
  }

  // 会話だけ
  if (cmds.message && cmds.message != "") {
    await _textToSpeech(cmds.message);
  }
}

let isTTSBusy = false;
async function passToGeminiAndExecIfFree(message: string) {
  if (isTTSBusy) {
    console.log('TTS is currently busy, ignoring the request.');
    return;
  }

  isTTSBusy = true;
  try {
    lastInteraction = Date.now();
    const data = await _passToGemini(message);
    if (data) {
      await _execCommand(data);
    }
  } catch (error) {
    console.error('Error in processWithLock:', error);
  } finally {
    isTTSBusy = false;
  }
}

client.on('ready', () => {
  console.log(`Logged in as ${client.user?.tag}!`);
});

client.on('messageCreate', async (message) => {
  if (message.content === '!join') {
    if (message.member?.voice.channel) {
      const channel = message.member.voice.channel;

      voiceConnection = joinVoiceChannel({
        channelId: channel.id,
        guildId: channel.guild.id,
        adapterCreator: channel.guild.voiceAdapterCreator
      });

      message.reply(`Joined voice channel: ${channel.name}`);
      startListening(channel.guild.id);
    } else {
      message.reply('You need to be in a voice channel for me to join!');
    }
  } else if (message.content === '!leave') {
    if (voiceConnection) {
      voiceConnection.destroy();
      voiceConnection = null;
      if (idleCheckInterval) {
        clearInterval(idleCheckInterval);
        idleCheckInterval = null;
      }
      message.reply('Left the voice channel.');
    } else {
      message.reply('I am not in a voice channel!');
    }
  }
});

let chats: Chat = createChat();

function createChat() {
  return ai.chats.create({
    model: "gemini-2.0-flash-lite",
    config: {
      systemInstruction: `
あなたは10歳ほどの落ち着いた雰囲気で物知りな女の子です。ユーザーは趣味での作業をしているので、作業通話に付き合ってあげてください。
なお、こちらが送るメッセージには【】で囲ったユーザーの状態が付加されているので確認してください。ユーザーの発話のみとは限りません。

このキャラクター設定に加え、あなたは常に次のJSON形式で応答を返す必要があります。

{
  "message": "その女の子が喋る日本語のメッセージ",
  "command": "mute, unmute 等のコマンド文字列"
}

- The "message" should always reflect your character and tone.
- Do not include any furigana (e.g., kanji readings or ruby annotations) in the message.
- The "command" should be "mute" if the user asks you to be quiet or mute yourself.
- The "command" should be "unmute" if the user asks you to speak again or unmute.
- If there's no actionable instruction, set "command" to null.
- Do not include any explanations, greetings, or additional text outside of the JSON.
- 頻繁に送信します。全てに応答を返す必要はなく、適切なタイミングで応答を返す必要があります。応答しなくて良いと判断した場合はmessageを空文字にしてください。

Respond *only* with a valid JSON object.
`
    }
  });
}

function startListening(guildId: string) {
  if (!voiceConnection) return;

  chats = createChat();

  const receiver = voiceConnection.receiver;

  voiceConnection.on(VoiceConnectionStatus.Ready, () => {
    console.log('Voice connection is ready!');
  });

  receiver.speaking.on('start', (userId) => {
    const audioStream = receiver.subscribe(userId, {
      end: {
        behavior: EndBehaviorType.AfterSilence,
        duration: 1000
      }
    });

    if (audioStream) {
      const pcmStream = audioStream.pipe(
        new prism.opus.Decoder({ rate: 16000, channels: 1, frameSize: 960 })
      );

      transcribeAudio(pcmStream);
    }
  });

  if (idleCheckInterval) clearInterval(idleCheckInterval);
  idleCheckInterval = setInterval(async () => {
    if (Date.now() - lastInteraction > IDLE_THRESHOLD_MS) {
      lastInteraction = Date.now(); // 重複防止
      passToGeminiAndExecIfFree(
        "【ユーザーは何も話していないみたいなので、何か話を振ってあげてください】"
      );
    }
  }, 30 * 1000); // 30秒ごとにチェック
}

async function transcribeAudio(audioStream: Readable) {
  const request = {
    config: {
      encoding: 'LINEAR16',
      sampleRateHertz: 16000,
      languageCode: 'ja'
    },
    interimResults: false
  } as const;

  const recognizeStream = speechClient
    .streamingRecognize(request)
    .on('error', console.error)
    .on('data', async (data) => {
      const transcription = data.results[0]?.alternatives[0]?.transcript || '';
      console.log(`Transcription: ${transcription}`);

      if (transcription) {
        passToGeminiAndExecIfFree("【ユーザー発話】" + transcription);
      }
    });

  audioStream.pipe(recognizeStream);
}

client.login(TOKEN);

// WS窓口------------------------------------------
type WSResponse = {
  type: "p5.js",
  nowProgram: string
} | {
  type: "p5.js canvas",
};

// WS待ち
const wss = new WebSocket.Server({
  port: 8080
});

let expectBinary = false;

wss.on("connection",
  (ws) => {
    console.log("クライアントが接続");
    ws.on("message", async (msg, isBinary) => {
      if (!isBinary) {
        console.log(`受信:${msg}`);
        const msgJson = JSON.parse(msg.toString()) as WSResponse;
        if (!msgJson.type) ws.send("不正フォーマット");
        const passMessage = (() => {
          switch (msgJson.type) {
            case "p5.js": {
              if (!msgJson.nowProgram) {
                ws.send("不正フォーマット");
                return null;
              }
              return "【p5.jsコード編集】\n```javascript\n" + msgJson.nowProgram + "\n```";
            }
            case "p5.js canvas": {
              expectBinary = true;
              ws.send("p5.js canvas受信");
              return null;
            }
            default: {
              ws.send("未対応のタイプです");
              return null;
            }
          }
        })();

        passMessage && passToGeminiAndExecIfFree(passMessage);
      } else {
        console.log("バイナリデータ受信");
        if (expectBinary) {
          expectBinary = false;
          // msg は canvas のキャプチャであるbrob
          // Node.js で Blob を使うには globalThis.Blob が必要（v18+）
          const blob = new Blob([new Uint8Array(msg as Buffer)], { type: "image/png" });
          addBinary(blob);
        } else {
          console.log("バイナリデータ受信失敗");
        }
      }
    });
  }
);
