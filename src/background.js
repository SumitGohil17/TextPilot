const { GoogleGenerativeAI } = require('@google/generative-ai');
import { API_KEY } from './config.js';

const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-nano" });

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Received message:', request);

  if (request.action === 'generate') {
    console.log('Generating text for keywords:', request.keywords, 'on website:', request.website);
    generateText(request.keywords, request.website)
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
    console.log('Generating suggestion for text:', request.text);
    console.log('Generating suggestion for text:', request.url);
    generateSuggestion(request.text, request.url)
      .then(suggestion => {
        console.log('Generated suggestion:', suggestion);
        sendResponse({ suggestion });
      })
      .catch(error => {
        console.error('Suggestion error:', error);
        sendResponse({ error: error.message });
      });
    return true;
  }
});

async function generateText(keywords, website) {
  console.log('Generating text for keywords:', keywords, 'on website:', website);

  const prompt = `suggest keywords according to "${website}" this websties textbox, based on these keywords: ${keywords} like if wesite is youtube suggest text according to youtube searchbox, if website is google docs then suggest text according to google docs canvas`;
  const result = await model.generateContent(prompt);

  if (!result.response) {
    throw new Error('Invalid API response format');
  }

  return result.response.text();
}

async function generateSuggestion(text, url) {
  console.log('Generating suggestion for text:', text, 'on website:', url);

  const prompt = `Continue this text naturally in a style appropriate for ${url} (1-2 lines max):
Text: "${text}"
Continuation:`;
  console.log(prompt);

  const result = await model.generateContent(prompt);

  if (!result.response) {
    throw new Error('Invalid API response format');
  }

  return result.response.text();
}