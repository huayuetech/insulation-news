# -*- coding: utf-8 -*-
"""
网页变化哨兵 —— 监测无 RSS、结构混乱的 T1 政府/标准源是否更新。
不解析内容，只判断"是否变化"：变了就产出一条提醒资讯，由人工点原文判断。

状态存于 data/watch-state.json（每个源记录上次内容哈希 + 抓取时间）。
"""
import hashlib
import json
import os
import re
import ssl
import urllib.request
from datetime import datetime, timezone

STATE_PATH = None  # 由 scrape.py 注入

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/120.0 Safari/537.36")
_CTX = ssl.create_default_context()
_CTX.check_hostname = False
_CTX.verify_mode = ssl.CERT_NONE


def _fetch_text(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    html = urllib.request.urlopen(req, timeout=20, context=_CTX).read().decode("utf-8", "ignore")
    # 去脚本/样式/标签，得到纯可见文本
    text = re.sub(r"<(script|style)[\s\S]*?</\1>", " ", html)
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"&#?[a-z0-9]+;", " ", text)
    # 归一化：剔除易变内容（时间戳/会话令牌/长ID），避免环境差异或页面计数器造成误报，
    # 但保留法规编号、年份等短数字（真正的变更信号会伴随文本变化）
    text = re.sub(r"\b\d{8,}\b", " ", text)                 # 8位以上数字串（epoch/ID）
    text = re.sub(r"\b[0-9a-fA-F]{16,}\b", " ", text)       # 长十六进制（CSRF/session token）
    text = re.sub(r"\b\d{1,2}:\d{2}(:\d{2})?\b", " ", text) # 时分秒
    text = re.sub(r"\s+", " ", text).strip().lower()
    return text


def _load_state(path):
    if os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    return {}


def _save_state(path, state):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(state, f, ensure_ascii=False, indent=2)


def run_watchers(watch_sources, state_path, now=None):
    """返回因页面变化而新产出的提醒资讯（与 news.json 同结构的精简条目）。"""
    now = now or datetime.now(timezone.utc)
    state = _load_state(state_path)
    alerts = []

    for src in watch_sources:
        if src.get("enabled") is False:
            continue  # 地理封锁/暂禁源，跳过（保留配置以备将来用代理接入）
        name, url = src["name"], src["url"]
        try:
            text = _fetch_text(url)
        except Exception as e:
            print(f"[哨兵失败] {name}: {e}")
            continue

        digest = hashlib.sha256(text.encode("utf-8")).hexdigest()
        prev = state.get(name, {})
        first_seen = "hash" not in prev

        if prev.get("hash") == digest:
            print(f"[哨兵] {name}: 无变化")
        else:
            if first_seen:
                print(f"[哨兵] {name}: 首次记录基线（不报警）")
            else:
                print(f"[哨兵] {name}: 检测到页面更新 → 生成提醒")
                date_str = now.strftime("%Y-%m-%d")
                uid = hashlib.md5((url + digest).encode()).hexdigest()[:8]
                alerts.append({
                    "id": f"{date_str.replace('-','')}-{uid}",
                    "title": f"⚠️ {name} 页面有更新，建议人工查看",
                    "titleOriginal": "",
                    "summary": f"{src.get('note','')}。系统检测到该官方页面内容发生变化，可能有新增/修订的法规或标准，请点击原文确认。",
                    "category": "标准政策",
                    "materials": [],
                    "applications": [],
                    "country": src.get("country", "GLOBAL"),
                    "region": "",  # 由 scrape.py 补
                    "source": name,
                    "sourceUrl": url,
                    "sourceTier": src.get("tier", "T1"),
                    "sourceType": "官方源",
                    "date": date_str,
                    "score": 95,            # 官方源变动，固定高分确保进精选
                    "featured": True,
                    "impact": "high",
                    "impactNote": "官方页面更新，可能含强制法规变动，需人工核实",
                    "dimensions": {"relevance": 28, "authority": 25, "timeliness": 20,
                                   "businessValue": 14, "marketImpact": 8},
                    "eventCluster": None,
                    "isMainEvent": True,
                    "relatedIds": [],
                    "topic": f"核实 {name} 的具体变动，评估对相关市场出口的影响",
                    "isWatchAlert": True,
                })

        state[name] = {"hash": digest, "lastCheck": now.isoformat(),
                       "lastChange": now.isoformat() if (not first_seen and prev.get("hash") != digest)
                       else prev.get("lastChange", now.isoformat())}

    _save_state(state_path, state)
    return alerts
