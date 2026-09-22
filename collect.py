# -*- coding: utf-8 -*-
"""
月度竞品车型 / 零部件新技术信息采集脚本
----------------------------------------
职责：定向抓取 config/sources.yaml 中官方渠道的新闻列表页，
     提取「标题 + 链接 + 发布日期」原始条目，按月归档到 data/raw/{YYYY-MM}/items.json。
定位：只做"收集"这一步的自动化。校验/分类/分析/写报由 Trae AI 月度生成阶段完成
     （见 monthly-workflow.md）。

用法：
    python collect.py            # 采集当前月份窗口
    python collect.py 2026-09    # 采集指定月份窗口
"""
import argparse
import concurrent.futures
import hashlib
import json
import re
import sys
import urllib3
from datetime import datetime, timedelta
from pathlib import Path

import requests
import yaml
from bs4 import BeautifulSoup

try:
    import feedparser
    HAS_FEEDPARSER = True
except ImportError:
    HAS_FEEDPARSER = False

BASE = Path(__file__).resolve().parent
CONFIG = BASE / "config" / "sources.yaml"
DATA_DIR = BASE / "data" / "raw"

HEADERS = {
    "User-Agent": ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                   "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.6",
}

# 通用新闻链接过滤：排除导航/页脚等非新闻词
NAV_WORDS = re.compile(
    r"^(首页|登录|注册|关于|联系|招聘|法务|隐私|EN|English|更多|MORE|搜索|网站地图|"
    r"版权|免责|回到顶部|订阅|关注我们|分享|上一篇|下一篇|关闭|下载)$"
)
NEWS_HREF_RE = re.compile(r"(news|press|article|info|zixun|xwzx|fabu|notice|公告|新闻)", re.I)
# 日期模式：2026-09-16 / 2026年9月16日 / 2026.09.16 / 2026/09/16 / 09-16
DATE_PATTERNS = [
    re.compile(r"(\d{4})[-年./](\d{1,2})[-年./](\d{1,2})"),
    re.compile(r"(\d{1,2})月(\d{1,2})日"),
    re.compile(r"(\d{2})-(\d{2})(?!\d)"),
]
TITLE_MIN_LEN = 10


def month_bounds(month: str):
    """返回 (月初, 今天) 边界，用于发布日期窗口过滤。"""
    year, mon = int(month[:4]), int(month[5:7])
    start = datetime(year, mon, 1)
    return start, datetime.now()


def parse_date(text: str):
    """从文本中尽量提取发布日期，失败返回 None。"""
    if not text:
        return None
    for pat in DATE_PATTERNS:
        m = pat.search(text)
        if not m:
            continue
        try:
            parts = [int(p) for p in m.groups()]
            if len(parts) == 3:
                return datetime(parts[0], parts[1], parts[2]).date().isoformat()
            # 无年份：按"不超过今天则属于今年，否则去年"推断
            today = datetime.now().date()
            d = datetime(today.year, parts[0], parts[1]).date()
            if d > today:
                d = d.replace(year=today.year - 1)
            return d.isoformat()
        except ValueError:
            continue
    return None


def fetch(session: requests.Session, url: str, timeout: int, verify: bool):
    """抓取 URL，证书异常时自动降级重试一次。返回 (text, err)。"""
    try:
        r = session.get(url, headers=HEADERS, timeout=timeout, verify=verify)
        r.raise_for_status()
        if not r.encoding or r.encoding.lower() in ("iso-8859-1", "ascii"):
            r.encoding = r.apparent_encoding or "utf-8"
        return r.text, None
    except requests.exceptions.SSLError:
        try:
            r = session.get(url, headers=HEADERS, timeout=timeout, verify=False, proxies={"https": None})
            r.raise_for_status()
            if not r.encoding or r.encoding.lower() in ("iso-8859-1", "ascii"):
                r.encoding = r.apparent_encoding or "utf-8"
            return r.text, None
        except Exception as e:
            return None, f"ssl-fallback失败: {type(e).__name__}: {e}"
    except Exception as e:
        return None, f"{type(e).__name__}: {e}"


def extract_items_html(html: str, base_url: str) -> list:
    """通用新闻列表页解析：收集疑似新闻条目的 (标题, url, 日期文本)。"""
    soup = BeautifulSoup(html, "lxml")
    items, seen = [], set()
    for a in soup.find_all("a", href=True):
        title = re.sub(r"\s+", " ", a.get_text(" ", strip=True))
        if len(title) < TITLE_MIN_LEN or NAV_WORDS.match(title):
            continue
        href = a["href"].strip()
        if href.startswith(("javascript:", "#", "mailto:")):
            continue
        from urllib.parse import urljoin
        url = urljoin(base_url, href)
        if not url.startswith("http"):
            continue
        key = url.split("?")[0]
        if key in seen:
            continue
        # 链接路径或标题需带新闻特征，降低导航栏误采率
        if not (NEWS_HREF_RE.search(key) or NEWS_HREF_RE.search(title)):
            continue
        seen.add(key)
        # 日期通常出现在链接自身、同级或父级文本里
        ctx_parts = [title]
        for node in (a.parent, a.parent.parent if a.parent else None):
            if node is not None:
                ctx_parts.append(node.get_text(" ", strip=True)[:300])
        pub = parse_date(" ".join(ctx_parts))
        items.append({"title": title[:200], "url": url, "publish_date": pub})
    return items


def extract_items_rss(raw_text: str) -> list:
    if not HAS_FEEDPARSER:
        return []
    fp = feedparser.parse(raw_text)
    items = []
    for e in fp.entries:
        title = re.sub(r"\s+", " ", e.get("title", "")).strip()
        if not title:
            continue
        pub = None
        for k in ("published_parsed", "updated_parsed"):
            if e.get(k):
                pub = datetime(*e[k][:3]).date().isoformat()
                break
        items.append({"title": title[:200], "url": e.get("link", ""), "publish_date": pub})
    return items


def crawl_source(session, cfg: dict, month: str, crawl_cfg: dict) -> dict:
    """抓取单源并过滤到采集窗口内，返回 per-source 结果。"""
    name = cfg["name"]
    url = cfg["url"]
    timeout = int(crawl_cfg.get("timeout", 20))
    verify = bool(cfg.get("verify_ssl", True))
    try:
        html, err = fetch(session, url, timeout, verify)
        if err:
            return {"source_id": cfg["id"], "name": name, "status": "failed", "error": err, "items": []}
        if cfg.get("type") == "rss":
            raw_items = extract_items_rss(html)
        else:
            raw_items = extract_items_html(html, url)
        window_start, today = month_bounds(month)
        win_start = (window_start - timedelta(days=int(crawl_cfg.get("lookback_days", 45)))).date()
        kept, dropped_old = [], 0
        for it in raw_items[: int(crawl_cfg.get("max_items_per_source", 30)) * 3]:
            d = it.get("publish_date")
            if d:
                if datetime.fromisoformat(d).date() < win_start or datetime.fromisoformat(d).date() > today.date():
                    dropped_old += 1
                    continue
            kept.append(it)
            if len(kept) >= int(crawl_cfg.get("max_items_per_source", 30)):
                break
        status = "ok" if raw_items else "empty"
        return {"source_id": cfg["id"], "name": name, "status": status, "error": None,
                "items": kept, "dropped_out_of_window": dropped_old}
    except Exception as e:  # 兜底：单源异常不影响整体
        return {"source_id": cfg["id"], "name": name, "status": "failed",
                "error": f"{type(e).__name__}: {e}", "items": []}


def dedupe(all_items: list) -> list:
    """按 URL 主键 + 标题哈希去重（不同源可能转载同一官方发布，保留首次出现）。"""
    seen_url, seen_title, out = set(), set(), []
    for it in all_items:
        ukey = it["url"].split("?")[0]
        tkey = re.sub(r"[\s\W_]", "", it["title"].lower())
        thash = hashlib.md5(tkey.encode()).hexdigest()
        if ukey in seen_url or thash in seen_title:
            it["duplicate_of_official"] = True
            continue
        seen_url.add(ukey)
        seen_title.add(thash)
        out.append(it)
    return out


def main():
    ap = argparse.ArgumentParser(description="月度竞品/技术官方信息采集")
    ap.add_argument("month", nargs="?", default=datetime.now().strftime("%Y-%m"),
                    help="目标月份，格式 YYYY-MM，默认当前月")
    args = ap.parse_args()
    month = args.month
    if not re.match(r"^\d{4}-\d{2}$", month):
        sys.exit("月份格式应为 YYYY-MM，例如 2026-09")

    urllib3.disable_warnings()
    cfg = yaml.safe_load(CONFIG.read_text(encoding="utf-8"))
    crawl_cfg = cfg.get("crawl", {})
    sources = [s for s in cfg.get("sources", []) if s.get("enabled", True)]
    print(f"[collect] 目标月份={month}，启用信息源={len(sources)} 个")

    out_dir = DATA_DIR / month
    out_dir.mkdir(parents=True, exist_ok=True)

    results = []
    with requests.Session() as session:
        with concurrent.futures.ThreadPoolExecutor(
                max_workers=int(crawl_cfg.get("workers", 8))) as pool:
            futs = {pool.submit(crawl_source, session, s, month, crawl_cfg): s for s in sources}
            for fut in concurrent.futures.as_completed(futs):
                res = fut.result()
                results.append(res)
                mark = {"ok": "√", "empty": "○", "failed": "×"}[res["status"]]
                print(f"  [{mark}] {res['name']}  条目={len(res['items'])}"
                      + (f"  错误={res['error']}" if res["error"] else ""))

    now = datetime.now().isoformat(timespec="seconds")
    # 挂 source 元信息后统一去重
    src_map = {s["id"]: {"source_id": s["id"], "source_name": s["name"], "category": s["category"]}
               for s in sources}
    final_items = []
    for r in results:
        for it in r["items"]:
            it.pop("duplicate_of_official", None)
            it.update(src_map[r["source_id"]])
            it["id"] = hashlib.md5(it["url"].encode()).hexdigest()[:12]
            it["crawled_at"] = now
            final_items.append(it)
    final_items = dedupe(final_items)

    (out_dir / "items.json").write_text(
        json.dumps({"month": month, "collected_at": now, "count": len(final_items),
                    "items": final_items}, ensure_ascii=False, indent=2), encoding="utf-8")

    log = {"month": month, "collected_at": now,
           "summary": {"sources_total": len(sources),
                       "ok": sum(1 for r in results if r["status"] == "ok"),
                       "empty": sum(1 for r in results if r["status"] == "empty"),
                       "failed": sum(1 for r in results if r["status"] == "failed"),
                       "items_kept": len(final_items)},
           "per_source": [{k: v for k, v in r.items() if k != "items"} for r in results]}
    (out_dir / "collection_log.json").write_text(
        json.dumps(log, ensure_ascii=False, indent=2), encoding="utf-8")

    s = log["summary"]
    print(f"\n[collect] 完成：成功 {s['ok']} / 空列表 {s['empty']} / 失败 {s['failed']}，"
          f"去重后条目 {s['items_kept']} 条")
    print(f"[collect] 输出：{out_dir / 'items.json'}")
    if s["failed"]:
        print("[collect] 注意：存在失败信息源，AI 月度生成阶段会用 WebSearch 兜底，"
              "也可检查 config/sources.yaml 中的失效 URL")


if __name__ == "__main__":
    main()
