document.getElementById('keywords').addEventListener('keydown', async (e) => {
  const input = e.target;
  const output = document.getElementById('output');
  
  if (e.key === 'Tab') {
    e.preventDefault(); // Prevent default tab behavior
    
    try {
      const response = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ 
          action: 'generate', 
          keywords: input.value 
        }, (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else if (response && response.error) {
            reject(new Error(response.error));
          } else {
            resolve(response);
          }
        });
      });

      if (response && response.paragraph) {
        input.value = response.paragraph;
        output.innerHTML = `
          <div class="success">Text accepted</div>
          <div class="result">${response.paragraph}</div>
        `;
      }
    } catch (error) {
      console.error('Generation error:', error);
      output.innerHTML = `
        <div class="error">Error: ${error.message || 'Failed to generate text'}</div>
      `;
    }
  }
});

// Keep existing click handler
document.getElementById('generate').addEventListener('click', async () => {
  const button = document.getElementById('generate');
  const output = document.getElementById('output');
  const keywords = document.getElementById('keywords').value;

  if (!keywords.trim()) {
    output.innerHTML = `<div class="error">Please enter some keywords</div>`;
    return;
  }

  try {
    button.textContent = 'Generating...';
    button.disabled = true;
    
    const response = await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ action: 'generate', keywords }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else if (response && response.error) {
          reject(new Error(response.error));
        } else {
          resolve(response);
        }
      });
    });

    if (response && response.paragraph) {
      output.innerHTML = `
        <div class="success">Generation successful</div>
        <div class="result">${response.paragraph}</div>
      `;
    } else {
      throw new Error('Invalid response format');
    }
  } catch (error) {
    console.error('Generation error:', error);
    output.innerHTML = `
      <div class="error">Error: ${error.message || 'Failed to generate text'}</div>
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
        } else if (response && response.error) {
          reject(new Error(response.error));
        } else {
          resolve(response);
        }
      });
    });
    status.innerHTML = 'TextPilot Active';
  } catch (error) {
    console.error('Status check error:', error);
    status.innerHTML = 'API Key Required';
  }
  
  document.querySelector('.container').appendChild(status);
});