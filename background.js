// background.js
const STORAGE_KEY = 'trackedPages';

// Safely send a runtime message without throwing if no receiver is present
function safeSendMessage(msg) {
  try { chrome.runtime.sendMessage(msg, () => void chrome.runtime.lastError); } catch (e) {}
}

// Acknowledge messages so senders don't error out when background is awake
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && (msg.type === 'tracked:updated' || msg.type === 'ping')) {
    sendResponse({ ok: true });
  }
  return false;
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'track_page',
    title: 'Track Page',
    contexts: ['page', 'frame', 'selection', 'link', 'image', 'video', 'audio', 'editable', 'page_action', 'action']
  });
});

async function getItems() {
  const { [STORAGE_KEY]: data } = await chrome.storage.sync.get(STORAGE_KEY);
  return Array.isArray(data) ? data : [];
}
async function setItems(items) { await chrome.storage.sync.set({ [STORAGE_KEY]: items }); }

async function addOrTouchItem({ url, name }) {
  const items = await getItems();
  const now = Date.now();

  const existing = items.find(i => i.url === url);
  if (existing) {
    existing.updatedAt = now;
    await setItems(items);
    return existing;
  }

  const id = (crypto?.randomUUID?.() || `${now}-${Math.random().toString(36).slice(2)}`);
  const item = {
    id, url, name: name?.trim() || url,
    status: 'todo', starred: false, tags: [],
    createdAt: now, updatedAt: now
  };

  items.unshift(item);
  await setItems(items);
  return item;
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== 'track_page') return;
  try {
    const url = tab?.url || info.pageUrl;
    const name = tab?.title || url;
    if (!url) return;
    const item = await addOrTouchItem({ url, name });

    chrome.action.setBadgeText({ text: '✓' });
    chrome.action.setBadgeBackgroundColor({ color: '#2e7d32' });
    setTimeout(() => chrome.action.setBadgeText({ text: '' }), 1200);

    safeSendMessage({ type: 'tracked:updated', payload: { id: item.id } });
  } catch (e) {
    console.error('Track Page failed:', e);
  }
});
