let ghostText = null;
let activeElement = null;
let isLoading = false;
let previousText = '';
let previousCursorPosition = 0;

let suggestionTimeout = null;
let lastSuggestionTime = 0;
const SUGGESTION_DELAY = 2000; // 2 seconds delay

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
  // Clear any existing suggestion state
  if (suggestionTimeout) {
    clearTimeout(suggestionTimeout);
  }
  if (ghostText?.element) {
    ghostText.element.remove();
    ghostText = null;
  }
  lastSuggestionTime = 0;
  updateSuggestion();
}

// Handle input changes
async function onInput(e) {
  if (!e.target.matches('textarea, input[type="text"], [contenteditable="true"]')) return;
  activeElement = e.target;
  
  const currentText = activeElement.value || activeElement.textContent;
  const currentCursorPosition = activeElement.selectionStart;
  
  // Clear any existing suggestion and timeout
  if (ghostText?.element) {
    ghostText.element.remove();
    ghostText = null;
  }
  
  if (suggestionTimeout) {
    clearTimeout(suggestionTimeout);
  }
  
  // Only set new timeout if text has changed
  if (currentText !== previousText) {
    // Set timeout for new suggestion
    suggestionTimeout = setTimeout(() => {
      const now = Date.now();
      // Only suggest if enough time has passed since last suggestion
      if (now - lastSuggestionTime >= SUGGESTION_DELAY) {
        updateSuggestion();
        lastSuggestionTime = now;
      }
    }, SUGGESTION_DELAY);
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
      lastSuggestionTime = Date.now(); // Update last suggestion time
    }
  } catch (error) {
    console.error('TextPilot suggestion error:', error);
  } finally {
    isLoading = false;
    hideLoadingIndicator();
  }
}

function showGhostText(element, suggestion, cursorPosition) {
  if (ghostText?.element) {
    ghostText.element.remove();
    ghostText = null;
  }

  // Get the text before cursor and last word
  const textBeforeCursor = element.value.substring(0, cursorPosition);
  const lastWord = textBeforeCursor.trim().split(/\s+/).pop() || '';

  // Clean up suggestion and remove any overlap with existing text
  let cleanedSuggestion = suggestion.trim();
  
  // Remove the last word from suggestion if it matches
  if (cleanedSuggestion.toLowerCase().startsWith(lastWord.toLowerCase())) {
    cleanedSuggestion = cleanedSuggestion.slice(lastWord.length);
  }
  
  // Get only the first word of remaining suggestion
  cleanedSuggestion = cleanedSuggestion.trim().split(/\s+/)[0];

  // Add space before suggestion if needed
  if (!textBeforeCursor.endsWith(' ') && cleanedSuggestion) {
    cleanedSuggestion = ' ' + cleanedSuggestion;
  }

  // Only show if we have a meaningful suggestion
  if (cleanedSuggestion && cleanedSuggestion.length > 1) {
    const ghostElement = document.createElement('div');
    ghostElement.className = 'textpilot-ghost-text';
    
    const rect = element.getBoundingClientRect();
    const computedStyle = window.getComputedStyle(element);
    const context = document.createElement('canvas').getContext('2d');
    context.font = computedStyle.font;

    const lastLine = textBeforeCursor.split('\n').pop() || '';
    const lastLineWidth = context.measureText(lastLine).width;
    const currentLineTop = Math.floor(cursorPosition / element.cols) * parseInt(computedStyle.lineHeight);

    // Get cursor position coordinates
    const getCaretCoordinates = () => {
      const range = document.createRange();
      const sel = window.getSelection();
      
      try {
        range.setStart(sel.anchorNode, sel.anchorOffset);
        range.collapse(true);
        const rect = range.getBoundingClientRect();
        return {
          left: rect.left,
          top: rect.top
        };
      } catch (e) {
        // Fallback for input/textarea elements
        return {
          left: rect.left + lastLineWidth,
          top: rect.top + currentLineTop
        };
      }
    };

    // Get cursor coordinates
    const caretPos = getCaretCoordinates();
    
    // Create and style suggestion text
    const suggestionText = document.createElement('span');
    suggestionText.className = 'textpilot-suggestion-text';
    suggestionText.textContent = cleanedSuggestion;
    suggestionText.style.color = '#8e8e8e';
    ghostElement.appendChild(suggestionText);

    // Position ghost text
    ghostElement.style.position = 'fixed';
    ghostElement.style.top = `${caretPos.top}px`;
    ghostElement.style.left = `${caretPos.left + 2}px`;
    ghostElement.style.font = computedStyle.font;
    ghostElement.style.lineHeight = computedStyle.lineHeight;
    ghostElement.style.padding = '0 4px';
    ghostElement.style.zIndex = '99999';
    ghostElement.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
    ghostElement.style.borderRadius = '3px';
    ghostElement.style.whiteSpace = 'pre';

    ghostText = {
      element: ghostElement,
      suggestion: cleanedSuggestion
    };

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
      url:  window.location.href 
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
  // Remove any existing ghost text first
  if (ghostText?.element) {
    ghostText.element.remove();
    ghostText = null;
  }

  const skeletonElement = document.createElement('div');
  skeletonElement.className = 'textpilot-skeleton';
  
  // Get current input element position and style
  const rect = activeElement.getBoundingClientRect();
  const computedStyle = window.getComputedStyle(activeElement);
  
  // Create loading animation bars
  const bars = Array(3).fill(0).map(() => {
    const bar = document.createElement('div');
    bar.className = 'skeleton-bar';
    return bar;
  });
  
  bars.forEach((bar, i) => {
    bar.style.width = `${40 + Math.random() * 60}px`; // Random width between 40-100px
    skeletonElement.appendChild(bar);
  });

  // Position skeleton at cursor position
  const cursorPosition = activeElement.selectionStart;
  const textBeforeCursor = (activeElement.value || activeElement.textContent).substring(0, cursorPosition);
  const lastLine = textBeforeCursor.split('\n').pop() || '';
  
  const context = document.createElement('canvas').getContext('2d');
  context.font = computedStyle.font;
  const lastLineWidth = context.measureText(lastLine).width;

  skeletonElement.style.position = 'fixed';
  skeletonElement.style.top = `${rect.top + parseInt(computedStyle.lineHeight)}px`;
  skeletonElement.style.left = `${rect.left + lastLineWidth + 4}px`;
  skeletonElement.style.zIndex = '99999';

  document.body.appendChild(skeletonElement);
}

function hideLoadingIndicator() {
  const skeleton = document.querySelector('.textpilot-skeleton');
  if (skeleton) skeleton.remove();
}

