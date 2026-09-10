# K线训练营 · Phase 2 地形（Wyckoff + Volume Profile）

从「这根K线说了什么」到「这段行情背后的大资金在做什么」：Wyckoff 结构分析（吸筹/派发五幕剧、Spring/UTAD、努力与结果）+ Volume Profile 地形成像 + 三层地形图合成。8 课 · 内容时长 64–68 min/课（视觉增强版）+ 毕业作业 + LINK 盲图毕业考。全部课件为**自包含 HTML**，无外部依赖、可离线、可打印。

## 快速开始

```bash
open index.html            # 或
python3 -m http.server 8000
```

## 目录结构

```
course/
├── index.html              # 课程主页
├── lessons/                # 2001–2008 八课（2008=综合作业+毕业考）
├── reference/
│   ├── glossary.html       # 全量术语手册（P0–P2，由 lib/gen_glossary.py 生成）
│   ├── review-template.html# 复盘 3.0 模板
│   └── tradingview-guide.html
└── assets/                 # course.css / candles.js（lib/ 权威版副本）/ quiz.js
```

## 教材依据（grounding 到章）

Villahermosa《The Wyckoff Methodology in Depth》《Wyckoff 2.0》（W1/W2）· Weis《Trades About to Happen》· Dalton《Mind Over Markets》(2nd) · 孟洪涛《新威科夫操盘法》。锚定数据：XRPUSDT 完整周期（1d/1h，剖面由 2906 根 1h 逐档计算）；毕业考 LINK/USDT（与课件数据不同源）。面向读者的数字由脚本计算并过 `tools/verify_data.py`。

## 机制说明（2026-09-09 起）

- **candles.js 唯一权威版**在 `~/Desktop/learn/lib/candles.js`，`publish.sh` 发布前自动同步副本。
- **术语**：新词条登记 `~/Desktop/learn/lib/glossary.json`，跑 `lib/gen_glossary.py` 重新生成本 phase 与站点根手册（本目录 gen_glossary.py 已退役，仅留档）。
- 每课结构、配色、Quiz 约定见 Phase 0 的 `course/README.md`（全站统一）。

## 版权与引用

课件文本可自由用于个人学习；公开转载注明来源与所引原著。行情数据来自 Binance 公开 API，仅供教学演示，不构成投资建议。

## 当前验收入口

[能力验收与学习档案](mastery.html)提供本阶段教学卡与五份起步任务。结构化检查逐项通过，开放自评、AI反馈和专门实作分别记录；课内选择题分数不授予里程碑。任务数量和跨日间隔是待试学校准的设计参数。内容分钟是标称预算，不是掌握实测。
