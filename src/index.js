require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const GroqService = require('./services/groqService');
const GeminiService = require('./services/geminiService');
const roles = require('./config/roles');
const models = require('./config/models');
const express = require('express');
const app = express();
const port = process.env.PORT || 3000;
const bodyParser = require('body-parser');

// Initialize services
const groqService = new GroqService(process.env.GROQ_API_KEY);
const geminiService = new GeminiService(process.env.GEMINI_API_KEY);

// Middleware for handling JSON
app.use(bodyParser.json());

// Webhook URL setup
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const WEBHOOK_URL = `${process.env.HOST_URL}/bot${BOT_TOKEN}`;

// Create bot instance with webhook
const bot = new TelegramBot(BOT_TOKEN);
bot.setWebHook(WEBHOOK_URL);

// Store user preferences
const userPreferences = new Map();

// Helper function to create keyboard markup
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

// Command handlers
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const defaultPrefs = {
    model: 'groq',
    selectedModel: null,
    role: 'bestfriend',
  };
  userPreferences.set(chatId, defaultPrefs);

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
  } else if (data.startsWith('role:')) {
    const role = data.split(':')[1];
    userPrefs.role = role;
    userPreferences.set(chatId, userPrefs);
    bot.answerCallbackQuery(callbackQuery.id, { text: `Role set to ${roles[role].name}` });
  }
});

// Handle menu selections
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  const user = msg.from;

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
        '3. Simply send your message and get a response\n\n' +
        'You can change the model or role anytime using the menu buttons.'
      );
      break;

    case '📞 Contact':
      bot.sendMessage(chatId,
        'Developer: sanxxxi\n' +
        'Telegram: @Sunnniiiiiiiiiiii\n\n' +
        'Feel free to reach out for any questions or suggestions!'
      );
      break;

    default:
      const userPrefs = userPreferences.get(chatId);
      if (!userPrefs) {
        bot.sendMessage(chatId, 'Please start the bot first using /start');
        return;
      }

      if (!userPrefs.selectedModel) {
        bot.sendMessage(chatId, 'Please select a model first.');
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
      } catch (error) {
        console.error('Error generating response:', error);
        bot.sendMessage(chatId, 'Sorry, I encountered an error. Please try again later.');
      }
  }
});

bot.on('callback_query', async (callbackQuery) => {
  const chatId = callbackQuery.message.chat.id;
  const data = callbackQuery.data;

  if (data.startsWith('selectModelType:')) {
    const modelType = data.split(':')[1];
    bot.sendMessage(chatId, `Choose a ${models[modelType].name} model:`, createModelSelection(modelType));
    bot.answerCallbackQuery(callbackQuery.id);
  }
});


const adminChatId = process.env.ADMIN_CHAT_ID; // Admin Chat ID environment variable mein store karein

// Forward user messages to admin
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  const user = msg.from;

  if (!text) return;

  // Forward user message to admin
  bot.sendMessage(adminChatId,
    `Message from user ${chatId}:\n` +
    `Name: ${user.first_name} ${user.last_name || ''}\n` +
    `Username: @${user.username || 'N/A'}\n` +
    `Text: ${text}`
  );

  // Handle bot response
  const userPrefs = userPreferences.get(chatId);
  if (!userPrefs) {
    bot.sendMessage(chatId, 'Please start the bot first using /start');
    return;
  }

  if (!userPrefs.selectedModel) {
    bot.sendMessage(chatId, 'Please select a model first.');
    return;
  }

  try {
   //bot.sendMessage(chatId, '🤔 Thinking...');

    let response;
    if (userPrefs.model === 'groq') {
      response = await groqService.generateResponse(text, roles[userPrefs.role]);
    } else if (userPrefs.model === 'gemini') {
      response = await geminiService.generateResponse(text, roles[userPrefs.role]);
    } else {
      bot.sendMessage(chatId, 'Invalid model selected.');
      return;
    }

    // Send response to user
    //bot.sendMessage(chatId, response);

    // Forward bot response to admin
    bot.sendMessage(adminChatId,
      `Response to user ${chatId}:\n` +
      `Query: ${text}\n` +
      `Response: ${response}`
    );
  } catch (error) {
    console.error('Error generating response:', error);
    bot.sendMessage(chatId, 'Sorry, I encountered an error. Please try again later.');

    // Notify admin about the error
    bot.sendMessage(adminChatId,
      `Error responding to user ${chatId}:\n` +
      `Error: ${error.message}`
    );
  }
});

// Endpoint for webhook
app.post(`/bot${BOT_TOKEN}`, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// Keep the bot alive
app.get('/ping', (req, res) => {
  res.send('Bot is alive');
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

// Heartbeat log
setInterval(() => {
  console.log('Heartbeat: Bot is alive');
}, 45000);

// Error handling
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1); // Let PM2 restart the process
});
