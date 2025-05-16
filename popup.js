// DOM elements
const toggleSwitch = document.getElementById('cipherToggle');
const statusOn = document.getElementById('status-on');
const statusOff = document.getElementById('status-off');

// Initialize popup state
document.addEventListener('DOMContentLoaded', () => {
  // Get current state from storage
  chrome.runtime.sendMessage({ action: 'getCipherState' }, (response) => {
    if (response && typeof response.enabled === 'boolean') {
      toggleSwitch.checked = response.enabled;
      updateStatusDisplay(response.enabled);
    }
  });
});

// Handle toggle switch changes
toggleSwitch.addEventListener('change', (e) => {
  const isEnabled = e.target.checked;
  
  // Send message to background script
  chrome.runtime.sendMessage({ 
    action: 'toggleCipher', 
    enabled: isEnabled 
  }, (response) => {
    if (response && response.success) {
      updateStatusDisplay(isEnabled);
    }
  });
});

// Update the status display
function updateStatusDisplay(isEnabled) {
  if (isEnabled) {
    statusOn.style.display = 'flex';
    statusOff.style.display = 'none';
  } else {
    statusOn.style.display = 'none';
    statusOff.style.display = 'flex';
  }
}
