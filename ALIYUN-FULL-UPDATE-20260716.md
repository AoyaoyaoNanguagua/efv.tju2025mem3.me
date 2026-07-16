# 阿里云全量更新说明（2026-07-16）

## 包内容

- 完整网站页面、游戏前端、Python HTTP/WebSocket/API 服务、`vendor/` 与当前运行资产。
- M04 三段 IMAGE 变身过渡动画、三阶段独立行走循环和正确的左右移动朝向。
- 教授变身与最终 BOSS 生成竞态修复、通关后回顾战斗流程。
- 稳定尺寸的未开启 BOSS 宝箱动画和地面阴影。
- 阿宇 v20 变猫末帧，以及学院大礼堂工装 NPC 与人物/黑白狗阴影调整。
- `VERSION.txt`、`FILE-MANIFEST.sha256` 和包内部署说明。

## 不包含

- `play-data.sqlite3*` 线上账号与角色数据。
- Git 历史、测试脚本、日志、临时 QA 截图、IMAGE 生成中间文件和历史淘汰素材。
- iPhone MOV 母片、旧版 4K60 视频、概念稿与未被运行时引用的旧角色/BOSS 图。

## 更新步骤

1. 停止旧服务，备份当前站点及 `play-data.sqlite3*`。
2. 解压到新的发布目录，再恢复数据库备份；不要直接删除或覆盖线上数据库。
3. 使用 `python3 play-server.py` 启动，或让现有 systemd/supervisor 服务指向新目录。
4. Nginx 同时代理 HTTP 与 WebSocket `/ws`，并保留 MP4 Range 请求。本项目不是纯静态站点。
5. 浏览器执行 `Ctrl+F5` 后验证 `/play.html = 200`、未登录 `/api/me = 401`，并实测 M04 与学院大礼堂。

包内 `FILE-MANIFEST.sha256` 用于逐文件校验；压缩包旁的 `.sha256` 用于整包校验。
