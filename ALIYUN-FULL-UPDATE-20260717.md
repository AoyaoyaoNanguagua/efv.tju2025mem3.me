# 阿里云全量更新说明（2026-07-17）

## 包内容

- 完整网站页面、游戏前端、Python HTTP/WebSocket/API 服务、`vendor/` 与 114 个实际运行资产。
- OPC Live Cycle Agent Hub 辐射式路线图、独立 Agent 订单关系和猫老板人工部署边界。
- 游戏状态面板 WASD/E/J/K/H/L 图标及悬浮说明。
- 最终 BOSS 命中反馈修正、全套技能表现升级，以及五个角色的技能特效升级。
- 无连续路径线的火焰逐格爆炸：每格独立落点、各自延迟 1 秒、错峰触发并自动清理。
- 多人战斗关键消息独立限流与存活 BOSS 缓存保护。
- `VERSION.txt`、`FILE-MANIFEST.sha256` 和包内部署说明。

## 不包含

- `play-data.sqlite3*` 线上账号与角色数据。
- Git 历史、日志、测试/生产脚本、Markdown 文档和临时 QA 文件。
- 25 个未被运行时引用的概念稿、参考视频、旧版地图/角色/BOSS 图和 OPC 路线图 `v2–v5`。

## 更新步骤

1. 停止旧服务，备份当前站点及 `play-data.sqlite3*`。
2. 解压到新的发布目录，再恢复数据库备份；不要直接删除或覆盖线上数据库。
3. 使用 `python3 play-server.py` 启动，或让现有 systemd/supervisor 服务指向新目录。
4. Nginx 同时代理 HTTP 与 WebSocket `/ws`，并保留 MP4 Range 请求。本项目不是纯静态站点。
5. 浏览器执行 `Ctrl+F5`，验证 `/play.html = 200`、未登录 `/api/me = 401`，并实测 M04 和 OPC Live Cycle。

包内 `FILE-MANIFEST.sha256` 用于逐文件校验；压缩包旁的 `.sha256` 用于整包校验。
