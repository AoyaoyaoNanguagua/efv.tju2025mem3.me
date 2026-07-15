# 阿里云全量更新说明（2026-07-15）

## 包内容

- 当前完整网站页面、游戏前端、Python HTTP/WebSocket/API 服务、`vendor/` 和所有当前运行资产。
- M04 三阶段 BOSS、充能精英、击退/火焰/落雷/闪电链效果、三阶段血条与死亡消失流程。
- M05 两段无缝樱花同济大道、4 款独立路人精灵、返回传送点和宽屏全画布覆盖。
- 2560×1440、30fps、H.264/AAC、fast-start 结章视频。
- `VERSION.txt`、`FILE-MANIFEST.sha256` 和包内部署说明。

## 不包含

- `play-data.sqlite3*` 线上数据。
- iPhone MOV 母片、旧 4K60 HEVC MP4、概念稿、旧版背景/精灵图和中间生产图。
- Git 历史、测试脚本、日志、临时图和本地数据。

## 更新步骤

1. 停止旧服务，备份当前站点和 `play-data.sqlite3*`。
2. 解压到新发布目录，再把数据库备份恢复进去；不要删除或覆盖线上数据库。
3. 使用 `python3 play-server.py` 启动，或让现有 systemd/supervisor 服务指向新目录。
4. Nginx 同时代理 HTTP 与 WebSocket `/ws`，并保留 MP4 Range 请求。本项目不是纯静态站点。
5. 检查 `/play.html = 200`、未登录 `/api/me = 401`、视频 Range 请求 `= 206`。

详细资产审计见 `deployment/ASSET_AUDIT_20260715_RELEASE.md`。
