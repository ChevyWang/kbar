# K线训练营 · 站点仓库

K线训练营（裸K价格行为系列课程）的线上站点，通过 GitHub Pages 发布：

- 线上地址：<https://chevywang.github.io/kbar/>
- `index.html` — 站点首页（课程目录）
- `seven-days/` — 七日课程《从读一根K线，到读一张图》

## 内容从哪里来

课件在各课程的工作目录中生成（源材料与课程设计笔记不在本仓库），由工作目录里的
`publish.sh` 将 `course/` 同步到对应子目录并推送。因此：

- **不要直接编辑本仓库里的课程内容**——下次发布会被覆盖；
- 新增课程 = 在它的工作目录里配置好 `publish.sh` 后运行一次，然后在 `index.html` 加一张课程卡片。

## 本地预览

```bash
python3 -m http.server 8000   # 在本仓库根目录执行，访问 http://localhost:8000
```
