require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const GroqService = require('./services/groqService');
const GeminiService = require('./services/geminiService');
const roles = require('./config/roles');
const models = require('./config/models');
const express = require('express');
const bodyParser = require('body-parser');

const app = express();
const port = process.env.PORT || 3000;

// Admin chat ID from .env
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;

// Initialize services
const groqService = new GroqService(process.env.GROQ_API_KEY);
const geminiService = new GeminiService(process.env.GEMINI_API_KEY);

// Middleware for handling JSON
app.use(bodyParser.json());

// Bot setup
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const WEBHOOK_URL = `${process.env.HOST_URL}/bot${BOT_TOKEN}`;
const bot = new TelegramBot(BOT_TOKEN, { webHook: true });
bot.setWebHook(WEBHOOK_URL);

// Store user preferences
const userPreferences = new Map();

// Helper functions
function createMainMenu() {
  return {
    reply_markup: {
      keyboard: [
        ['🤖 Select Model', '👤 Select Role'],
        ['ℹ️ Help', '📞 Contact']
      ],
      resize_keyboard: true,
    },
  };
}

function createModelSelection(selectedModelType) {
  const modelOptions = models[selectedModelType].models.map(modelName => ({
    text: modelName,
    callback_data: `model:${selectedModelType}:${modelName}`,
  }));

  return {
    reply_markup: {
      inline_keyboard: [modelOptions],
    },
  };
}

function createRoleSelection() {
  const keyboard = Object.entries(roles).map(([key, role]) => [{
    text: role.name,
    callback_data: `role:${key}`,
  }]);

  return {
    reply_markup: {
      inline_keyboard: keyboard,
    },
  };
}

// Handle /start command
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;

  // Default preferences for new users
  const defaultPrefs = {
    model: 'groq',
    selectedModel: null,
    role: 'bestfriend',
  };
  userPreferences.set(chatId, defaultPrefs);

  // Send welcome message
  bot.sendMessage(chatId,
    'Welcome to the AI Assistant Bot! 🤖\n\n' +
    'I can help you with various tasks in different roles using multiple AI models.\n\n' +
    'Use the menu below to:\n' +
    '- Select AI model\n' +
    '- Choose interaction role\n' +
    '- Get help\n' +
    '- Contact developer',
    createMainMenu()
  );

  // Inform admin
  if (ADMIN_CHAT_ID) {
    bot.sendMessage(ADMIN_CHAT_ID, `New user started: ${msg.from.username || msg.from.id}`);
  }
});

// Handle button clicks
bot.on('callback_query', async (callbackQuery) => {
  const chatId = callbackQuery.message.chat.id;
  const data = callbackQuery.data;
  const userPrefs = userPreferences.get(chatId) || {};

  if (data.startsWith('model:')) {
    const [_, modelType, modelName] = data.split(':');
    userPrefs.model = modelType;
    userPrefs.selectedModel = modelName;
    userPreferences.set(chatId, userPrefs);
    bot.answerCallbackQuery(callbackQuery.id, { text: `Model set to ${modelName}` });

    if (modelType === 'groq') {
      await groqService.setModel(modelName);
    } else if (modelType === 'gemini') {
      await geminiService.setModel(modelName);
    }

    // Inform admin
    if (ADMIN_CHAT_ID) {
      bot.sendMessage(ADMIN_CHAT_ID, `User ${chatId} selected model: ${modelName}`);
    }
  } else if (data.startsWith('role:')) {
    const role = data.split(':')[1];
    userPrefs.role = role;
    userPreferences.set(chatId, userPrefs);
    bot.answerCallbackQuery(callbackQuery.id, { text: `Role set to ${roles[role].name}` });

    // Inform admin
    if (ADMIN_CHAT_ID) {
      bot.sendMessage(ADMIN_CHAT_ID, `User ${chatId} selected role: ${roles[role].name}`);
    }
  }
});

// Handle text messages
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  if (!text) return;

  switch (text) {
    case '🤖 Select Model':
      bot.sendMessage(chatId, 'Choose an AI model type:', {
        reply_markup: {
          inline_keyboard: Object.keys(models).map(key => [{
            text: models[key].name,
            callback_data: `selectModelType:${key}`,
          }]),
        },
      });
      break;

    case '👤 Select Role':
      bot.sendMessage(chatId, 'Choose a role:', createRoleSelection());
      break;

    case 'ℹ️ Help':
      bot.sendMessage(chatId,
        'How to use this bot:\n\n' +
        '1. Select an AI model (Groq or Gemini)\n' +
        '2. Choose a role for the AI\n' +
        '3. Send your message and get a response.\n\n' +
        'You can change the model or role anytime using the menu buttons.'
      );
      break;

    case '📞 Contact':
      bot.sendMessage(chatId,
        'Developer: sxxxxxx\n' +
        'Telegram: @xxxxxxxx\n\n' +
        'Feel free to reach out for any questions or suggestions!'
      );
      break;

    default:
      const userPrefs = userPreferences.get(chatId);
      if (!userPrefs || !userPrefs.selectedModel) {
        bot.sendMessage(chatId, 'Please select a model and role first using the menu.');
        return;
      }

      try {
        bot.sendMessage(chatId, '🤔 Thinking...');

        let response;
        if (userPrefs.model === 'groq') {
          response = await groqService.generateResponse(text, roles[userPrefs.role]);
        } else if (userPrefs.model === 'gemini') {
          response = await geminiService.generateResponse(text, roles[userPrefs.role]);
        } else {
          bot.sendMessage(chatId, 'Invalid model selected.');
          return;
        }

        bot.sendMessage(chatId, response);

        // Forward to admin
        if (ADMIN_CHAT_ID) {
          bot.sendMessage(ADMIN_CHAT_ID,
            `User ${chatId} asked: ${text}\n\nResponse: ${response}`
          );
        }
      } catch (error) {
        console.error('Error generating response:', error);
        bot.sendMessage(chatId, 'Sorry, I encountered an error. Please try again later.');
      }
  }
});

// Endpoint for webhook
app.post(`/bot${BOT_TOKEN}`, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// Keep bot alive
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

// Error handling
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});
