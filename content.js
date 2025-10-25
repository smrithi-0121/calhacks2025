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
    
    // 🥈 General/Fallback selectors
    'textarea[placeholder*="Send a message"]', 
    '.text-input-field-main-area textarea', 
    'textarea[data-testid="textarea"]',
    '#prompt-textarea', 
    'input[placeholder*="Prompt"]', 
];

const SUBMIT_BUTTON_SELECTORS = [
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
    // Prioritize the stable parent container/main area
    const mainArea = document.querySelector('.text-input-field-main-area');
    if (mainArea) return mainArea; 

    // Fallback to the rich-textarea element itself
    for (const selector of PROMPT_INPUT_SELECTORS) {
        const input = document.querySelector(selector);
        if (input) return input;
    }
    return null;
}

function getSubmitButton(inputElement) {
    // This function is still needed for meter positioning
    if (inputElement) {
        let parentForm = inputElement.closest('form') || inputElement.closest('div');
        if (parentForm) {
            for (const selector of SUBMIT_BUTTON_SELECTORS) {
                const button = parentForm.querySelector(selector);
                if (button) return button;
            }
        }
    }

    for (const selector of SUBMIT_BUTTON_SELECTORS) {
        const button = document.querySelector(selector);
        if (button) return button;
    }
    
    const mainArea = document.querySelector('.text-input-field-main-area');
    if (mainArea) return mainArea;
    
    return null;
}

function calculateEnergy(promptText) {
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
    meter.style.top = `${buttonRect.top - 40}px`;
    meter.style.left = `${buttonRect.left + buttonRect.width / 2 - 50}px`;

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
                displayEnergyEstimate(energyEstimate, submitButton); 
                
                // Storage logic
                chrome.storage.local.get(['totalEnergyJoules'], (result) => {
                    const currentTotal = result.totalEnergyJoules || 0;
                    const newTotal = currentTotal + energyEstimate;
                    chrome.storage.local.set({ totalEnergyJoules: newTotal });
                });
            }
        };

        console.log('PromptPowerMeter: Monitoring Input Element Found.');


        // --- 2. TIMER POLLING LOGIC (The Aggressive Fix) ---
        // --- 2. TIMER POLLING LOGIC (The Aggressive Fix) ---
        pollingId = setInterval(() => {
            let currentPromptValue = "";
            
            // ⚠️ FINAL FIX: Safely retrieve the current value
            if (promptInput.value !== undefined) {
                // Case 1: Standard input/textarea (uses .value)
                currentPromptValue = promptInput.value;
            } else {
                // Case 2: Custom/Container input (search for contenteditable)
                const contentEditableInput = promptInput.querySelector('[contenteditable="true"]') || 
                                             promptInput.querySelector('rich-textarea') || 
                                             promptInput.querySelector('textarea');
                
                if (contentEditableInput) {
                    // Use textContent for contenteditable divs, and fallback to .value
                    currentPromptValue = contentEditableInput.textContent || contentEditableInput.value || "";
                }
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
                processSubmission(lastPromptValue);
                lastPromptValue = ""; // Reset the tracker
                return; 
            }

            // Update the tracker only if the current value is not empty.
            if (currentPromptValue.trim().length > 0) {
                lastPromptValue = currentPromptValue;
            }

        }, 100); // Check every 100 milliseconds

        console.log(`PromptPowerMeter: Polling started (ID: ${pollingId}). Event listeners disabled.`);


        // --- 3. MUTATION OBSERVER (For cleanup/re-init) ---
        if (observer) {
            observer.disconnect();
        }

        observer = new MutationObserver(() => {
            const currentInput = getPromptInput();
            
            if (!currentInput || currentInput !== promptInput) { 
                console.log('PromptPowerMeter: Input element changed or disappeared, re-scanning...');
                clearInterval(pollingId); // Stop the old timer
                observer.disconnect();
                setTimeout(setupPromptMonitoring, 1000); // Restart setup
            }
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