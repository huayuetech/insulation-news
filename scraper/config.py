# -*- coding: utf-8 -*-
"""信源配置 —— 对应《信源清单.md》第九节首批接入建议"""

# RSS 信源（已验证可用）
RSS_SOURCES = [
    {
        "name": "Global Insulation",
        "url": "https://www.globalinsulation.com/news?format=feed&type=rss",
        "tier": "T2",
        "sourceType": "行业媒体",
        "trusted": True,   # 垂直行业媒体，全部条目默认相关，跳过相关性预筛
    },
    {
        "name": "Middle East Construction News",
        "url": "https://meconstructionnews.com/feed",
        "tier": "T2",
        "sourceType": "行业媒体",
        "trusted": False,  # 泛建筑媒体，需要相关性预筛
    },
    # 第2批（2026-06-13 接入，泛源→关键词预筛过滤非保温内容）
    {
        "name": "EU BUILD UP",
        "url": "https://build-up.ec.europa.eu/en/rss.xml",
        "tier": "T1",          # 欧盟委员会运营的建筑节能政策门户
        "sourceType": "官方源",
        "trusted": False,
    },
    {
        "name": "CBNME",
        "url": "https://www.cbnme.com/feed/",
        "tier": "T2",
        "sourceType": "行业媒体",
        "trusted": False,
    },
    {
        "name": "MEP Middle East",
        "url": "https://www.mepmiddleeast.com/feed",
        "tier": "T2",
        "sourceType": "行业媒体",
        "trusted": False,
    },
    {
        "name": "The Investor (Vietnam)",
        "url": "https://theinvestor.vn/feed.rss",
        "tier": "T2",
        "sourceType": "行业媒体",
        "trusted": False,
    },
    # 第3批（2026-06-13 接入，东南亚法规追踪主力，RSS 已验证每小时更新）
    {
        "name": "Enviliance ASIA",
        "url": "https://enviliance.com/feed",
        "tier": "T2",          # EHS/能效法规追踪服务，一站覆盖越南/泰国/印尼
        "sourceType": "法规追踪",
        "trusted": False,      # 泛 EHS 内容，需关键词预筛过滤非保温/非建筑
    },
    {
        "name": "Thailand DEDE BEC",
        "url": "https://bec.dede.go.th/feed/",
        "tier": "T1",          # 泰国官方 Building Energy Code 站点 RSS
        "sourceType": "官方源",
        "trusted": True,       # 专站内容集中在建筑节能规范/BEC 推进，跳过英文关键词预筛
    },
    {
        "name": "SEDA Malaysia",
        "url": "https://www.seda.gov.my/feed/",
        "tier": "T1",
        "sourceType": "官方源",
        "trusted": False,      # SEDA RSS 很泛（招标/招聘/可再生能源），仍需关键词预筛
    },
]

# 网页变化哨兵（T1 政府/标准源，无 RSS、页面结构乱，只监测"是否更新"不解析内容）
# 变化后生成一条提醒资讯，由人工点进原文判断。content_selector 留空则用全文本去噪后比对。
WATCH_SOURCES = [
    # —— 中东 P0 ——
    {
        "name": "SASO 技术法规",
        "url": "https://www.saso.gov.sa/en/Laws-And-Regulations/Technical_regulations/Pages/default.aspx",
        "country": "SA",
        "tier": "T1",
        "enabled": False,  # "页面有更新"提醒说不出具体变化、且反复误报(SASO一天报2次)，价值低已停用。
                           # 待将来升级为"抽取变化内容"再启用，仅靠监测哈希无意义
        "note": "沙特标准组织技术法规页，建材/保温强制认证变动来源（SASO 2870 能效要求）",
    },
    {
        "name": "Saudi Building Code (SBC)",
        "url": "https://sbc.gov.sa/En",
        "country": "SA",
        "tier": "T1",
        "enabled": False,  # GitHub Actions 美国IP被沙特政府站防火墙拒绝(Network unreachable)，待代理
        "note": "沙特建筑规范，2024 版含保温要求",
    },
    {
        "name": "SEEC 节能中心",
        "url": "https://www.seec.gov.sa/en/rules/saudi-building-code-thermal-insulation-guidelines",
        "country": "SA",
        "tier": "T1",
        "enabled": False,  # 同上，沙特政府站地理封锁
        "note": "沙特节能中心，保温专页",
    },
    {
        "name": "Dubai Civil Defence",
        "url": "https://www.dcd.gov.ae",
        "country": "AE",
        "tier": "T1",
        "enabled": False,  # 迪拜政府站对美国IP超时(firewall timeout)，待代理
        "note": "UAE Fire & Life Safety Code，覆层/NFPA 285 防火要求来源",
    },
    {
        "name": "Emirates Safety Laboratory (ESL)",
        "url": "https://www.dcd.gov.ae/portal/en/item/1537-the-uae-safety-lab-undergoes-major-service-transformation-starting-from-2024.jsp",
        "country": "AE",
        "tier": "T1",
        "enabled": False,  # 同 dcd.gov.ae 地理封锁
        "note": "2024 起负责 façade/覆层材料合格认证，保温材料准入风向标",
    },
    # —— 东南亚 P0 ——
    {
        "name": "越南建设部",
        "url": "https://moc.gov.vn/en",
        "country": "VN",
        "tier": "T1",
        "enabled": False,  # 首页哈希变动没有实际内容价值；待定制 HTML 新闻列表解析
        "note": "越南建设部英文版，QCVN 09 建筑节能规范来源",
    },
    {
        "name": "Thailand DEDE — Building Energy Code",
        "url": "https://bec.dede.go.th/",
        "country": "TH",
        "tier": "T1",
        "enabled": False,  # 已改用 https://bec.dede.go.th/feed/ 进入内容抓取管线
        "note": "泰国能源部 BEC，2023 生效、2025 起强制，含围护结构 OTTV/RTTV 保温要求",
    },
    {
        "name": "SEDA Malaysia — MS 1525",
        "url": "https://www.seda.gov.my/",
        "country": "MY",
        "tier": "T1",
        "enabled": False,  # 已改用 https://www.seda.gov.my/feed/，避免只报首页变化
        "note": "马来 MS 1525:2019 能效标准，规定屋面 U 值上限，GBI 强制引用",
    },
    {
        "name": "GORD — GSAS（卡塔尔）",
        "url": "https://www.gord.qa/",
        "country": "QA",
        "tier": "T1.5",
        "enabled": False,  # 官网首页变化无法产出可读资讯；待找到新闻/RSS/API 后再接入
        "note": "海湾可持续评估体系 GSAS，QCS 2014 已部分强制，卡塔尔绿建/能效来源",
    },
    {
        "name": "Indonesia GBCI — Greenship",
        "url": "https://www.gbcindonesia.org/",
        "country": "ID",
        "tier": "T1.5",
        "enabled": False,  # 新闻列表为动态接口，需单独解析，首页哈希报警价值低
        "note": "印尼绿建委 Greenship 评级，英文可及，补 BSN SNI（印尼语）的不足",
    },
]

# Google News RSS 关键词组（兜底网）
GOOGLE_NEWS_QUERIES = [
    "glass wool OR rock wool OR mineral wool insulation",
    "building insulation regulation OR standard OR code",
    '"thermal insulation" Saudi OR UAE OR Vietnam OR Indonesia',
    "insulation plant OR factory investment OR capacity",
]
GOOGLE_NEWS_URL = "https://news.google.com/rss/search?q={q}&hl=en-US&gl=US&ceid=US:en"

# 泛信源关键词预筛（recall 优先，宁松勿紧；命中任一即送 AI 处理）
RELEVANCE_KEYWORDS = [
    "insulat", "glass wool", "rock wool", "mineral wool", "stone wool",
    "aerogel", "thermal", "cladding", "fireproof", "fire safety", "fire-rated",
    "energy efficiency", "energy code", "epbd", "hvac", "façade", "facade",
    "PIR", "polyiso", "polyurethane", "EPS", "XPS", "foam board",
    "building energy code", "bec", "ms 1525", "green building", "greenship",
    "building envelope", "u-value", "ottv", "rttv", "qcvn 09",
]

# 屏蔽：付费市场研究报告软文（"市场规模/预测/趋势"模板化内容，信息价值低）
# 按来源名屏蔽（不区分大小写，子串匹配）
BLOCKED_SOURCES = [
    "indexbox", "market.us", "marketsandmarkets", "mordor intelligence",
    "grand view research", "straits research", "fortune business insights",
    "research and markets", "globe newswire", "openpr", "einpresswire",
    "future market insights", "precedence research",
    "cognitive market research", "polaris market research", "imarc",
    "data bridge", "verified market", "persistence market", "fact.mr",
]
# 按标题模板屏蔽（命中即丢弃，针对"World X - Market Analysis, Forecast, Size, Trends"类）
BLOCKED_TITLE_PATTERNS = [
    "market analysis, forecast, size",
    "market size, share, growth",
    "market size, share & trends",
    "market to grow", "market worth", "market forecast to 20",
    "cagr", "billion by 20",
]

# 单次运行处理条数上限（控制 AI 成本与运行时间）
MAX_ITEMS_PER_RUN = 60
# 每批送 AI 处理的条数
AI_BATCH_SIZE = 8
# 数据保留天数
KEEP_DAYS = 30

# 信源等级 → 权威分（满分25，对应五维评分中的"权威性"）
TIER_AUTHORITY = {"T1": 25, "T1.5": 22, "T2": 16, "T3": 10}

# 精选阈值（recall 优先，宁松勿紧）
FEATURED_THRESHOLD = 72

# 实质性系数：AI 判内容类型，代码乘罚分。解决"软文/科普最切题却最没价值"的漏洞。
# high=真实新闻事件 / medium=有实质或含真实数据 / low=营销软文/科普/无数据市场展望
SUBSTANCE_MULTIPLIER = {"high": 1.0, "medium": 0.85, "low": 0.4}
# low 实质性永不进精选（硬门槛，即便原始分很高）
SUBSTANCE_FEATURED_BLOCK = ("low",)

CATEGORIES = ["标准政策", "产品与材料", "市场价格", "工程应用", "企业展会", "技术观点"]

# 日报版块 ↔ 分类映射
DAILY_SECTIONS = [
    {"title": "政策法规变动", "icon": "policy",  "category": "标准政策"},
    {"title": "产品与材料动态", "icon": "product", "category": "产品与材料"},
    {"title": "市场价格信号", "icon": "market",  "category": "市场价格"},
    {"title": "工程与应用案例", "icon": "project", "category": "工程应用"},
    {"title": "企业与展会动态", "icon": "company", "category": "企业展会"},
    {"title": "技术与选型观点", "icon": "tech",    "category": "技术观点"},
]
