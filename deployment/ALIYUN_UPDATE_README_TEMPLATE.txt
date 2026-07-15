EFV 阿里云全量更新包

构建时间：{{BUILT_AT}}
Git 分支：{{BRANCH}}
Git 提交：{{COMMIT}}

主要更新：
- M04 结构失稳聚合体三阶段战斗、充能精英、同步特效、击退轨迹与倒地消失流程。
- M05 两段无缝樱花同济大道、独立路人 NPC、返回传送点与宽屏全画布覆盖。
- 2K/30fps H.264 结章视频，支持 fast-start 与 HTTP Range 加载。

部署步骤：
1. 停止线上 Python 服务，备份当前站点目录和 play-data.sqlite3* 数据文件。
2. 将本包解压到新的发布目录，不要用包内文件覆盖线上数据库（本包不携带数据库）。
3. 恢复原 play-data.sqlite3、play-data.sqlite3-wal 和 play-data.sqlite3-shm（如存在）。
4. 使用 python3 play-server.py 启动，或让现有 systemd/supervisor 服务指向新目录后重启。
5. Nginx 需同时反向代理 HTTP 与 WebSocket /ws，并保留 Range 请求。该项目不是纯静态站点。
6. 验证 /play.html = 200，未登录 /api/me = 401，视频 Range 请求 = 206。

校验：
- FILE-MANIFEST.sha256 包含包内每个运行文件的 SHA-256。
- 压缩包外的 .sha256 文件用于校验整包。
