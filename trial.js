/* ===== 试用周组件：使用说明 + 站内反馈 =====
 * 零后端方案：反馈提交后自动整理成文字并复制到剪贴板，
 * 同事粘贴到微信/飞书发给组织者；同时存入 localStorage 可随时导出。
 *
 * 升级接口：如果之后创建了飞书问卷，把链接填到下面 FEEDBACK_FORM_URL，
 * 反馈按钮将直接打开问卷（自动汇总），站内表单自动停用。
 */
const FEEDBACK_FORM_URL = 'https://zy93hohnod.feishu.cn/share/base/form/shrcnzvdgaKYzEZIMKmI93KQ9Fb'; // 飞书问卷（清空 = 回退站内表单）
const FEEDBACK_TO = 'marchtime2020@gmail.com';      // 反馈接收人（mailto 备用通道）
const TRIAL_STORE_KEY = 'insulation_trial_feedback';

/* ---------- 浮动按钮 ---------- */
function trialMount() {
  const wrap = document.createElement('div');
  wrap.className = 'trial-fab-wrap';
  wrap.innerHTML = `
    <button class="trial-fab" id="trialHelpBtn" type="button">&#10067; 使用说明</button>
    <button class="trial-fab primary" id="trialFeedbackBtn" type="button">&#128172; 反馈</button>
  `;
  document.body.appendChild(wrap);

  document.getElementById('trialHelpBtn').addEventListener('click', openHelp);
  document.getElementById('trialFeedbackBtn').addEventListener('click', () => {
    if (FEEDBACK_FORM_URL) { window.open(FEEDBACK_FORM_URL, '_blank'); return; }
    openFeedback();
  });

  // 首次访问自动弹出使用说明
  if (!localStorage.getItem('insulation_help_seen')) {
    openHelp();
    localStorage.setItem('insulation_help_seen', '1');
  }
}

/* ---------- 弹窗骨架 ---------- */
function trialModal(title, bodyHtml) {
  closeTrialModal();
  const overlay = document.createElement('div');
  overlay.className = 'trial-overlay';
  overlay.id = 'trialOverlay';
  overlay.innerHTML = `
    <div class="trial-modal" role="dialog" aria-label="${title}">
      <div class="trial-modal-head">
        <h2>${title}</h2>
        <button class="trial-close" type="button" aria-label="关闭">&times;</button>
      </div>
      <div class="trial-modal-body">${bodyHtml}</div>
    </div>
  `;
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeTrialModal(); });
  overlay.querySelector('.trial-close').addEventListener('click', closeTrialModal);
  document.body.appendChild(overlay);
  return overlay;
}

function closeTrialModal() {
  document.getElementById('trialOverlay')?.remove();
}

/* ---------- 使用说明 ---------- */
function openHelp() {
  trialModal('使用说明 · 试用周', `
    <h3>这是什么？</h3>
    <p>华跃内部的<strong>全球保温建材资讯监控平台</strong>原型。每天了解各国市场的政策变动、产品资讯和项目机会。当前为模拟数据（85 条，覆盖 30+ 国家），本周目标是验证页面结构是否好用，请放心随便点。</p>

    <h3>两个页面，两种用法</h3>
    <ul>
      <li><strong>工作台</strong>（index.html）：三栏全景。左边按分类/国家筛选，中间看资讯，右边看政策预警和简报。适合坐下来分析。</li>
      <li><strong>时间线</strong>（feed.html）：单栏时间流，按日期往下刷。适合碎片时间快速过一遍"最近发生了什么"。两个页面左上角可互相切换。</li>
    </ul>

    <h3>工作台顶部的三个身份按钮</h3>
    <ul>
      <li><strong>管理层</strong>：精选 + 今日简报 + 政策预警（宏观全景）</li>
      <li><strong>销售部</strong>：政策预警优先（哪个国家出了新政策/认证要求）</li>
      <li><strong>运营部</strong>：每条资讯下方会多出蓝色的"选题建议"</li>
    </ul>
    <p>请切到你自己的身份用，这是本次试用最想验证的设计。</p>

    <h3>几个值得试的操作</h3>
    <ul>
      <li>左侧"国家/地区"点选一个国家（比如沙特），看只属于它的动态</li>
      <li>搜索框输入"越南"或"岩棉"试试</li>
      <li>遇到"&#9654; N 条相关报道"点开看看——同一事件多家报道被折叠了</li>
      <li>右上角圆形按钮切换深色模式</li>
    </ul>

    <div class="trial-tip">&#128161; 用完一周后，点右下角 <strong>&#128172; 反馈</strong> 花 2 分钟填一下感受——你的反馈直接决定这个工具接下来怎么做。</div>
  `);
}

/* ---------- 反馈表单 ---------- */
function openFeedback() {
  const saved = JSON.parse(localStorage.getItem(TRIAL_STORE_KEY) || '[]');
  trialModal('试用反馈', `
    <div class="trial-field">
      <label>你的部门/角色</label>
      <select id="fbRole">
        <option value="">请选择...</option>
        <option>销售部</option>
        <option>运营部</option>
        <option>管理层</option>
        <option>其他</option>
      </select>
    </div>
    <div class="trial-field">
      <label>姓名 <span class="opt">（选填）</span></label>
      <input type="text" id="fbName" placeholder="方便后续沟通" />
    </div>
    <div class="trial-field">
      <label>这一周你主动打开了几次？</label>
      <select id="fbFreq">
        <option value="">请选择...</option>
        <option>没打开过</option>
        <option>1-2 次</option>
        <option>3-5 次</option>
        <option>几乎每天</option>
      </select>
    </div>
    <div class="trial-field">
      <label>哪个板块对你最有用？</label>
      <select id="fbBest">
        <option value="">请选择...</option>
        <option>精选</option>
        <option>日报</option>
        <option>时间线</option>
        <option>国家筛选</option>
        <option>政策预警</option>
        <option>选题建议</option>
        <option>都不太有用</option>
      </select>
    </div>
    <div class="trial-field">
      <label>你更希望哪种使用方式？</label>
      <select id="fbMode">
        <option value="">请选择...</option>
        <option>每天自己打开看</option>
        <option>有大事时推送到飞书/微信</option>
        <option>两者都要</option>
      </select>
    </div>
    <div class="trial-field">
      <label>缺什么功能？有什么建议或吐槽？<span class="opt">（畅所欲言）</span></label>
      <textarea id="fbText" placeholder="比如：希望能查某个国家现在的认证要求 / 信息太多看不过来 / 想要英文原文..."></textarea>
    </div>
    <div class="trial-actions">
      <button class="trial-btn" id="fbSubmit" type="button">提交反馈</button>
      ${saved.length > 0 ? `<button class="trial-btn ghost" id="fbExport" type="button">导出本机全部反馈（${saved.length}条）</button>` : ''}
      <span class="trial-note">提交后内容会自动复制，粘贴发给组织者即可</span>
    </div>
  `);

  document.getElementById('fbSubmit').addEventListener('click', submitFeedback);
  document.getElementById('fbExport')?.addEventListener('click', exportFeedback);
}

function submitFeedback() {
  const data = {
    role: document.getElementById('fbRole').value,
    name: document.getElementById('fbName').value.trim(),
    freq: document.getElementById('fbFreq').value,
    best: document.getElementById('fbBest').value,
    mode: document.getElementById('fbMode').value,
    text: document.getElementById('fbText').value.trim(),
    page: location.pathname.includes('feed') ? '时间线' : '工作台',
    time: new Date().toLocaleString('zh-CN'),
  };

  if (!data.role && !data.text) {
    alert('请至少选择你的部门，或写一句建议～');
    return;
  }

  // 本地留存
  const saved = JSON.parse(localStorage.getItem(TRIAL_STORE_KEY) || '[]');
  saved.push(data);
  localStorage.setItem(TRIAL_STORE_KEY, JSON.stringify(saved));

  // 整理成可粘贴文字
  const text = [
    '【保温资讯平台 · 试用反馈】',
    `部门：${data.role || '未填'}${data.name ? ' / ' + data.name : ''}`,
    `打开频率：${data.freq || '未填'}`,
    `最有用板块：${data.best || '未填'}`,
    `期望方式：${data.mode || '未填'}`,
    `建议：${data.text || '无'}`,
    `（${data.time} 提交于${data.page}）`,
  ].join('\n');

  copyText(text);

  trialModal('反馈已提交', `
    <div class="trial-success">
      <div class="big">&#127881;</div>
      <p><strong>反馈内容已自动复制到剪贴板。</strong><br/>请打开微信或飞书，粘贴发给组织者，谢谢！</p>
      <div class="copied-box">${text.replace(/\n/g, '<br/>')}</div>
      <div class="trial-actions" style="justify-content:center">
        <a class="trial-btn ghost" href="mailto:${FEEDBACK_TO}?subject=${encodeURIComponent('保温资讯平台试用反馈')}&body=${encodeURIComponent(text)}">或用邮件发送</a>
        <button class="trial-btn" type="button" onclick="closeTrialModal()">完成</button>
      </div>
    </div>
  `);
}

function exportFeedback() {
  const saved = JSON.parse(localStorage.getItem(TRIAL_STORE_KEY) || '[]');
  const text = saved.map((d, i) =>
    `--- 第${i + 1}条 ---\n部门：${d.role}${d.name ? ' / ' + d.name : ''}\n打开频率：${d.freq}\n最有用：${d.best}\n期望方式：${d.mode}\n建议：${d.text}\n时间：${d.time}`
  ).join('\n\n');
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = '试用反馈导出.txt';
  a.click();
  URL.revokeObjectURL(a.href);
}

/* ---------- 剪贴板（含 file:// 降级） ---------- */
function copyText(text) {
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).catch(() => copyFallback(text));
  } else {
    copyFallback(text);
  }
}
function copyFallback(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); } catch (e) { /* 复制失败时成功页内仍展示全文可手动复制 */ }
  ta.remove();
}

document.addEventListener('DOMContentLoaded', trialMount);
