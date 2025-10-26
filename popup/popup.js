// Popup script
document.addEventListener('DOMContentLoaded', async () => {
  await loadStats();
  setupEventListeners();
  
  // Auto-refresh stats every 2 seconds
  setInterval(loadStats, 2000);
});

async function loadStats() {
  try {
    const result = await chrome.storage.local.get([
      'sessionEnergy',
      'sessionCarbon',
      'totalPrompts',
      'energySaved',
      'lastUpdated'
    ]);

    const sessionEnergy = result.sessionEnergy || 0;
    const sessionCarbon = result.sessionCarbon || 0;
    const totalPrompts = result.totalPrompts || 0;
    const energySaved = result.energySaved || 0;

    // Update display
    document.getElementById('session-energy').textContent = formatEnergy(sessionEnergy);
    document.getElementById('session-carbon').textContent = formatCarbon(sessionCarbon);
    document.getElementById('total-prompts').textContent = totalPrompts;
    document.getElementById('energy-saved').textContent = formatEnergy(energySaved);

    // Update impact comparison
    updateImpactComparison(sessionEnergy, sessionCarbon);
  } catch (error) {
    console.error('Error loading stats:', error);
    showError('Failed to load statistics');
  }
}

function formatEnergy(energyWh) {
  if (energyWh === 0) return '0 Wh';
  if (energyWh < 0.001) {
    return `${(energyWh * 1000000).toFixed(0)} µWh`;
  }
  if (energyWh < 1) {
    return `${(energyWh * 1000).toFixed(0)} mWh`;
  }
  if (energyWh < 1000) {
    return `${energyWh.toFixed(2)} Wh`;
  }
  return `${(energyWh / 1000).toFixed(2)} kWh`;
}

function formatCarbon(carbonG) {
  if (carbonG === 0) return '0 g CO₂';
  if (carbonG < 0.001) {
    return `${(carbonG * 1000000).toFixed(0)} µg CO₂`;
  }
  if (carbonG < 1) {
    return `${(carbonG * 1000).toFixed(0)} mg CO₂`;
  }
  if (carbonG < 1000) {
    return `${carbonG.toFixed(2)} g CO₂`;
  }
  return `${(carbonG / 1000).toFixed(2)} kg CO₂`;
}

function updateImpactComparison(energyWh, carbonG) {
  const comparisonEl = document.getElementById('impact-comparison');
  
  if (energyWh < 0.01) {
    comparisonEl.innerHTML = `
      <div style="text-align: center; padding: 10px;">
        <div style="font-size: 32px; margin-bottom: 8px;">🌱</div>
        <div>Great start! Keep using efficient prompts.</div>
      </div>
    `;
    return;
  }

  // Calculate various comparisons
  const comparisons = generateComparisons(energyWh, carbonG);
  
  comparisonEl.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 8px;">
      ${comparisons.map(c => `
        <div style="display: flex; align-items: center; gap: 8px; padding: 8px; background: rgba(255,255,255,0.1); border-radius: 6px;">
          <span style="font-size: 20px;">${c.emoji}</span>
          <span style="flex: 1; font-size: 13px;">${c.text}</span>
        </div>
      `).join('')}
    </div>
  `;
}

function generateComparisons(energyWh, carbonG) {
  const comparisons = [];
  
  // Phone charging (15Wh per full charge)
  const phoneCharges = energyWh / 15;
  if (phoneCharges >= 0.01) {
    if (phoneCharges < 1) {
      comparisons.push({
        emoji: '📱',
        text: `${(phoneCharges * 100).toFixed(0)}% of a phone charge`
      });
    } else {
      comparisons.push({
        emoji: '📱',
        text: `${phoneCharges.toFixed(1)} phone charges`
      });
    }
  }
  
  // LED bulb (10W LED)
  const ledMinutes = (energyWh / 10) * 60;
  if (ledMinutes >= 1) {
    if (ledMinutes < 60) {
      comparisons.push({
        emoji: '💡',
        text: `LED bulb for ${Math.round(ledMinutes)} minutes`
      });
    } else {
      const hours = Math.floor(ledMinutes / 60);
      const mins = Math.round(ledMinutes % 60);
      comparisons.push({
        emoji: '💡',
        text: `LED bulb for ${hours}h ${mins}m`
      });
    }
  }
  
  // Laptop usage (50W average)
  const laptopMinutes = (energyWh / 50) * 60;
  if (laptopMinutes >= 1) {
    comparisons.push({
      emoji: '💻',
      text: `Laptop for ${Math.round(laptopMinutes)} minutes`
    });
  }
  
  // Trees needed (21kg CO2 per tree per year)
  const treesNeeded = (carbonG / 1000) / 21;
  comparisons.push({
    emoji: '🌳',
    text: `Offset by ${treesNeeded < 0.001 ? '<0.001' : treesNeeded.toFixed(3)} trees/year`
  });
  
  // Car equivalent (120g CO2 per km average)
  const carMeters = (carbonG / 120) * 1000;
  if (carMeters >= 1) {
    if (carMeters < 1000) {
      comparisons.push({
        emoji: '🚗',
        text: `Driving ${Math.round(carMeters)} meters`
      });
    } else {
      comparisons.push({
        emoji: '🚗',
        text: `Driving ${(carMeters / 1000).toFixed(2)} km`
      });
    }
  }
  
  return comparisons.slice(0, 3); // Return top 3 most relevant
}

function setupEventListeners() {
  // Reset stats button
  document.getElementById('reset-stats').addEventListener('click', async () => {
    if (confirm('Are you sure you want to reset your session stats?')) {
      const btn = document.getElementById('reset-stats');
      btn.disabled = true;
      btn.textContent = 'Resetting...';
      
      try {
        // Get current stats before resetting (to potentially save to history)
        const currentStats = await chrome.storage.local.get([
          'sessionEnergy',
          'sessionCarbon',
          'totalPrompts'
        ]);
        
        // Reset current session
        await chrome.storage.local.set({
          sessionEnergy: 0,
          sessionCarbon: 0,
          totalPrompts: 0,
          lastUpdated: Date.now()
        });
        
        // Optionally save to history
        if (currentStats.sessionEnergy > 0) {
          await addToHistory(currentStats);
        }
        
        // Reload stats display
        await loadStats();
        
        // Show success
        btn.textContent = '✓ Reset Complete!';
        btn.style.background = 'rgba(74, 222, 128, 0.3)';
        
        setTimeout(() => {
          btn.textContent = 'Reset Session';
          btn.style.background = '';
          btn.disabled = false;
        }, 2000);
        
      } catch (error) {
        console.error('Error resetting stats:', error);
        btn.textContent = '✗ Error';
        btn.style.background = 'rgba(239, 68, 68, 0.3)';
        
        setTimeout(() => {
          btn.textContent = 'Reset Session';
          btn.style.background = '';
          btn.disabled = false;
        }, 2000);
      }
    }
  });

  // Learn more button
  document.getElementById('learn-more').addEventListener('click', () => {
    chrome.tabs.create({
      url: 'https://github.com/smrithi-0121/calhacks2025' // Update with your repo
    });
  });
}

async function addToHistory(stats) {
  try {
    const result = await chrome.storage.local.get('history');
    const history = result.history || [];
    
    history.push({
      date: new Date().toISOString(),
      energy: stats.sessionEnergy,
      carbon: stats.sessionCarbon,
      prompts: stats.totalPrompts
    });
    
    // Keep only last 30 days
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    const filteredHistory = history.filter(entry => 
      new Date(entry.date).getTime() > thirtyDaysAgo
    );
    
    await chrome.storage.local.set({ history: filteredHistory });
  } catch (error) {
    console.error('Error saving to history:', error);
  }
}

function showError(message) {
  const comparisonEl = document.getElementById('impact-comparison');
  comparisonEl.innerHTML = `
    <div style="text-align: center; padding: 10px; color: #fca5a5;">
      <div style="font-size: 24px; margin-bottom: 8px;">⚠️</div>
      <div>${message}</div>
    </div>
  `;
}

// Export stats functionality
document.addEventListener('keydown', (e) => {
  // Ctrl/Cmd + E to export stats
  if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
    e.preventDefault();
    exportStats();
  }
});

async function exportStats() {
  try {
    const stats = await chrome.storage.local.get([
      'sessionEnergy',
      'sessionCarbon',
      'totalPrompts',
      'energySaved',
      'history'
    ]);
    
    const exportData = {
      exportDate: new Date().toISOString(),
      currentSession: {
        energy: stats.sessionEnergy,
        carbon: stats.sessionCarbon,
        prompts: stats.totalPrompts,
        energySaved: stats.energySaved
      },
      history: stats.history || []
    };
    
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    chrome.downloads.download({
      url: url,
      filename: `ai-energy-stats-${Date.now()}.json`,
      saveAs: true
    });
    
  } catch (error) {
    console.error('Error exporting stats:', error);
    alert('Failed to export stats');
  }
}