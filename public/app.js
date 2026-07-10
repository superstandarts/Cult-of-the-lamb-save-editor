const $ = (selector) => document.querySelector(selector);

const state = {
  folder: '', slot: 0, data: null, original: '', category: 'Overview',
  dlc: false, complexKey: null, catalogPage: 'Resources'
};

const wikiPages = ['Resources', 'Cooking', 'Followers', 'Buildings', 'Rituals', 'Doctrines'];
const wikiCache = {};

const categoryRules = {
  'Overview': /^(CultName|CurrentDayIndex|CurrentPhaseIndex|CurrentGameTime|TimeInGame|Difficulty|KillsInGame|playerDeaths|CurrentCultLevel|StaticFaith|CultFaith|HungerBarCount|IllnessBarCount|MealsCooked|Level|XP$)/i,
  'Inventory & Resources': /(^items$|inventory|resource|ingredient|food|log|stone|coin|bone|soul|crystal|shell|fish|seed|meat|meal|drink|poop|grass|capacity)/i,
  'Followers': /(follower|disciple|wedding|missionar|mating|egg|elderly|dissent|loyalty|indoctor)/i,
  'Tarot & Relics': /(tarot|relic|trinket|card|talisman)/i,
  'Weapons & Combat': /(weapon|sword|dagger|axe|hammer|gauntlet|curse|damage|health|heart|ammo|combat|enemy|boss|kill)/i,
  'Cult & Faith': /(cult|faith|sermon|ritual|doctrine|shrine|temple|prayer|devotion|sin|pleasure)/i,
  'Buildings': /(structure|building|build|base|hub|decoration|tailor)/i,
  'World & Progress': /(dungeon|location|quest|objective|story|progress|unlock|revealed|visited|completed|tutorial|onboard|beaten|found|encounter)/i,
  'Player': /(^player|fleece|ability|chore|level|xp|currentrun|resurrect)/i,
  'Time & Weather': /(day|time|weather|phase|season|holiday|timestamp)/i,
  'Settings & Modes': /(option|mode|enabled|active|allow|show|quickstart|permadeath|survival|sandbox)/i,
  'DLC': /^(DLC_|Cultist_DLC|Heretic_DLC|Sinful_DLC|Pilgrim_DLC|PAX_DLC|Twitch_Drop)/i,
  'Catalog': /(?!)/,
  'Other': /.*/
};

const friendly = {
  CultName: 'Cult name', CurrentDayIndex: 'Current day', CurrentPhaseIndex: 'Time phase',
  CurrentGameTime: 'Current game time', TimeInGame: 'Total time played', playerDeaths: 'Player deaths',
  KillsInGame: 'Enemies defeated', StaticFaith: 'Current faith', CultFaith: 'Cult faith',
  HungerBarCount: 'Cult hunger', IllnessBarCount: 'Cult illness', CurrentCultLevel: 'Cult level',
  DifficultyChosen: 'Difficulty selected', PLAYER_HEALTH: 'Current health',
  PLAYER_TOTAL_HEALTH: 'Maximum health', XP: 'Experience', Level: 'Level'
};

function toast(message, error = false) {
  const element = $('#toast');
  element.textContent = message;
  element.className = error ? 'show error' : 'show';
  setTimeout(() => { element.className = ''; }, 4200);
}

async function api(url, options) {
  const response = await fetch(url, options);
  const result = await response.json();
  if (!result.ok) throw new Error(result.error || 'Unknown error');
  return result;
}

function esc(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
}

function humanize(key) {
  if (friendly[key]) return friendly[key];
  return key.replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/\b\w/g, (c) => c.toUpperCase());
}

function normalizeName(value) {
  return String(value || '').toLowerCase().replace(/inventory\//g, '').replace(/[^a-z0-9]/g, '');
}

function markDirty() {
  if (!state.data) return;
  const dirty = JSON.stringify(state.data) !== state.original;
  $('#dirtyBadge').textContent = dirty ? 'CHANGED' : 'SAVED';
  $('#dirtyBadge').style.color = 'var(--text)';
}

function categoryFor(key) {
  for (const [name, regex] of Object.entries(categoryRules)) {
    if (name !== 'Other' && name !== 'Catalog' && regex.test(key)) return name;
  }
  return 'Other';
}

function renderNav() {
  const counts = {};
  Object.keys(state.data || {}).forEach((key) => {
    const category = categoryFor(key);
    counts[category] = (counts[category] || 0) + 1;
  });
  $('#categories').innerHTML = Object.keys(categoryRules)
    .filter((category) => (category !== 'DLC' || state.dlc) && (counts[category] || category === 'Overview' || category === 'Catalog'))
    .map((category) => `<button data-cat="${category}" class="${state.category === category ? 'active' : ''}">${category} <small>${category === 'Catalog' ? 'WIKI' : counts[category] || 0}</small></button>`)
    .join('');
  document.querySelectorAll('[data-cat]').forEach((button) => {
    button.onclick = () => { state.category = button.dataset.cat; render(); };
  });
}

function fieldHtml(key, value) {
  const label = humanize(key);
  const search = esc(`${label} ${key}`.toLowerCase());
  const caption = `<label title="Internal field: ${esc(key)}">${esc(label)}<small>${esc(key)}</small></label>`;
  if (typeof value === 'boolean') {
    return `<div class="field" data-name="${search}">${caption}<input class="toggle" type="checkbox" data-key="${esc(key)}" ${value ? 'checked' : ''}></div>`;
  }
  if (typeof value === 'number' || typeof value === 'string') {
    return `<div class="field" data-name="${search}">${caption}<input data-key="${esc(key)}" data-type="${typeof value}" value="${esc(value)}"></div>`;
  }
  return `<div class="field" data-name="${search}">${caption}<button class="ghost edit-complex" data-complex="${esc(key)}">Edit details ${Array.isArray(value) ? `(${value.length})` : ''}</button></div>`;
}

function findItemImage(name) {
  const normalized = normalizeName(name);
  for (const page of ['Resources', 'Cooking']) {
    for (const entry of wikiCache[page] || []) {
      if (normalizeName(entry.name) === normalized || normalizeName(entry.alt) === normalized) return entry.src;
    }
  }
  return '';
}

function inventoryHtml() {
  const items = Array.isArray(state.data.items) ? state.data.items : [];
  const rows = items.map((item, index) => {
    const name = window.COTL_ITEM_IDS[item.type] || 'Unknown item';
    const src = findItemImage(name);
    return `<div class="item-row" data-item-row="${index}">
      ${src ? `<img class="item-thumb" src="${esc(src)}" alt="">` : '<span class="item-thumb"></span>'}
      <strong>${esc(name)}</strong>
      <input class="item-id" data-item-id="${index}" type="number" min="1" max="999" value="${esc(item.type)}">
      <input data-item-qty="${index}" type="number" min="0" value="${esc(item.quantity ?? 0)}">
      <input data-item-reserved="${index}" type="number" min="0" value="${esc(item.QuantityReserved ?? 0)}">
      <button class="remove-item" data-remove-item="${index}" title="Remove">×</button>
    </div>`;
  }).join('');
  return `<section class="section inventory-section">
    <div class="section-head"><div><h3>Inventory</h3><small>Available and total quantities are kept in sync.</small></div><button id="addItem" class="primary compact">Add item</button></div>
    <div class="item-table"><div class="item-row item-head"><span>Item</span><span>ID</span><span>Quantity</span><span>Reserved</span><span></span></div>${rows}</div>
  </section>`;
}

function renderStats() {
  const data = state.data || {};
  const cards = [['Day', data.CurrentDayIndex ?? '—'], ['Followers', data.Followers?.length ?? '—'], ['Items', data.items?.length ?? '—'], ['Fields', Object.keys(data).length]];
  $('#stats').innerHTML = cards.map(([label, value]) => `<div class="stat"><small>${label}</small><b>${esc(value)}</b></div>`).join('');
}

async function loadWikiPage(page) {
  if (wikiCache[page]) return wikiCache[page];
  const endpoint = `https://cult-of-the-lamb.fandom.com/api.php?action=parse&page=${encodeURIComponent(page)}&prop=text&format=json&origin=*`;
  const response = await fetch(endpoint);
  if (!response.ok) throw new Error(`The ${page} catalog could not be downloaded.`);
  const payload = await response.json();
  const html = payload?.parse?.text?.['*'];
  if (!html) throw new Error(`The ${page} wiki page returned no content.`);
  const documentNode = new DOMParser().parseFromString(html, 'text/html');
  const entries = [];
  const seen = new Set();
  documentNode.querySelectorAll('table img, figure img, .gallery img, .portable-infobox img').forEach((image) => {
    let src = image.dataset.src || image.dataset.lazySrc || image.getAttribute('src') || '';
    if (!src || src.startsWith('data:')) return;
    if (src.startsWith('//')) src = `https:${src}`;
    const row = image.closest('tr,li,figure,.gallerybox,.pi-item');
    const cells = row ? [...row.querySelectorAll('th,td,.gallerytext,.pi-data-value')] : [];
    const alt = image.getAttribute('alt') || image.getAttribute('data-image-name') || '';
    let name = cells.map((cell) => cell.textContent.trim()).find((text) => text && text.length < 120) || alt;
    name = name.replace(/^File:/i, '').replace(/\.(png|jpg|jpeg|webp)$/i, '').trim();
    const signature = `${normalizeName(name)}|${src.split('/revision/')[0]}`;
    if (!name || seen.has(signature) || /logo|icon site|wordmark/i.test(name)) return;
    seen.add(signature);
    entries.push({ name, alt, src });
  });
  wikiCache[page] = entries;
  return entries;
}

async function warmInventoryImages() {
  try {
    await Promise.all(['Resources', 'Cooking'].map(loadWikiPage));
    if (state.category === 'Inventory & Resources') render();
  } catch (error) {
    console.warn(error);
  }
}

async function renderCatalog() {
  $('#stats').innerHTML = '';
  $('#search').placeholder = 'Search the catalog...';
  $('#content').innerHTML = `<section class="section catalog-section"><div class="catalog-tabs">${wikiPages.map((page) => `<button data-wiki-page="${page}" class="${state.catalogPage === page ? 'active' : ''}">${page}</button>`).join('')}</div><div id="catalogGrid" class="catalog-grid"><div class="catalog-status">Loading ${state.catalogPage} from the wiki...</div></div></section>`;
  document.querySelectorAll('[data-wiki-page]').forEach((button) => {
    button.onclick = () => { state.catalogPage = button.dataset.wikiPage; renderCatalog(); };
  });
  try {
    const entries = await loadWikiPage(state.catalogPage);
    if (state.category !== 'Catalog') return;
    const query = $('#search').value.trim().toLowerCase();
    const filtered = entries.filter((entry) => `${entry.name} ${entry.alt}`.toLowerCase().includes(query));
    $('#catalogGrid').innerHTML = filtered.length ? filtered.map((entry) => `<article class="catalog-card"><img loading="lazy" src="${esc(entry.src)}" alt="${esc(entry.name)}"><strong>${esc(entry.name)}</strong></article>`).join('') : '<div class="catalog-status">No matching content was found.</div>';
  } catch (error) {
    $('#catalogGrid').innerHTML = `<div class="catalog-status">${esc(error.message)} Check your internet connection and try again.</div>`;
  }
}

function render() {
  if (!state.data) return;
  renderNav();
  renderStats();
  $('#crumb').textContent = state.category.toUpperCase();
  $('#pageTitle').textContent = state.category;
  $('#search').placeholder = state.category === 'Catalog' ? 'Search the catalog...' : 'Search fields...';
  if (state.category === 'Catalog') { renderCatalog(); return; }
  const keys = Object.keys(state.data).filter((key) => categoryFor(key) === state.category && (state.dlc || categoryFor(key) !== 'DLC') && key !== 'items');
  const chunks = [];
  for (let index = 0; index < keys.length; index += 18) chunks.push(keys.slice(index, index + 18));
  const inventory = state.category === 'Inventory & Resources' ? inventoryHtml() : '';
  const sections = chunks.map((group, index) => `<section class="section"><div class="section-head"><h3>${state.category}${chunks.length > 1 ? ` · ${index + 1}` : ''}</h3><small>${group.length} fields</small></div>${group.map((key) => fieldHtml(key, state.data[key])).join('')}</section>`).join('');
  $('#content').innerHTML = inventory + sections || '<section class="section">No fields are available in this category.</section>';
  bindFields();
  bindInventory();
  filterFields();
}

function bindFields() {
  document.querySelectorAll('[data-key]').forEach((element) => {
    element.onchange = () => {
      const key = element.dataset.key;
      if (element.type === 'checkbox') state.data[key] = element.checked;
      else if (element.dataset.type === 'number') {
        const number = Number(element.value);
        if (!Number.isFinite(number)) { toast('Enter a valid number.', true); return; }
        state.data[key] = number;
      } else state.data[key] = element.value;
      markDirty(); renderStats();
    };
  });
  document.querySelectorAll('[data-complex]').forEach((button) => { button.onclick = () => openJson(button.dataset.complex); });
}

function bindInventory() {
  document.querySelectorAll('[data-item-id]').forEach((element) => {
    element.onchange = () => { state.data.items[+element.dataset.itemId].type = Number(element.value); markDirty(); render(); };
  });
  document.querySelectorAll('[data-item-qty]').forEach((element) => {
    element.onchange = () => { const item = state.data.items[+element.dataset.itemQty]; const amount = Math.max(0, Number(element.value) || 0); item.quantity = amount; item.UnreservedQuantity = amount; markDirty(); };
  });
  document.querySelectorAll('[data-item-reserved]').forEach((element) => {
    element.onchange = () => { state.data.items[+element.dataset.itemReserved].QuantityReserved = Math.max(0, Number(element.value) || 0); markDirty(); };
  });
  document.querySelectorAll('[data-remove-item]').forEach((button) => {
    button.onclick = () => { state.data.items.splice(+button.dataset.removeItem, 1); markDirty(); render(); };
  });
  const add = $('#addItem');
  if (add) add.onclick = () => { state.data.items.push({ type: 1, quantity: 0, QuantityReserved: 0, UnreservedQuantity: 0 }); markDirty(); render(); };
}

function openJson(key = null) {
  state.complexKey = key;
  $('#jsonTitle').textContent = key || 'Complete save';
  $('#jsonEditor').value = JSON.stringify(key ? state.data[key] : state.data, null, 2);
  $('#jsonDialog').showModal();
}

function filterFields() {
  const query = $('#search').value.toLowerCase();
  document.querySelectorAll('.field').forEach((field) => { field.style.display = field.dataset.name.includes(query) ? 'grid' : 'none'; });
}

async function loadSelected(selection) {
  state.folder = selection.folder;
  state.slot = selection.slot;
  const loaded = await api(`/api/load/${state.slot}?folder=${encodeURIComponent(state.folder)}`);
  state.data = loaded.data;
  state.original = JSON.stringify(state.data);
  state.dlc = $('#dlcToggle').checked;
  $('#saveInfo').textContent = `Slot ${state.slot + 1} · ${loaded.source}`;
  $('#welcome').classList.remove('show');
  render();
  warmInventoryImages();
  toast(`${loaded.fields} fields loaded successfully.`);
}

$('#browseBtn').onclick = async () => {
  try {
    const selection = await api('/api/select-file', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: $('#folderInput').value }) });
    await loadSelected(selection);
  } catch (error) { toast(error.message, true); }
};

$('#saveBtn').onclick = async () => {
  if (!state.data) return;
  try {
    if (!confirm('Close Cult of the Lamb before saving. Continue and create an automatic backup?')) return;
    const result = await api(`/api/save/${state.slot}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ folder: state.folder, data: state.data }) });
    state.original = JSON.stringify(state.data);
    markDirty();
    toast(`Save updated. Backup: ${result.backup}`);
  } catch (error) { toast(error.message, true); }
};

$('#rawBtn').onclick = () => state.data && openJson();
$('#search').oninput = () => state.category === 'Catalog' ? renderCatalog() : filterFields();
document.querySelectorAll('[data-close]').forEach((button) => { button.onclick = () => $('#jsonDialog').close(); });
$('#applyJson').onclick = () => {
  try {
    const parsed = JSON.parse($('#jsonEditor').value);
    if (state.complexKey) state.data[state.complexKey] = parsed;
    else {
      if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') throw new Error('The complete save must be an object.');
      state.data = parsed;
    }
    $('#jsonDialog').close(); markDirty(); render(); toast('JSON applied to the editor.');
  } catch (error) { toast(`Invalid JSON: ${error.message}`, true); }
};

function applyTheme(theme) {
  document.body.classList.toggle('light', theme === 'light');
  $('#themeBtn').textContent = theme === 'light' ? 'Dark mode' : 'Light mode';
  localStorage.setItem('cotl-rage-theme', theme);
}

$('#themeBtn').onclick = () => applyTheme(document.body.classList.contains('light') ? 'dark' : 'light');
applyTheme(localStorage.getItem('cotl-rage-theme') || 'dark');

function applyPalette(palette) {
  const valid = ['pink', 'cyan', 'red', 'green'];
  const selected = valid.includes(palette) ? palette : 'pink';
  valid.forEach((name) => document.body.classList.remove(`palette-${name}`));
  document.body.classList.add(`palette-${selected}`);
  $('#paletteSelect').value = selected;
  localStorage.setItem('cotl-rage-palette', selected);
}

$('#paletteSelect').onchange = (event) => applyPalette(event.target.value);
applyPalette(localStorage.getItem('cotl-rage-palette') || 'pink');
