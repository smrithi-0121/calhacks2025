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
  }
};

// Make available globally
if (typeof window !== 'undefined') {
  window.EnergyCalculator = EnergyCalculator;
}