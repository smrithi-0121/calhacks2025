// content.js - FINAL AGGRESSIVE FIX: TIMER POLLING

// --- Configuration ---
const ENERGY_PER_CHAR = 0.000000001;
const ENERGY_PER_TOKEN = 0.000000005;
const BASE_INFERENCE_ENERGY = 0.0000001;

// Elements to watch for prompt input and submission buttons
const PROMPT_INPUT_SELECTORS = [
    // 🥇 Highly specific selectors for Gemini
    'rich-textarea.text-input-field_textarea', 
    'rich-textarea[enterkeyhint="send"]',
    '.text-input-field-main-area', // Gemini container

    //for chat
    '#prompt-textarea', 
    
    // 🥈 General/Fallback selectors
    'textarea[placeholder*="Send a message"]', 
    'textarea[data-testid="textarea"]',
    'input[placeholder*="Prompt"]', 
];

const SUBMIT_BUTTON_SELECTORS = [
    // Specific IDs/Test-IDs
    '#composer-submit-button',
    'button[data-testid="send-button"]',
    
    // Specific custom element
    'composer-submit-button',

    // Generic fallbacks
    'button[aria-label*="Send"]',
    'button[type="submit"]',
    'button:has(svg)', 
];

let observer = null; // To hold the MutationObserver instance
let pollingId = null; // To hold the timer interval ID
let lastPromptValue = ""; // Stores the prompt text before submission clears it

// --- Helper Functions ---

// ⚠️ We use a highly stable element for the polling anchor
function getPromptInput() {
    // This function will now find the *best* input element available
    for (const selector of PROMPT_INPUT_SELECTORS) {
        const input = document.querySelector(selector);
        if (input) return input;
    }
    return null;
}

function getSubmitButton(inputElement) {
    // This function is still needed for meter positioning
    if (inputElement) {
        // Try finding the button relative to the input first
        let parentForm = inputElement.closest('form') || inputElement.closest('div[role="presentation"]');
        if (parentForm) {
            for (const selector of SUBMIT_BUTTON_SELECTORS) {
                const button = parentForm.querySelector(selector);
                if (button) return button;
            }
        }
    }

    // Fallback to searching the whole document
    for (const selector of SUBMIT_BUTTON_SELECTORS) {
        const button = document.querySelector(selector);
        if (button) return button;
    }
    
    // Last resort, find the main input area as an anchor
    const mainArea = document.querySelector('.text-input-field-main-area');
    if (mainArea) return mainArea;
    
    return null;
}

function calculateEnergy(promptText) {
    console.log("PromptPowerMeter: calculateEnergy RUNNING!"); // <-- Added log
    if (!promptText || promptText.trim() === '') {
        return 0;
    }
    const charCount = promptText.length;
    const tokenCount = Math.ceil(charCount / 4);

    let energy = BASE_INFERENCE_ENERGY;
    energy += charCount * ENERGY_PER_CHAR;
    energy += tokenCount * ENERGY_PER_TOKEN;

    return energy;
}

function formatEnergy(joules) {
    if (joules === 0) return '0 J';
    if (joules < 0.000000001) return `< 0.001 nJ`;
    if (joules < 0.000001) return `${(joules * 1e9).toFixed(3)} nJ`;
    if (joules < 0.001) return `${(joules * 1e6).toFixed(3)} µJ`;
    if (joules < 1) return `${(joules * 1e3).toFixed(3)} mJ`;
    if (joules < 1000) return `${joules.toFixed(3)} J`;
    if (joules < 3600) return `${(joules / 1000).toFixed(3)} kJ`;
    return `${(joules / 3600).toFixed(3)} Wh`;
}

function createMeterDisplay(button) {
    let meter = document.getElementById('prompt-power-meter');
    if (!meter) {
        meter = document.createElement('div');
        meter.id = 'prompt-power-meter';
        document.body.appendChild(meter);
    }
    const buttonRect = button.getBoundingClientRect();
    meter.style.top = `${window.scrollY + buttonRect.top - 40}px`; // Added scrollY
    meter.style.left = `${window.scrollX + buttonRect.left + buttonRect.width / 2 - 50}px`; // Added scrollX

    meter.style.opacity = '1';
    meter.textContent = 'Estimating...';
    return meter;
}

function displayEnergyEstimate(joules, button) {
    const meter = createMeterDisplay(button);
    meter.textContent = `⚡️ ${formatEnergy(joules)}`;
    meter.style.backgroundColor = 'var(--meter-bg-color, #333)';
    meter.style.color = 'var(--meter-text-color, white)';
    meter.classList.remove('fade-out');
    void meter.offsetWidth;
    meter.classList.add('fade-out');
}

// --- Main Logic ---

function setupPromptMonitoring() {
    // ⚠️ REVISED FIX: Get input first, then button.
    // We pass promptInput to getSubmitButton for better context.
    const promptInput = getPromptInput();
    const submitButton = getSubmitButton(promptInput);

    // Stop any previous timers to prevent duplicates
    if (pollingId) {
        clearInterval(pollingId);
    }

    if (promptInput) { 
        
        // --- 1. CORE LOGIC FUNCTION ---
        const processSubmission = (promptText) => {
            if (promptText && promptText.trim().length > 0) {
                const energyEstimate = calculateEnergy(promptText);
                
                console.log(`Prompt submitted. Estimated Energy: ${energyEstimate} J`);
                
                // ⚠️ REVISED FIX: Get the button *right now* to avoid stale references.
                // This addresses your concern about the button changing.
                const currentSubmitButton = getSubmitButton(promptInput);
                if (currentSubmitButton) {
                    displayEnergyEstimate(energyEstimate, currentSubmitButton); 
                } else {
                    console.warn("PromptPowerMeter: Couldn't find submit button to display meter.");
                }
                
                // Storage logic
                chrome.storage.local.get(['totalEnergyJoules'], (result) => {
                    const currentTotal = result.totalEnergyJoules || 0;
                    const newTotal = currentTotal + energyEstimate;
                    chrome.storage.local.set({ totalEnergyJoules: newTotal });
                });
            }
        };

        console.log('PromptPowerMeter: Monitoring Input Element Found.', promptInput);


        // --- 2. TIMER POLLING LOGIC (The Aggressive Fix) ---
        pollingId = setInterval(() => {
            let currentPromptValue = "";
            
            // ⚠️ REVISED FIX: Safely retrieve the current value based on element type
            try {
                if (promptInput.value !== undefined) {
                    // Case 1: Standard <textarea> or <input> (uses .value)
                    currentPromptValue = promptInput.value;
                } else if (promptInput.isContentEditable) {
                    // Case 2: A contenteditable <div> (like ChatGPT's #prompt-textarea)
                    currentPromptValue = promptInput.textContent;
                } else if (promptInput.matches('rich-textarea, .text-input-field-main-area')) {
                    // Case 3: A container (like Gemini's)
                    // Find the *actual* input inside it.
                    const internalInput = promptInput.querySelector('textarea') || promptInput.querySelector('[contenteditable="true"]');
                    if (internalInput) {
                         // Use textContent for contenteditable, value for textarea
                        currentPromptValue = internalInput.textContent || internalInput.value || "";
                    } else {
                        // Fallback if structure is unexpected
                        currentPromptValue = promptInput.textContent;
                    }
                } else {
                    // Fallback for any other element
                    currentPromptValue = promptInput.textContent;
                }

            } catch (e) {
                console.error("PromptPowerMeter: Error reading prompt value.", e);
                currentPromptValue = ""; // Failsafe
            }

            // Ensure currentPromptValue is a string before proceeding
            if (typeof currentPromptValue !== 'string') {
                currentPromptValue = "";
            }

            // --- Detection Logic ---
            const isInputCleared = currentPromptValue.trim() === "";
            const wasContentPresent = lastPromptValue.trim().length > 0;
            
            if (isInputCleared && wasContentPresent) {
                // Submission detected! Measure the last known value.
                console.log("PromptPowerMeter: Submission detected!"); // <-- ADDED LOG
                processSubmission(lastPromptValue);
                lastPromptValue = ""; // Reset the tracker
                return; 
            }

            // Update the tracker only if the current value is not empty.
            if (currentPromptValue.trim().length > 0) {
                lastPromptValue = currentPromptValue;
            }

        }, 100); // Check every 100 milliseconds

        console.log(`PromptPowerMeter: Polling started (ID: ${pollingId}).`);


        // --- 3. MUTATION OBSERVER (For cleanup/re-init) ---
        if (observer) {
            observer.disconnect();
        }

        observer = new MutationObserver(() => {
            // Check if the input we are watching is still in the document
            if (!document.body.contains(promptInput)) {
                console.log('PromptPowerMeter: Input element disappeared, re-scanning...');
                clearInterval(pollingId); // Stop the old timer
                observer.disconnect();
                setTimeout(setupPromptMonitoring, 1000); // Restart setup
            }
            // You could also re-run getPromptInput() here to see if a *better*
            // one has appeared, but checking for removal is most important.
        });
        observer.observe(document.body, { childList: true, subtree: true });

    } else {
        console.log('PromptPowerMeter: Could not find prompt input yet.');
        setTimeout(setupPromptMonitoring, 1000);
    }
}

// Initial setup call
setupPromptMonitoring();

window.addEventListener('load', setupPromptMonitoring);
