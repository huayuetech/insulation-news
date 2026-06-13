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
