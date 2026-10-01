#!/usr/bin/env python3
"""一次性檢查：計畫的步驟與決定欄位齊全、需求清單每項都有對應。

用法：python3 check_plan.py [--report validation-report.md]
只在本階段有意義，留在附件；不進 repo 的 CI。
"""
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
PLAN = HERE.parent / (HERE.name + ".md")
REQS = HERE / "requirements.md"

STEP_FIELDS = ["範圍", "消費端", "不能動", "驗收", "停止條件"]
errors = []


def section(text, title):
    m = re.search(rf"^## {title}.*?$(.*?)(?=^## |\Z)", text, re.S | re.M)
    return m.group(1) if m else ""


def check_plan(plan):
    steps = re.split(r"^- \[[ x]\] \*\*", section(plan, "步驟"), flags=re.M)[1:]
    numbers = set()
    for body in steps:
        m = re.match(r"(\d+)\. ([^*]+)\*\*（被擋於：([^）]+)）", body)
        if not m:
            errors.append(f"步驟缺編號或「被擋於」：{body[:40]!r}")
            continue
        num, name = m.group(1), m.group(2)
        numbers.add(num)
        if name.strip().startswith("收尾"):
            if "驗收" not in body:
                errors.append(f"步驟 {num} 收尾缺驗收")
            continue
        for f in STEP_FIELDS:
            if f"  - {f}：" not in body:
                errors.append(f"步驟 {num} 缺欄位：{f}")
        if "mutation" not in body and "不寫產品程式碼" not in body:
            errors.append(f"步驟 {num} 驗收沒有 mutation")
        if "確認正常" in body:
            errors.append(f"步驟 {num} 用了無法判定的「確認正常」")
    decisions = re.split(r"^- \*\*(?=D\d+ )", section(plan, "決定"), flags=re.M)[1:]
    ids = set()
    for body in decisions:
        did = body.split()[0]
        ids.add(did)
        head = body.splitlines()[0]
        for f in ["狀態：", "擋住步驟：", "需要的事實："]:
            if f not in head:
                errors.append(f"{did} 標題缺 {f}")
        if len(re.findall(r"^\s+- [A-D]：", body, re.M)) < 2 and "／" not in body:
            errors.append(f"{did} 少於兩個選項")
        if "建議" not in body:
            errors.append(f"{did} 沒有建議")
        if "結論：" not in body:
            errors.append(f"{did} 沒有結論欄")
    progress = section(plan, "進度")
    for n in numbers:
        if not re.search(rf"^\| {n} ", progress, re.M):
            errors.append(f"進度表缺步驟 {n}")
    return numbers, ids, plan


def check_reqs(numbers, ids, plan):
    scope = section(plan, "範圍")
    for line in REQS.read_text().splitlines():
        m = re.match(r"\| (R\d+) \|.*\| ([^|]+) \|$", line)
        if not m:
            continue
        rid, target = m.group(1), m.group(2).strip()
        if not target:
            errors.append(f"{rid} 沒有對應")
            continue
        for n in re.findall(r"步驟 (\d+)", target):
            if n not in numbers:
                errors.append(f"{rid} 指向不存在的步驟 {n}")
        for d in re.findall(r"D\d+", target):
            if d not in ids:
                errors.append(f"{rid} 指向不存在的決定 {d}")
        if target in ("不做", "延後") and rid not in scope:
            errors.append(f"{rid} 標「{target}」但範圍段沒有提到 {rid}")


def check_report(path):
    p = HERE / path
    if not p.exists():
        errors.append(f"找不到 {path}")
        return
    text = p.read_text()
    for line in text.splitlines():
        if line.startswith("|") and re.search(r"\|\s*\|", line):
            errors.append(f"{path} 有空格：{line}")
    risks = section((HERE / "nfr-and-risks.md").read_text(), "待驗證的產品風險")
    for line in risks.splitlines():
        m = re.match(r"\| ([^|-][^|]*?) \|", line)
        if m and m.group(1) not in ("風險", "付費"):
            if m.group(1) not in text:
                errors.append(f"{path} 沒有涵蓋風險：{m.group(1)}")


def main():
    numbers, ids, plan = check_plan(PLAN.read_text())
    check_reqs(numbers, ids, plan)
    if "--report" in sys.argv:
        check_report(sys.argv[sys.argv.index("--report") + 1])
    for e in errors:
        print("ERROR", e)
    print(f"steps={len(numbers)} decisions={len(ids)} errors={len(errors)}")
    sys.exit(1 if errors else 0)


if __name__ == "__main__":
    main()
