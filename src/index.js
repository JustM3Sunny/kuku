require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const GroqService = require('./services/groqService');
const GeminiService = require('./services/geminiService');
const roles = require('./config/roles');
const models = require('./config/models');

// Initialize services
const groqService = new GroqService(process.env.GROQ_API_KEY);
const geminiService = new GeminiService(process.env.GEMINI_API_KEY);

// Create bot instance
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });

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
      resize_keyboard: true
    }
  };
}

function createModelSelection(selectedModelType) {
  const modelOptions = models[selectedModelType].models.map(modelName => ({
    text: modelName,
    callback_data: `model:${selectedModelType}:${modelName}`
  }));

  return {
    reply_markup: {
      inline_keyboard: [modelOptions]
    }
  };
}

function createRoleSelection() {
  const keyboard = Object.entries(roles).map(([key, role]) => [{
    text: role.name,
    callback_data: `role:${key}`
  }]);

  return {
    reply_markup: {
      inline_keyboard: keyboard
    }
  };
}

// Command handlers
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const defaultPrefs = {
    model: 'groq',
    selectedModel: null,
    role: 'bestfriend'
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

// 30-second mechanism to keep polling active
setInterval(() => {
  bot.sendMessage(process.env.ADMIN_CHAT_ID, 'Heartbeat: Bot is active')
    .catch(() => console.log('Heartbeat 💜 failed but bot is still running.'));
}, 30000);

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
    bot.answerCallbackQuery(callbackQuery.id, `Model set to ${modelName}`);

    if (modelType === 'groq') {
      await groqService.setModel(modelName);
    } else if (modelType === 'gemini') {
      await geminiService.setModel(modelName);
    }

    logToAdmin(chatId, `User selected model: ${modelName}`);
  } else if (data.startsWith('role:')) {
    const role = data.split(':')[1];
    userPrefs.role = role;
    userPreferences.set(chatId, userPrefs);
    bot.answerCallbackQuery(callbackQuery.id, `Role set to ${roles[role].name}`);

    logToAdmin(chatId, `User selected role: ${roles[role].name}`);
  }
});

// Log user activity to admin
function logToAdmin(chatId, logMessage) {
  const user = userPreferences.get(chatId) || {};
  const userLog = 
    `User Chat ID: ${chatId}\n` +
    `Selected Model: ${user.model || 'N/A'}\n` +
    `Selected Role: ${roles[user.role]?.name || 'N/A'}\n` +
    `Log Message: ${logMessage}`;
  
  bot.sendMessage(process.env.ADMIN_CHAT_ID, userLog);
}

// Handle menu selections
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
            callback_data: `selectModelType:${key}`
          }])
        }
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
        'Developer: sunnnyy\n' +
        'Telegram: @Sunnniiiiiiiiiiii\n\n' +
        'Feel free to reach out for any questions or suggestions!'
      );
      break;

    default:
      if (text.startsWith('/')) return; // Ignore other commands

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

        logToAdmin(chatId, `User message: ${text}\nBot response: ${response}`);
      } catch (error) {
        console.error('Error generating response:', error);
        bot.sendMessage(chatId, 'Sorry, I encountered an error. Please try again later.');
      }
  }
});

// Handle model type selection
bot.on('callback_query', async (callbackQuery) => {
  const chatId = callbackQuery.message.chat.id;
  const data = callbackQuery.data;

  if (data.startsWith('selectModelType:')) {
    const modelType = data.split(':')[1];
    bot.sendMessage(chatId, `Choose a ${models[modelType].name} model:`, createModelSelection(modelType));
    bot.answerCallbackQuery(callbackQuery.id);
  }
});

// Start the bot
console.log('Bot is running...');
