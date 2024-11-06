document.getElementById('generate').addEventListener('click', async () => {
  const button = document.getElementById('generate');
  const output = document.getElementById('output');
  const keywords = document.getElementById('keywords').value;

  try {
    button.textContent = 'Generating...';
    button.disabled = true;
    
    const response = await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ action: 'generate', keywords }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else if (response.error) {
          reject(new Error(response.error));
        } else {
          resolve(response);
        }
      });
    });

    output.innerHTML = `
      <div class="success">✓ Generation successful</div>
      <div class="result">${response.paragraph}</div>
    `;
  } catch (error) {
    output.innerHTML = `
      <div class="error">⚠️ Error: ${error.message || 'Failed to generate text'}</div>
    `;
  } finally {
    button.textContent = 'Generate Paragraph';
    button.disabled = false;
  }
});

// Add status indicator for extension
document.addEventListener('DOMContentLoaded', async () => {
  const status = document.createElement('div');
  status.className = 'status-indicator';
  
  try {
    // Test API connection
    await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ 
        action: 'getSuggestion', 
        text: 'Hello world' 
      }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else if (response.error) {
          reject(new Error(response.error));
        } else {
          resolve(response);
        }
      });
    });
    status.innerHTML = '🟢 TextPilot Active';
  } catch {
    status.innerHTML = '🔴 API Key Required';
  }
  
  document.querySelector('.container').appendChild(status);
});