/**
 * Prep Tracker - Enhanced Background Script
 * Handles context menus, badge updates, and cross-tab communication
 */

// Configuration
const CONFIG = {
  STORAGE_KEY: 'trackedPages',
  BADGE_DURATION: 2000,
  CONTEXT_MENU_ID: 'track_page'
};

// Utility Functions
const Utils = {
  // Safe chrome runtime messaging
  async safeSendMessage(message) {
    try {
      return new Promise((resolve) => {
        chrome.runtime.sendMessage(message, (response) => {
          if (chrome.runtime.lastError) {
            console.warn('Runtime message failed:', chrome.runtime.lastError.message);
          }
          resolve(response);
        });
      });
    } catch (error) {
      console.warn('Failed to send message:', error);
      return null;
    }
  },

  // Generate unique ID
  generateId() {
    const timestamp = Date.now();
    return crypto?.randomUUID?.() || `${timestamp}-${Math.random().toString(36).slice(2)}`;
  },

  // Get current timestamp
  now() {
    return Date.now();
  },

  // Validate URL
  isValidUrl(string) {
    try {
      const url = new URL(string);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  },

  // Extract domain from URL
  getDomain(url) {
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  }
};

// Storage Management
const Storage = {
  async getItems() {
    try {
      const result = await chrome.storage.sync.get(CONFIG.STORAGE_KEY);
      const data = result[CONFIG.STORAGE_KEY];
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.error('Failed to get items from storage:', error);
      return [];
    }
  },

  async setItems(items) {
    try {
      if (!Array.isArray(items)) {
        throw new Error('Items must be an array');
      }
      
      await chrome.storage.sync.set({ [CONFIG.STORAGE_KEY]: items });
      return true;
    } catch (error) {
      console.error('Failed to save items to storage:', error);
      return false;
    }
  }
};

// Badge Management
const BadgeManager = {
  showSuccess() {
    chrome.action.setBadgeText({ text: '✓' });
    chrome.action.setBadgeBackgroundColor({ color: '#2e7d32' });
    
    setTimeout(() => {
      chrome.action.setBadgeText({ text: '' });
    }, CONFIG.BADGE_DURATION);
  },

  showError() {
    chrome.action.setBadgeText({ text: '✗' });
    chrome.action.setBadgeBackgroundColor({ color: '#d32f2f' });
    
    setTimeout(() => {
      chrome.action.setBadgeText({ text: '' });
    }, CONFIG.BADGE_DURATION);
  },

  async updateCount() {
    try {
      const items = await Storage.getItems();
      const pendingCount = items.filter(item => 
        item.status === 'todo' || item.status === 'in-progress'
      ).length;
      
      if (pendingCount > 0) {
        chrome.action.setBadgeText({ text: pendingCount.toString() });
        chrome.action.setBadgeBackgroundColor({ color: '#1976d2' });
      } else {
        chrome.action.setBadgeText({ text: '' });
      }
    } catch (error) {
      console.error('Failed to update badge count:', error);
    }
  }
};

// Item Management
const ItemManager = {
  async addOrUpdateItem({ url, name, fromContextMenu = false }) {
    try {
      if (!Utils.isValidUrl(url)) {
        throw new Error('Invalid URL provided');
      }

      const items = await Storage.getItems();
      const now = Utils.now();
      
      // Check if item already exists
      const existingIndex = items.findIndex(item => item.url === url);
      
      if (existingIndex !== -1) {
        // Update existing item
        const existing = items[existingIndex];
        existing.name = name?.trim() || existing.name;
        existing.updatedAt = now;
        
        // If added via context menu and it's marked as done, reset to todo
        if (fromContextMenu && existing.status === 'done') {
          existing.status = 'todo';
        }
        
        await Storage.setItems(items);
        return existing;
      } else {
        // Create new item
        const newItem = {
          id: Utils.generateId(),
          url: url,
          name: (name?.trim() || Utils.getDomain(url)),
          status: 'todo',
          starred: false,
          tags: [],
          createdAt: now,
          updatedAt: now
        };
        
        items.unshift(newItem);
        await Storage.setItems(items);
        return newItem;
      }
    } catch (error) {
      console.error('Failed to add/update item:', error);
      throw error;
    }
  }
};

// Event Listeners
class BackgroundEventHandler {
  constructor() {
    this.setupEventListeners();
  }

  setupEventListeners() {
    // Extension installation
    chrome.runtime.onInstalled.addListener(this.handleInstallation.bind(this));
    
    // Context menu clicks
    chrome.contextMenus.onClicked.addListener(this.handleContextMenuClick.bind(this));
    
    // Runtime messages
    chrome.runtime.onMessage.addListener(this.handleMessage.bind(this));
    
    // Tab updates (for badge count)
    chrome.tabs.onActivated.addListener(() => BadgeManager.updateCount());
    chrome.tabs.onUpdated.addListener(() => BadgeManager.updateCount());
  }

  handleInstallation(details) {
    console.log('PrepTracker installed:', details.reason);
    
    // Create context menu
    chrome.contextMenus.create({
      id: CONFIG.CONTEXT_MENU_ID,
      title: 'Track this page',
      contexts: ['page', 'frame', 'selection', 'link', 'image', 'video', 'audio']
    });

    // Update badge count
    BadgeManager.updateCount();

    // Show welcome notification for new installations
    if (details.reason === 'install') {
      chrome.notifications?.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: 'PrepTracker Installed!',
        message: 'Right-click on any page to start tracking your learning resources.'
      });
    }
  }

  async handleContextMenuClick(info, tab) {
    if (info.menuItemId !== CONFIG.CONTEXT_MENU_ID) return;
    
    try {
      const url = tab?.url || info.pageUrl;
      const name = tab?.title;
      
      if (!url || !Utils.isValidUrl(url)) {
        console.warn('Invalid URL for context menu action:', url);
        BadgeManager.showError();
        return;
      }

      // Add or update the item
      const item = await ItemManager.addOrUpdateItem({ 
        url, 
        name, 
        fromContextMenu: true 
      });

      // Show success feedback
      BadgeManager.showSuccess();
      
      // Notify popup about the update
      Utils.safeSendMessage({ 
        type: 'tracked:updated', 
        payload: { 
          id: item.id,
          action: 'context-menu-add'
        } 
      });

      // Update badge count
      BadgeManager.updateCount();
      
      console.log('Successfully tracked page:', item.name);
      
    } catch (error) {
      console.error('Context menu track failed:', error);
      BadgeManager.showError();
      
      // Show error notification
      chrome.notifications?.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: 'Failed to Track Page',
        message: 'Could not track this page. Please try again.'
      });
    }
  }

  handleMessage(message, sender, sendResponse) {
    // Acknowledge messages to prevent errors
    if (!message?.type) {
      sendResponse({ ok: false, error: 'No message type' });
      return false;
    }

    switch (message.type) {
      case 'tracked:updated':
        // Update badge when items change
        BadgeManager.updateCount();
        sendResponse({ ok: true });
        break;
        
      case 'get:stats':
        // Provide stats to popup if needed
        this.handleStatsRequest(sendResponse);
        return true; // Will respond asynchronously
        
      case 'ping':
        sendResponse({ ok: true, timestamp: Utils.now() });
        break;
        
      default:
        sendResponse({ ok: true, message: 'Unknown message type' });
    }
    
    return false;
  }

  async handleStatsRequest(sendResponse) {
    try {
      const items = await Storage.getItems();
      const stats = {
        total: items.length,
        todo: items.filter(item => item.status === 'todo').length,
        inProgress: items.filter(item => item.status === 'in-progress').length,
        done: items.filter(item => item.status === 'done').length,
        starred: items.filter(item => item.starred).length
      };
      
      sendResponse({ ok: true, stats });
    } catch (error) {
      console.error('Failed to get stats:', error);
      sendResponse({ ok: false, error: 'Failed to get stats' });
    }
  }
}

// Startup Management
class BackgroundApp {
  constructor() {
    this.eventHandler = new BackgroundEventHandler();
  }

  async initialize() {
    console.log('PrepTracker background script initialized');
    
    // Update badge count on startup
    await BadgeManager.updateCount();
    
    // Clean up old data if needed (optional)
    // await this.performMaintenance();
  }

  async performMaintenance() {
    try {
      const items = await Storage.getItems();
      
      // Remove items older than 1 year (optional cleanup)
      const oneYearAgo = Utils.now() - (365 * 24 * 60 * 60 * 1000);
      const cleanedItems = items.filter(item => 
        item.updatedAt > oneYearAgo || item.starred
      );
      
      if (cleanedItems.length < items.length) {
        await Storage.setItems(cleanedItems);
        console.log(`Cleaned up ${items.length - cleanedItems.length} old items`);
      }
    } catch (error) {
      console.error('Maintenance failed:', error);
    }
  }
}

// Initialize the background application
const backgroundApp = new BackgroundApp();
backgroundApp.initialize();
