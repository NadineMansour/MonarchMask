// Initialize extension state
chrome.runtime.onInstalled.addListener(() => {
  // Default state is OFF
  chrome.storage.local.set({ cipherEnabled: false });
});

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'toggleCipher') {
    // Update storage with new state
    chrome.storage.local.set({ cipherEnabled: message.enabled });
    
    // Send message to all tabs to update their state
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id, { 
          action: 'updateCipherState', 
          enabled: message.enabled 
        }).catch(error => {
          // Suppress errors for tabs that can't receive messages
          console.debug('Could not send message to tab', tab.id, error);
        });
      });
    });
    
    sendResponse({ success: true });
  } else if (message.action === 'getCipherState') {
    // Return current state
    chrome.storage.local.get('cipherEnabled', (data) => {
      sendResponse({ enabled: data.cipherEnabled });
    });
    return true; // Required for async sendResponse
  }
});
