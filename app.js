/* ===== Insulation News 单页版 =====
 * 信息架构：
 *   左栏顶部主视图切换（精选 / 全部动态）；右侧内容区顶部为分类筛选签
 *   （全部 + 🔥高影响 + 6 大分类），在当前视图内做二级筛选。按日期降序分组。
 */
const state = {
  items: [],
  countries: null,
  view: 'featured',            // 'featured' | 'all'（左栏主视图）
  chip: 'all',                 // 'all' | 分类名（右侧二级筛选）
  impactFilter: null,          // null | 'high'
  selectedCountries: new Set(),
  searchQuery: '',
  timeFilter: 'all',
  theme: localStorage.getItem('theme') || 'light',
};

const CATEGORIES = ['标准政策', '产品与材料', '市场价格', '工程应用', '企业展会', '技术观点'];
const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const today = new Date();
const countryFlags = {};

/* ===== Init ===== */
async function init() {
  applyTheme();
  let newsRes, countriesRes;
  try {
    [newsRes, countriesRes] = await Promise.all([
      fetch('data/news.json').then(r => r.json()),
      fetch('data/countries.json').then(r => r.json()),
    ]);
  } catch (e) {
    // file:// 直接打开时 fetch 被浏览器拦截，降级使用 bundle.js 内嵌数据
    const d = window.__INSULATION_DATA__;
    if (!d) throw e;
    newsRes = d.news;
    countriesRes = d.countries;
  }

  state.items = newsRes.items;
  state.countries = countriesRes;
  countriesRes.regions.forEach(r => r.countries.forEach(c => {
    countryFlags[c.code] = c.flag;
    countryFlags[c.name] = c.flag;
  }));

  document.getElementById('updateTime').textContent = formatTime(newsRes.lastUpdated);

  renderChips();
  renderCountryFilter();
  bindEvents();
  render();
}

/* ===== Render ===== */
function render() {
  const filtered = getFilteredItems();
  const viewLabel = state.view === 'featured' ? '精选' : '全部动态';
  const chipLabel = state.chip === 'all' ? '' : ' · ' + state.chip;
  document.getElementById('feedTitle').textContent = viewLabel + chipLabel + (state.impactFilter === 'high' ? ' · 高影响' : '');
  document.getElementById('feedCount').textContent = `${filtered.length} 条`;

  const countries = new Set(filtered.map(i => i.country)).size;
  document.getElementById('feedCoverage').textContent = filtered.length ? `覆盖 ${countries} 个国家` : '';

  syncViewNav();
  renderChips();
  renderTimeline(filtered);
  renderPolicyAlerts();
  renderTopics(filtered);
}

function syncViewNav() {
  document.querySelectorAll('.view-item').forEach(b =>
    b.classList.toggle('active', b.dataset.view === state.view));
}

/* 在「视图+地区+时间+搜索」范围内统计各分类数量（不含 chip 与 impact，使徽标稳定可比） */
function scopeFiltered() {
  let items = [...state.items];
  if (state.view === 'featured') items = items.filter(i => i.featured);
  if (state.selectedCountries.size > 0) items = items.filter(i => state.selectedCountries.has(i.country));
  if (state.timeFilter !== 'all') {
    const cutoff = getTimeCutoff(state.timeFilter);
    items = items.filter(i => new Date(i.date) >= cutoff);
  }
  if (state.searchQuery) items = matchSearch(items, state.searchQuery);
  return items;
}

function getFilteredItems() {
  let items = [...state.items];

  if (state.view === 'featured') {
    items = items.filter(i => i.featured);
  }

  if (state.chip !== 'all') {
    items = items.filter(i => i.category === state.chip);
  }

  if (state.impactFilter) {
    items = items.filter(i => i.impact === state.impactFilter);
  }

  if (state.selectedCountries.size > 0) {
    items = items.filter(i => state.selectedCountries.has(i.country));
  }

  if (state.timeFilter !== 'all') {
    const cutoff = getTimeCutoff(state.timeFilter);
    items = items.filter(i => new Date(i.date) >= cutoff);
  }

  if (state.searchQuery) items = matchSearch(items, state.searchQuery);

  return clusterItems(items);
}

function matchSearch(items, query) {
  const q = query.toLowerCase();
  return items.filter(i =>
    i.title.toLowerCase().includes(q) ||
    i.summary.toLowerCase().includes(q) ||
    (i.titleOriginal || '').toLowerCase().includes(q) ||
    (i.materials || []).some(m => m.toLowerCase().includes(q)) ||
    (i.applications || []).some(a => a.toLowerCase().includes(q)) ||
    (i.country || '').toLowerCase().includes(q) ||
    getCountryName(i.country).toLowerCase().includes(q) ||
    (i.source || '').toLowerCase().includes(q)
  );
}

function getTimeCutoff(filter) {
  const d = new Date(today);
  if (filter === 'today') { d.setHours(0, 0, 0, 0); return d; }
  if (filter === 'month') { d.setDate(1); d.setHours(0, 0, 0, 0); return d; }
  d.setDate(d.getDate() - parseInt(filter));
  d.setHours(0, 0, 0, 0);
  return d;
}

function clusterItems(items) {
  const seen = new Set();
  const result = [];
  for (const item of items) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    if (item.isMainEvent && item.relatedIds?.length > 0) {
      item._related = item.relatedIds.map(rid => items.find(i => i.id === rid)).filter(Boolean);
      item._related.forEach(r => seen.add(r.id));
    }
    result.push(item);
  }
  return result;
}

/* ===== 分类筛选签（全部 + 6 分类 + 🔥高影响开关 + 清除，在当前视图内二级筛选） ===== */
function renderChips() {
  const bar = document.getElementById('chipBar');
  const scope = scopeFiltered();                 // 视图+地区+时间+搜索范围内
  const countOf = (id) =>
    id === 'all' ? scope.length : scope.filter(i => i.category === id).length;

  const chips = [
    { id: 'all', label: '全部' },
    ...CATEGORIES.map(c => ({ id: c, label: c })),
  ];

  // 高影响开关：在「当前分类 + 视图地区时间搜索」范围内的高影响条数
  const chipScope = state.chip === 'all' ? scope : scope.filter(i => i.category === state.chip);
  const highN = chipScope.filter(i => i.impact === 'high').length;

  const hasFilter = state.impactFilter || state.selectedCountries.size > 0 ||
                    state.searchQuery || state.timeFilter !== 'all' || state.chip !== 'all';

  bar.innerHTML =
    chips.map(c => {
      const n = countOf(c.id);
      return `<button class="chip ${state.chip === c.id ? 'active' : ''} ${n === 0 ? 'dim' : ''}" data-chip="${c.id}">${c.label}<span class="chip-n">${n}</span></button>`;
    }).join('') +
    `<button class="chip chip-impact ${state.impactFilter === 'high' ? 'active' : ''} ${highN === 0 && state.impactFilter !== 'high' ? 'dim' : ''}" data-impact="high">🔥 高影响<span class="chip-n">${highN}</span></button>` +
    (hasFilter ? `<button class="chip-clear" data-clear="1">清除筛选 ✕</button>` : '');

  bar.onclick = (e) => {
    const clear = e.target.closest('[data-clear]');
    if (clear) { clearAllFilters(); return; }
    const imp = e.target.closest('[data-impact]');
    if (imp) { state.impactFilter = state.impactFilter === 'high' ? null : 'high'; render(); return; }
    const chip = e.target.closest('.chip[data-chip]');
    if (!chip) return;
    state.chip = chip.dataset.chip;
    render();
  };
}

function clearAllFilters() {
  // 仅清空二级筛选，保留当前主视图（精选/全部动态）
  state.chip = 'all';
  state.impactFilter = null;
  state.searchQuery = '';
  document.getElementById('searchInput').value = '';
  state.selectedCountries.clear();
  renderSelectedCountries();
  state.timeFilter = 'all';
  document.getElementById('timeFilter').value = 'all';
  render();
}

/* ===== 时间线主流 ===== */
function renderTimeline(items) {
  const timeline = document.getElementById('timeline');
  const empty = document.getElementById('emptyState');

  if (items.length === 0) {
    timeline.innerHTML = '';
    empty.hidden = false;
    return;
  }
  empty.hidden = true;

  const groups = {};
  items.forEach(i => { (groups[i.date] = groups[i.date] || []).push(i); });
  const dates = Object.keys(groups).sort((a, b) => b.localeCompare(a));

  timeline.innerHTML = dates.map(date => {
    const dayItems = groups[date].sort((a, b) => b.score - a.score);
    const d = new Date(date + 'T00:00:00');
    const policyN = dayItems.filter(i => i.category === '标准政策').length;
    const highN = dayItems.filter(i => i.impact === 'high').length;
    const parts = [`${dayItems.length} 条`];
    if (policyN) parts.push(`${policyN} 条政策`);
    if (highN) parts.push(`${highN} 条高影响`);
    return `
      <section class="day-group">
        <div class="day-header">
          <h3>${d.getMonth() + 1}月${d.getDate()}日</h3>
          <span class="day-week">${WEEKDAYS[d.getDay()]}</span>
          <span class="day-count">${parts.join(' · ')}</span>
        </div>
        <div class="day-items">
          ${dayItems.map(renderCard).join('')}
        </div>
      </section>
    `;
  }).join('');
}

function renderCard(item) {
  const flag = countryFlags[item.country] || '';
  const countryName = getCountryName(item.country);
  const scoreClass = item.score >= 90 ? 'score-high' : item.score >= 75 ? 'score-med' : 'score-low';
  const impactClass = item.impact === 'high' ? 'impact-high' : item.impact === 'medium' ? 'impact-medium' : '';
  const tierClass = item.sourceTier === 'T1' ? 'tier-t1' : item.sourceTier === 'T1.5' ? 'tier-t15' : item.sourceTier === 'T2' ? 'tier-t2' : 'tier-t3';

  let clusterHtml = '';
  if (item._related?.length > 0) {
    clusterHtml = `
      <div class="cluster-toggle" onclick="this.nextElementSibling.classList.toggle('open')">
        &#9654; ${item._related.length} 条相关报道
      </div>
      <div class="cluster-items">
        ${item._related.map(r => `
          <div class="cluster-item">
            <span>${r.title}</span>
            <span class="source-tier ${r.sourceTier === 'T1' ? 'tier-t1' : 'tier-t2'}">${r.sourceTier}</span>
          </div>
        `).join('')}
      </div>
    `;
  }

  return `
    <article class="news-card ${impactClass}">
      <div class="t-dot" aria-hidden="true"></div>
      <div class="card-header">
        <div class="card-title">
          ${item.featured ? '<span class="card-star" title="精选">⭐</span>' : ''}
          <a href="${item.sourceUrl || '#'}" target="_blank" rel="noopener">${item.title}</a>
        </div>
        <div class="card-score ${scoreClass}">${item.score}</div>
      </div>
      <p class="card-summary">${item.summary}</p>
      ${item.impactNote ? `<div class="card-reason"><span>为什么值得看</span>${item.impactNote}</div>` : ''}
      <div class="card-tags">
        <span class="tag tag-country">${flag} ${countryName}</span>
        <span class="tag tag-category">${item.category}</span>
        ${item.impact ? `<span class="tag tag-impact-${item.impact}">${item.impact === 'high' ? '高影响' : item.impact === 'medium' ? '中影响' : '低影响'}</span>` : ''}
        ${(item.materials || []).slice(0, 3).map(m => `<span class="tag tag-material">${m}</span>`).join('')}
      </div>
      <div class="card-footer">
        <div class="card-source">
          <span class="source-tier ${tierClass}">${item.sourceTier}</span>
          <span>${item.source}</span>
        </div>
        <span>${item.date}</span>
      </div>
      ${item.topic ? `
        <div class="card-topic-toggle" onclick="this.nextElementSibling.classList.toggle('open');this.classList.toggle('open')">&#9998; 选题建议</div>
        <div class="card-topic">${item.topic}</div>` : ''}
      ${clusterHtml}
    </article>
  `;
}

/* ===== 政策预警 ===== */
function renderPolicyAlerts() {
  const container = document.getElementById('policyAlerts');
  const alerts = state.items
    .filter(i => i.category === '标准政策' && (i.impact === 'high' || i.impact === 'medium'))
    .sort((a, b) => {
      if (a.impact === 'high' && b.impact !== 'high') return -1;
      if (a.impact !== 'high' && b.impact === 'high') return 1;
      return b.score - a.score;
    })
    .slice(0, 6);

  document.getElementById('alertCount').textContent = alerts.length;

  container.innerHTML = alerts.length === 0
    ? '<div class="rail-empty">暂无政策预警</div>'
    : alerts.map(a => {
        const flag = countryFlags[a.country] || '';
        const cn = getCountryName(a.country);
        return `
          <div class="alert-item ${a.impact === 'medium' ? 'medium' : ''}" data-url="${a.sourceUrl || ''}" title="点击查看原文">
            <div class="alert-item-title">${a.title.length > 40 ? a.title.slice(0, 40) + '...' : a.title}</div>
            <div class="alert-item-country">${flag} ${cn} | ${a.source}</div>
            ${a.impactNote ? `<div class="alert-item-action">${a.impactNote}</div>` : ''}
          </div>
        `;
      }).join('');

  container.onclick = (e) => {
    const el = e.target.closest('.alert-item');
    if (el?.dataset.url) window.open(el.dataset.url, '_blank', 'noopener');
  };
}

/* ===== 选题灵感 ===== */
function renderTopics(items) {
  const topics = items.filter(i => i.topic).slice(0, 5);
  const container = document.getElementById('topicList');
  container.innerHTML = topics.length === 0
    ? '<div class="rail-empty">当前筛选下暂无选题</div>'
    : topics.map(t => `<div class="topic-item" data-url="${t.sourceUrl || ''}" title="点击查看原文">${t.topic}</div>`).join('');
  container.onclick = (e) => {
    const el = e.target.closest('.topic-item');
    if (el?.dataset.url) window.open(el.dataset.url, '_blank', 'noopener');
  };
}

/* ===== 国家筛选（可搜索下拉，多选） ===== */
function renderCountryFilter() {
  const input = document.getElementById('countrySearch');
  const dropdown = document.getElementById('countryDropdown');
  const combo = document.getElementById('countryCombo');

  const show = () => {
    renderCountryDropdown(input.value.trim());
    dropdown.hidden = false;
  };
  input.addEventListener('focus', show);
  input.addEventListener('input', show);

  // 点击下拉外部时收起
  document.addEventListener('click', (e) => {
    if (!combo.contains(e.target)) dropdown.hidden = true;
  });

  // 选择国家（多选，选完不收起方便连选）
  dropdown.addEventListener('click', (e) => {
    const opt = e.target.closest('.combo-option');
    if (!opt) return;
    toggleCountry(opt.dataset.code);
    renderCountryDropdown(input.value.trim());
  });

  renderSelectedCountries();
}

function renderCountryDropdown(query) {
  const dropdown = document.getElementById('countryDropdown');
  const q = (query || '').toLowerCase();
  let html = '';
  for (const region of state.countries.regions) {
    const matches = region.countries.filter(c =>
      !q || c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q) || region.name.includes(q)
    );
    if (!matches.length) continue;
    html += `<div class="combo-group-label">${region.name}</div>`;
    html += matches.map(c =>
      `<div class="combo-option ${state.selectedCountries.has(c.code) ? 'selected' : ''}" data-code="${c.code}">${c.flag} ${c.name}</div>`
    ).join('');
  }
  dropdown.innerHTML = html || '<div class="combo-empty">没有匹配的国家</div>';
}

function toggleCountry(code) {
  if (state.selectedCountries.has(code)) {
    state.selectedCountries.delete(code);
  } else {
    state.selectedCountries.add(code);
  }
  renderSelectedCountries();
  render();
}

function renderSelectedCountries() {
  const box = document.getElementById('selectedCountries');
  box.innerHTML = [...state.selectedCountries].map(code =>
    `<span class="sel-chip" data-code="${code}" title="点击移除">${countryFlags[code] || ''} ${getCountryName(code)} &times;</span>`
  ).join('');
  box.onclick = (e) => {
    const chip = e.target.closest('.sel-chip');
    if (chip) toggleCountry(chip.dataset.code);
  };
}

/* ===== Events ===== */
function bindEvents() {
  document.getElementById('viewNav').addEventListener('click', (e) => {
    const item = e.target.closest('.view-item');
    if (!item || item.dataset.view === state.view) return;
    state.view = item.dataset.view;
    state.chip = 'all';            // 切视图时重置二级分类
    state.impactFilter = null;
    render();
  });

  let searchTimer;
  document.getElementById('searchInput').addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.searchQuery = e.target.value.trim();
      render();
    }, 250);
  });

  document.getElementById('timeFilter').addEventListener('change', (e) => {
    state.timeFilter = e.target.value;
    render();
  });

  document.getElementById('themeToggle').addEventListener('click', () => {
    state.theme = state.theme === 'light' ? 'dark' : 'light';
    applyTheme();
    localStorage.setItem('theme', state.theme);
  });

  document.getElementById('clearCountries').addEventListener('click', () => {
    state.selectedCountries.clear();
    renderSelectedCountries();
    render();
  });
}

/* ===== Helpers ===== */
function applyTheme() {
  document.documentElement.setAttribute('data-theme', state.theme);
}

function formatTime(iso) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} 更新`;
}

function getCountryName(code) {
  if (!state.countries) return code || '';
  for (const region of state.countries.regions) {
    const c = region.countries.find(c => c.code === code);
    if (c) return c.name;
  }
  return code === 'GLOBAL' ? '全球' : (code || '');
}

function searchFor(keyword) {
  document.getElementById('searchInput').value = keyword;
  state.searchQuery = keyword;
  render();
}

document.addEventListener('DOMContentLoaded', init);
