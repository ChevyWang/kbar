# K线训练营 · Phase 5 执行（心理与实盘）

从「知道」到「做到」：概率思维、与盈亏脱钩的决策质量记分卡、认知偏差与弱点画像、回撤期协议、60 秒执行检查单、三级升仓阶梯 + 毕业考。6 课 · 内容时长 65–73 min/课 + 6–8 周并行实盘；全程用课程自己的数据解剖心理（18 笔止损研究、BT30 水下段）。全部课件为**自包含 HTML**，可离线、可打印。

## 快速开始

```bash
open index.html            # 或
python3 -m http.server 8000
```

## 目录结构

```
course/
├── index.html              # 课程主页
├── lessons/                # 5001–5006 六课（5006=升仓协议+毕业考）
├── reference/
│   ├── glossary-p5.html    # 本阶段速查（由 lib/gen_glossary.py 生成）
│   └── toolkit.html        # 执行工具包（记分卡/检查单/回撤协议/阶梯，可打印）
└── assets/                 # course.css / candles.js（lib/ 权威版副本）/ quiz.js
```

## 教材依据（grounding 到章）

Douglas《交易心理分析》（中英对照）· 行为金融第三柱：Kahneman-Tversky (1979)、Shefrin-Statman (1985)、Odean (1998)· Duke《Thinking in Bets》。实证数据：`private/`（aftermath_p5 18 笔止损研究、windows_p5），面向读者的数字由脚本计算并过 `tools/verify_data.py`。

## 机制说明（2026-09-09 起）

- **candles.js 唯一权威版**在 `~/Desktop/learn/lib/candles.js`，`publish.sh` 发布前自动同步副本。
- **术语**：新词条登记 `~/Desktop/learn/lib/glossary.json`，跑 `lib/gen_glossary.py` 生成速查页与站点根手册。
- 每课结构、配色、Quiz 约定见 Phase 0 的 `course/README.md`（全站统一）。

## 版权与引用

课件文本可自由用于个人学习；公开转载注明来源与所引原著。行情数据来自 Binance 公开 API，仅供教学演示，不构成投资建议。
