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
  
  // Override content display for financial apps
  overrideFinancialAppDisplays();
  
  // Set up observer for new content
  setupObserver();
}

// Specifically target financial app displays with special handling
function overrideFinancialAppDisplays() {
  // Use CSS to mask numbers in table cells and common financial app elements
  const style = document.createElement('style');
  style.id = 'cipher-finance-style';
  style.textContent = `
    /* Hide actual text content but keep the element dimensions */
    .cipher-masked {
      color: transparent !important;
      position: relative !important;
    }
    
    /* Add masked content overlay */
    .cipher-masked::before {
      content: '•••' !important;
      position: absolute !important;
      left: 0 !important;
      top: 0 !important;
      color: currentColor !important;
      background: inherit !important;
      z-index: 10000 !important;
    }
    
    /* Specifically target Monarch Money currency inputs */
    .CurrencyInput__Input-ay6xtd-0,
    .PlanCell__AmountInput-ubpe1q-1,
    input[name="budgeted"],
    input.fs-exclude,
    input[class*="CurrencyInput"],
    input[class*="AmountInput"] {
      color: transparent !important;
      position: relative !important;
    }
    
    /* Add overlay for Monarch Money currency inputs */
    .CurrencyInput__Input-ay6xtd-0::before,
    .PlanCell__AmountInput-ubpe1q-1::before,
    input[name="budgeted"]::before,
    input.fs-exclude::before,
    input[class*="CurrencyInput"]::before,
    input[class*="AmountInput"]::before {
      content: '•••' !important;
      position: absolute !important;
      left: 0 !important;
      top: 0 !important;
      width: 100% !important;
      height: 100% !important;
      color: currentColor !important;
      background: inherit !important;
      z-index: 10000 !important;
      display: flex !important;
      align-items: center !important;
      padding: 0 8px !important;
      pointer-events: none !important;
    }
  `;
  document.head.appendChild(style);
  
  // Apply masking to all cells with dollar amounts and numbers
  // Use a variety of selectors to target financial app interfaces
  const potentialFinancialElements = document.querySelectorAll(
    // Target elements that likely contain financial data
    '[class*="amount"], [class*="balance"], [class*="budget"], [class*="price"], ' +
    '[class*="cost"], [class*="total"], [class*="value"], [class*="money"], ' +
    '[class*="currency"], [class*="number"], [id*="amount"], [id*="balance"], ' +
    '[id*="budget"], [id*="price"], [id*="cost"], [id*="total"], [id*="value"], ' +
    // Target common table cells in financial tables
    'td, th, [role="cell"], [role="gridcell"], ' + 
    // Target specific cell-like structures 
    '[style*="display: grid"] > div, [style*="display: flex"] > div'
  );
  
  potentialFinancialElements.forEach(element => {
    // Check if the element contains a number
    const text = element.textContent.trim();
    const hasNumber = /\d/.test(text);
    
    // Skip already masked or very large text blocks
    if (!hasNumber || text.length > 50) return;
    
    // For input elements, we need to handle them differently
    if (element.tagName === 'INPUT') {
      // Only mask read-only inputs - these are often used for display
      if (element.hasAttribute('readonly') || element.getAttribute('type') === 'text') {
        // Create a wrapper around the input if needed
        if (!element.parentElement.classList.contains('cipher-input-wrapper')) {
          const wrapper = document.createElement('div');
          wrapper.className = 'cipher-input-wrapper';
          wrapper.style.position = 'relative';
          element.parentNode.insertBefore(wrapper, element);
          wrapper.appendChild(element);
        }
        
        // Apply masking overlay
        if (!element.nextElementSibling || !element.nextElementSibling.classList.contains('cipher-input-mask')) {
          const overlay = document.createElement('div');
          overlay.className = 'cipher-input-mask';
          overlay.textContent = '•••';
          overlay.style.position = 'absolute';
          overlay.style.left = '0';
          overlay.style.top = '0';
          overlay.style.width = '100%';
          overlay.style.height = '100%';
          overlay.style.display = 'flex';
          overlay.style.alignItems = 'center';
          overlay.style.padding = '0 8px';
          overlay.style.pointerEvents = 'none';
          overlay.style.zIndex = '1000';
          overlay.style.backgroundColor = 'inherit';
          element.parentNode.insertBefore(overlay, element.nextSibling);
          
          // Hide the actual input text
          element.style.color = 'transparent';
        }
      }
      return;
    }
    
    // Skip other form elements and editable fields
    if (element.tagName === 'TEXTAREA' || 
        element.tagName === 'SELECT' ||
        element.hasAttribute('contenteditable')) {
      return;
    }
    
    // Check if the element might be a financial value
    const isCurrencyValue = 
      /^\s*\$\s*\d/.test(text) || // Starts with $ followed by number
      /^\s*\d+([.,]\d+)*(\.\d+)?\s*$/.test(text) || // Just a number
      /^\s*\d+([.,]\d+)*(\.\d+)?\s*%\s*$/.test(text); // Percentage
    
    if (isCurrencyValue) {
      // Mark as masked through classes for styling
      element.classList.add('cipher-masked');
      
      // If Monarch Money is detected, apply additional specific masking
      if (window.location.hostname.includes('monarchmoney')) {
        // Apply more specific selectors for Monarch Money
        if (element.closest('[class*="budget"]') || 
            element.closest('[class*="amount"]')) {
          element.classList.add('cipher-masked');
          element.setAttribute('data-original-text', element.textContent);
        }
      }
    }
  });
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
  if (node.hasAttribute('contenteditable') || 
      node.getAttribute('contenteditable') === 'true' ||
      node.getAttribute('contenteditable') === '') {
    return false;
  }
  
  // Check if this element or any parent has contenteditable
  let parent = node.parentElement;
  while (parent) {
    if (parent.hasAttribute('contenteditable') || 
        parent.getAttribute('contenteditable') === 'true' ||
        parent.getAttribute('contenteditable') === '') {
      return false;
    }
    parent = parent.parentElement;
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
