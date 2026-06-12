/* ===== 资讯流（时间线）===== */
const state = {
  mode: 'all',               // featured | all（数据稀疏期默认全部，召回优先）
  cat: 'all',
  q: '',
  theme: localStorage.getItem('theme') || 'light',
};

const CATEGORIES = ['全部', '标准政策', '产品与材料', '市场价格', '工程应用', '企业展会', '技术观点'];
const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

let items = [];
let countryMap = {};   // code -> { name, flag }
let lastUpdated = '';

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
  items = newsRes.items;
  lastUpdated = newsRes.lastUpdated;
  countriesRes.regions.forEach(r => r.countries.forEach(c => { countryMap[c.code] = c; }));

  renderCatBar();
  bindEvents();
  render();
}

/* ===== Filter + Cluster ===== */
function getFiltered() {
  let list = [...items];
  if (state.mode === 'featured') list = list.filter(i => i.featured);
  if (state.cat !== 'all') list = list.filter(i => i.category === state.cat);
  if (state.q) {
    const q = state.q.toLowerCase();
    list = list.filter(i =>
      i.title.toLowerCase().includes(q) ||
      i.summary.toLowerCase().includes(q) ||
      (i.materials || []).some(m => m.toLowerCase().includes(q)) ||
      (i.source || '').toLowerCase().includes(q) ||
      (countryMap[i.country]?.name || '').toLowerCase().includes(q)
    );
  }
  return clusterFold(list);
}

function clusterFold(list) {
  const folded = new Set();
  const result = [];
  for (const item of list) {
    if (folded.has(item.id)) continue;
    if (item.isMainEvent && item.relatedIds?.length > 0) {
      item._related = item.relatedIds.map(rid => list.find(i => i.id === rid)).filter(Boolean);
      item._related.forEach(r => folded.add(r.id));
    }
    result.push(item);
  }
  return result;
}

/* ===== Render ===== */
function render() {
  const list = getFiltered();
  const timeline = document.getElementById('timeline');
  const empty = document.getElementById('emptyState');

  document.getElementById('timelineMeta').textContent =
    `${formatUpdate(lastUpdated)} · 共 ${list.length} 条${state.mode === 'featured' ? '精选' : ''}`;

  if (list.length === 0) {
    timeline.innerHTML = '';
    empty.hidden = false;
    return;
  }
  empty.hidden = true;

  // 按日期分组（倒序），组内按分数排
  const groups = {};
  list.forEach(i => { (groups[i.date] = groups[i.date] || []).push(i); });
  const dates = Object.keys(groups).sort((a, b) => b.localeCompare(a));

  timeline.innerHTML = dates.map(date => {
    const dayItems = groups[date].sort((a, b) => b.score - a.score);
    const d = new Date(date + 'T00:00:00');
    return `
      <section class="day-group">
        <div class="day-header">
          <h2>${d.getMonth() + 1}月${d.getDate()}日</h2>
          <span class="day-week">${WEEKDAYS[d.getDay()]}</span>
          <span class="day-count">${dayItems.length} 条</span>
        </div>
        <div class="day-items">
          ${dayItems.map(renderItem).join('')}
        </div>
      </section>
    `;
  }).join('');
}

function renderItem(item) {
  const c = countryMap[item.country] || { name: item.country, flag: '' };
  const impactClass = item.impact === 'high' ? 'impact-high' : item.impact === 'medium' ? 'impact-medium' : '';
  const scoreClass = item.score >= 90 ? 's-high' : item.score >= 80 ? 's-med' : 's-low';
  const tierClass = item.sourceTier === 'T1' ? 'tier-t1' : item.sourceTier === 'T1.5' ? 'tier-t15' : item.sourceTier === 'T2' ? 'tier-t2' : 'tier-t3';

  let clusterHtml = '';
  if (item._related?.length > 0) {
    clusterHtml = `
      <div class="t-cluster" onclick="this.nextElementSibling.classList.toggle('open')">&#9654; ${item._related.length} 条相关报道</div>
      <div class="t-cluster-items">
        ${item._related.map(r => `
          <div class="t-cluster-item">
            <span>${r.title}</span>
            <span class="t-tier ${r.sourceTier === 'T1' ? 'tier-t1' : 'tier-t2'}">${r.sourceTier}</span>
          </div>
        `).join('')}
      </div>
    `;
  }

  return `
    <article class="t-item ${impactClass}">
      <div class="t-dot"></div>
      <div class="t-card">
        <div class="t-meta">
          <span class="t-country">${c.flag} ${c.name}</span>
          <span class="t-cat">${item.category}</span>
          <span class="t-tier ${tierClass}">${item.sourceTier}</span>
          <span>${item.source}</span>
          <span class="t-score ${scoreClass}">${item.score}</span>
        </div>
        <a class="t-title" href="${item.sourceUrl || '#'}" target="_blank" rel="noopener">${item.title}</a>
        <p class="t-summary">${item.summary}</p>
        ${clusterHtml}
      </div>
    </article>
  `;
}

/* ===== Category Bar ===== */
function renderCatBar() {
  const bar = document.getElementById('catBar');
  bar.innerHTML = CATEGORIES.map(cat => {
    const val = cat === '全部' ? 'all' : cat;
    return `<button class="cat-chip ${state.cat === val ? 'active' : ''}" data-cat="${val}">${cat}</button>`;
  }).join('');
  bar.onclick = (e) => {
    const chip = e.target.closest('.cat-chip');
    if (!chip) return;
    state.cat = chip.dataset.cat;
    bar.querySelectorAll('.cat-chip').forEach(c => c.classList.toggle('active', c.dataset.cat === state.cat));
    render();
  };
}

/* ===== Events ===== */
function bindEvents() {
  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.mode = btn.dataset.mode;
      render();
    });
  });

  let timer;
  document.getElementById('feedSearch').addEventListener('input', (e) => {
    clearTimeout(timer);
    timer = setTimeout(() => { state.q = e.target.value.trim(); render(); }, 250);
  });

  document.getElementById('themeToggle').addEventListener('click', () => {
    state.theme = state.theme === 'light' ? 'dark' : 'light';
    applyTheme();
    localStorage.setItem('theme', state.theme);
  });
}

function applyTheme() {
  document.documentElement.setAttribute('data-theme', state.theme);
}

function formatUpdate(iso) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} 更新`;
}

document.addEventListener('DOMContentLoaded', init);
