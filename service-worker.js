// service-worker.js

// This service worker can be used for global state management,
// handling messages between content scripts and other parts of the extension,
// or for future background tasks like displaying total accumulated energy.

// Example: Listen for messages from content scripts (if you later want to send data)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "logEnergyEstimate") {
        console.log("Service Worker received energy estimate:", message.energyJoules);
        // You could aggregate this data here, send it to a server, etc.
    }
    // sendResponse({}); // Always call sendResponse if you register an async listener
});

// Example: Initialize total energy in storage if not already present
chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.get(['totalEnergyJoules'], (result) => {
        if (result.totalEnergyJoules === undefined) {
            chrome.storage.local.set({ totalEnergyJoules: 0 }, () => {
                console.log("PromptPowerMeter: totalEnergyJoules initialized to 0.");
            });
        }
    });
});