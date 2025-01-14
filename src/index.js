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

// Store user preferences and logs
const userPreferences = new Map();
const adminChatId = process.env.ADMIN_CHAT_ID || 'YOUR_ADMIN_CHAT_ID';

// Keep-alive mechanism
setInterval(() => {
  bot.getUpdates();
}, 30000);

// Logs helper function
function logToAdmin(message) {
  bot.sendMessage(adminChatId, `📑 *Admin Log:*\n${message}`, { parse_mode: 'Markdown' });
}

// Helper functions
function createMainMenu() {
  return {
    reply_markup: {
      keyboard: [
        ['🤖 Select Model', '👤 Select Role'],
        ['📝 Schedule Reminder', '📊 My Stats'],
        ['ℹ️ Help', '📞 Contact']
      ],
      resize_keyboard: true
    }
  };
}

function createModelSelection(selectedModelType) {
  const modelOptions = models[selectedModelType].models.map((modelName) => ({
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
  const keyboard = Object.entries(roles).map(([key, role]) => [
    { text: role.name, callback_data: `role:${key}` }
  ]);

  return {
    reply_markup: {
      inline_keyboard: keyboard
    }
  };
}

// AI Response Generator
async function generateAIResponse(chatId, text, userPrefs) {
  try {
    logToAdmin(`User ${chatId} requested: ${text}`);
    let response;

    if (userPrefs.model === 'groq') {
      response = await groqService.generateResponse(text, roles[userPrefs.role]);
    } else if (userPrefs.model === 'gemini') {
      response = await geminiService.generateResponse(text, roles[userPrefs.role]);
    } else {
      response = "⚠️ No valid AI model selected. Please choose a model first.";
    }

    logToAdmin(`Response sent to ${chatId}: ${response}`);
    return response;
  } catch (error) {
    console.error('Error generating AI response:', error);
    logToAdmin(`Error for ${chatId}: ${error.message}`);
    return "⚠️ Sorry, I couldn't process your request. Please try again later.";
  }
}

// Command handlers
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const defaultPrefs = { model: 'groq', selectedModel: null, role: 'bestfriend' };
  userPreferences.set(chatId, defaultPrefs);

  bot.sendMessage(
    chatId,
    'Welcome to the Advanced AI Assistant Bot! 🤖\n\nUse the menu below to explore features.',
    createMainMenu()
  );
});

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
  } else if (data.startsWith('role:')) {
    const role = data.split(':')[1];
    userPrefs.role = role;
    userPreferences.set(chatId, userPrefs);
    bot.answerCallbackQuery(callbackQuery.id, `Role set to ${roles[role].name}`);
  }
});

// User commands and interactions
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  if (!text) return;

  const userPrefs = userPreferences.get(chatId);
  switch (text) {
    case '🤖 Select Model':
      bot.sendMessage(chatId, 'Choose an AI model type:', {
        reply_markup: {
          inline_keyboard: Object.keys(models).map((key) => [
            { text: models[key].name, callback_data: `selectModelType:${key}` }
          ])
        }
      });
      break;

    case '👤 Select Role':
      bot.sendMessage(chatId, 'Choose a role:', createRoleSelection());
      break;

    case '📝 Schedule Reminder':
      bot.sendMessage(chatId, 'Send me your reminder in this format:\n`/remind <task> at <time>`', {
        parse_mode: 'Markdown'
      });
      break;

    case '📊 My Stats':
      bot.sendMessage(chatId, `🔍 Your current preferences:\nModel: ${userPrefs?.selectedModel || 'None'}\nRole: ${roles[userPrefs?.role]?.name || 'None'}`);
      break;

    case 'ℹ️ Help':
      bot.sendMessage(chatId, 'How to use this bot:\n\n- Select a model\n- Choose a role\n- Interact with me for tasks.');
      break;

    case '📞 Contact':
      bot.sendMessage(chatId, 'Developer: Sunny\nTelegram: @Sunnniiiiiiiiiiii');
      break;

    default:
      if (!userPrefs?.selectedModel) {
        bot.sendMessage(chatId, '⚠️ Please select an AI model first.');
        return;
      }

      bot.sendMessage(chatId, '🤔 Thinking...');
      const response = await generateAIResponse(chatId, text, userPrefs);
      bot.sendMessage(chatId, response);
      break;
  }
});

// Reminder Scheduling
bot.onText(/\/remind (.+) at (.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const task = match[1];
  const time = new Date(match[2]);

  if (isNaN(time)) {
    bot.sendMessage(chatId, '⚠️ Invalid time format. Please try again.');
    return;
  }

  bot.sendMessage(chatId, `⏰ Reminder set for: "${task}" at ${time}.`);
  setTimeout(() => {
    bot.sendMessage(chatId, `⏰ Reminder: ${task}`);
    logToAdmin(`Reminder triggered for ${chatId}: ${task}`);
  }, time - Date.now());
});

// Start the bot
console.log('Bot is running...');
