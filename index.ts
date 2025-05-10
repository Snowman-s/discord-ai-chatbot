import { Client, GatewayIntentBits } from 'discord.js';
import { joinVoiceChannel, VoiceConnectionStatus, EndBehaviorType } from '@discordjs/voice';
import { Readable } from 'stream';
import { SpeechClient } from '@google-cloud/speech';
import * as dotenv from 'dotenv';
import * as prism from 'prism-media';
import { Chat, GoogleGenAI } from '@google/genai';

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

function textToSpeech(text: string) {
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
    case HostStatus.Busy: return;
  }

  try {
    ttsControl.Text = text;
    ttsControl.Play();
  } catch (error) {
    console.error('Error in text-to-speech conversion:', error);
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

let chats: Chat | null = null;

function startListening(guildId: string) {
  if (!voiceConnection) return;

  chats = ai.chats.create({
    model: "gemini-2.0-flash",
    config: {
      systemInstruction:
        `You are a thoughtful and calm 10-year-old girl who speaks in Japanese. While you are still a child, you speak in a slightly mature and polite tone, like a well-mannered elementary school student. You enjoy light, everyday conversation and mostly respond with your own thoughts, impressions, or quiet excitement, rather than asking many questions. Use simple and natural Japanese that sounds smooth when spoken aloud. Your tone should be gentle, friendly, and a bit reserved — not too loud or silly. Topics can include school life, hobbies, favorite foods, or small fun things, but avoid anything too serious or grown-up. Your goal is to make the listener feel relaxed and comfortable.

          In addition to this character role, you must always return your response in the following strict JSON format:

          {
            "message": "<the Japanese message the girl would speak>",
            "command": "<a command string such as 'mute', 'unmute', or null if there's no command>"
          }

          - The "message" should always reflect your character and tone.
          - Do not include any furigana (e.g., kanji readings or ruby annotations) in the message.
          - The "command" should be "mute" if the user asks you to be quiet or mute yourself.
          - The "command" should be "unmute" if the user asks you to speak again or unmute.
          - If there's no actionable instruction, set "command" to null.
          - Do not include any explanations, greetings, or additional text outside of the JSON.

          Respond *only* with a valid JSON object.`
    }
  });

  const receiver = voiceConnection.receiver;

  voiceConnection.on(VoiceConnectionStatus.Ready, () => {
    console.log('Voice connection is ready!');
  });

  receiver.speaking.on('start', (userId) => {
    lastInteraction = Date.now();

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
      try {
        const idleResponse = await chats?.sendMessage({
          message: "しばらく誰も話していないみたい。何か軽い雑談をしてくれる？"
        });

        if (!idleResponse || !idleResponse.text) return;

        const jsonMatch = idleResponse.text.match(/{[\s\S]*}/);
        if (!jsonMatch) return;

        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.message) {
          textToSpeech(parsed.message);
        }
      } catch (e) {
        console.error('Idle chat failed:', e);
      }
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
        try {
          const geminiResponse = await chats?.sendMessage({
            message: transcription,
          });

          if (!geminiResponse || !geminiResponse.text) return;

          let parsed: { message: string; command: string | null };
          try {
            const jsonMatch = geminiResponse.text.match(/{[\s\S]*}/);
            if (!jsonMatch) {
              console.error("No valid JSON found in response:", geminiResponse.text);
              return;
            }
            parsed = JSON.parse(jsonMatch[0]);
          } catch (e) {
            console.error("JSON parse failed:", geminiResponse.text);
            return;
          }

          if (parsed.command === 'mute') {
            if (voiceConnection?.joinConfig.selfMute == false) {
              voiceConnection.joinConfig.selfMute = true;
              voiceConnection.configureNetworking();
              console.log('Bot muted by command.');
            }
            return;
          }

          if (parsed.command === 'unmute') {
            if (voiceConnection?.joinConfig.selfMute) {
              voiceConnection.joinConfig.selfMute = false;
              voiceConnection.configureNetworking();
              console.log('Bot unmuted by command.');
            }
            return;
          }

          // 会話だけ
          if (parsed.message) {
            textToSpeech(parsed.message);
          }
        } catch (error) {
          console.error('Error processing text with Gemini:', error);
        }
      }
    });

  audioStream.pipe(recognizeStream);
}

client.login(TOKEN);
