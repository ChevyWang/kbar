# K线训练营 · 站点仓库

「技术分析大师之路」系列课程的线上站点，通过 GitHub Pages 发布：

- 线上地址：<https://chevywang.github.io/kbar/>
- `index.html` — 站点首页（Phase 0–6 阶段路线图）
- `phase-0/` — Phase 0 · 读图：《从读一根K线，到读一张图》（7 课）

## 目录划分

课程子目录按长期课程规划的阶段划分，一个 Phase 一个目录：

| 目录 | 阶段 | 主题 |
|---|---|---|
| `phase-0/` | 读图 | 词汇与语法：单根 → 双K → 位置 → 结构 → 量能 → 多周期 |
| `phase-1/` | 流利 | 逐根推理（Brooks 体系），约 10 课 |
| `phase-2/` | 地形 | 供需区域地图（Wyckoff + Profile），约 8 课 |
| `phase-3/` | 概率 | 形态统计全景（Bulkowski / Morris），约 7 课 |
| `phase-4/` | 系统 | 组装交易系统（Grimes Part 2），约 10 课 |
| `phase-5/` | 执行 | 心理与实盘（Douglas），约 6 课 |
| `phase-6/` | 大师 | 输出与体系化（持续） |

## 内容从哪里来

课件在各课程的工作目录中生成（源材料与课程设计笔记不在本仓库），由工作目录里的
`publish.sh` 将 `course/` 同步到对应 Phase 子目录并推送。因此：

- **不要直接编辑本仓库里的课程内容**——下次发布会被覆盖；
- 新增课程 = 复制一个工作目录、改好 `publish.sh` 里的 `COURSE_SLUG`（如 `phase-1`）后运行一次，
  然后在 `index.html` 把该阶段的卡片从"规划中"改为可点链接。

## 本地预览

```bash
python3 -m http.server 8000   # 在本仓库根目录执行，访问 http://localhost:8000
```
