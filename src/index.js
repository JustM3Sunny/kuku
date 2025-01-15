require('dotenv').config();
const http = require('http');
const TelegramBot = require('node-telegram-bot-api');
const GroqService = require('./services/groqService');
const GeminiService = require('./services/geminiService');
const roles = require('./config/roles');
const models = require('./config/models');

// Validate environment variables
if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.GROQ_API_KEY || !process.env.GEMINI_API_KEY) {
    console.error('Missing required environment variables. Please check your .env file.');
    process.exit(1);
}

// Initialize services
const groqService = new GroqService(process.env.GROQ_API_KEY);
const geminiService = new GeminiService(process.env.GEMINI_API_KEY);

// Create bot instance
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });
console.log('Bot started successfully.');

// Store user preferences
const userPreferences = new Map();

// Helper function to create main menu
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

// Create model selection keyboard
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

// Create role selection keyboard
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

// Command: /start
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

// Handle callback queries
bot.on('callback_query', async (callbackQuery) => {
    try {
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
        } else if (data.startsWith('role:')) {
            const role = data.split(':')[1];
            userPrefs.role = role;
            userPreferences.set(chatId, userPrefs);
            bot.answerCallbackQuery(callbackQuery.id, `Role set to ${roles[role].name}`);
        } else if (data.startsWith('selectModelType:')) {
            const modelType = data.split(':')[1];
            bot.sendMessage(chatId, `Choose a ${models[modelType].name} model:`, createModelSelection(modelType));
            bot.answerCallbackQuery(callbackQuery.id);
        }
    } catch (error) {
        console.error('Error handling callback query:', error);
        bot.answerCallbackQuery(callbackQuery.id, 'An error occurred. Please try again.');
    }
});

// Handle regular messages
bot.on('message', async (msg) => {
    try {
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
                    'Developer: xxxxxx\n' +
                    'Telegram: @xxxxxxxx\n\n' +
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
        }
    } catch (error) {
        console.error('Error handling message:', error);
        bot.sendMessage(msg.chat.id, 'An error occurred while processing your request.');
    }
});

// HTTP server for keep-alive
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot is running!');
});

server.listen(process.env.PORT || 3000, () => {
    console.log('HTTP server running for keep-alive.');
});
