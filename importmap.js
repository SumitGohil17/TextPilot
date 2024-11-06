const importMap = {
  "imports": {
    "@google/generative-ai": "https://esm.run/@google/generative-ai"
  }
};

const script = document.createElement('script');
script.type = 'importmap';
script.textContent = JSON.stringify(importMap);
document.head.appendChild(script);
