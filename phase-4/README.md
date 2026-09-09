# K线训练营 · Phase 4 系统（组装交易系统）

从「看到」到「等到」到「算到」：Setup 正式定义、入场/止损/出场/目标全规则、R 与凯利、仓位模型、四市场微观结构、一页纸交易计划 + 30 笔手工回测毕业考。10 课 · 内容时长 65–80 min/课；示范系统「训练者一号」33 品种×5 年 87 笔真实交易贯穿全阶段；含蒙特卡洛与仓位计算器交互。全部课件为**自包含 HTML**，可离线、可打印。

## 快速开始

```bash
open index.html            # 或
python3 -m http.server 8000
```

## 目录结构

```
course/
├── index.html              # 课程主页
├── lessons/                # 4001–4010 十课（4010=手工回测+毕业考）
├── reference/
│   ├── glossary-p4.html    # 本阶段速查（由 lib/gen_glossary.py 生成）
│   └── one-page-plan.html  # 一页纸交易计划模板（可打印）
└── assets/                 # course.css / candles.js（lib/ 权威版副本）/ quiz.js
```

## 教材依据（grounding 到章）

Grimes《The Art and Science of Technical Analysis》Part III（setup/入场/止损/出场）· Brooks《Reversals》· Harris《交易与交易所》（微观结构）· Kelly (1956)；学术柱 Osler（止损聚集）。回测与实验数据：`private/`（backtest_p4 / variants / windows，87 笔 + 三执行变体 + 相关性矩阵），面向读者的数字由脚本计算并过 `tools/verify_data.py`。

## 机制说明（2026-09-09 起）

- **candles.js 唯一权威版**在 `~/Desktop/learn/lib/candles.js`（本 phase 副本即其来源），`publish.sh` 发布前自动同步。
- **术语**：新词条登记 `~/Desktop/learn/lib/glossary.json`，跑 `lib/gen_glossary.py` 生成速查页与站点根手册。
- 每课结构、配色、Quiz 约定见 Phase 0 的 `course/README.md`（全站统一）。

## 版权与引用

课件文本可自由用于个人学习；公开转载注明来源与所引原著。行情数据来自 Binance 公开 API，仅供教学演示，不构成投资建议。
