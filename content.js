// Global variables
let cipherEnabled = false;
let observer = null;

// Initialize the extension
function initCipher() {
  // Check initial state from storage
  chrome.storage.local.get('cipherEnabled', (data) => {
    cipherEnabled = data.cipherEnabled || false;
    if (cipherEnabled) {
      startMasking();
    }
  });

  // Listen for messages from popup or background
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'updateCipherState') {
      cipherEnabled = message.enabled;
      
      if (cipherEnabled) {
        startMasking();
      } else {
        stopMasking();
      }
      
      sendResponse({ success: true });
    }
  });
}

// Start the masking process
function startMasking() {
  // First, mask existing content
  maskAllNumbers();
  
  // Specifically target table cells and grid layouts 
  // This helps with financial apps like Monarch Money
  maskTableData();
  
  // Set up observer for new content
  setupObserver();
}

// Specifically mask content in tables and grid layouts
function maskTableData() {
  // Target table cells (td elements)
  const tableCells = document.querySelectorAll('td');
  tableCells.forEach(cell => {
    // Process each table cell directly
    processTextInElement(cell);
  });
  
  // Target div elements that might be acting as cells in a grid layout
  // (common in modern web apps that use CSS Grid or Flexbox for tables)
  const divCells = document.querySelectorAll('div');
  divCells.forEach(div => {
    // Check if this div might be a grid/table cell
    const style = window.getComputedStyle(div);
    const text = div.textContent.trim();
    
    // If the div contains a number and looks like it could be a cell
    // (short text content, specific display types)
    if (text.length < 20 && /\d/.test(text) && 
        (style.display.includes('flex') || 
         style.display.includes('grid') || 
         style.display.includes('table'))) {
      processTextInElement(div);
    }
  });
}

// Process all text inside an element directly
function processTextInElement(element) {
  if (!element || !shouldProcessNode(element)) return;
  
  // Apply the same regex from processTextNode function
  const basicNumberRegex = /(\$|€|£|¥)\s*\d+(?:[.,]\d+)*(?:\.\d+)?|\b\d+(?:[.,]\d+)*(?:\.\d+)?(?:\s*%)?/g;
  const digitSequenceRegex = /\d+/g;
  
  // Handle immediate text in this element (not in children)
  for (const node of element.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      let text = node.textContent;
      let hasNumbers = false;
      
      if (basicNumberRegex.test(text)) {
        text = text.replace(basicNumberRegex, '•••');
        hasNumbers = true;
      }
      
      // If still contains digits, use the more aggressive approach
      if (/\d/.test(text)) {
        text = text.replace(digitSequenceRegex, '•••');
        hasNumbers = true;
      }
      
      if (hasNumbers) {
        node.textContent = text;
      }
    }
  }
  
  // In case the element has no child text nodes but has direct textContent
  if (element.childNodes.length === 0 && element.textContent.trim() !== '') {
    let text = element.textContent;
    let hasNumbers = false;
    
    if (basicNumberRegex.test(text)) {
      text = text.replace(basicNumberRegex, '•••');
      hasNumbers = true;
    }
    
    // If still contains digits, use the more aggressive approach
    if (/\d/.test(text)) {
      text = text.replace(digitSequenceRegex, '•••');
      hasNumbers = true;
    }
    
    if (hasNumbers) {
      element.textContent = text;
    }
  }
}

// Stop the masking process
function stopMasking() {
  // Disconnect observer if exists
  if (observer) {
    observer.disconnect();
    observer = null;
  }
  
  // Reload page to restore original content
  // This is the simplest way to restore all numbers
  location.reload();
}

// Setup mutation observer to watch for DOM changes
function setupObserver() {
  // Disconnect existing observer if any
  if (observer) {
    observer.disconnect();
  }
  
  // Create new observer
  observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      // Handle added nodes
      if (mutation.addedNodes.length) {
        mutation.addedNodes.forEach(node => {
          if (shouldProcessNode(node)) {
            processNode(node);
          }
        });
      }
      
      // Handle character data changes
      if (mutation.type === 'characterData' && 
          shouldProcessNode(mutation.target)) {
        processTextNode(mutation.target);
      }
      
      // Also process the parent element for attribute changes
      // This helps catch changes to elements that might be using custom rendering
      if (mutation.target && mutation.target.parentElement) {
        processNode(mutation.target.parentElement);
      }
    }
    
    // Periodically scan the whole document again for numbers
    // This ensures we catch elements that might have been missed
    setTimeout(() => maskAllNumbers(), 500);
  });
  
  // Start observing the document with the configured parameters
  observer.observe(document.body, { 
    childList: true, 
    subtree: true, 
    characterData: true,
    attributes: true,
    attributeFilter: ['textContent', 'innerText', 'innerHTML', 'value']
  });
  
  // Additional recurring scan to ensure we catch all numbers
  // This helps with SPAs and dynamic content that might evade the observer
  setInterval(maskAllNumbers, 2000);
}

// Process all existing numbers on the page
function maskAllNumbers() {
  // Process all text nodes in the document
  const treeWalker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node) => {
        // Skip if node is empty or whitespace only
        if (!node.textContent.trim()) {
          return NodeFilter.FILTER_REJECT;
        }
        
        // Skip if parent should be ignored
        if (!shouldProcessNode(node.parentElement)) {
          return NodeFilter.FILTER_REJECT;
        }
        
        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );
  
  // Collect nodes first to avoid issues with modifying the tree while walking
  const textNodes = [];
  while (treeWalker.nextNode()) {
    textNodes.push(treeWalker.currentNode);
  }
  
  // Process all collected text nodes
  textNodes.forEach(node => {
    processTextNode(node);
  });
}

// Check if a node should be processed
function shouldProcessNode(node) {
  // Skip if node is null or not an element
  if (!node || node.nodeType !== Node.ELEMENT_NODE) {
    return true; // Text nodes should be processed by default
  }
  
  // Skip script, style, and meta tags
  if (['SCRIPT', 'STYLE', 'META', 'NOSCRIPT'].includes(node.tagName)) {
    return false;
  }
  
  // Skip input, textarea, and other editable elements
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(node.tagName)) {
    return false;
  }
  
  // Skip elements with contenteditable attribute
  if (node.hasAttribute('contenteditable')) {
    return false;
  }
  
  // Skip password fields
  if (node.getAttribute('type') === 'password') {
    return false;
  }
  
  // Skip hidden elements
  if (window.getComputedStyle(node).display === 'none' || 
      window.getComputedStyle(node).visibility === 'hidden') {
    return false;
  }
  
  return true;
}

// Process a DOM node (element or text)
function processNode(node) {
  // If it's a text node, process it directly
  if (node.nodeType === Node.TEXT_NODE) {
    processTextNode(node);
    return;
  }
  
  // If it's an element, process all its text nodes
  const treeWalker = document.createTreeWalker(
    node,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: (textNode) => {
        if (!textNode.textContent.trim()) {
          return NodeFilter.FILTER_REJECT;
        }
        
        if (!shouldProcessNode(textNode.parentElement)) {
          return NodeFilter.FILTER_REJECT;
        }
        
        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );
  
  // Collect and process all text nodes
  const textNodes = [];
  while (treeWalker.nextNode()) {
    textNodes.push(treeWalker.currentNode);
  }
  
  textNodes.forEach(textNode => {
    processTextNode(textNode);
  });
}

// Process a text node to mask numbers
function processTextNode(node) {
  if (!node || !node.textContent) return;
  
  // Skip if parent element should not be processed
  if (node.parentElement && !shouldProcessNode(node.parentElement)) {
    return;
  }
  
  // First check: Basic number formats with currency symbols and decimals
  const basicNumberRegex = /(\$|€|£|¥)\s*\d+(?:[.,]\d+)*(?:\.\d+)?|\b\d+(?:[.,]\d+)*(?:\.\d+)?(?:\s*%)?/g;
  
  // Second check: Any standalone digit sequence (very aggressive)
  const digitSequenceRegex = /\d+/g;
  
  // Replace all occurrences with the mask
  let text = node.textContent;
  let hasNumbers = false;
  
  if (basicNumberRegex.test(text)) {
    text = text.replace(basicNumberRegex, '•••');
    hasNumbers = true;
  }
  
  // If still contains digits, use the more aggressive approach
  if (/\d/.test(text)) {
    text = text.replace(digitSequenceRegex, '•••');
    hasNumbers = true;
  }
  
  if (hasNumbers) {
    node.textContent = text;
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initCipher);
} else {
  initCipher();
}
