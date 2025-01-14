const models = {
  groq: {
    name: "Groq",
    models: [
      "gemma2-9b-it",
      "llama-3.3-70b-versatile",
      "llama-3.1-8b-instant",
      "llama-guard-3-8b",
      "llama3-70b-8192",
      "llama-3.2-90b-vision-preview",
      "llama-3.3-70b-specdec"
      
    ],
    type: "groq"
  },
  gemini: {
    name: "Gemini 1.5",
    models: [
      "gemini-1.5-flash",
      "gemini-1.5-pro",
      "gemini-1.5-pro-001",
      "gemini-1.5-pro-002",
      "gemini-pro",
      "gemini-1.5-flash-8b-001",
      "gemini-1.5-flash-8b",
      "gemini-1.0-pro",
      "gemini-1.0-pro-001",
      "gemini-1.0-pro-latest",
      
     
     
    ],
    type: "gemini"
  }
};

module.exports = models;