// background.js
let config;

// Load configuration
fetch(chrome.runtime.getURL('config.json'))
  .then(response => response.json())
  .then(data => {
    config = data;
  });

// Function to match URL against patterns
function matchesPattern(url, patterns) {
  return patterns.some(pattern => {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    return regex.test(url);
  });
}

// Function to get group configuration for a URL
function getGroupForUrl(url) {
  return config.rules.find(rule => matchesPattern(url, rule.urls));
}

// Function to ensure a group exists
async function ensureGroup(windowId, groupConfig) {
  const groups = await chrome.tabGroups.query({ windowId, title: groupConfig.group });
  if (groups.length > 0) {
    return groups[0].id;
  }
  
  const groupId = await chrome.tabs.group({ createProperties: { windowId } });
  await chrome.tabGroups.update(groupId, { 
    title: groupConfig.group,
    color: groupConfig.color
  });
  return groupId;
}

// Handle new and updated tabs
chrome.tabs.onCreated.addListener(async (tab) => {
  if (!config) return;
  
  const groupConfig = getGroupForUrl(tab.pendingUrl || tab.url);
  if (groupConfig) {
    const groupId = await ensureGroup(tab.windowId, groupConfig);
    await chrome.tabs.group({ groupId, tabIds: [tab.id] });
  }
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (!config || !changeInfo.url) return;
  
  const groupConfig = getGroupForUrl(changeInfo.url);
  if (groupConfig) {
    const groupId = await ensureGroup(tab.windowId, groupConfig);
    await chrome.tabs.group({ groupId, tabIds: [tabId] });
  }
});
