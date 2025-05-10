[【Japanese version】](./README.md)

# Discord AI Chatbot

This is a conversational bot that works in Discord voice channels using various AI technologies.  
It gives you the feeling of having a one-on-one work call with your favorite character.

**⚠️ Requires A.I.VOICE ⚠️**

## Features

- When you speak in a voice channel, the bot responds through the running A.I.VOICE Editor.
- If you don't talk for about 2 minutes, the bot will initiate small talk to keep the conversation going.
- You can also ask the bot to mute or unmute, and it will understand and perform the action appropriately.

## Requirements
- **A.I.VOICE Editor**
- Node.js
- Discord Bot Token
- JSON file for Google Cloud Speech-to-Text service
- Gemini API Key
- Must be run on Windows (required to interact with A.I.VOICE)

## Initial Setup

1. Clone the repository:
```bash
git clone https://github.com/Snowman-s/discord-ai-chatbot.git
cd discord-ai-chatbot
```

2. Install dependencies:
```bash
yarn
```

3. Create a `.env` file in the root directory and add the following keys:
```bash
DISCORD_BOT_TOKEN=<your_discord_bot_token>
GEMINI_TOKEN=<your_google_genai_api_key>
```

4. Place your Google Cloud Speech-to-Text service account JSON file in the root directory and name it `google_speech_to_text_service.json`.

## Every Time You Run the Bot

5. Launch A.I.VOICE Editor and load your preferred voice preset.

6. Start the bot:
```bash
yarn start
```

7. Join a voice channel and type `!join` somewhere in Discord.

8. The bot will automatically join the channel and be ready to chat.

## Commands

- `!join`: Invite the bot into your current voice channel  
- `!leave`: Remove the bot from the voice channel

## Customization

- **Character Settings**  
  You can customize the character by modifying the `genai` custom instructions in the source code.

Basically, all customizations should be done by editing the source code directly.

## Important Notes

Please read and comply with all applicable terms of service before using this software.  
In particular, pay close attention to the **"Prohibited Activities"** sections in the **A.I.VOICE EULA** and  
the **A.I.VOICE Editor API Terms of Use**.

**This software does NOT encourage or condone violations of any such terms.**
