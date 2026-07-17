# 2026-07-17 发布资产审计

## 结论

- 审计通过：`assets/` 共 140 个文件、431.64 MiB，页面、样式、脚本和地图配置直接引用 114 个运行资产。
- 114 个被引用资产均存在；没有精确重复、非法运行目录、越界交互点或被障碍物覆盖的交互点。
- 25 个未被运行时引用的文件均为旧版、概念稿、参考视频或生产中间资产，保留在 GitHub 源码仓库，但全部排除出阿里云运行包。
- OPC Live Cycle 当前实际使用 `assets/opc/opc-live-operating-roadmap-v6.png`；`v2`、`v3`、`v4`、`v5` 均不进入阿里云包。

## 实际运行资产边界

- 阿里云包仅包含 114 个被代码或地图配置直接引用的资产，以及网站根页面、脚本、样式、`vendor/` 和 `play-server.py`。
- 不包含 `play-data.sqlite3*`、Git 历史、日志、测试/生产脚本、Markdown 文档、临时文件、概念稿和历史淘汰素材。
- GitHub `main` 保留可复现开发所需的源码、审计记录、生产脚本和历史资产；本地 MOV 母片继续忽略。

## 审计强化

- `scripts/audit-assets.mjs` 现在同时读取 `deployment/release-manifest.json`。
- 若任何未引用资产未被阿里云排除规则覆盖，审计会直接失败，防止历史资产再次混入全量包。

## 验证命令

- `node scripts/audit-assets.mjs`
- `node --check play.js`
- `python -m py_compile play-server.py`
- `git diff --check`

