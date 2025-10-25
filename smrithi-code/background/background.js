/* global chrome */

// Background service worker for AI Energy Tracker
console.log('AI Energy Tracker: Background service worker started');

// Initialize storage on install
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('AI Energy Tracker: Extension installed/updated', details.reason);
  
  if (details.reason === 'install') {
    // First time installation
    await chrome.storage.local.set({
      sessionEnergy: 0,
      sessionCarbon: 0,
      totalPrompts: 0,
      energySaved: 0,
      installDate: Date.now(),
      lifetimeEnergy: 0,
      lifetimeCarbon: 0,
      lifetimePrompts: 0,
      history: [],
      settings: {
        showOverlay: true,
        enableNotifications: true,
        energyThreshold: 5,
        autoOptimize: false
      }
    });
    
    // Show welcome notification (with error handling)
    try {
      if (chrome.notifications) {
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icons/icon128.png',
          title: '⚡ AI Energy Tracker Installed!',
          message: 'Start tracking your AI energy usage on ChatGPT, Claude, and more.',
          priority: 2
        });
      }
    } catch (error) {
      console.log('Notifications not available:', error);
    }
  } else if (details.reason === 'update') {
    console.log('AI Energy Tracker: Extension updated');
  }
});

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background: Received message', message.type);
  
  switch (message.type) {
    case 'PROMPT_SENT':
      handlePromptSent(message.data, sender.tab)
        .then(result => sendResponse({ success: true, data: result }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;
      
    case 'GET_STATS':
      getStats()
        .then(stats => sendResponse({ success: true, stats }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;
      
    case 'RESET_SESSION':
      resetSessionStats()
        .then(() => sendResponse({ success: true }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;
      
    case 'UPDATE_SETTINGS':
      updateSettings(message.settings)
        .then(() => sendResponse({ success: true }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;
      
    case 'GET_HISTORY':
      getHistory(message.days)
        .then(history => sendResponse({ success: true, history }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;
      
    default:
      sendResponse({ success: false, error: 'Unknown message type' });
  }
});

/**
 * Handle a prompt being sent
 */
async function handlePromptSent(data, tab) {
  try {
    const result = await chrome.storage.local.get([
      'sessionEnergy',
      'sessionCarbon',
      'totalPrompts',
      'lifetimeEnergy',
      'lifetimeCarbon',
      'lifetimePrompts',
      'settings'
    ]);
    
    const newSessionEnergy = (result.sessionEnergy || 0) + data.energy;
    const newSessionCarbon = (result.sessionCarbon || 0) + data.carbon;
    const newTotalPrompts = (result.totalPrompts || 0) + 1;
    const newLifetimeEnergy = (result.lifetimeEnergy || 0) + data.energy;
    const newLifetimeCarbon = (result.lifetimeCarbon || 0) + data.carbon;
    const newLifetimePrompts = (result.lifetimePrompts || 0) + 1;
    
    await chrome.storage.local.set({
      sessionEnergy: newSessionEnergy,
      sessionCarbon: newSessionCarbon,
      totalPrompts: newTotalPrompts,
      lifetimeEnergy: newLifetimeEnergy,
      lifetimeCarbon: newLifetimeCarbon,
      lifetimePrompts: newLifetimePrompts,
      lastUpdated: Date.now()
    });
    
    await logPromptEvent({
      timestamp: Date.now(),
      platform: data.platform,
      energy: data.energy,
      carbon: data.carbon,
      tokens: data.tokens,
      url: tab?.url
    });
    
    const settings = result.settings || {};
    if (settings.enableNotifications && data.energy > (settings.energyThreshold || 5)) {
      showHighEnergyNotification(data.energy, data.carbon);
    }
    
    updateBadge(newSessionEnergy);
    
    console.log('AI Energy Tracker: Stats updated', {
      sessionEnergy: newSessionEnergy,
      sessionCarbon: newSessionCarbon,
      totalPrompts: newTotalPrompts
    });
    
    return {
      sessionEnergy: newSessionEnergy,
      sessionCarbon: newSessionCarbon,
      totalPrompts: newTotalPrompts
    };
  } catch (error) {
    console.error('Error handling prompt sent:', error);
    throw error;
  }
}

/**
 * Get all statistics
 */
async function getStats() {
  try {
    const result = await chrome.storage.local.get([
      'sessionEnergy',
      'sessionCarbon',
      'totalPrompts',
      'energySaved',
      'lifetimeEnergy',
      'lifetimeCarbon',
      'lifetimePrompts',
      'installDate',
      'lastUpdated'
    ]);
    
    return {
      session: {
        energy: result.sessionEnergy || 0,
        carbon: result.sessionCarbon || 0,
        prompts: result.totalPrompts || 0
      },
      lifetime: {
        energy: result.lifetimeEnergy || 0,
        carbon: result.lifetimeCarbon || 0,
        prompts: result.lifetimePrompts || 0
      },
      energySaved: result.energySaved || 0,
      installDate: result.installDate,
      lastUpdated: result.lastUpdated
    };
  } catch (error) {
    console.error('Error getting stats:', error);
    throw error;
  }
}

/**
 * Reset session statistics
 */
async function resetSessionStats() {
  try {
    await chrome.storage.local.set({
      sessionEnergy: 0,
      sessionCarbon: 0,
      totalPrompts: 0,
      lastUpdated: Date.now()
    });
    
    updateBadge(0);
    
    console.log('AI Energy Tracker: Session stats reset');
  } catch (error) {
    console.error('Error resetting session stats:', error);
    throw error;
  }
}

/**
 * Update user settings
 */
async function updateSettings(newSettings) {
  try {
    const result = await chrome.storage.local.get('settings');
    const currentSettings = result.settings || {};
    
    const updatedSettings = {
      ...currentSettings,
      ...newSettings
    };
    
    await chrome.storage.local.set({ settings: updatedSettings });
    console.log('AI Energy Tracker: Settings updated', updatedSettings);
  } catch (error) {
    console.error('Error updating settings:', error);
    throw error;
  }
}

/**
 * Log a prompt event to history
 */
async function logPromptEvent(event) {
  try {
    const result = await chrome.storage.local.get('promptHistory');
    const history = result.promptHistory || [];
    
    history.push(event);
    
    const trimmedHistory = history.slice(-1000);
    
    await chrome.storage.local.set({ promptHistory: trimmedHistory });
  } catch (error) {
    console.error('Error logging prompt event:', error);
  }
}

/**
 * Get historical data
 */
async function getHistory(days = 7) {
  try {
    const result = await chrome.storage.local.get(['history', 'promptHistory']);
    const history = result.history || [];
    const promptHistory = result.promptHistory || [];
    
    const cutoffDate = Date.now() - (days * 24 * 60 * 60 * 1000);
    
    const recentPrompts = promptHistory.filter(event => event.timestamp > cutoffDate);
    
    const dailyStats = {};
    
    recentPrompts.forEach(event => {
      const date = new Date(event.timestamp).toISOString().split('T')[0];
      
      if (!dailyStats[date]) {
        dailyStats[date] = {
          date,
          energy: 0,
          carbon: 0,
          prompts: 0
        };
      }
      
      dailyStats[date].energy += event.energy;
      dailyStats[date].carbon += event.carbon;
      dailyStats[date].prompts += 1;
    });
    
    return {
      daily: Object.values(dailyStats).sort((a, b) => a.date.localeCompare(b.date)),
      recentPrompts: recentPrompts.slice(-50)
    };
  } catch (error) {
    console.error('Error getting history:', error);
    throw error;
  }
}

/**
 * Show notification for high energy usage
 */
function showHighEnergyNotification(energy, carbon) {
  try {
    if (chrome.notifications) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: '⚠️ High Energy Prompt',
        message: `This prompt used ${energy.toFixed(2)} Wh (${carbon.toFixed(2)} g CO₂). Consider shortening it!`,
        priority: 1
      });
    }
  } catch (error) {
    console.log('Could not show notification:', error);
  }
}

/**
 * Update extension badge with session energy
 */
function updateBadge(energyWh) {
  try {
    if (energyWh < 1) {
      chrome.action.setBadgeText({ text: '' });
    } else if (energyWh < 10) {
      chrome.action.setBadgeText({ text: energyWh.toFixed(1) });
      chrome.action.setBadgeBackgroundColor({ color: '#4ade80' });
    } else if (energyWh < 50) {
      chrome.action.setBadgeText({ text: Math.floor(energyWh).toString() });
      chrome.action.setBadgeBackgroundColor({ color: '#fbbf24' });
    } else {
      chrome.action.setBadgeText({ text: '50+' });
      chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });
    }
  } catch (error) {
    console.log('Could not update badge:', error);
  }
}

/**
 * Daily reset at midnight
 */
function setupDailyReset() {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  
  const msUntilMidnight = tomorrow - now;
  
  setTimeout(async () => {
    console.log('AI Energy Tracker: Daily reset triggered');
    
    try {
      const stats = await chrome.storage.local.get([
        'sessionEnergy',
        'sessionCarbon',
        'totalPrompts'
      ]);
      
      const result = await chrome.storage.local.get('history');
      const history = result.history || [];
      
      const today = new Date().toISOString().split('T')[0];
      history.push({
        date: today,
        energy: stats.sessionEnergy || 0,
        carbon: stats.sessionCarbon || 0,
        prompts: stats.totalPrompts || 0
      });
      
      const trimmedHistory = history.slice(-30);
      
      await chrome.storage.local.set({ history: trimmedHistory });
      
      await resetSessionStats();
      
      console.log('AI Energy Tracker: Daily reset complete');
    } catch (error) {
      console.error('Error during daily reset:', error);
    }
    
    setupDailyReset();
  }, msUntilMidnight);
  
  console.log(`AI Energy Tracker: Daily reset scheduled in ${Math.floor(msUntilMidnight / 1000 / 60)} minutes`);
}

setupDailyReset();

/**
 * Clean up old data periodically
 */
async function cleanupOldData() {
  try {
    const result = await chrome.storage.local.get('promptHistory');
    const history = result.promptHistory || [];
    
    const cutoffDate = Date.now() - (30 * 24 * 60 * 60 * 1000);
    const cleanedHistory = history.filter(event => event.timestamp > cutoffDate);
    
    if (cleanedHistory.length !== history.length) {
      await chrome.storage.local.set({ promptHistory: cleanedHistory });
      console.log(`AI Energy Tracker: Cleaned up ${history.length - cleanedHistory.length} old events`);
    }
  } catch (error) {
    console.error('Error during cleanup:', error);
  }
}

setInterval(cleanupOldData, 7 * 24 * 60 * 60 * 1000);
cleanupOldData();

console.log('AI Energy Tracker: Background service worker fully initialized');