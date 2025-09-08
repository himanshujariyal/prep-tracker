/**
 * Prep Tracker - Enhanced Popup Script
 * A modern, performant Chrome extension for tracking learning resources
 */

// Configuration and Constants
const CONFIG = {
  STORAGE_KEY: 'trackedPages',
  UI_STATE_KEY: 'prepTrackerUIState',
  MAX_OPEN_TABS: 15,
  MAX_TAG_SUGGESTIONS: 24,
  DEBOUNCE_DELAY: 300,
  ANIMATION_DURATION: 200,
  STATUS_TRANSITIONS: {
    'todo': 'in-progress',
    'in-progress': 'done',
    'done': 'todo'
  },
  STATUS_LABELS: {
    'todo': 'Not Started',
    'in-progress': 'In Progress', 
    'done': 'Done'
  }
};

// DOM Element Cache
const DOM = {
  list: document.getElementById('list'),
  nameInput: document.getElementById('nameInput'),
  tagsInput: document.getElementById('tagsInput'),
  saveCurrentBtn: document.getElementById('saveCurrent'),
  openAllBtn: document.getElementById('openAll'),
  statusFilter: document.getElementById('statusFilter'),
  sortBy: document.getElementById('sortBy'),
  searchInput: document.getElementById('search'),
  tagFilterInput: document.getElementById('tagFilter'),
  clearTagFilterBtn: document.getElementById('clearTagFilter'),
  exportBtn: document.getElementById('exportBtn'),
  importBtn: document.getElementById('importBtn'),
  importFile: document.getElementById('importFile'),
  tagSuggestions: document.getElementById('tagSuggestions'),
  openInTab: document.getElementById('openInTab')
};

// Application State
class AppState {
  constructor() {
    this.items = [];
    this.isLoading = false;
    this.lastSync = null;
  }

  updateItems(items) {
    this.items = items;
    this.lastSync = Date.now();
    this.render();
  }

  render() {
    UI.renderItemList();
    UI.renderTagSuggestions();
    UI.updateStats();
  }
}

// UI State Management
class UIState {
  constructor() {
    this.defaultState = {
      statusFilter: 'all',
      sortBy: 'updatedDesc',
      searchQuery: '',
      tagFilter: ''
    };
  }

  async saveState() {
    try {
      const currentState = {
        statusFilter: DOM.statusFilter?.value || this.defaultState.statusFilter,
        sortBy: DOM.sortBy?.value || this.defaultState.sortBy,
        searchQuery: DOM.searchInput?.value || this.defaultState.searchQuery,
        tagFilter: DOM.tagFilterInput?.value || this.defaultState.tagFilter
      };
      
      await chrome.storage.local.set({ [CONFIG.UI_STATE_KEY]: currentState });
    } catch (error) {
      console.warn('Failed to save UI state:', error);
    }
  }

  async restoreState() {
    try {
      const result = await chrome.storage.local.get(CONFIG.UI_STATE_KEY);
      const savedState = result[CONFIG.UI_STATE_KEY] || this.defaultState;
      
      // Apply saved state to DOM elements
      if (DOM.statusFilter && savedState.statusFilter) {
        DOM.statusFilter.value = savedState.statusFilter;
      }
      if (DOM.sortBy && savedState.sortBy) {
        DOM.sortBy.value = savedState.sortBy;
      }
      if (DOM.searchInput && savedState.searchQuery) {
        DOM.searchInput.value = savedState.searchQuery;
      }
      if (DOM.tagFilterInput && savedState.tagFilter) {
        DOM.tagFilterInput.value = savedState.tagFilter;
      }
    } catch (error) {
      console.warn('Failed to restore UI state:', error);
    }
  }
}

const state = new AppState();
const uiState = new UIState();

// Enhanced Utility Functions
const Utils = {
  // Safe chrome runtime messaging
  async safeSendMessage(msg) {
    try {
      return new Promise((resolve) => {
        chrome.runtime.sendMessage(msg, (response) => {
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

  // Cycle through status values
  cycleStatus(currentStatus) {
    return CONFIG.STATUS_TRANSITIONS[currentStatus] || 'todo';
  },

  // Parse tags from string input
  parseTags(tagString) {
    if (!tagString?.trim()) return [];
    return [...new Set(
      tagString
        .split(/[,\s]+/)
        .map(tag => tag.trim().toLowerCase())
        .filter(Boolean)
    )];
  },

  // Convert tags array to display string
  tagsToString(tags) {
    return (tags || []).join(', ');
  },

  // Debounce function for input handlers
  debounce(func, delay) {
    let timeoutId;
    return (...args) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
  },

  // Format date for display
  formatDate(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  },

  // Validate URL
  isValidUrl(string) {
    try {
      new URL(string);
      return true;
    } catch {
      return false;
    }
  }
};

// Enhanced Storage Management
const Storage = {
  async getItems() {
    try {
      state.isLoading = true;
      const result = await chrome.storage.sync.get(CONFIG.STORAGE_KEY);
      const data = result[CONFIG.STORAGE_KEY];
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.error('Failed to get items from storage:', error);
      return [];
    } finally {
      state.isLoading = false;
    }
  },

  async setItems(items) {
    try {
      if (!Array.isArray(items)) {
        throw new Error('Items must be an array');
      }

      await chrome.storage.sync.set({ [CONFIG.STORAGE_KEY]: items });
      await Utils.safeSendMessage({ type: 'tracked:updated' });
      return true;
    } catch (error) {
      console.error('Failed to save items to storage:', error);
      UI.showNotification('Failed to save changes', 'error');
      return false;
    }
  },

  async saveItem(item) {
    const items = await this.getItems();
    const index = items.findIndex(i => i.id === item.id);
    
    if (index !== -1) {
      items[index] = { ...item, updatedAt: Utils.now() };
    } else {
      items.unshift({ ...item, updatedAt: Utils.now() });
    }
    
    const success = await this.setItems(items);
    if (success) {
      state.updateItems(items);
    }
    return success;
  },

  async deleteItem(itemId) {
    const items = await this.getItems();
    const filteredItems = items.filter(item => item.id !== itemId);
    
    const success = await this.setItems(filteredItems);
    if (success) {
      state.updateItems(filteredItems);
    }
    return success;
  }
};

// Tag Management
const TagManager = {

  // Collect all existing tags with usage counts
  collectAllTags(items) {
    const tagCounts = new Map();
    
    items.forEach(item => {
      (item.tags || []).forEach(tag => {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      });
    });

    // Sort by frequency (desc) then alphabetically
    return Array.from(tagCounts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([tag, count]) => ({ tag, count }));
  },

  // Get tag suggestions based on current input
  getTagSuggestions(currentInput, allTags) {
    const currentTags = new Set(Utils.parseTags(currentInput));
    const query = currentInput.split(/[,\s]+/).pop()?.toLowerCase() || '';
    
    return allTags
      .filter(({ tag }) => !currentTags.has(tag))
      .filter(({ tag }) => !query || tag.includes(query))
      .slice(0, CONFIG.MAX_TAG_SUGGESTIONS);
  },

  // Add tag to current input
  addTagToInput(tagToAdd) {
    const currentValue = DOM.tagsInput.value;
    const existingTags = new Set(Utils.parseTags(currentValue));
    
    if (!existingTags.has(tagToAdd)) {
      existingTags.add(tagToAdd);
      DOM.tagsInput.value = Array.from(existingTags).join(', ');
      UI.renderTagSuggestions();
    }
  },

  // Remove tag from current input
  removeTagFromInput(tagToRemove) {
    const currentValue = DOM.tagsInput.value;
    const existingTags = new Set(Utils.parseTags(currentValue));
    
    existingTags.delete(tagToRemove);
    DOM.tagsInput.value = Array.from(existingTags).join(', ');
    UI.renderTagSuggestions();
  }
};

// UI Management
const UI = {

  // Show notification to user
  showNotification(message, type = 'info') {
    // Create or update notification element
    let notification = document.querySelector('.notification');
    if (!notification) {
      notification = document.createElement('div');
      notification.className = 'notification';
      document.body.appendChild(notification);
    }
    
    notification.textContent = message;
    notification.className = `notification ${type}`;
    notification.style.display = 'block';
    
    // Auto-hide after 3 seconds
    setTimeout(() => {
      notification.style.display = 'none';
    }, 3000);
  },

  // Render tag suggestions
  renderTagSuggestions() {
    if (!DOM.tagSuggestions) return;

    const allTags = TagManager.collectAllTags(state.items);
    DOM.tagSuggestions.innerHTML = '';

    if (!allTags.length) {
      DOM.tagSuggestions.parentElement.style.display = 'none';
      return;
    }

    DOM.tagSuggestions.parentElement.style.display = 'grid';
    const selectedTags = new Set(Utils.parseTags(DOM.tagsInput.value));
    const suggestions = TagManager.getTagSuggestions(DOM.tagsInput.value, allTags);

    suggestions.forEach(({ tag, count }) => {
      const chip = this.createTagChip(tag, count, selectedTags.has(tag));
      DOM.tagSuggestions.appendChild(chip);
    });
  },

  // Create a tag suggestion chip
  createTagChip(tag, count, isSelected) {
    const chip = document.createElement('span');
    chip.className = `sugg${isSelected ? ' selected' : ''}`;
    chip.textContent = tag;
    chip.title = `${tag} (used ${count} times) - Click to ${isSelected ? 'remove' : 'add'}`;
    
    chip.addEventListener('click', () => {
      if (isSelected) {
        TagManager.removeTagFromInput(tag);
      } else {
        TagManager.addTagToInput(tag);
      }
    });

    return chip;
  },

  // Update statistics display
  updateStats() {
    const stats = this.calculateStats(state.items);
    // Update badge or stats display if needed
    console.log('Stats:', stats);
  },

  // Calculate statistics
  calculateStats(items) {
    return {
      total: items.length,
      todo: items.filter(item => item.status === 'todo').length,
      inProgress: items.filter(item => item.status === 'in-progress').length,
      done: items.filter(item => item.status === 'done').length,
      starred: items.filter(item => item.starred).length
    };
  },

  // Apply all active filters to items
  applyFilters(items) {
    let filtered = [...items];

    // Status filter
    const statusFilter = DOM.statusFilter.value;
    if (statusFilter !== 'all') {
      filtered = filtered.filter(item => item.status === statusFilter);
    }

    // Search filter
    const searchQuery = DOM.searchInput.value.trim().toLowerCase();
    if (searchQuery) {
      filtered = filtered.filter(item =>
        item.name.toLowerCase().includes(searchQuery) ||
        item.url.toLowerCase().includes(searchQuery) ||
        (item.tags || []).some(tag => tag.includes(searchQuery))
      );
    }

    // Tag filter
    const tagQuery = Utils.parseTags(DOM.tagFilterInput.value);
    if (tagQuery.length) {
      filtered = filtered.filter(item =>
        tagQuery.every(tag => (item.tags || []).includes(tag))
      );
    }

    // Sort items
    const sortBy = DOM.sortBy.value;
    this.sortItems(filtered, sortBy);

    return filtered;
  },

  // Sort items by specified criteria
  sortItems(items, criteria) {
    switch (criteria) {
      case 'updatedDesc':
        items.sort((a, b) => b.updatedAt - a.updatedAt);
        break;
      case 'createdDesc':
        items.sort((a, b) => b.createdAt - a.createdAt);
        break;
      case 'starredFirst':
        items.sort((a, b) => (b.starred - a.starred) || (b.updatedAt - a.updatedAt));
        break;
      case 'nameAsc':
        items.sort((a, b) => a.name.localeCompare(b.name));
        break;
      default:
        break;
    }
  },

  // Render the main item list
  renderItemList() {
    if (!DOM.list) return;

    DOM.list.innerHTML = '';
    const filteredItems = this.applyFilters(state.items);

    if (filteredItems.length === 0) {
      this.renderEmptyState();
      return;
    }

    // Use document fragment for better performance
    const fragment = document.createDocumentFragment();
    filteredItems.forEach(item => {
      const card = this.createItemCard(item);
      fragment.appendChild(card);
    });
    
    DOM.list.appendChild(fragment);
  },

  // Render empty state
  renderEmptyState() {
    const empty = document.createElement('div');
    empty.className = 'card empty-state';
    empty.innerHTML = `
      <div class="empty-message">
        <h3>No tracked pages found</h3>
        <p>Try adjusting your filters or track your first page!</p>
      </div>
    `;
    DOM.list.appendChild(empty);
  },

  // Create an item card element
  createItemCard(item) {
    const card = document.createElement('div');
    card.className = 'card';
    card.dataset.itemId = item.id;

    card.innerHTML = `
      <div class="card-header">
        <div class="name" title="${item.name}">${item.name}</div>
      </div>
      <div class="url" title="${item.url}">${item.url}</div>
      <div class="statusbar">
        <span class="status-chip ${item.status}">${CONFIG.STATUS_LABELS[item.status]}</span>
        <button class="chip-btn progress-btn" title="Cycle Status">⟳</button>
        <button class="chip-btn done-btn" title="Mark Done">✓</button>
        <span class="date-info">${Utils.formatDate(item.updatedAt)}</span>
      </div>
      <div class="tags">
        ${(item.tags || []).map(tag => 
          `<span class="tag" data-tag="${tag}" title="Filter by tag: ${tag}">${tag}</span>`
        ).join('')}
      </div>
      <div class="actions">
        <button class="icon star-btn ${item.starred ? 'starred' : ''}" title="Star / Unstar">★</button>
        <button class="icon open-btn" title="Open in new tab">↗</button>
        <button class="icon edit-btn" title="Rename">✎</button>
        <button class="icon tags-btn" title="Edit tags">🏷</button>
        <button class="icon delete-btn" title="Delete">🗑</button>
      </div>
    `;

    this.attachCardEventListeners(card, item);
    return card;
  },

  // Attach event listeners to card buttons
  attachCardEventListeners(card, item) {
    // Star button
    card.querySelector('.star-btn').addEventListener('click', async () => {
      item.starred = !item.starred;
      await Storage.saveItem(item);
    });

    // Open button
    card.querySelector('.open-btn').addEventListener('click', () => {
      chrome.tabs.create({ url: item.url });
    });

    // Edit name button
    card.querySelector('.edit-btn').addEventListener('click', async () => {
      const newName = prompt('Rename item:', item.name);
      if (newName?.trim()) {
        item.name = newName.trim();
        await Storage.saveItem(item);
      }
    });

    // Edit tags button
    card.querySelector('.tags-btn').addEventListener('click', async () => {
      const currentTags = Utils.tagsToString(item.tags || []);
      const newTags = prompt('Edit tags (comma or space separated):', currentTags);
      if (newTags !== null) {
        item.tags = Utils.parseTags(newTags);
        await Storage.saveItem(item);
      }
    });

    // Delete button
    card.querySelector('.delete-btn').addEventListener('click', async () => {
      if (confirm(`Are you sure you want to delete "${item.name}"?`)) {
        await Storage.deleteItem(item.id);
      }
    });

    // Progress button
    card.querySelector('.progress-btn').addEventListener('click', async () => {
      item.status = Utils.cycleStatus(item.status);
      await Storage.saveItem(item);
    });

    // Mark done button
    card.querySelector('.done-btn').addEventListener('click', async () => {
      if (item.status !== 'done') {
        item.status = 'done';
        await Storage.saveItem(item);
      }
    });

    // Tag click handlers
    card.querySelectorAll('.tag').forEach(tagElement => {
      tagElement.addEventListener('click', () => {
        const tag = tagElement.dataset.tag;
        DOM.tagFilterInput.value = tag;
        state.render();
        uiState.saveState();
      });
    });
  }
};

// Application Initialization and Event Handlers
class PrepTrackerApp {
  constructor() {
    this.debouncedRender = Utils.debounce(() => state.render(), CONFIG.DEBOUNCE_DELAY);
    this.debouncedTagRender = Utils.debounce(() => UI.renderTagSuggestions(), CONFIG.DEBOUNCE_DELAY);
  }

  async initialize() {
    try {
      // Load initial data
      const items = await Storage.getItems();
      
      // Restore UI state before updating items (so filters are applied correctly)
      await uiState.restoreState();
      
      state.updateItems(items);

      // Set current tab info
      await this.setCurrentTabInfo();

      // Attach event listeners
      this.attachEventListeners();

      console.log('PrepTracker initialized successfully');
    } catch (error) {
      console.error('Failed to initialize PrepTracker:', error);
      UI.showNotification('Failed to initialize app', 'error');
    }
  }

  async setCurrentTabInfo() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.title) {
        const truncatedTitle = tab.title.length > 40 ? 
          tab.title.slice(0, 40) + '...' : tab.title;
        DOM.nameInput.placeholder = `Custom name (default: "${truncatedTitle}")`;
      }
    } catch (error) {
      console.warn('Could not get current tab info:', error);
    }
  }

  attachEventListeners() {
    // Save current page
    DOM.saveCurrentBtn?.addEventListener('click', this.handleSaveCurrentPage.bind(this));

    // Open all pages
    DOM.openAllBtn?.addEventListener('click', this.handleOpenAll.bind(this));

    // Open in tab
    DOM.openInTab?.addEventListener('click', () => {
      const url = chrome.runtime.getURL('popup.html');
      chrome.tabs.create({ url });
    });

    // Filter and search handlers with state persistence
    DOM.statusFilter?.addEventListener('change', () => {
      this.debouncedRender();
      uiState.saveState();
    });
    DOM.sortBy?.addEventListener('change', () => {
      this.debouncedRender();
      uiState.saveState();
    });
    DOM.searchInput?.addEventListener('input', () => {
      this.debouncedRender();
      uiState.saveState();
    });
    DOM.tagFilterInput?.addEventListener('input', () => {
      this.debouncedRender();
      uiState.saveState();
    });

    // Tag input handler
    DOM.tagsInput?.addEventListener('input', this.debouncedTagRender);

    // Clear tag filter
    DOM.clearTagFilterBtn?.addEventListener('click', () => {
      DOM.tagFilterInput.value = '';
      state.render();
      uiState.saveState();
    });

    // Import/Export
    DOM.exportBtn?.addEventListener('click', this.handleExport.bind(this));
    DOM.importBtn?.addEventListener('click', () => DOM.importFile?.click());
    DOM.importFile?.addEventListener('change', this.handleImport.bind(this));

    // Runtime message listener
    chrome.runtime.onMessage.addListener((message) => {
      if (message?.type === 'tracked:updated') {
        this.refreshItems();
      }
    });
  }

  async handleSaveCurrentPage() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.url || !Utils.isValidUrl(tab.url)) {
        UI.showNotification('Invalid page URL', 'error');
        return;
      }

      const items = await Storage.getItems();
      const existing = items.find(item => item.url === tab.url);

      const itemData = {
        url: tab.url,
        name: (DOM.nameInput.value.trim() || tab.title || tab.url).trim(),
        tags: Utils.parseTags(DOM.tagsInput.value)
      };

      if (existing) {
        // Update existing item
        existing.name = itemData.name;
        existing.tags = [...new Set([...(existing.tags || []), ...itemData.tags])];
        existing.updatedAt = Utils.now();
        await Storage.saveItem(existing);
        UI.showNotification('Page updated successfully!', 'success');
      } else {
        // Create new item
        const newItem = {
          id: Utils.generateId(),
          ...itemData,
          status: 'todo',
          starred: false,
          createdAt: Utils.now(),
          updatedAt: Utils.now()
        };
        await Storage.saveItem(newItem);
        UI.showNotification('Page tracked successfully!', 'success');
      }

      // Clear inputs
      DOM.nameInput.value = '';
      DOM.tagsInput.value = '';
      UI.renderTagSuggestions();

    } catch (error) {
      console.error('Failed to save current page:', error);
      UI.showNotification('Failed to save page', 'error');
    }
  }

  async handleOpenAll() {
    try {
      const filteredItems = UI.applyFilters(state.items)
        .filter(item => item.status !== 'done')
        .slice(0, CONFIG.MAX_OPEN_TABS);

      if (filteredItems.length === 0) {
        UI.showNotification('No pages to open', 'info');
        return;
      }

      if (filteredItems.length > 10) {
        const proceed = confirm(`This will open ${filteredItems.length} tabs. Continue?`);
        if (!proceed) return;
      }

      filteredItems.forEach(item => {
        chrome.tabs.create({ url: item.url, active: false });
      });

      UI.showNotification(`Opened ${filteredItems.length} tabs`, 'success');
    } catch (error) {
      console.error('Failed to open tabs:', error);
      UI.showNotification('Failed to open tabs', 'error');
    }
  }

  async handleExport() {
    try {
      const items = await Storage.getItems();
      const exportData = {
        version: '2.0',
        timestamp: new Date().toISOString(),
        items: items
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { 
        type: 'application/json' 
      });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `prep-tracker-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      
      URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      UI.showNotification('Export completed successfully!', 'success');
    } catch (error) {
      console.error('Export failed:', error);
      UI.showNotification('Export failed', 'error');
    }
  }

  async handleImport() {
    try {
      const file = DOM.importFile.files[0];
      if (!file) return;

      const text = await file.text();
      const data = JSON.parse(text);

      // Handle different import formats
      let itemsToImport;
      if (data.version && data.items) {
        itemsToImport = data.items; // New format
      } else if (Array.isArray(data)) {
        itemsToImport = data; // Legacy format
      } else {
        throw new Error('Invalid file format');
      }

      // Validate and clean data
      const cleanedItems = itemsToImport.map(item => ({
        ...item,
        id: item.id || Utils.generateId(),
        tags: Array.isArray(item.tags) ? item.tags : [],
        createdAt: item.createdAt || Utils.now(),
        updatedAt: item.updatedAt || Utils.now(),
        status: ['todo', 'in-progress', 'done'].includes(item.status) ? item.status : 'todo',
        starred: Boolean(item.starred)
      }));

      await Storage.setItems(cleanedItems);
      state.updateItems(cleanedItems);
      
      UI.showNotification(`Import completed! ${cleanedItems.length} items imported.`, 'success');
    } catch (error) {
      console.error('Import failed:', error);
      UI.showNotification('Import failed. Please check the file format.', 'error');
    } finally {
      DOM.importFile.value = '';
    }
  }

  async refreshItems() {
    const items = await Storage.getItems();
    state.updateItems(items);
  }
}

// Initialize the application
const app = new PrepTrackerApp();
app.initialize();
