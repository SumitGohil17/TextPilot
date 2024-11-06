let ghostText = null;
let activeElement = null;
let isLoading = false;

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
  updateSuggestion();
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  // Start observing dynamic content changes
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
  
  // Attach to existing inputs
  attachToInputs(document);
});

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
  
  // Only suggest if we have enough context
  if (precedingText.trim().length < 2) {
    ghostText?.element?.remove();
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
  const ghostElement = document.createElement('div');
  ghostElement.className = 'textpilot-ghost-text';
  
  const rect = element.getBoundingClientRect();
  const computedStyle = window.getComputedStyle(element);
  const lineHeight = parseInt(computedStyle.lineHeight);
  
  // Calculate position based on cursor
  const textBeforeCursor = element.value.substring(0, cursorPosition);
  const lines = textBeforeCursor.split('\n').length;
  
  ghostElement.style.top = `${rect.top + (lines - 1) * lineHeight}px`;
  ghostElement.style.left = `${rect.left}px`;
  ghostElement.style.font = computedStyle.font;
  ghostElement.textContent = suggestion;
  
  ghostText = {
    element: ghostElement,
    suggestion: suggestion
  };
  
  document.body.appendChild(ghostElement);

  // Add visual cues for keyboard shortcuts
  const shortcuts = document.createElement('div');
  shortcuts.className = 'textpilot-shortcuts';
  shortcuts.textContent = '⇥ to accept';
  ghostElement.appendChild(shortcuts);
}

function acceptSuggestion() {
  if (!ghostText?.element || !activeElement) return;
  
  const cursorPosition = activeElement.selectionStart;
  const originalText = activeElement.value;
  
  activeElement.value = originalText.substring(0, cursorPosition) +
                       ghostText.suggestion +
                       originalText.substring(cursorPosition);
  
  ghostText.element.remove();
  ghostText = null;
}

async function getSuggestion(text) {
  const response = await new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ action: 'getSuggestion', text }, (response) => {
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
