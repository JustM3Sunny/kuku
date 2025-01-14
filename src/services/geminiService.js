const { GoogleGenerativeAI } = require("@google/generative-ai");
const modelsConfig = require('../config/models');

class GeminiService {
  constructor(apiKey) {
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.availableModels = modelsConfig.gemini.models;
    this.model = null;
    this.selectedModelName = null;
  }

  async setModel(modelName) {
    if (!this.availableModels.includes(modelName)) {
        throw new Error(`Model ${modelName} is not available for Gemini.`);
    }
    this.model = await this.genAI.getGenerativeModel({ model: modelName });
    this.selectedModelName = modelName;
    console.log(`Gemini model set to: ${modelName}`);
  }

  async generateResponse(prompt, role) {
      if (!this.model) {
          throw new Error('Gemini model not selected. Please select a model using setModel().');
      }
    try {
      const fullPrompt = `${role.prompt}\n\nUser: ${prompt}`;
      const result = await this.model.generateContent(fullPrompt);
      return result.response.text();
    } catch (error) {
      console.error('Gemini API Error:', error);
      throw new Error('Failed to generate response from Gemini');
    }
  }

  getAvailableModels() {
    return this.availableModels;
  }

  getSelectedModelName() {
    return this.selectedModelName;
  }
}

module.exports = GeminiService;