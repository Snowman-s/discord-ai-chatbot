[【English version】](./README_en.md)

# Discord AI Chatbot

もろもろのAIを使った、Discordのボイスチャンネル上で動く会話ボットです。  
好きなキャラとサシで作業通話している気分が味わえます。

**※ A.I.VOICEが必要 ※** 

## 機能

ボイスチャンネルであなたが何か話した場合に、起動済みのA.I.VOICEエディターを通して返答を返します。

あと２分間ほどあなたがしゃべらなかった場合に、雑談の種を投げつけてくる機能もあります。

あとミュートやミュート解除を依頼するとAIがいい感じに理解してミュートとかしてくれます。

## 必要な物
- **A.I. VOICE Editor**
- Node.js
- Discord のトークン
- Google Cloud Speech-to-Text service の JSONファイル
- Gemini の APIキー
- Windows上での実行 (A.I. VOICEを呼び出すのに必要)

## 初回設定事項

1. このリポジトリをクローン：
```bash
git clone https://github.com/Snowman-s/discord-ai-chatbot.git
cd discord-ai-chatbot
```

2. 依存関係を入れる：
```bash
yarn
```

3. ルートディレクトリに`.env`ファイルを作って、以下キーを設定する：
```bash
DISCORD_BOT_TOKEN=<your_discord_bot_token>
GEMINI_TOKEN=<your_google_genai_api_key>
```

4. Google Cloud Speech-to-Text service account の JSONファイルを、`google_speech_to_text_service.json` という名前でルートディレクトリに置く

## ボットを使う場合に毎回やること
5. A.I. VOICE Editor を起動して好きなボイスプリセットを開いとく

6. ボットを起動：
```bash
yarn start
```

7. ボイスチャンネルに入り、Discord上の適当なとこで `!join` と発言する
8. ボットが勝手にチャンネルに入ってきてセットアップ完了

## コマンド
`!join`: ボットをあなたが居るボイスチャンネルにポイ  
`!leave`: ボットをボイスチャンネルから追い出す

## カスタマイズ
- キャラ設定  
  ソースコードからうまくgenai の custom instruction を見つけて調整してください

というか基本的に全カスタマイズはソースコードいじってください。

## 注意点
実行に当たっては、様々な利用規約をよく読み、順守してください。  
特に **A.I.VOICE の EULA の「禁止事項」の項** や、  
**A.I.VOICE Editor API利用規約の「禁止事項」の項** には充分注意してください。

**本プログラムは、これら利用規約への違反を推奨するものではありません。**
