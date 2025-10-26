// Energy calculation utilities
const EnergyCalculator = {
  // Energy per token in Watt-hours (Wh)
  ENERGY_PER_TOKEN: {
    'chatgpt': 0.0004,    // GPT-3.5/4
    'claude': 0.0003,     // Claude
    'gemini': 0.0002,     // Gemini
    'perplexity': 0.0003, // Perplexity
    'default': 0.0003
  },

  // Carbon intensity (gCO2 per kWh) - US average
  CARBON_INTENSITY: 500,

  /**
   * Estimate token count from text
   * Rough approximation: 1 token ≈ 0.75 words or ~4 characters
   */
  estimateTokens(text) {
    if (!text) return 0;
    
    // Method 1: Word count * 1.33
    const wordCount = text.trim().split(/\s+/).length;
    const tokensByWords = Math.ceil(wordCount * 1.33);
    
    // Method 2: Character count / 4
    const tokensByChars = Math.ceil(text.length / 4);
    
    // Use average of both methods
    return Math.ceil((tokensByWords + tokensByChars) / 2);
  },

  /**
   * Calculate energy consumption in Watt-hours
   */
  calculateEnergy(text, platform = 'default') {
    const tokens = this.estimateTokens(text);
    const energyPerToken = this.ENERGY_PER_TOKEN[platform] || this.ENERGY_PER_TOKEN.default;
    return tokens * energyPerToken;
  },

  /**
   * Calculate carbon footprint in grams CO2
   */
  calculateCarbon(energyWh) {
    const energyKWh = energyWh / 1000;
    return energyKWh * this.CARBON_INTENSITY;
  },

  /**
   * Get human-readable energy string
   */
  formatEnergy(energyWh) {
    if (energyWh < 1) {
      return `${(energyWh * 1000).toFixed(2)} mWh`;
    }
    return `${energyWh.toFixed(3)} Wh`;
  },

  /**
   * Get human-readable carbon string
   */
  formatCarbon(carbonG) {
    if (carbonG < 1) {
      return `${(carbonG * 1000).toFixed(2)} mg CO₂`;
    }
    return `${carbonG.toFixed(2)} g CO₂`;
  },

  /**
   * Get color based on energy level
   */
  getEnergyColor(energyWh) {
    if (energyWh < 0.5) return '#4ade80'; // green
    if (energyWh < 2) return '#fbbf24';   // yellow
    return '#ef4444';                      // red
  },

  /**
   * Get relatable comparison
   */
  getComparison(energyWh) {
    const comparisons = [
      { threshold: 0.1, text: '☕ Less than brewing a cup of coffee' },
      { threshold: 0.5, text: '💡 Like a LED bulb for 2 minutes' },
      { threshold: 1, text: '📱 Like charging your phone 2%' },
      { threshold: 5, text: '💻 Like your laptop for 5 minutes' },
      { threshold: 10, text: '🔋 Like charging a tablet' },
      { threshold: Infinity, text: '⚡ Significant energy usage!' }
    ];

    return comparisons.find(c => energyWh < c.threshold).text;
  },

  /**
   * Suggest optimization
   */
  suggestOptimization(text) {
    const tokens = this.estimateTokens(text);
    
    if (tokens < 50) {
      return "✅ Your prompt is already efficient!";
    }
    
    if (tokens < 150) {
      return "💡 Consider removing filler words to save energy.";
    }
    
    const savings = Math.floor((tokens - 100) / tokens * 100);
    return `💡 Try shortening by ~${savings}% to significantly reduce energy use.`;
  },

  /**
   * Compare energy across different models
   */
  compareModels(text) {
    const tokens = this.estimateTokens(text);
    
    const models = {};
    for (const [model, energyPerToken] of Object.entries(this.ENERGY_PER_TOKEN)) {
      if (model === 'default') continue;
      
      const energy = tokens * energyPerToken;
      const carbon = this.calculateCarbon(energy);
      
      models[model] = {
        energy: energy,
        energyFormatted: this.formatEnergy(energy),
        carbon: carbon,
        carbonFormatted: this.formatCarbon(carbon),
        tokens: tokens
      };
    }
    
    return models;
  }
};

// Prompt Optimizer - Rule-based optimization without AI
const PromptOptimizer = {
  /**
   * Optimize prompt without using AI
   */
  optimizePrompt(text) {
    let optimized = text;
    const suggestions = [];
    
    // 1. Remove filler words
    const fillerWords = [
      'just', 'really', 'very', 'quite', 'rather', 'somewhat',
      'basically', 'actually', 'literally', 'honestly',
      'I think', 'I believe', 'in my opinion', 'it seems like'
    ];
    
    fillerWords.forEach(filler => {
      const regex = new RegExp(`\\b${filler}\\b`, 'gi');
      if (regex.test(optimized)) {
        optimized = optimized.replace(regex, '');
        suggestions.push(`Removed filler word: "${filler}"`);
      }
    });
    
    // 2. Replace verbose phrases
    const replacements = {
      'a lot of': 'many',
      'in order to': 'to',
      'due to the fact that': 'because',
      'at this point in time': 'now',
      'for the purpose of': 'for',
      'in the event that': 'if',
      'on the grounds that': 'because',
      'with regard to': 'about',
      'give consideration to': 'consider',
      'make a decision': 'decide',
      'come to a conclusion': 'conclude',
      'provide assistance': 'help',
      'please ': '',
      'could you ': '',
      'can you ': ''
    };
    
    Object.entries(replacements).forEach(([verbose, concise]) => {
      const regex = new RegExp(verbose, 'gi');
      if (regex.test(optimized)) {
        optimized = optimized.replace(regex, concise);
        suggestions.push(`Shortened: "${verbose}" → "${concise}"`);
      }
    });
    
    // 3. Remove redundant punctuation
    optimized = optimized.replace(/\.{2,}/g, '.');
    optimized = optimized.replace(/!{2,}/g, '!');
    optimized = optimized.replace(/\?{2,}/g, '?');
    
    // 4. Clean up extra whitespace
    optimized = optimized.replace(/\s+/g, ' ').trim();
    
    // 5. Calculate savings
    const originalTokens = EnergyCalculator.estimateTokens(text);
    const optimizedTokens = EnergyCalculator.estimateTokens(optimized);
    const tokensSaved = originalTokens - optimizedTokens;
    const percentSaved = originalTokens > 0 ? (tokensSaved / originalTokens * 100).toFixed(1) : 0;
    
    const originalEnergy = EnergyCalculator.calculateEnergy(text);
    const optimizedEnergy = EnergyCalculator.calculateEnergy(optimized);
    const energySaved = originalEnergy - optimizedEnergy;
    
    return {
      original: text,
      optimized: optimized,
      originalTokens,
      optimizedTokens,
      tokensSaved,
      percentSaved,
      originalEnergy,
      optimizedEnergy,
      energySaved,
      suggestions: suggestions.slice(0, 3) // Show top 3 suggestions
    };
  }
};

// Make available globally
if (typeof window !== 'undefined') {
  window.EnergyCalculator = EnergyCalculator;
  window.PromptOptimizer = PromptOptimizer;
}