// Fix: Add a triple-slash directive to provide TypeScript with Chrome extension API types.
/// <reference types="chrome" />

// IMPORTANT: For the extension to work, you MUST rename this file from 'background.ts' to 'background.js'.

// This script runs in the background and sets up the extension's behavior.

/**
 * Opens the side panel when the user clicks the extension's action icon in the toolbar.
 */
function setupSidePanel() {
  // Check if the sidePanel API is available.
  if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
    chrome.sidePanel
      .setPanelBehavior({ openPanelOnActionClick: true })
      .catch((error) => console.error('Error setting side panel behavior:', error));
  } else {
    console.error('chrome.sidePanel API not available.');
  }
}

try {
  setupSidePanel();
} catch (e) {
  console.error('An error occurred during extension initialization:', e);
}
