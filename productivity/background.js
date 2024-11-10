// background.js
let config;

// Load configuration with error handling
fetch(chrome.runtime.getURL('config.json'))
  .then(response => response.json())
  .then(data => {
    config = data;
  })
  .catch(error => {
    console.error('Failed to load config:', error);
  });

// Function to match URL against patterns with improved robustness
function matchesPattern(url, patterns) {
  try {
    const lowerUrl = url.toLowerCase();
    return patterns.some(pattern => {
      const regex = new RegExp('^' + pattern.toLowerCase().replace(/\*/g, '.*') + '$');
      return regex.test(lowerUrl);
    });
  } catch (error) {
    console.error('Pattern matching error:', error);
    return false;
  }
}

// Function to get group configuration for a URL
function getGroupForUrl(url) {
  if (!url || !config || !config.rules) return null;
  return config.rules.find(rule => matchesPattern(url, rule.urls));
}

// Function to clean up empty groups
async function cleanupEmptyGroups() {
  try {
    const windows = await chrome.windows.getAll();
    for (const window of windows) {
      const groups = await chrome.tabGroups.query({ windowId: window.id });
      for (const group of groups) {
        const tabs = await chrome.tabs.query({ groupId: group.id });
        if (tabs.length === 0) {
          await chrome.tabGroups.remove(group.id);
        }
      }
    }
  } catch (error) {
    console.error('Cleanup error:', error);
  }
}

// Function to ensure a group exists with error handling
async function ensureGroup(windowId, groupConfig) {
  try {
    const groups = await chrome.tabGroups.query({ windowId, title: groupConfig.group });
    if (groups.length > 0) {
      return groups[0].id;
    }
    
    const groupId = await chrome.tabs.group({ createProperties: { windowId } });
    await chrome.tabGroups.update(groupId, { 
      title: groupConfig.group,
      color: groupConfig.color,
      collapsed: groupConfig.collapsed || false
    });
    return groupId;
  } catch (error) {
    console.error('Group creation error:', error);
    return null;
  }
}

// Handle new tabs
chrome.tabs.onCreated.addListener(async (tab) => {
  if (!config) return;
  
  const groupConfig = getGroupForUrl(tab.pendingUrl || tab.url);
  if (groupConfig) {
    try {
      const groupId = await ensureGroup(tab.windowId, groupConfig);
      if (groupId) {
        await chrome.tabs.group({ groupId, tabIds: [tab.id] });
      }
    } catch (error) {
      console.error('Tab grouping error:', error);
    }
  }
});

// Handle updated tabs
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (!config || !changeInfo.url) return;
  
  const groupConfig = getGroupForUrl(changeInfo.url);
  if (groupConfig) {
    try {
      const groupId = await ensureGroup(tab.windowId, groupConfig);
      if (groupId) {
        await chrome.tabs.group({ groupId, tabIds: [tabId] });
      }
    } catch (error) {
      console.error('Tab update grouping error:', error);
    }
  }
});

// Handle tab removal and cleanup empty groups
chrome.tabs.onRemoved.addListener(cleanupEmptyGroups);
