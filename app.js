/* ===== State ===== */
const state = {
  items: [],
  dailyReport: null,
  countries: null,
  currentView: 'featured',
  currentCategory: null,
  currentRole: 'management',
  selectedCountries: new Set(),
  searchQuery: '',
  timeFilter: 'all',
  theme: localStorage.getItem('theme') || 'light',
};

const today = new Date();

const countryFlags = {};

const sectionIcons = {
  policy: '⚠',
  product: '⚙',
  market: '↗',
  project: '⚒',
  company: '★',
  tech: '✎'
};

/* ===== Init ===== */
async function init() {
  applyTheme();
  let newsRes, countriesRes, dailyRes;
  try {
    [newsRes, countriesRes, dailyRes] = await Promise.all([
      fetch('data/news.json').then(r => r.json()),
      fetch('data/countries.json').then(r => r.json()),
      fetch('data/daily-reports/2026-05-19.json').then(r => r.json()).catch(() => null),
    ]);
  } catch (e) {
    // file:// 直接打开时 fetch 被浏览器拦截，降级使用 bundle.js 内嵌数据
    const d = window.__INSULATION_DATA__;
    if (!d) throw e;
    newsRes = d.news;
    countriesRes = d.countries;
    dailyRes = d.daily;
  }

  state.items = newsRes.items;
  state.countries = countriesRes;
  state.dailyReport = dailyRes;

  countriesRes.regions.forEach(r => r.countries.forEach(c => { countryFlags[c.code] = c.flag; countryFlags[c.name] = c.flag; }));

  document.getElementById('updateTime').textContent = formatTime(newsRes.lastUpdated);

  renderCountryFilter();
  renderSourceBars();
  bindEvents();
  render();
}

/* ===== Rendering ===== */
function render() {
  const filtered = getFilteredItems();
  const view = state.currentView;

  document.getElementById('feedList').hidden = (view === 'daily');
  document.getElementById('dailyReportView').hidden = (view !== 'daily');

  if (view === 'daily') {
    renderDailyReport();
    updateFeedHeader('每日简报', `${state.dailyReport?.date || ''}`, filtered.length);
  } else {
    renderFeedList(filtered);
    updateFeedHeader(
      view === 'featured' ? '精选动态' : view === 'all' ? '全部动态' : state.currentCategory || '全部',
      view === 'featured' ? '行业热点' : view === 'all' ? '信息流' : state.currentCategory,
      filtered.length
    );
  }

  renderStats(filtered);
  renderPolicyAlerts();
  renderDailyBrief();
  renderSignal(filtered);
  renderMaterialTags(filtered);
  renderCountryTags(filtered);
  renderTopics(filtered);
  updateRoleVisibility();
}

function getFilteredItems() {
  let items = [...state.items];

  if (state.currentView === 'featured') {
    items = items.filter(i => i.featured);
  } else if (state.currentView === 'cat' && state.currentCategory) {
    items = items.filter(i => i.category === state.currentCategory);
  }

  if (state.selectedCountries.size > 0) {
    items = items.filter(i => state.selectedCountries.has(i.country));
  }

  if (state.timeFilter !== 'all') {
    const cutoff = getTimeCutoff(state.timeFilter);
    items = items.filter(i => new Date(i.date) >= cutoff);
  }

  if (state.searchQuery) {
    const q = state.searchQuery.toLowerCase();
    items = items.filter(i =>
      i.title.toLowerCase().includes(q) ||
      i.summary.toLowerCase().includes(q) ||
      (i.materials || []).some(m => m.toLowerCase().includes(q)) ||
      (i.applications || []).some(a => a.toLowerCase().includes(q)) ||
      (i.country || '').toLowerCase().includes(q) ||
      getCountryName(i.country).toLowerCase().includes(q) ||
      (i.source || '').toLowerCase().includes(q)
    );
  }

  items.sort((a, b) => b.score - a.score);
  return items;
}

function getTimeCutoff(filter) {
  const d = new Date(today);
  if (filter === 'today') { d.setHours(0, 0, 0, 0); return d; }
  if (filter === 'month') { d.setDate(1); d.setHours(0, 0, 0, 0); return d; }
  d.setDate(d.getDate() - parseInt(filter));
  d.setHours(0, 0, 0, 0);
  return d;
}

function updateFeedHeader(eyebrow, title, count) {
  document.getElementById('feedEyebrow').textContent = eyebrow;
  document.getElementById('feedTitle').textContent = title;
  document.getElementById('feedCount').textContent = `${count} 条`;
}

function renderFeedList(items) {
  const list = document.getElementById('feedList');
  const empty = document.getElementById('emptyState');

  if (items.length === 0) {
    list.innerHTML = '';
    empty.hidden = false;
    return;
  }
  empty.hidden = true;

  const clustered = clusterItems(items);
  list.innerHTML = clustered.map(item => renderCard(item)).join('');
}

function clusterItems(items) {
  const seen = new Set();
  const result = [];
  for (const item of items) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    if (item.isMainEvent && item.relatedIds?.length > 0) {
      item._related = item.relatedIds
        .map(rid => items.find(i => i.id === rid))
        .filter(Boolean);
      item._related.forEach(r => seen.add(r.id));
    }
    result.push(item);
  }
  return result;
}

function renderCard(item) {
  const flag = countryFlags[item.country] || '';
  const countryName = getCountryName(item.country);
  const scoreClass = item.score >= 90 ? 'score-high' : item.score >= 75 ? 'score-med' : 'score-low';
  const impactClass = item.impact === 'high' ? 'high-impact' : item.impact === 'medium' ? 'medium-impact' : '';
  const tierClass = item.sourceTier === 'T1' ? 'tier-t1' : item.sourceTier === 'T1.5' ? 'tier-t15' : item.sourceTier === 'T2' ? 'tier-t2' : 'tier-t3';
  const showTopic = state.currentRole === 'operations';

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
    <article class="news-card ${impactClass} ${showTopic ? 'show-topic' : ''}">
      <div class="card-header">
        <div class="card-title"><a href="${item.sourceUrl || '#'}" target="_blank" rel="noopener">${item.title}</a></div>
        <div class="card-score ${scoreClass}">${item.score}</div>
      </div>
      <p class="card-summary">${item.summary}</p>
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
      ${item.topic ? `<div class="card-topic">${item.topic}</div>` : ''}
      ${clusterHtml}
    </article>
  `;
}

/* ===== Daily Report ===== */
function renderDailyReport() {
  const view = document.getElementById('dailyReportView');
  const report = state.dailyReport;

  if (!report) {
    view.innerHTML = '<div class="empty-state"><strong>暂无日报数据</strong></div>';
    return;
  }

  const sectionsHtml = report.sections.map(section => {
    const iconClass = section.icon;
    return `
      <div class="daily-section">
        <div class="daily-section-header">
          <div class="daily-section-icon ${iconClass}">${sectionIcons[iconClass] || '●'}</div>
          <span class="daily-section-title">${section.title}</span>
          <span class="daily-section-count">${section.items.length} 条</span>
        </div>
        <div class="daily-items">
          ${section.items.map(item => {
            const flag = countryFlags[item.country] || '';
            return `
              <div class="daily-item">
                <span class="daily-item-flag">${flag}</span>
                <div class="daily-item-content">
                  <div class="daily-item-title">${item.title}</div>
                  <div class="daily-item-summary">${item.summary}</div>
                  <div class="daily-item-meta">
                    <span>${item.source}</span>
                    <span class="daily-item-impact impact-${item.impact}">${item.impact === 'high' ? '高影响' : item.impact === 'medium' ? '中影响' : '低影响'}</span>
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }).join('');

  view.innerHTML = `
    <div class="daily-date-nav">
      <button onclick="loadDailyReport(-1)">&larr; 前一天</button>
      <span class="current-date">${report.date} 日报</span>
      <button onclick="loadDailyReport(1)">后一天 &rarr;</button>
    </div>
    ${sectionsHtml}
  `;
}

function loadDailyReport(offset) {
  // Placeholder for loading other dates
}

/* ===== Stats ===== */
function renderStats(items) {
  const row = document.getElementById('statsRow');
  const policyCount = items.filter(i => i.category === '标准政策').length;
  const highImpact = items.filter(i => i.impact === 'high').length;
  const countries = new Set(items.map(i => i.country)).size;
  const featured = items.filter(i => i.featured).length;

  row.innerHTML = `
    <div class="stat-card"><div class="stat-label">总资讯</div><div class="stat-value">${items.length}</div><div class="stat-sub">覆盖 ${countries} 个国家</div></div>
    <div class="stat-card alert"><div class="stat-label">高影响</div><div class="stat-value">${highImpact}</div><div class="stat-sub">需要关注</div></div>
    <div class="stat-card"><div class="stat-label">政策变动</div><div class="stat-value">${policyCount}</div><div class="stat-sub">各国标准更新</div></div>
    <div class="stat-card"><div class="stat-label">精选</div><div class="stat-value">${featured}</div><div class="stat-sub">值得深入了解</div></div>
  `;
}

/* ===== Policy Alerts ===== */
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

  container.innerHTML = alerts.map(a => {
    const flag = countryFlags[a.country] || '';
    const cn = getCountryName(a.country);
    return `
      <div class="alert-item ${a.impact === 'medium' ? 'medium' : ''}">
        <div class="alert-item-title">${a.title.length > 40 ? a.title.slice(0, 40) + '...' : a.title}</div>
        <div class="alert-item-country">${flag} ${cn} | ${a.source}</div>
        ${a.impactNote ? `<div class="alert-item-action">${a.impactNote}</div>` : ''}
      </div>
    `;
  }).join('');
}

/* ===== Daily Brief (sidebar) ===== */
function renderDailyBrief() {
  const container = document.getElementById('dailyBrief');
  const topItems = state.items
    .filter(i => i.featured)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  container.innerHTML = topItems.map(item => {
    const flag = countryFlags[item.country] || '';
    return `
      <div class="brief-item">
        <div class="brief-item-title">${flag} ${item.title.length > 35 ? item.title.slice(0, 35) + '...' : item.title}</div>
        <div class="brief-item-meta">${item.source} | ${item.score}分</div>
      </div>
    `;
  }).join('');
}

/* ===== Signal ===== */
function renderSignal(items) {
  const policyChanges = items.filter(i => i.category === '标准政策').length;
  const newProducts = items.filter(i => i.category === '产品与材料').length;
  const score = Math.min(99, policyChanges * 3 + newProducts * 2 + items.length);
  document.getElementById('signalScore').textContent = score;
  document.getElementById('signalCopy').innerHTML = `本周监测到 <strong>${policyChanges}</strong> 项政策变动、<strong>${newProducts}</strong> 款新产品发布`;
}

/* ===== Material Tags ===== */
function renderMaterialTags(items) {
  const counts = {};
  items.forEach(i => (i.materials || []).forEach(m => { counts[m] = (counts[m] || 0) + 1; }));
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 12);

  const el = document.getElementById('materialTags');
  el.innerHTML = sorted.map(([name, count]) =>
    `<span class="cloud-tag" data-keyword="${name}">${name}<span class="tag-count">${count}</span></span>`
  ).join('');
  el.onclick = (e) => { const t = e.target.closest('.cloud-tag'); if (t) searchFor(t.dataset.keyword); };
}

/* ===== Country Tags ===== */
function renderCountryTags(items) {
  const counts = {};
  items.forEach(i => {
    if (i.country) {
      const name = getCountryName(i.country);
      const flag = countryFlags[i.country] || '';
      counts[i.country] = counts[i.country] || { name, flag, count: 0 };
      counts[i.country].count++;
    }
  });
  const sorted = Object.values(counts).sort((a, b) => b.count - a.count).slice(0, 10);

  const ctEl = document.getElementById('countryTags');
  ctEl.innerHTML = sorted.map(c =>
    `<span class="cloud-tag" data-country="${c.name}">${c.flag} ${c.name}<span class="tag-count">${c.count}</span></span>`
  ).join('');
  ctEl.onclick = (e) => { const t = e.target.closest('.cloud-tag'); if (t) toggleCountry(t.dataset.country); };
}

/* ===== Topics ===== */
function renderTopics(items) {
  const topics = items.filter(i => i.topic).slice(0, 4);
  document.getElementById('topicList').innerHTML = topics.map(t =>
    `<div class="topic-item">${t.topic}</div>`
  ).join('');
}

/* ===== Country Filter ===== */
function renderCountryFilter() {
  const container = document.getElementById('countryGroups');
  container.innerHTML = state.countries.regions.map(region => `
    <div>
      <div class="country-group-label">${region.name}</div>
      <div class="country-chips">
        ${region.countries.map(c => `
          <span class="country-chip" data-code="${c.code}">${c.flag} ${c.name}</span>
        `).join('')}
      </div>
    </div>
  `).join('');

  container.addEventListener('click', (e) => {
    const chip = e.target.closest('.country-chip');
    if (!chip) return;
    toggleCountryChip(chip, chip.dataset.code);
  });
}

function toggleCountryChip(el, code) {
  if (state.selectedCountries.has(code)) {
    state.selectedCountries.delete(code);
    el.classList.remove('selected');
  } else {
    state.selectedCountries.add(code);
    el.classList.add('selected');
  }
  render();
}

function toggleCountry(name) {
  const region = state.countries.regions.flatMap(r => r.countries);
  const country = region.find(c => c.name === name);
  if (country) {
    const chip = document.querySelector(`.country-chip[data-code="${country.code}"]`);
    if (chip) toggleCountryChip(chip, country.code);
  }
}

/* ===== Source Bars ===== */
function renderSourceBars() {
  const tiers = [
    { label: '官方源', tier: 'T1', count: 0, color: 'var(--green)' },
    { label: '官方社媒', tier: 'T1.5', count: 0, color: 'var(--accent)' },
    { label: '行业媒体', tier: 'T2', count: 0, color: 'var(--orange)' },
    { label: '市场观察', tier: 'T3', count: 0, color: 'var(--text-3)' },
  ];

  state.items.forEach(item => {
    const t = tiers.find(t => t.tier === item.sourceTier);
    if (t) t.count++;
  });

  const max = Math.max(...tiers.map(t => t.count), 1);

  document.getElementById('sourceBars').innerHTML = tiers.map(t => `
    <div class="source-bar">
      <span class="source-bar-label">${t.label}</span>
      <div class="source-bar-track">
        <div class="source-bar-fill" style="width:${(t.count / max * 100)}%;background:${t.color}"></div>
      </div>
      <span class="source-bar-count">${t.count}</span>
    </div>
  `).join('');
}

/* ===== Role Visibility ===== */
function updateRoleVisibility() {
  const role = state.currentRole;
  const policyCard = document.getElementById('policyAlertCard');
  const topicCard = document.getElementById('topicCard');
  const dailyBriefCard = document.getElementById('dailyBriefCard');

  policyCard.style.display = (role === 'sales' || role === 'management') ? '' : 'none';
  topicCard.style.display = (role === 'operations') ? '' : 'none';
  dailyBriefCard.style.display = (role === 'management') ? '' : 'none';

  document.querySelectorAll('.news-card').forEach(card => {
    card.classList.toggle('show-topic', role === 'operations');
  });
}

/* ===== Events ===== */
function bindEvents() {
  // Navigation
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const view = btn.dataset.view;
      state.currentView = view;
      state.currentCategory = btn.dataset.cat || null;
      render();
    });
  });

  // Role tabs
  document.querySelectorAll('.role-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.role-tab').forEach(t => { t.classList.remove('active'); t.setAttribute('aria-selected', 'false'); });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      state.currentRole = tab.dataset.role;

      if (state.currentRole === 'sales' && state.currentView === 'daily') {
        // Sales default to featured
        state.currentView = 'featured';
        document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
        document.querySelector('.nav-item[data-view="featured"]').classList.add('active');
      }
      render();
    });
  });

  // Search
  let searchTimer;
  document.getElementById('searchInput').addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.searchQuery = e.target.value.trim();
      render();
    }, 250);
  });

  // Time filter
  document.getElementById('timeFilter').addEventListener('change', (e) => {
    state.timeFilter = e.target.value;
    render();
  });

  // Theme
  document.getElementById('themeToggle').addEventListener('click', () => {
    state.theme = state.theme === 'light' ? 'dark' : 'light';
    applyTheme();
    localStorage.setItem('theme', state.theme);
  });

  // Clear countries
  document.getElementById('clearCountries').addEventListener('click', () => {
    state.selectedCountries.clear();
    document.querySelectorAll('.country-chip').forEach(c => c.classList.remove('selected'));
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
  if (!state.countries) return code;
  for (const region of state.countries.regions) {
    const c = region.countries.find(c => c.code === code);
    if (c) return c.name;
  }
  return code;
}

function searchFor(keyword) {
  document.getElementById('searchInput').value = keyword;
  state.searchQuery = keyword;
  render();
}

/* ===== Start ===== */
document.addEventListener('DOMContentLoaded', init);
