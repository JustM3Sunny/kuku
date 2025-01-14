const axios = require('axios');
const modelsConfig = require('../config/models');

class GroqService {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseURL = 'https://api.groq.com/openai/v1/chat/completions';
    this.availableModels = modelsConfig.groq.models;
    this.model = null;
    this.selectedModelName = null;
  }

  async setModel(modelName) {
    if (!this.availableModels.includes(modelName)) {
        throw new Error(`Model ${modelName} is not available for Groq.`);
    }
    this.model = modelName;
    this.selectedModelName = modelName;
    console.log(`Groq model set to: ${modelName}`);
  }


  async generateResponse(prompt, role) {
    if (!this.model) {
        throw new Error('Groq model not selected. Please select a model using setModel().');
    }
    try {
      const response = await axios.post(
        this.baseURL,
        {
          model: this.model,
          messages: [
            {
              role: "system",
              content: role.prompt
            },
            {
              role: "user",
              content: prompt
            }
          ]
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
          }
        }
      );

      return response.data.choices[0].message.content;
    } catch (error) {
      console.error('Groq API Error:', error);
      throw new Error('Failed to generate response from Groq');
    }
  }

  getAvailableModels() {
    return this.availableModels;
  }

  getSelectedModelName() {
    return this.selectedModelName;
  }
}

module.exports = GroqService;