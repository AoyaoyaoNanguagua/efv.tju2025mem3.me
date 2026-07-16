EFV 阿里云全量更新包

构建时间：{{BUILT_AT}}
Git 分支：{{BRANCH}}
Git 提交：{{COMMIT}}

本轮主要更新：
- M04 教授到 BOSS、一阶段到二阶段、二阶段到三阶段均改为 IMAGE 生成的 8 帧过渡动画。
- 三阶段 BOSS 使用独立行走循环，并按素材默认面向左侧修正左右翻转规则。
- 修复 BOSS 动画被每帧重启、教授变身后偶发不生成最终 BOSS，以及通关回顾流程。
- 修复未开启宝箱混入缩小帧导致的忽大忽小，并增加宝箱地面阴影。
- 修复阿宇变猫末帧体型与尾巴；学院大礼堂工装 NPC 放大 30%，人物与黑白狗阴影缩小。

部署步骤：
1. 停止线上 Python 服务，备份当前站点目录和 play-data.sqlite3* 数据文件。
2. 将本包解压到新的发布目录。不要覆盖或删除线上数据库；本包不携带数据库。
3. 将备份的 play-data.sqlite3、play-data.sqlite3-wal、play-data.sqlite3-shm（如存在）恢复到新目录。
4. 使用 python3 play-server.py 启动，或让现有 systemd/supervisor 服务指向新目录后重启。
5. Nginx 需同时代理 HTTP 与 WebSocket /ws，并保留 MP4 Range 请求。本项目不是纯静态站点。
6. 浏览器按 Ctrl+F5 清理旧的 play.js 与地图 JSON 缓存。

部署后验证：
- GET /play.html = 200
- 未登录 GET /api/me = 401
- WebSocket /ws 可连接
- M04 三段变身、三阶段左右行走、通关回顾与宝箱表现正常
- 学院大礼堂工装 NPC 为放大版本，人物和黑白狗阴影尺寸正确

校验：
- FILE-MANIFEST.sha256 包含包内每个运行文件的 SHA-256。
- 压缩包外同名 .sha256 文件用于校验整个 ZIP。
