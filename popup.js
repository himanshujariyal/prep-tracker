// popup.js
const STORAGE_KEY = 'trackedPages';

const listEl = document.getElementById('list');
const nameInput = document.getElementById('nameInput');
const tagsInput = document.getElementById('tagsInput');
const saveCurrentBtn = document.getElementById('saveCurrent');
const openAllBtn = document.getElementById('openAll');
const statusFilter = document.getElementById('statusFilter');
const sortBy = document.getElementById('sortBy');
const searchInput = document.getElementById('search');
const tagFilterInput = document.getElementById('tagFilter');
const clearTagFilterBtn = document.getElementById('clearTagFilter');
const exportBtn = document.getElementById('exportBtn');
const importBtn = document.getElementById('importBtn');
const importFile = document.getElementById('importFile');
const tagSuggestionsEl = document.getElementById('tagSuggestions');
const openInTabBtn = document.getElementById('openInTab');

let ITEMS = [];

// Safely send a runtime message without throwing if no receiver is present
function safeSendMessage(msg) {
  try { chrome.runtime.sendMessage(msg, () => void chrome.runtime.lastError); } catch (e) {}
}

// Storage helpers
async function getItems() {
  const { [STORAGE_KEY]: data } = await chrome.storage.sync.get(STORAGE_KEY);
  return Array.isArray(data) ? data : [];
}
async function setItems(items) {
  await chrome.storage.sync.set({ [STORAGE_KEY]: items });
  safeSendMessage({ type: 'tracked:updated' });
}
function updateLocal(items) { ITEMS = items; render();
  renderTagSuggestions(); }

// Utils
function id() { const n = Date.now(); return (crypto?.randomUUID?.() || `${n}-${Math.random().toString(36).slice(2)}`); }
function now() { return Date.now(); }
function cycleStatus(s) { if (s==='todo') return 'in-progress'; if (s==='in-progress') return 'done'; return 'todo'; }
function parseTags(str) { if (!str) return []; return [...new Set(str.split(/[,\s]+/).map(t => t.trim().toLowerCase()).filter(Boolean))]; }
function tagsToString(tags) { return (tags||[]).join(', '); }
// Collect all existing tags with counts
function collectAllTags(items) {
  const counts = {};
  for (const it of items) {
    for (const t of (it.tags||[])) counts[t] = (counts[t] || 0) + 1;
  }
  // sort by frequency desc, then alphabetically
  return Object.entries(counts)
    .sort((a,b) => (b[1]-a[1]) || a[0].localeCompare(b[0]))
    .map(([tag,count]) => ({ tag, count }));
}

// Render selectable suggestion chips under the input
function renderTagSuggestions() {
  if (!tagSuggestionsEl) return;
  const all = collectAllTags(ITEMS);
  tagSuggestionsEl.innerHTML = '';
  if (!all.length) {
    tagSuggestionsEl.parentElement.style.display = 'none';
    return;
  }
  tagSuggestionsEl.parentElement.style.display = 'grid';

  const selected = new Set(parseTags(tagsInput.value));
  // show up to 24 suggestions
  for (const { tag } of all.slice(0, 24)) {
    const chip = document.createElement('span');
    chip.className = 'sugg' + (selected.has(tag) ? ' selected' : '');
    chip.textContent = tag;
    chip.title = `Use tag: ${tag}`;
    chip.addEventListener('click', () => {
      const set = new Set(parseTags(tagsInput.value));
      if (set.has(tag)) set.delete(tag); else set.add(tag);
      tagsInput.value = Array.from(set).join(', ');
      renderTagSuggestions();
    });
    tagSuggestionsEl.appendChild(chip);
  }
}


// Load
(async function init() {
  ITEMS = await getItems();
  render();
  renderTagSuggestions();
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.title) nameInput.placeholder = `Custom name (default: "${tab.title.slice(0, 40)}")`;
  } catch {}
})();

// Open full-page
openInTabBtn?.addEventListener('click', () => {
  const url = chrome.runtime.getURL('popup.html');
  chrome.tabs.create({ url });
});

// Listen for background updates
chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === 'tracked:updated') getItems().then(updateLocal);
});

// Actions
saveCurrentBtn.addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url) return;

  const items = await getItems();
  const existing = items.find(i => i.url === tab.url);

  const base = {
    url: tab.url,
    name: (nameInput.value || tab.title || tab.url).trim(),
    tags: parseTags(tagsInput.value)
  };

  if (existing) {
    existing.name = base.name;
    const tagset = new Set([...(existing.tags||[]), ...base.tags]);
    existing.tags = Array.from(tagset);
    existing.updatedAt = now();
  } else {
    items.unshift({
      id: id(), url: base.url, name: base.name,
      status: 'todo', starred: false, tags: base.tags,
      createdAt: now(), updatedAt: now()
    });
  }

  await setItems(items);
  nameInput.value = ''; tagsInput.value = '';
  updateLocal(items);
});

openAllBtn.addEventListener('click', () => {
  const filtered = applyFilters(ITEMS).filter(i => i.status !== 'done');
  filtered.slice(0, 10).forEach(i => chrome.tabs.create({ url: i.url }));
});

statusFilter.addEventListener('change', render);
sortBy.addEventListener('change', render);
searchInput.addEventListener('input', render);
tagFilterInput.addEventListener('input', render);

tagsInput.addEventListener('input', renderTagSuggestions);
clearTagFilterBtn.addEventListener('click', () => { tagFilterInput.value=''; render();
  renderTagSuggestions(); });

// Export/Import
exportBtn.addEventListener('click', async (e) => {
  e.preventDefault();
  const data = await getItems();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: 'prep-tracker.json' });
  document.body.appendChild(a); a.click(); URL.revokeObjectURL(url); a.remove();
});
importBtn.addEventListener('click', (e) => { e.preventDefault(); importFile.click(); });
importFile.addEventListener('change', async () => {
  const file = importFile.files[0]; if (!file) return;
  const text = await file.text();
  try {
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) throw new Error('Invalid file');
    for (const it of parsed) if (!Array.isArray(it.tags)) it.tags = [];
    await setItems(parsed); updateLocal(parsed);
  } catch (e) {
    alert('Import failed. Make sure it is a JSON export from this extension.');
  } finally { importFile.value = ''; }
});

// Rendering
function applyFilters(items) {
  let out = [...items];

  const status = statusFilter.value;
  if (status !== 'all') out = out.filter(i => i.status === status);

  const q = searchInput.value.trim().toLowerCase();
  if (q) out = out.filter(i => i.name.toLowerCase().includes(q) || i.url.toLowerCase().includes(q));

  const tagQ = parseTags(tagFilterInput.value);
  if (tagQ.length) out = out.filter(i => tagQ.every(t => (i.tags||[]).includes(t)));

  const s = sortBy.value;
  if (s === 'updatedDesc') out.sort((a,b)=>b.updatedAt-a.updatedAt);
  if (s === 'createdDesc') out.sort((a,b)=>b.createdAt-a.createdAt);
  if (s === 'starredFirst') out.sort((a,b)=>(b.starred-a.starred)|| (b.updatedAt-a.updatedAt));
  if (s === 'nameAsc') out.sort((a,b)=>a.name.localeCompare(b.name));

  return out;
}

function render() {
  listEl.innerHTML = '';
  const items = applyFilters(ITEMS);

  if (items.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'card';
    empty.textContent = 'No tracked pages match the current filters.';
    listEl.appendChild(empty);
    return;
  }

  for (const item of items) listEl.appendChild(renderCard(item));
}

function renderCard(item) {
  const card = document.createElement('div');
  card.className = 'card';

  const top = document.createElement('div');
  top.className = 'top';

  const name = document.createElement('div');
  name.className = 'name';
  name.textContent = item.name;

  const star = button('★', 'icon' + (item.starred ? ' starred' : ''), 'Star / Unstar');
  star.addEventListener('click', async () => { item.starred = !item.starred; item.updatedAt = now(); await saveItem(item); });

  const visitBtn = button('Visit', 'icon visit', 'Visit site');
  visitBtn.addEventListener('click', () => chrome.tabs.create({ url: item.url }));

  const openBtn = button('↗', 'icon open', 'Open in new tab');
  openBtn.addEventListener('click', () => chrome.tabs.create({ url: item.url }));

  const editBtn = button('✎', 'icon edit', 'Rename');
  editBtn.addEventListener('click', async () => {
    const newName = prompt('Rename', item.name);
    if (newName && newName.trim()) { item.name = newName.trim(); item.updatedAt = now(); await saveItem(item); }
  });

  const tagsEdit = button('🏷', 'icon edit', 'Edit tags');
  tagsEdit.addEventListener('click', async () => {
    const current = tagsToString(item.tags||[]);
    const val = prompt('Edit tags (comma or space separated)', current);
    if (val !== null) { item.tags = parseTags(val); item.updatedAt = now(); await saveItem(item); }
  });

  const delBtn = button('🗑', 'icon delete', 'Delete');
  delBtn.addEventListener('click', async () => { await deleteItem(item.id); });

  top.append(name, star, visitBtn, openBtn, editBtn, tagsEdit, delBtn);

  const url = document.createElement('div');
  url.className = 'url';
  url.textContent = item.url;

  // Status bar and inline controls
  const statusBar = document.createElement('div');
  statusBar.className = 'statusbar';

  const statusChip = document.createElement('span');
  statusChip.className = `status-chip ${item.status}`;
  statusChip.textContent = ({ 'todo':'Not Started', 'in-progress':'In Progress', 'done':'Done' })[item.status];

  const progressBtn = button('⟳', 'chip-btn', 'Cycle Status');
  progressBtn.addEventListener('click', async () => { item.status = cycleStatus(item.status); item.updatedAt = now(); await saveItem(item); });

  const markDone = button('✓', 'chip-btn', 'Mark Done');
  markDone.addEventListener('click', async () => { item.status = 'done'; item.updatedAt = now(); await saveItem(item); });

  statusBar.append(statusChip, progressBtn, markDone);

  // Tags
  const tagWrap = document.createElement('div');
  tagWrap.className = 'tags';
  for (const t of (item.tags||[])) {
    const tag = document.createElement('span');
    tag.className = 'tag';
    tag.textContent = t;
    tag.title = `Filter by tag: ${t}`;
    tag.addEventListener('click', () => { tagFilterInput.value = t; render();
  renderTagSuggestions(); });
    tagWrap.appendChild(tag);
  }

  card.append(top, url, statusBar, tagWrap);
  return card;

  function button(text, className, title) {
    const b = document.createElement('button');
    b.className = className + ' ';
    b.textContent = text;
    b.title = title;
    return b;
  }
}

// CRUD
async function saveItem(updated) {
  const items = await getItems();
  const idx = items.findIndex(i => i.id === updated.id);
  if (idx !== -1) {
    items[idx] = updated;
    await setItems(items);
    updateLocal(items);
  }
}
async function deleteItem(id) {
  let items = await getItems();
  items = items.filter(i => i.id !== id);
  await setItems(items);
  updateLocal(items);
}
