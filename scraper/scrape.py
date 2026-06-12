# -*- coding: utf-8 -*-
"""
Insulation News 抓取管线（零第三方依赖，Python 3.9+ 标准库实现）

流程：RSS抓取 → 关键词预筛 → AI批量处理（翻译/分类/国别/评分维度）
      → 代码计算最终分与精选 → 标题去重 → 合并历史 → 输出 news.json
      → 生成日报 → 重新打包 bundle.js

环境变量（或 scraper/.env）：AIHUBMIX_API_KEY / AIHUBMIX_BASE_URL / AI_MODEL
"""
import json
import os
import re
import sys
import hashlib
import urllib.request
import urllib.parse
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import config

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(ROOT, "data")

# ---------- 环境 ----------
def load_env():
    env_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
    if os.path.exists(env_file):
        for line in open(env_file, encoding="utf-8"):
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k, v)

load_env()
API_KEY = os.environ.get("AIHUBMIX_API_KEY", "")
BASE_URL = os.environ.get("AIHUBMIX_BASE_URL", "https://api.aihubmix.com/v1")
MODEL = os.environ.get("AI_MODEL", "deepseek-v4-flash")
NOW = datetime.now(timezone.utc)

# ---------- RSS 抓取 ----------
def http_get(url, timeout=30):
    req = urllib.request.Request(url, headers={
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) InsulationNewsBot/1.0"
    })
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()

def text_of(el, *tags):
    for tag in tags:
        node = el.find(tag)
        if node is not None and node.text:
            return node.text.strip()
    return ""

def strip_html(s):
    s = re.sub(r"<[^>]+>", " ", s or "")
    s = re.sub(r"&[a-zA-Z#0-9]+;", " ", s)
    return re.sub(r"\s+", " ", s).strip()

def parse_rss(xml_bytes, source_name, tier, source_type):
    items = []
    try:
        root = ET.fromstring(xml_bytes)
    except ET.ParseError:
        return items
    for item in root.iter("item"):
        title = text_of(item, "title")
        link = text_of(item, "link")
        desc = strip_html(text_of(item, "description"))[:600]
        pub = text_of(item, "pubDate")
        try:
            dt = parsedate_to_datetime(pub)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
        except Exception:
            dt = NOW
        if not title or not link:
            continue
        items.append({
            "titleOriginal": title,
            "summaryOriginal": desc,
            "sourceUrl": link,
            "source": source_name,
            "sourceTier": tier,
            "sourceType": source_type,
            "date": dt.astimezone(timezone.utc).strftime("%Y-%m-%d"),
            "_dt": dt,
        })
    return items

def fetch_all():
    raw = []
    for src in config.RSS_SOURCES:
        try:
            data = http_get(src["url"])
            got = parse_rss(data, src["name"], src["tier"], src["sourceType"])
            for g in got:
                g["_trusted"] = src["trusted"]
            print(f"[抓取] {src['name']}: {len(got)} 条")
            raw += got
        except Exception as e:
            print(f"[抓取失败] {src['name']}: {e}")
    for q in config.GOOGLE_NEWS_QUERIES:
        url = config.GOOGLE_NEWS_URL.format(q=urllib.parse.quote(q))
        try:
            data = http_get(url)
            got = parse_rss(data, "Google News", "T3", "市场观察")
            for g in got:
                g["_trusted"] = False
                # Google News 标题尾部带 " - 媒体名"，提取真实来源
                m = re.search(r"\s+-\s+([^-]+)$", g["titleOriginal"])
                if m:
                    g["source"] = m.group(1).strip()
                    g["titleOriginal"] = g["titleOriginal"][: m.start()].strip()
            print(f"[抓取] Google News [{q[:30]}...]: {len(got)} 条")
            raw += got
        except Exception as e:
            print(f"[抓取失败] Google News: {e}")
    return raw

# ---------- 预筛与去重 ----------
def keyword_relevant(item):
    text = (item["titleOriginal"] + " " + item["summaryOriginal"]).lower()
    return any(k.lower() in text for k in config.RELEVANCE_KEYWORDS)

def norm_title(t):
    return re.sub(r"[^a-z0-9一-鿿]+", "", t.lower())

def jaccard(a, b):
    sa, sb = set(a.lower().split()), set(b.lower().split())
    if not sa or not sb:
        return 0.0
    return len(sa & sb) / len(sa | sb)

def prefilter(raw, existing_urls, existing_titles):
    seen_urls, seen_norm = set(), set()
    out = []
    cutoff = NOW - timedelta(days=config.KEEP_DAYS)
    for it in sorted(raw, key=lambda x: x["_dt"], reverse=True):
        if it["_dt"] < cutoff:
            continue
        if it["sourceUrl"] in existing_urls or it["sourceUrl"] in seen_urls:
            continue
        nt = norm_title(it["titleOriginal"])
        if nt in seen_norm or nt in existing_titles:
            continue
        if not it["_trusted"] and not keyword_relevant(it):
            continue
        # 与本批已收条目做标题相似度去重
        if any(jaccard(it["titleOriginal"], o["titleOriginal"]) >= 0.6 for o in out):
            continue
        seen_urls.add(it["sourceUrl"])
        seen_norm.add(nt)
        out.append(it)
        if len(out) >= config.MAX_ITEMS_PER_RUN:
            break
    return out

# ---------- AI 处理 ----------
AI_PROMPT = """你是建筑保温材料行业的资讯分析师，服务于一家中国保温材料出口企业（主营玻璃棉、岩棉等，面向全球B2B市场）。
对下面每条英文资讯输出 JSON 对象，所有条目组成 JSON 数组，不要输出任何其他文字。

每个对象的字段：
- idx: 条目序号（与输入一致）
- relevant: 是否与建筑/工业保温材料行业相关（true/false）。如果 false，其余字段可省略。
- title: 中文标题（信达雅，保留关键数字与标准号）
- summary: 一句话中文摘要（60字内，突出对中国保温材料出口商的意义）
- category: 从以下选一："标准政策","产品与材料","市场价格","工程应用","企业展会","技术观点"
- country: ISO两位国家码（如 SA/AE/VN/US/DE）；欧盟整体用 "EU"；无法判断用 "GLOBAL"
- materials: 涉及的材料中文标签数组（如 ["玻璃棉","岩棉"]），最多3个，没有则 []
- impact: 对华跃业务的影响 "high"/"medium"/"low"
- impactNote: 一句话影响说明（30字内），low 可省略
- topic: 一句话内容选题建议（30字内）
- relevance: 行业相关度 0-30 整数
- businessValue: 业务价值 0-15 整数（政策强制变化、大额采购信号给高分）
- marketImpact: 市场影响力 0-12 整数

输入条目：
{items}"""

def ai_chat(prompt, max_retries=2):
    body = json.dumps({
        "model": MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.2,
    }).encode()
    req = urllib.request.Request(
        BASE_URL + "/chat/completions", data=body,
        headers={"Authorization": "Bearer " + API_KEY, "Content-Type": "application/json"},
    )
    for attempt in range(max_retries + 1):
        try:
            with urllib.request.urlopen(req, timeout=180) as r:
                resp = json.load(r)
            return resp["choices"][0]["message"]["content"]
        except Exception as e:
            if attempt == max_retries:
                raise
            print(f"  [AI重试 {attempt+1}] {e}")

def parse_json_array(text):
    m = re.search(r"\[[\s\S]*\]", text)
    if not m:
        return []
    try:
        return json.loads(m.group(0))
    except json.JSONDecodeError:
        return []

def ai_process(items):
    results = {}
    for start in range(0, len(items), config.AI_BATCH_SIZE):
        batch = items[start : start + config.AI_BATCH_SIZE]
        lines = []
        for i, it in enumerate(batch):
            lines.append(f"{i}. [{it['source']}] {it['titleOriginal']}\n   {it['summaryOriginal'][:300]}")
        prompt = AI_PROMPT.replace("{items}", "\n".join(lines))
        print(f"[AI] 处理第 {start+1}-{start+len(batch)} 条...")
        try:
            content = ai_chat(prompt)
        except Exception as e:
            print(f"  [AI失败，跳过本批] {e}")
            continue
        for obj in parse_json_array(content):
            idx = obj.get("idx")
            if isinstance(idx, int) and 0 <= idx < len(batch):
                results[start + idx] = obj
    return results

# ---------- 评分与组装 ----------
def timeliness_score(date_str):
    try:
        d = datetime.strptime(date_str, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    except ValueError:
        return 6
    days = (NOW - d).days
    if days <= 0: return 20
    if days <= 2: return 18
    if days <= 4: return 14
    if days <= 7: return 10
    return 6

def load_regions():
    with open(os.path.join(DATA_DIR, "countries.json"), encoding="utf-8") as f:
        cdata = json.load(f)
    code2region = {}
    for region in cdata["regions"]:
        for c in region["countries"]:
            code2region[c["code"]] = region["name"]
    return code2region

def assemble(items, ai_results, code2region):
    out = []
    for i, it in enumerate(items):
        ai = ai_results.get(i)
        if not ai or not ai.get("relevant"):
            continue
        rel = max(0, min(30, int(ai.get("relevance", 15))))
        bus = max(0, min(15, int(ai.get("businessValue", 7))))
        mkt = max(0, min(12, int(ai.get("marketImpact", 5))))
        auth = config.TIER_AUTHORITY.get(it["sourceTier"], 10)
        tim = timeliness_score(it["date"])
        score = rel + bus + mkt + auth + tim
        country = (ai.get("country") or "GLOBAL").upper()
        uid = hashlib.md5(it["sourceUrl"].encode()).hexdigest()[:8]
        out.append({
            "id": f"{it['date'].replace('-','')}-{uid}",
            "title": ai.get("title") or it["titleOriginal"],
            "titleOriginal": it["titleOriginal"],
            "summary": ai.get("summary") or it["summaryOriginal"][:120],
            "category": ai.get("category") if ai.get("category") in config.CATEGORIES else "技术观点",
            "materials": (ai.get("materials") or [])[:3],
            "applications": [],
            "country": country,
            "region": code2region.get(country, "全球"),
            "source": it["source"],
            "sourceUrl": it["sourceUrl"],
            "sourceTier": it["sourceTier"],
            "sourceType": it["sourceType"],
            "date": it["date"],
            "score": score,
            "featured": score >= config.FEATURED_THRESHOLD,
            "impact": ai.get("impact") if ai.get("impact") in ("high", "medium", "low") else "low",
            "impactNote": ai.get("impactNote", ""),
            "dimensions": {"relevance": rel, "authority": auth, "timeliness": tim,
                           "businessValue": bus, "marketImpact": mkt},
            "eventCluster": None,
            "isMainEvent": True,
            "relatedIds": [],
            "topic": ai.get("topic", ""),
        })
    return out

# ---------- 输出 ----------
def generate_daily(all_items):
    today_str = NOW.strftime("%Y-%m-%d")
    recent = [i for i in all_items if i["featured"]]
    sections = []
    for sec in config.DAILY_SECTIONS:
        rows = sorted([i for i in recent if i["category"] == sec["category"]],
                      key=lambda x: x["score"], reverse=True)[:5]
        if not rows:
            continue
        sections.append({
            "title": sec["title"], "icon": sec["icon"],
            "items": [{"id": r["id"], "title": r["title"], "summary": r["summary"],
                       "country": r["country"], "source": r["source"], "impact": r["impact"]}
                      for r in rows],
        })
    report = {"date": today_str, "generatedAt": NOW.astimezone().isoformat(), "sections": sections}
    os.makedirs(os.path.join(DATA_DIR, "daily-reports"), exist_ok=True)
    path = os.path.join(DATA_DIR, "daily-reports", f"{today_str}.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    return report

def regenerate_bundle(news, daily):
    with open(os.path.join(DATA_DIR, "countries.json"), encoding="utf-8") as f:
        countries = f.read().strip()
    with open(os.path.join(DATA_DIR, "bundle.js"), "w", encoding="utf-8") as f:
        f.write("// 自动生成：news.json + countries.json + 日报 的离线打包\n")
        f.write("window.__INSULATION_DATA__ = {\n")
        f.write("news: " + json.dumps(news, ensure_ascii=False) + ",\n")
        f.write("countries: " + countries + ",\n")
        f.write("daily: " + json.dumps(daily, ensure_ascii=False) + "\n};\n")

def main():
    if not API_KEY:
        print("错误：未配置 AIHUBMIX_API_KEY")
        sys.exit(1)

    news_path = os.path.join(DATA_DIR, "news.json")
    with open(news_path, encoding="utf-8") as f:
        old = json.load(f)
    # 仅保留真实抓取的历史（id 含8位哈希后缀）；首次运行时丢弃模拟数据
    history = [i for i in old.get("items", []) if re.search(r"-[0-9a-f]{8}$", i.get("id", ""))]
    existing_urls = {i["sourceUrl"] for i in history}
    existing_titles = {norm_title(i.get("titleOriginal") or i["title"]) for i in history}

    print("=== 第1步 抓取 ===")
    raw = fetch_all()
    print(f"原始合计: {len(raw)} 条")

    print("=== 第2步 预筛+去重 ===")
    fresh = prefilter(raw, existing_urls, existing_titles)
    print(f"送AI处理: {len(fresh)} 条")

    print("=== 第3步 AI 处理 ===")
    ai_results = ai_process(fresh)
    print(f"AI判定相关: {sum(1 for v in ai_results.values() if v.get('relevant'))} 条")

    print("=== 第4步 评分组装 ===")
    code2region = load_regions()
    new_items = assemble(fresh, ai_results, code2region)

    # 合并历史，按日期+分数排序，丢弃超期
    cutoff = (NOW - timedelta(days=config.KEEP_DAYS)).strftime("%Y-%m-%d")
    merged = new_items + [i for i in history if i["date"] >= cutoff]
    merged.sort(key=lambda x: (x["date"], x["score"]), reverse=True)

    news = {
        "lastUpdated": NOW.astimezone().isoformat(),
        "dailyDate": NOW.strftime("%Y-%m-%d"),
        "totalSources": len(config.RSS_SOURCES) + len(config.GOOGLE_NEWS_QUERIES),
        "items": merged,
    }
    with open(news_path, "w", encoding="utf-8") as f:
        json.dump(news, f, ensure_ascii=False, indent=2)

    print("=== 第5步 日报+打包 ===")
    daily = generate_daily(merged)
    regenerate_bundle(news, daily)

    featured = sum(1 for i in merged if i["featured"])
    print(f"完成：新增 {len(new_items)} 条 | 库内共 {len(merged)} 条 | 精选 {featured} 条 | 日报 {len(daily['sections'])} 个版块")

if __name__ == "__main__":
    main()
