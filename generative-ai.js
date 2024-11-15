const { GoogleGenerativeAI } = require('@google/generative-ai');

export function initializeAI(apiKey) {
  return new GoogleGenerativeAI(apiKey);
} 