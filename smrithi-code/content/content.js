// Content script that runs on AI chat websites
console.log('AI Energy Tracker: Content script loaded');

class AIEnergyTracker {
  constructor() {
    this.platform = this.detectPlatform();
    this.overlayElement = null;
    this.textArea = null;
    this.sessionEnergy = 0;
    this.sessionCarbon = 0;
    this.totalPrompts = 0;
    
    this.init();
  }

  detectPlatform() {
    const hostname = window.location.hostname;
    if (hostname.includes('openai.com')) return 'chatgpt';
    if (hostname.includes('claude.ai')) return 'claude';
    if (hostname.includes('gemini.google.com')) return 'gemini';
    if (hostname.includes('perplexity.ai')) return 'perplexity';
    return 'default';
  }

  init() {
    // Wait for page to load
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.setup());
    } else {
      this.setup();
    }
  }

  setup() {
    console.log('AI Energy Tracker: Setting up on', this.platform);
    
    // Find the input textarea
    this.findTextArea();
    
    // Create and inject overlay
    this.createOverlay();
    
    // Load session stats
    this.loadSessionStats();
    
    // Start monitoring
    this.startMonitoring();

    this.monitorTabClose();
  }


  monitorTabClose() {
    // The 'beforeunload' event fires when the page is about to be unloaded.
    window.addEventListener('beforeunload', () => {
      console.log('AI Energy Tracker: Tab is closing or navigating away...');
      this.sessionEnergy = 0
      this.saveSessionStats()
      //sessionEnergy = 0
      // You can add logic here to:
      // 1. Save any current, unsaved data (though it should be done dynamically).
      // 2. Perform cleanup.
      
      // IMPORTANT: Chrome Storage is asynchronous, but 'beforeunload' is synchronous.
      // For critical data saving, you must use a technique that ensures the write
      // completes before the page unloads, which is generally complex and discouraged.
      // Rely on dynamic saving (like the prompt counting logic) instead.
    });
  }

  findTextArea() {
    // Platform-specific selectors
    const selectors = {
      chatgpt: '#prompt-textarea, textarea[placeholder*="Message"]',
      claude: 'div[contenteditable="true"]',
      gemini: 'textarea, div[contenteditable="true"]',
      perplexity: 'textarea',
      default: 'textarea'
    };

    const selector = selectors[this.platform] || selectors.default;
    
    // Try to find the textarea
    const findTextAreaInterval = setInterval(() => {
      this.textArea = document.querySelector(selector);
      
      if (this.textArea) {
        console.log('AI Energy Tracker: Found input element');
        clearInterval(findTextAreaInterval);
      }
    }, 1000);

    // Stop trying after 10 seconds
    setTimeout(() => clearInterval(findTextAreaInterval), 10000);
  }

  createOverlay() {
    // Create overlay container
    this.overlayElement = document.createElement('div');
    this.overlayElement.id = 'ai-energy-overlay';
    this.overlayElement.innerHTML = `
      <div class="energy-tracker-container">
        <div class="energy-header">
          <span class="energy-icon">⚡</span>
          <span class="energy-title">Energy Tracker</span>
        </div>
        <div class="energy-stats">
          <div class="stat-item">
            <span class="stat-label">Current Prompt:</span>
            <span class="stat-value current-energy">0 mWh</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Carbon:</span>
            <span class="stat-value current-carbon">0 mg CO₂</span>
          </div>
          <div class="stat-item session-stats">
            <span class="stat-label">Session Total:</span>
            <span class="stat-value session-energy">0 Wh</span>
          </div>
        </div>
        <div class="energy-bar-container">
          <div class="energy-bar" style="width: 0%; background: #4ade80;"></div>
        </div>
        <div class="energy-suggestion">
          Type to see energy impact...
        </div>
        <button class="minimize-btn" title="Minimize">−</button>
      </div>
    `;

    // Add to page
    document.body.appendChild(this.overlayElement);

    // Add minimize functionality
    const minimizeBtn = this.overlayElement.querySelector('.minimize-btn');
    const container = this.overlayElement.querySelector('.energy-tracker-container');
    
    minimizeBtn.addEventListener('click', () => {
      container.classList.toggle('minimized');
      minimizeBtn.textContent = container.classList.contains('minimized') ? '+' : '−';
    });
  }

  startMonitoring() {
    if (!this.textArea) {
      console.log('AI Energy Tracker: No textarea found, retrying...');
      setTimeout(() => this.startMonitoring(), 2000);
      return;
    }

    // Monitor input changes
    const updateEnergy = () => {
      const text = this.getTextContent();
      this.updateOverlay(text);
    };

    // Handle different input types
    if (this.textArea.tagName === 'TEXTAREA' || this.textArea.tagName === 'INPUT') {
      this.textArea.addEventListener('input', updateEnergy);
      this.textArea.addEventListener('keyup', updateEnergy);
    } else {
      // For contenteditable divs
      this.textArea.addEventListener('input', updateEnergy);
      this.textArea.addEventListener('keyup', updateEnergy);
      
      // Use MutationObserver as backup
      const observer = new MutationObserver(updateEnergy);
      observer.observe(this.textArea, {
        childList: true,
        subtree: true,
        characterData: true
      });
    }

    // Monitor for send button clicks to track session energy
    this.monitorSendButton();
  }

  getTextContent() {
    if (!this.textArea) return '';
    
    if (this.textArea.tagName === 'TEXTAREA' || this.textArea.tagName === 'INPUT') {
      return this.textArea.value;
    } else {
      // For contenteditable
      return this.textArea.innerText || this.textArea.textContent || '';
    }
  }

  updateOverlay(text) {
    if (!text || text.trim().length === 0) {
      this.resetOverlay();
      return;
    }

    const energy = EnergyCalculator.calculateEnergy(text, this.platform);
    const carbon = EnergyCalculator.calculateCarbon(energy);
    const color = EnergyCalculator.getEnergyColor(energy);
    const suggestion = EnergyCalculator.suggestOptimization(text);
    const comparison = EnergyCalculator.getComparison(energy);

    // Update display
    this.overlayElement.querySelector('.current-energy').textContent = 
      EnergyCalculator.formatEnergy(energy);
    this.overlayElement.querySelector('.current-carbon').textContent = 
      EnergyCalculator.formatCarbon(carbon);
    this.overlayElement.querySelector('.energy-suggestion').innerHTML = 
      `${suggestion}<br><small>${comparison}</small>`;

    // Update energy bar
    const bar = this.overlayElement.querySelector('.energy-bar');
    const percentage = Math.min((energy / 5) * 100, 100); // Max at 5 Wh
    bar.style.width = `${percentage}%`;
    bar.style.background = color;

    // Update current prompt energy data attribute
    this.overlayElement.dataset.currentEnergy = energy;
    this.overlayElement.dataset.currentCarbon = carbon;
  }

  resetOverlay() {
    this.overlayElement.querySelector('.current-energy').textContent = '0 mWh';
    this.overlayElement.querySelector('.current-carbon').textContent = '0 mg CO₂';
    this.overlayElement.querySelector('.energy-suggestion').textContent = 
      'Type to see energy impact...';
    this.overlayElement.querySelector('.energy-bar').style.width = '0%';
  }

  monitorSendButton() {
    // Listen for clicks anywhere on the page
    document.addEventListener('click', (e) => {
      // Check if click is likely a send button
      const target = e.target;
      const isSendButton = 
        target.matches('button[type="submit"]') ||
        target.closest('button[type="submit"]') ||
        target.matches('[data-testid*="send"]') ||
        target.closest('[data-testid*="send"]');

      if (isSendButton) {
        this.recordPromptSent();
      }
    }, true);

    // Also listen for Enter key
    if (this.textArea) {
      this.textArea.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          // Short delay to ensure text is captured
          setTimeout(() => this.recordPromptSent(), 100);
        }
      });
    }
  }

  recordPromptSent() {
    const energy = parseFloat(this.overlayElement.dataset.currentEnergy || 0);
    const carbon = parseFloat(this.overlayElement.dataset.currentCarbon || 0);
    

    if (energy > 0) {
      this.sessionEnergy += energy;
      this.sessionCarbon += carbon;
      this.totalPrompts+=1
      console.log(this.totalPrompts)
      
      // Update session display
      this.overlayElement.querySelector('.session-energy').textContent = 
        EnergyCalculator.formatEnergy(this.sessionEnergy);

      // Save to storage
      this.saveSessionStats();

      console.log('AI Energy Tracker: Prompt sent -', {
        energy: EnergyCalculator.formatEnergy(energy),
        carbon: EnergyCalculator.formatCarbon(carbon)
      });
    }
  }

  async loadSessionStats() {
    try {
      const result = await chrome.storage.local.get(['sessionEnergy', 'sessionCarbon', 'totalPrompts']);
      this.sessionEnergy = result.sessionEnergy || 0;
      this.sessionCarbon = result.sessionCarbon || 0;
      this.totalPrompts = result.totalPrompts || 0;
      
      this.overlayElement.querySelector('.session-energy').textContent = 
        EnergyCalculator.formatEnergy(this.sessionEnergy);
    } catch (error) {
      console.error('Error loading session stats:', error);
    }
  }

  async saveSessionStats() {
    try {
      await chrome.storage.local.set({
        sessionEnergy: this.sessionEnergy,
        sessionCarbon: this.sessionCarbon,
        totalPrompts: this.totalPrompts,
        lastUpdated: Date.now()
      });
    } catch (error) {
      console.error('Error saving session stats:', error);
    }
  }
}

// Initialize when script loads
const tracker = new AIEnergyTracker();