const { GoogleGenerativeAI } = require('@google/generative-ai');
import { API_KEY } from './config.js';

const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Received message:', request);
  
  if (request.action === 'generate') {
    console.log('Generating text for keywords:', request.keywords);
    generateText(request.keywords)
      .then(paragraph => {
        console.log('Generated text:', paragraph);
        sendResponse({ paragraph });
      }) 
      .catch(error => {
        console.error('Generation error:', error);
        sendResponse({ error: error.message });
      });
    return true;
  }
  
  if (request.action === 'getSuggestion') {
    generateSuggestion(request.text, request.url)
      .then(suggestion => {
        sendResponse({ suggestion });
      })
      .catch(error => {
        console.error('Suggestion error:', error);
        sendResponse({ error: error.message });
      });
    return true;
  }
});

async function generateText(keywords) {
  console.log('Generating text for keywords:', keywords);
  
  const prompt = `Generate a paragraph based on these keywords : ${keywords}`;
  const result = await model.generateContent(prompt);
  
  if (!result.response) {
    throw new Error('Invalid API response format');
  }
  
  return result.response.text();
}

async function generateSuggestion(text, url) {
  console.log('Generating suggestion for text:', text);
  
  const prompt = `Suggest a continuation for this text from ${url}: "${text}"`;
  const result = await model.generateContent(prompt);
  
  if (!result.response) {
    throw new Error('Invalid API response format');
  }

  return result.response.text();
}