let ghostText = null;
let activeElement = null;
let isLoading = false;
let previousText = '';
let previousCursorPosition = 0;

// Initialize observer for dynamic content
const observer = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    mutation.addedNodes.forEach((node) => {
      if (node.nodeType === 1) { // Element node
        attachToInputs(node);
      }
    });
  });
});

// Attach to all text inputs
function attachToInputs(root) {
  const inputs = root.querySelectorAll('textarea, input[type="text"], [contenteditable="true"]');
  inputs.forEach(input => {
    input.addEventListener('focus', onFocus);
    input.addEventListener('input', debounce(onInput, 300));
  });
}

// Handle input focus
function onFocus(e) {
  activeElement = e.target;
  updateSuggestion();
}

// Handle input changes
async function onInput(e) {
  if (!e.target.matches('textarea, input[type="text"], [contenteditable="true"]')) return;
  activeElement = e.target;
  
  const currentText = activeElement.value || activeElement.textContent;
  const currentCursorPosition = activeElement.selectionStart;
  
  if (currentText.length < previousText.length && currentCursorPosition < previousCursorPosition) {
    // User has deleted text
    if (ghostText && ghostText.element) {
      const deletedText = previousText.slice(currentCursorPosition, previousCursorPosition);
      const remainingSuggestion = ghostText.suggestion.slice(deletedText.length);
      
      if (remainingSuggestion.length > 0) {
        showGhostText(activeElement, remainingSuggestion, currentCursorPosition);
      } else {
        ghostText.element.remove();
        ghostText = null;
      }
    }
  } else {
    updateSuggestion();
  }
  
  previousText = currentText;
  previousCursorPosition = currentCursorPosition;
}

// Check if the current page is a Google Docs document
function isGoogleDocsDocument() {
  return window.location.hostname === 'docs.google.com' && 
         /\/document\/d\//.test(window.location.pathname);
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  if (isGoogleDocsDocument()) {
    // Attach to Google Docs editor
    attachToGoogleDocs();
  } else {
    // Start observing dynamic content changes
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    // Attach to existing inputs
    attachToInputs(document);
  }
});

// Attach to Google Docs editor
function attachToGoogleDocs() {
  const editorElement = document.querySelector('.kix-appview-editor-container');
  if (editorElement) {
    editorElement.addEventListener('focus', onFocus);
    editorElement.addEventListener('input', debounce(onInput, 300));
  }
}

// Keyboard shortcuts
const KEYS = {
  ACCEPT: ['Tab', 'ArrowRight'],
  REJECT: ['Escape'],
  NEXT: ['Alt+]'],
  PREV: ['Alt+[']
};

document.addEventListener('keyup', debounce(async (e) => {
  if (!e.target.matches('textarea, input[type="text"], [contenteditable="true"]')) return;
  
  activeElement = e.target;
  updateSuggestion();
}, 300));

document.addEventListener('keydown', (e) => {
  if (!ghostText?.element) return;

  if (KEYS.ACCEPT.includes(e.key)) {
    e.preventDefault();
    acceptSuggestion();
  } else if (KEYS.REJECT.includes(e.key)) {
    e.preventDefault();
    rejectSuggestion();
  }
});

// Update your updateSuggestion function
async function updateSuggestion() {
  if (!activeElement || isLoading) return;

  const cursorPosition = activeElement.selectionStart;
  const text = activeElement.value || activeElement.textContent;
  const precedingText = text.substring(0, cursorPosition);
  
  // Only suggest if we have at least one complete word (contains space)
  if (!precedingText.includes(' ') || precedingText.trim().length < 2) {
    if (ghostText?.element) {
      ghostText.element.remove();
      ghostText = null;
    }
    return;
  }

  try {
    isLoading = true;
    showLoadingIndicator();
    
    const suggestion = await getSuggestion(precedingText);
    if (suggestion && activeElement.selectionStart === cursorPosition) {
      showGhostText(activeElement, suggestion, cursorPosition);
    }
  } catch (error) {
    console.error('TextPilot suggestion error:', error);
  } finally {
    isLoading = false;
    hideLoadingIndicator();
  }
}

function showGhostText(element, suggestion, cursorPosition) {
  // Remove any existing ghost text first
  if (ghostText?.element) {
    ghostText.element.remove();
    ghostText = null;
  }

  const ghostElement = document.createElement('div');
  ghostElement.className = 'textpilot-ghost-text';
  
  const rect = element.getBoundingClientRect();
  const computedStyle = window.getComputedStyle(element);
  
  // Get the text before cursor
  const textBeforeCursor = element.value.substring(0, cursorPosition);
  const lastLine = textBeforeCursor.split('\n').pop() || '';
  
  // Clean up the suggestion
  let cleanedSuggestion = suggestion
    .split('\n')[0]  // Take only first line
    .split('.')[0];  // Take only first sentence
    
  // Remove any part that matches the current line
  if (cleanedSuggestion.toLowerCase().startsWith(lastLine.toLowerCase())) {
    cleanedSuggestion = cleanedSuggestion.slice(lastLine.length);
  }
  
  // Ensure the suggestion starts with a space if needed
  if (cleanedSuggestion && !lastLine.endsWith(' ') && !cleanedSuggestion.startsWith(' ')) {
    cleanedSuggestion = ' ' + cleanedSuggestion;
  }
  
  // Truncate suggestion to fit available width
  const context = document.createElement('canvas').getContext('2d');
  context.font = computedStyle.font;
  
  const maxWidth = rect.width - context.measureText(lastLine).width - 50; // Add padding
  while (context.measureText(cleanedSuggestion).width > maxWidth && cleanedSuggestion.length > 0) {
    cleanedSuggestion = cleanedSuggestion.slice(0, -1);
  }
  
  // Only show if we have a valid suggestion
  if (cleanedSuggestion.trim().length > 0) {
    const suggestionText = document.createElement('span');
    suggestionText.className = 'textpilot-suggestion-text';
    suggestionText.textContent = cleanedSuggestion;
    ghostElement.appendChild(suggestionText);
    
    ghostText = {
      element: ghostElement,
      suggestion: cleanedSuggestion
    };
    
    // Calculate exact position after the last word
    const lastLineWidth = context.measureText(lastLine).width;
    const currentLineTop = Math.floor(cursorPosition / element.cols) * parseInt(computedStyle.lineHeight);
    
    ghostElement.style.position = 'absolute';
    ghostElement.style.top = `${rect.top + currentLineTop}px`;
    ghostElement.style.left = `${rect.left + lastLineWidth}px`;
    ghostElement.style.font = computedStyle.font;
    ghostElement.style.lineHeight = computedStyle.lineHeight;
    
    document.body.appendChild(ghostElement);
  }
}

function acceptSuggestion() {
  if (!ghostText?.element || !activeElement) return;
  
  const cursorPosition = activeElement.selectionStart;
  const canvasElement = activeElement.querySelector('.kix-canvas-tile-content');
  if (!canvasElement) return;
  
  const originalText = canvasElement.textContent;
  
  canvasElement.textContent = originalText.substring(0, cursorPosition) +
                              ghostText.suggestion +
                              originalText.substring(cursorPosition);
  
  ghostText.element.remove();
  ghostText = null;
}

async function getSuggestion(text) {
  const response = await new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ 
      action: 'getSuggestion', 
      text, 
      url: isGoogleDocsDocument() ? 'Google Docs' : window.location.href 
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
  return response.suggestion;
}

// Helper functions
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

function showLoadingIndicator() {
  const loader = document.createElement('div');
  loader.className = 'textpilot-loading';
  document.body.appendChild(loader);
}

function hideLoadingIndicator() {
  const loader = document.querySelector('.textpilot-loading');
  if (loader) loader.remove();
}

