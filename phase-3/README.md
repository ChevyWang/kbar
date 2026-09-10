# K线训练营 · Phase 3 概率（Bulkowski / Morris 形态统计全景）

把形态从「看涨/看跌」的词升级为概率语言——任给形态 30 秒说出统计预期 + 过滤条件 + 失效条件。7 课 · 内容时长 65–73 min/课 + 毕业考；含 33 品种×5 年 3594 例三市场统计与 20 样本人工判定实验（3006 交互）。全部课件为**自包含 HTML**，可离线、可打印。

## 快速开始

```bash
open index.html            # 或
python3 -m http.server 8000
```

## 目录结构

```
course/
├── index.html              # 课程主页
├── lessons/                # 3001–3007 七课（3006=动手实验课，3007=反迷信结业+毕业考）
├── reference/
│   ├── glossary-p3.html    # 本阶段速查（由 lib/gen_glossary.py 生成，2026-09-09 补齐）
│   └── pattern-stats.html  # 形态统计总表（三市场分列）
└── assets/                 # course.css / candles.js（lib/ 权威版副本）/ quiz.js
```

## 教材依据（grounding 到章）

Bulkowski《Encyclopedia of Chart Patterns》第3版（表结构/口径/形态章）+《Encyclopedia of Candlestick Charts》· Morris《蜡烛图精解》第3版（Ch.7–9 过滤工程）· 学术柱：Lo-Mamaysky-Wang (2000)、Marshall-Young-Rose (2006)、AMH。统计管线：`private/scan`（33 品种×5 年）与 `stats_p3.js`，面向读者的数字由脚本计算并过 `tools/verify_data.py`。

## 机制说明（2026-09-09 起）

- **candles.js 唯一权威版**在 `~/Desktop/learn/lib/candles.js`，`publish.sh` 发布前自动同步副本。
- **术语**：新词条登记 `~/Desktop/learn/lib/glossary.json`，跑 `lib/gen_glossary.py` 生成速查页与站点根手册。
- 每课结构、配色、Quiz 约定见 Phase 0 的 `course/README.md`（全站统一）。

## 版权与引用

课件文本可自由用于个人学习；公开转载注明来源与所引原著。行情数据来自 Binance 公开 API，仅供教学演示，不构成投资建议。

## 当前验收入口

[能力验收与学习档案](mastery.html)提供本阶段教学卡与五份起步任务。结构化检查逐项通过，开放自评、AI反馈和专门实作分别记录；课内选择题分数不授予里程碑。任务数量和跨日间隔是待试学校准的设计参数。内容分钟是标称预算，不是掌握实测。
