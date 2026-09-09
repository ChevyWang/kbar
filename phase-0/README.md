# K线训练营 · 七日课程（可复用课件包）

从「读一根K线」到「读一张图」的裸K价格行为课程：7 课 · 内容时长 71–81 min/课 + 课外作业，3 个盲图考场，1 个毕业考。全部课件为**自包含 HTML**，无外部依赖、可离线、可打印，可自学也可由教练带练。

## 快速开始

```bash
# 方式一：直接双击打开（macOS 也可）
open index.html

# 方式二：本地静态服务（推荐，方便在课件间跳转）
python3 -m http.server 8000
# 浏览器访问 http://localhost:8000
```

课程入口：`index.html`（课程主页，含七日地图与使用说明）。

## 目录结构

```
course/
├── index.html              # 课程主页（从这里开始）
├── README.md               # 本文件
├── assets/                 # 共享组件（所有课件引用）
│   ├── course.css          # 样式（配色变量在 :root）
│   ├── candles.js          # K线 SVG 渲染库（candle/anatomy/row/chart/playback）
│   └── quiz.js             # 即时反馈选择题训练器
├── lessons/                # 七日课件（每课=知识+训练场+案例深读，课 sub 为内容时长权威源）
│   ├── 0001-anatomy-of-a-candle.html      # 单根解剖：三问框架 + 两个度量
│   ├── 0002-two-candle-dialogue.html      # 双K对话：吞没/Pin/内包 + 确认
│   ├── 0003-position-beats-pattern.html   # 位置>形态：支撑阻力 + 假突破
│   ├── 0004-market-structure.html         # 市场结构：HH/HL/LH/LL + BOS
│   ├── 0005-volume-confirms.html          # 量能：四象限 + 相对量 + 高潮量
│   ├── 0006-multiple-timeframes.html      # 多周期：自上而下 + 冲突裁决
│   └── 0007-chart-reading-training.html   # 训练法：复盘/盲测/错误分类 + 毕业考
├── exercises/              # 盲图考场（真实数据，附折叠参考答案）
│   ├── 0001-blind-chart-btc.html          # 覆盖第 1–2 课（BTC 日线）
│   ├── 0002-blind-chart-sol.html          # 覆盖第 3–4 课（SOL 日线）
│   └── 0003-blind-chart-eth4h.html        # 覆盖第 5–6 课（ETH 4h）
└── reference/
    └── glossary.html       # 术语手册（全课程统一用词）
```

## 教材依据（grounding 模型）

课程内容四层依据，缺一不可，每课页脚"主资源"标注到书与章：

1. **经典原著**：Nison《日本蜡烛图技术》（第二版，丁圣元 译）/ Grimes《The Art and Science of Technical Analysis》/ Brooks《Trading Price Action》三部曲 / Morris《蜡烛图精解》（第3版）/ Bulkowski《Encyclopedia of Candlestick Charts》
2. **统计检验**：Marshall, Young & Rose (2006)、SAGE (2017) 等学术研究
3. **学习方法论**：《认知天性》《刻意练习》——训练场/考场/间隔复习的设计依据
4. **真实数据**：全部案例与考场用交易所真实行情；面向读者的数字与原书逐项核对

新课件制作规范：一切面向读者的数字必须由代码从数据生成，发布前跑 `tools/verify_data.py` 校验（OHLC/marks/verdicts/时间预算/死链/JS 语法）。

## 每课标准结构（内容时长以课 sub 为准 + 课外作业）

1. **知识讲解**（厚课：心理叙述、边界情况、强度分级、worked example、统计引用、跨市场差异）≈ 30 min
2. **训练场**：本课新题 + 混入前几课复习题（不预告，交错练习）≈ 12–16 min
3. **案例深读**：真实数据逐根带读（与考场数据不同源，防泄题）≈ 10 min
4. **小结 + 主资源课外阅读 + 实战作业** ≈ 5 min

课件内不含任何学习者个人信息——进度记录、学习档案、教练笔记请在课件包之外单独维护（例如本仓库的 `private/` 目录，不随课件分发）。

## 技术说明

- **渲染组件 `Kbar`**（`assets/candles.js`）：
  - `Kbar.candle(k, opts)` 单根K线（返回 svg + 实体占比 + 收盘位置）
  - `Kbar.row(candles, opts)` 多根序列；`Kbar.anatomy()` 标注解剖图
  - `Kbar.chart(candles, opts)` 完整图表：量能柱 `vol`、水平位 `levels`、区域 `zones`、结构标注 `marks`、逐根揭示 `reveal`、价格刻度 `yLabels`
  - `Kbar.playback(sel, candles, opts)` 交互式逐根揭示训练器（盲测用）
- **训练器 `Quiz`**（`assets/quiz.js`）：`Quiz.mount('#sel', {title, questions, verdicts})`，选项自动打乱、即时反馈、可重练。
- **配色约定**：红涨绿跌（A股惯例）+「左刻度=开、右刻度=收」第二重编码（无障碍），全程提示国际盘绿涨红跌双阅读。改配色：`assets/course.css` 里的 `--up` / `--down` 与 `candles.js` 头部的 `UP` / `DOWN`。
- **数据**：课件与考场行情全部来自 Binance 公开 API 的真实 OHLCV（ETH/BTC/SOL，日线与 1h/4h，2026 年 6–9 月），课件内均标注品种、周期与时间范围。形态定义与统计口径引自 Nison / Bulkowski / Morris / Grimes，关键数字附原文链接。

## 如何加一课 / 换数据

1. 复制任意 `lessons/00NN-*.html` 为模板：改标题、课内地图、知识层、题目生成器。
2. 数据用 `{o,h,l,c}`（可加 `v`）字面量数组嵌入，配合 `Kbar.chart(..., {vol, zones, levels, marks})` 渲染。
3. 在 `index.html` 加课程卡片、上一课 footer 加下一课链接、`reference/glossary.html` 补新术语。
4. 训练场题目生成器约定：选项**字数一致**（防格式泄题），每题必带 `explain`，复习题不标注来源课。

## 版权与引用

- 课件文本与代码可自由用于个人学习与内部教学；公开转载请注明来源与所引原著（Nison / Grimes / Brooks / Morris / Bulkowski）。
- 行情数据来自 Binance 公开 API，仅供教学演示，不构成投资建议。
