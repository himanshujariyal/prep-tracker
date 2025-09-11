# Bookmark++ (Chrome Extension)

Download from store: https://chromewebstore.google.com/detail/ijicfkajaockoebpkgfdjoejgfiombhf

🚀 **Next-generation bookmarks for learners** - A modern Chrome extension to organize your learning resources with intelligent tagging, status tracking, and advanced filtering.

<div align="center">
  <img src="images/popup-view.png" alt="Popup view" width="400"/>
</div>

## ✨ Key Features

### Core Functionality
- **One-click page tracking** via popup or right-click context menu
- **Smart status management** (Not Started → In Progress → Done)  
- **Intelligent tagging system** with auto-suggestions from your history
- **Advanced filtering** by status, tags, and search terms
- **Bulk operations** - open multiple tracked pages at once
- **Data portability** - import/export your collection as JSON

### Enhanced User Experience
- **Persistent UI state** - your filter selections are remembered
- **Real-time notifications** for action feedback
- **Responsive design** that adapts to different screen sizes
- **Smooth animations** and visual feedback
- **Right-aligned action buttons** for cleaner card layout
- **Human-readable timestamps** (Today, Yesterday, etc.)

### Smart Organization
- **Tag suggestions** based on your existing collection
- **Status workflow** with inline quick actions
- **Star system** for marking important resources
- **Search across** names, URLs, and tags
- **Sort options** - recently updated, added, starred first, alphabetical

## 🔧 Installation

1. **Download** the latest release or clone this repository
2. **Open Chrome** and navigate to `chrome://extensions/`
3. **Enable Developer mode** (toggle in top-right corner)
4. **Click "Load unpacked"** and select the extension folder
5. **Pin the extension** to your toolbar for easy access

## 📖 Quick Start

### Basic Usage
1. **Track current page**: Click extension icon → "Track Current Page"
2. **Add tags**: Use the tags input for better organization  
3. **Right-click tracking**: Right-click any page → "Track this page"
4. **Manage items**: Use the card buttons to update status, edit, or delete

### Power Features
- **Open All**: Bulk open non-completed items (up to 15 tabs)
- **Full Page Mode**: Click "Open Full Page" for expanded workspace
- **Tag Filtering**: Click any tag to filter by that tag
- **Status Workflow**: Use ⟳ to cycle through statuses or ✓ to mark done
- **Quick Search**: Search across names, URLs, and tags simultaneously

## 🎯 Card Layout

Each tracked item displays in this clean layout:
1. **Title** - Custom name or page title
2. **URL** - Full page address  
3. **Status Bar** - Current status with quick action buttons
4. **Tags** - Clickable tags for filtering
5. **Actions** - Right-aligned buttons (★, ↗, ✎, 🏷, 🗑)

## 🔍 Data Model

Each tracked item is stored as JSON in `chrome.storage.sync`:

```javascript
{
  id: "unique-id",          // UUID or timestamp-based ID
  url: "https://example.com", // Full page URL
  name: "Custom Name",      // User-editable display name
  status: "todo",           // "todo" | "in-progress" | "done"
  starred: false,           // Boolean favorite flag
  tags: ["react", "tutorial"], // Array of lowercase tag strings
  createdAt: 1694476800000, // Timestamp when first tracked
  updatedAt: 1694476800000  // Timestamp of last modification
}
```

> 💾 **Data Storage**: Uses Chrome's sync storage - your data syncs across devices and persists across browser sessions (subject to Chrome's sync quotas).

## 🚀 Technical Architecture

### Modern JavaScript Implementation
- **ES6+ features** - Classes, async/await, arrow functions, destructuring
- **Modular design** - Separate modules for UI, Storage, TagManager, Utils
- **State management** - Centralized app state with predictable updates
- **Error handling** - Comprehensive try-catch blocks with user feedback
- **Performance optimized** - Debounced inputs, document fragments, efficient DOM updates

### UI/UX Enhancements
- **Notification system** - Toast messages for user feedback
- **Loading states** - Visual indicators during operations
- **Smooth animations** - CSS transitions and transforms
- **Accessibility** - ARIA labels, keyboard navigation, high contrast support
- **Responsive design** - Adapts from 380px to 720px+ widths
- **Empty states** - Helpful messages when no items match filters

### Storage & Data Management
- **Dual storage strategy** - Main data in sync storage, UI state in local storage
- **Data validation** - Input sanitization and error recovery
- **Import/Export** - JSON format with metadata and versioning
- **Cross-tab sync** - Real-time updates via chrome.runtime messaging
- **Backup-friendly** - Human-readable export format

## ⌨️ Keyboard & Power Tips

- **Bulk Operations**: "Open All" opens up to 15 non-completed items
- **Smart Search**: Matches across names, URLs, and tags simultaneously
- **Tag Logic**: Tag filtering uses AND logic (all specified tags must match)
- **Quick Filtering**: Click any tag to instantly filter by that tag
- **Persistent State**: All filter selections are remembered between sessions
- **Status Shortcuts**: Use ⟳ to cycle through statuses, ✓ to mark complete
- **Context Menu**: Right-click any page to quickly add to your collection

## 🔧 Browser Compatibility

- **Chrome 88+** (Manifest V3 support)
- **Edge 88+** (Chromium-based)
- **Opera 74+** (Chromium-based)

## 📁 Project Structure

```
prep-tracker/
├── manifest.json       # Extension configuration (Manifest V3)
├── background.js       # Service worker with context menu & messaging
├── popup.html         # Main interface markup
├── popup.css          # Dark theme styling with CSS variables
├── popup.js           # Enhanced frontend logic (ES6+ classes)
├── icons/             # Extension icons (16px to 128px)
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
└── images/
    └── popup-view.png # README screenshot
```

## 🔒 Permissions

The extension requires these permissions:
- **`storage`** - Save your reading list and preferences
- **`tabs`** - Read current tab info and open tracked links
- **`contextMenus`** - Add right-click "Track this page" option
- **`host_permissions: <all_urls>`** - Allow tracking any website

## 🐛 Troubleshooting

### Common Issues

**Extension not loading?**
- Ensure Developer mode is enabled in `chrome://extensions`
- Check that all files are present and properly structured
- Look for errors in the browser console

**Data not syncing?**
- Verify Chrome sync is enabled in browser settings
- Check extension permissions in `chrome://extensions`
- Try export/import as a manual sync method

**Performance issues?**
- Large collections (1000+ items) may load slower
- Consider using export/cleanup for old items
- Restart browser if memory usage seems high

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes with proper documentation
4. Test across different browser versions
5. Submit a pull request with a clear description

### Development Guidelines
- Follow existing ES6+ patterns and code style
- Add JSDoc comments for new functions
- Test UI changes across different screen sizes
- Update README if adding new features

## 📄 License

MIT License - feel free to use, modify, and distribute.

## 🙏 Acknowledgments

- Chrome Extension APIs for powerful browser integration
- Modern web standards for enhanced user experience
- Open source community for inspiration and best practices

---

**Version 2.0** - Enhanced with modern JavaScript, improved UX, persistent UI state, and comprehensive error handling.

## Keyboard & Power Tips

- The popup’s **Open All** opens up to 10 non‑done items at once.
- Use **search** to match both names and URLs.
- **Tag filtering** matches all specified tags (AND logic).

## Data Model

Each tracked item is stored under `chrome.storage.sync` as part of `trackedPages` array:

```json
{
  "id": "uuid",
  "url": "https://…",
  "name": "Custom label",
  "status": "todo | in-progress | done",
  "starred": false,
  "tags": ["react","performance"],
  "createdAt": 1731000000000,
  "updatedAt": 1731000000000
}
```

> Your data stays in your browser profile’s synced storage (subject to Chrome’s sync quotas).

## Permissions

- `storage` — to save your reading list
- `tabs` — to read current tab URL/title and open links
- `contextMenus` — to add the right-click **Track Page** action
- `host_permissions: <all_urls>` — to allow saving any page

## Folder Structure

```
prep-page-tracker/
├─ manifest.json
├─ background.js
├─ popup.html
├─ popup.css
├─ popup.js
├─ icons/
│  ├─ icon16.png
│  ├─ icon32.png
│  ├─ icon48.png
│  └─ icon128.png
└─ images/
   ├─ popup-view.png
```

## Development

- Edit files, then in `chrome://extensions` click **Reload** on the extension.
- The UI is plain HTML/CSS/JS (no frameworks).
- Styling uses a dark theme with CSS variables (`popup.css`).

## License

MIT — or update to your preferred license.
