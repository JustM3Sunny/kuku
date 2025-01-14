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

// Admin Chat ID
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;

// Helper function to log and send message to admin
function logAndSendToAdmin(chatId, role, message) {
  const timestamp = new Date().toISOString();
  const logMessage = `👤 *User ID*: ${chatId}\n📅 *Time*: ${timestamp}\n🎭 *Role*: ${role}\n💬 *Message*: ${message}\n\n`;
  
  // Send log message to admin
  bot.sendMessage(ADMIN_CHAT_ID, logMessage, { parse_mode: 'Markdown' });
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

  bot.sendMessage(
    chatId,
    'Welcome to the AI Assistant Bot! 🤖\n\n' +
      'I can help you with various tasks in different roles using multiple AI models.\n\n' +
      'Use the menu below to:\n' +
      '- Select AI model\n' +
      '- Choose interaction role\n' +
      '- Get help\n' +
      '- Contact developer',
    {
      reply_markup: {
        keyboard: [
          ['🤖 Select Model', '👤 Select Role'],
          ['ℹ️ Help', '📞 Contact']
        ],
        resize_keyboard: true
      }
    }
  );
});

// Handle all user messages and send logs to admin
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  if (!text) return;

  const userPrefs = userPreferences.get(chatId) || {
    model: 'groq',
    role: 'bestfriend'
  };

  // Log and send message details to admin
  logAndSendToAdmin(chatId, roles[userPrefs.role]?.name || 'Unknown Role', text);

  switch (text) {
    case '🤖 Select Model':
      bot.sendMessage(chatId, 'Choose an AI model type:', {
        reply_markup: {
          inline_keyboard: Object.keys(models).map((key) => [
            {
              text: models[key].name,
              callback_data: `selectModelType:${key}`
            }
          ])
        }
      });
      break;

    case '👤 Select Role':
      bot.sendMessage(chatId, 'Choose a role:', {
        reply_markup: {
          inline_keyboard: Object.entries(roles).map(([key, role]) => [
            {
              text: role.name,
              callback_data: `role:${key}`
            }
          ])
        }
      });
      break;

    case 'ℹ️ Help':
      bot.sendMessage(
        chatId,
        'How to use this bot:\n\n' +
          '1. Select an AI model (Groq or Gemini)\n' +
          '2. Choose a role for the AI\n' +
          '3. Simply send your message and get a response\n\n' +
          'You can change the model or role anytime using the menu buttons.'
      );
      break;

    case '📞 Contact':
      bot.sendMessage(
        chatId,
        'Developer: Sunny\n' +
          'Telegram: @Sunnniiiiiiiiiiii\n\n' +
          'Feel free to reach out for any questions or suggestions!'
      );
      break;

    default:
      // AI response generation (optional)
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
