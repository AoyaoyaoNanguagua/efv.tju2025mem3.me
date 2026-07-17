EFV 阿里云全量更新包

构建时间：{{BUILT_AT}}
Git 分支：{{BRANCH}}
Git 提交：{{COMMIT}}

本轮主要更新：
- OPC Live Cycle 更新为 Agent Hub 辐射式架构，各 Agent 独立接单与回写，最终部署只允许猫老板 Human Owner 人工完成。
- 更新路线图为背影猫老板版本；技术完成后将增量更新包写入指定目录并向中台登记。
- 游戏状态面板统一展示 WASD、E、J、K、H、L 图标与悬浮说明。
- 修正最终 BOSS 命中点与伤害数字位置，并升级 BOSS 全套技能和五个角色的技能表现层。
- 火焰之径取消连续路径线，改为逐格独立落点、各自延迟 1 秒爆炸并及时清理。
- 提升多人战斗关键消息可靠性，避免容量淘汰误删存活 BOSS。

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
- M04 命中点、火焰逐格爆炸、阶段技能和多人同步正常
- 五个角色的攻击、蓄力、大招、治疗与变身特效正常
- OPC Live Cycle 路线图、Agent 文案和人工部署边界正常

校验：
- FILE-MANIFEST.sha256 包含包内每个运行文件的 SHA-256。
- 压缩包外同名 .sha256 文件用于校验整个 ZIP。
