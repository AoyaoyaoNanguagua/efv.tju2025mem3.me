# 学术喵关卡协作与素材提交指南

> 适用项目：《学术喵的奇幻之旅：樱花同济篇》
>
> 这份 Markdown 可以直接交给 AI agent 阅读。网页版本在 `contribution_guide.html`，网页更适合查看参考图；Markdown 更适合复制给 AI、整理任务和离线阅读。

## 0. 开场提示词：先复制给你的 AI agent

如果你不知道怎么开始，直接复制下面这段。它会先让 AI 学习项目页面，再验证官方角色 API 能不能在你的本地跑起来，最后再进入个人关卡设计。

```text
https://efv.tju2025mem3.me/llms.txt
https://efv.tju2025mem3.me/contribution_guide.html
https://efv.tju2025mem3.me/gdd_scope_review.html
https://efv.tju2025mem3.me/index.html

是我们小组作业总体项目，你学习一下。然后我想先试一下官方角色能不能拉到我本地开始测试，然后我们再策划我的关卡怎么设计。

我的学号是 2540732。你来组织文件结构，目前先看看官方 API 成不成，让角色在我电脑上能做动作。

如果本地没有 Python，请你帮我安装 3.10/3.11 以及必要的环境；如果网络连接不好，请使用国内镜像。

当能看到官方角色在我本地跑起来时，我们开始讨论我的关卡设计。
```

使用时把 `2540732` 改成自己的学号。搜索引擎收录需要时间，不要依赖搜索；让 AI 优先读取 `https://efv.tju2025mem3.me/llms.txt` 和本指南。临时 HTML 可以用于本地测试，但正式提交时只保留个人 JS、assets、data。

如果 AI 仍然打不开网页，通常是 AI 平台自己的网络出站限制，不是项目页面失效。请打开或下载 `https://efv.tju2025mem3.me/ai_context.txt`，把全文复制给 AI，再继续本地测试和关卡规划。

## 1. 协作目标

本项目希望让每位同学都能根据自己的能力参与关卡设计。每个人不需要直接修改主程序，也不需要理解完整游戏架构。正式提交时，每位同学只维护一个以自己学号命名的内容包。

内容包可以很小，例如：

- 一个怪物。
- 一个 NPC。
- 一个地图角落。
- 一组 props。
- 一个触发事件。
- 一段对话。
- 一个小任务钩子。

重点不是一次做完整系统，而是把内容整理成统一结构，方便之后合并进主线。

## 2. 项目技术栈

当前项目以静态前端为主：

- 页面：HTML、CSS、原生 JavaScript。
- 游戏框架：Phaser，位于 `vendor/phaser.min.js`。
- 主程序：`app.js`。
- 官方协作 API：`official-api.js`。
- 公共素材：`assets/`。
- 当前测试地图：衷和广场测试区块。

本阶段不需要后台服务。`python -m http.server` 这类本地服务只负责让浏览器通过 `http://127.0.0.1:8000/` 读取静态文件，不负责登录、上传、数据库、存档或排行榜。

以后如果项目需要在线提交、账号、云存档、排行榜、多人同步，再新增真正的后端 API。

## 3. 同学不要修改哪些文件

正式提交内容包时，不要修改或覆盖这些主项目文件：

- `app.js`
- `index.html`
- `styles.css`
- `official-api.js`
- `vendor/`
- 公共 `assets/`

可以读取这些文件，让 AI 理解项目，但不要让 AI 直接改它们。

## 4. 每个人的正式提交结构

每位同学使用自己的学号作为文件夹名，统一放在 `contrib/` 下。

```text
contrib/2025000000/
  2025000000-level.js
  assets/
    sprites/
    portraits/
    tilesets/
    props/
    enemies/
    npc/
  data/
    manifest.json
    points.json
    triggers.json
    dialogue.json
    collisions.json
    test_report.md
```

正式提交只保留三类内容：

1. 一个 JS 入口：`2025000000-level.js`
2. 一个素材目录：`assets/`
3. 一个数据目录：`data/`

## 5. 可以用 HTML 自测，但不要提交 HTML

同学可以临时写一个 `local-preview.html` 来测试自己的 JS、JSON 和图片路径。

例如：

```text
contrib/2025000000/local-preview.html
```

如果临时测试页放在学号文件夹下，可以这样引用公共库：

```html
<script src="../../vendor/phaser.min.js"></script>
<script src="../../official-api.js"></script>
<script src="2025000000-level.js"></script>
```

但是正式交付时，不要提交 HTML 测试页。原因是每个人的 HTML 页面结构不同，最后合并时容易互相冲突。测试结果写进 `data/test_report.md` 即可。

## 6. 命名规则

所有 ID 建议使用 `s学号_` 前缀，方便合并时区分来源。

| 对象 | 推荐格式 | 示例 |
|---|---|---|
| 内容包 ID | `s学号_英文短名` | `s2025000000_leaf_courtyard` |
| 怪物 ID | `s学号_monster_名字` | `s2025000000_monster_book_mite` |
| NPC ID | `s学号_npc_名字` | `s2025000000_npc_archive_senior` |
| 物件 ID | `s学号_prop_名字` | `s2025000000_prop_notice_board` |
| 事件 ID | `s学号_event_名字` | `s2025000000_event_library_gate` |
| 出生点 ID | `s学号_spawn_名字` | `s2025000000_spawn_main` |
| 触发点 ID | `s学号_trigger_名字` | `s2025000000_trigger_first_note` |

素材文件名使用英文小写、数字和连字符：

```text
book-mite-sprites-v1.png
archive-senior-portrait-v1.png
notice-board-prop-v1.png
leaf-courtyard-tileset-v1.png
```

不要使用空格、中文文件名、特殊符号或非常长的文件名。

## 7. JS 入口写什么

JS 入口只做注册，不改主程序。

模板：

```js
(function () {
  "use strict";

  const studentId = "2025000000";

  const pack = {
    studentId,
    id: "s2025000000_leaf_courtyard",
    title: "叶影庭院小关卡",
    type: "level-pack",
    version: "0.1.0",
    entry: "2025000000-level.js",
    zone: "zhonghe-plaza",
    assets: {
      sprites: [],
      portraits: [],
      tilesets: [],
      props: [],
      enemies: [],
      npc: []
    },
    data: {
      manifest: "data/manifest.json",
      points: "data/points.json",
      triggers: "data/triggers.json",
      dialogue: "data/dialogue.json",
      collisions: "data/collisions.json",
      testReport: "data/test_report.md"
    }
  };

  window.EFVContrib?.register(pack);
})();
```

## 8. data/manifest.json 模板

`manifest.json` 是内容包说明书。它告诉主项目：这个包是谁做的、叫什么、有哪些素材、有哪些数据文件。

```json
{
  "studentId": "2025000000",
  "id": "s2025000000_leaf_courtyard",
  "title": "叶影庭院小关卡",
  "type": "level-pack",
  "version": "0.1.0",
  "zone": "zhonghe-plaza",
  "entry": "2025000000-level.js",
  "assets": {
    "monsters": ["assets/enemies/book-mite-sprites-v1.png"],
    "npcs": ["assets/npc/archive-senior-portrait-v1.png"],
    "props": ["assets/props/notice-board-v1.png"],
    "tilesets": []
  },
  "data": {
    "points": "data/points.json",
    "triggers": "data/triggers.json",
    "dialogue": "data/dialogue.json",
    "collisions": "data/collisions.json",
    "testReport": "data/test_report.md"
  }
}
```

## 9. data/points.json 模板

`points.json` 用来描述出生点、兴趣点、NPC 点位、props 点位等。

```json
{
  "spawnPoints": [
    {
      "id": "s2025000000_spawn_main",
      "x": 4800,
      "y": 3600,
      "facing": "S",
      "note": "玩家进入该内容包后的测试点"
    }
  ],
  "interestPoints": [
    {
      "id": "s2025000000_point_notice_board",
      "type": "prop",
      "x": 4920,
      "y": 3520,
      "asset": "assets/props/notice-board-v1.png",
      "note": "示例可交互物件点位"
    }
  ]
}
```

坐标可以先写近似值。如果不确定，就在 `test_report.md` 里写“需要技术组合并时微调坐标”。

## 10. data/triggers.json 模板

`triggers.json` 用来描述进入某个范围后触发什么事件。

```json
{
  "triggers": [
    {
      "id": "s2025000000_event_first_dialogue",
      "type": "dialogue",
      "x": 4920,
      "y": 3520,
      "radius": 96,
      "target": "s2025000000_dialogue_01",
      "once": true
    }
  ]
}
```

常见触发类型：

- `dialogue`：触发对话。
- `spawn`：生成怪物或 NPC。
- `collect`：拾取道具。
- `teleport`：传送点。
- `inspect`：调查物件。
- `quest`：任务节点。

## 11. data/dialogue.json 模板

对话要短，最好三句以内，并且能引出任务、地图线索、图鉴或道具。

```json
{
  "dialogues": [
    {
      "id": "s2025000000_dialogue_01",
      "speaker": "档案馆学姐",
      "lines": [
        "这片叶影庭院里藏着一张旧讲义。",
        "如果你能找到它，也许能解锁一段校史线索。"
      ],
      "next": "s2025000000_event_find_note"
    }
  ]
}
```

## 12. data/collisions.json 模板

如果提交 props 或地图角落，建议写碰撞建议。

```json
{
  "collisions": [
    {
      "id": "s2025000000_collision_notice_board",
      "type": "rect",
      "x": 4880,
      "y": 3480,
      "w": 80,
      "h": 56,
      "note": "公告板底座不可穿过，合并时可微调"
    }
  ]
}
```

常见碰撞类型：

- `rect`：矩形。
- `circle`：圆形。
- `polygon`：多边形，适合不规则水池或花坛。
- `none`：装饰物，不需要碰撞。

## 13. 官方 API：official-api.js

如果需要调用官方主角莉娜、读取动作规格、读取风格提示或注册内容包，请使用 `official-api.js`。

不要复制主角路径，不要自己猜动作规格。

### 13.1 读取主角资料

```js
const lina = window.EFVOfficial.getMainCharacter();
console.log(lina.name);
console.log(lina.assets.sprite);
console.log(lina.actions);
```

### 13.2 读取精灵规格

```js
const spec = window.EFVOfficial.getSpriteSpec();
console.log(spec.frameWidth, spec.frameHeight);
```

当前官方角色精灵表规格：

- 8 列 × 8 行。
- 每格 147 × 147。
- 总尺寸 1176 × 1176。
- 角色基准线约为 140。

注意：这是官方主角莉娜的规格，不是怪物、NPC、技能特效等投稿素材的硬性要求。

动作行：

| 行 | id | 说明 |
|---|---|---|
| 0 | `idle` | 待机 |
| 1 | `walk` | 行走 |
| 2 | `attack` | 施法 / 攻击 |
| 3 | `hit` | 受击 |
| 4 | `death` | 倒地 |
| 5 | `transform` | 人猫互变 |
| 6 | `catRun` | 猫形移动 |
| 7 | `catJump` | 猫形跳跃 |

### 13.3 读取武器和飞弹

```js
const weapons = window.EFVOfficial.getWeapons();
console.log(weapons);
```

当前有三把官方法杖：

- `amethyst-staff`：紫晶治疗杖。
- `sakura-staff`：樱花短杖。
- `thesis-staff`：开题星杖。

### 13.4 注册内容包

```js
window.EFVContrib.register({
  studentId: "2025000000",
  id: "s2025000000_leaf_courtyard",
  title: "叶影庭院小关卡",
  type: "level-pack",
  entry: "2025000000-level.js"
});
```

### 13.5 Phaser 中预加载官方主角

```js
preload() {
  EFVOfficial.preloadPhaserAssets(this);
}

create() {
  const lina = EFVOfficial.createLina(this, 480, 320, {
    scale: 1,
    action: "idle"
  });
}
```

## 14. 投稿素材的帧数可以灵活决定

怪物、NPC、技能特效、props 动画不强制使用 8 帧。帧数越多，对图像模型的稳定性要求越高，越容易出现体型漂移、五官变化、边缘抖动或动作不连续。请根据自己的 AI agent 能力、素材重要程度和设计对象特征选择帧数。

推荐档位：

| 类型 | 推荐帧数 | 适合对象 |
|---|---:|---|
| 静态图 | 1 帧 | props、头像、任务物件、图标、地图装饰 |
| 低门槛动画 | 2-4 帧 | 普通怪物、简单 NPC、短技能特效、机关提示 |
| 中等动画 | 4-6 帧 | 重要 NPC、小 Boss、较明显的攻击动作 |
| 完整动画 | 8 帧或更多 | 官方角色、核心角色、需要精细表现的主线素材 |

建议优先选择稳定方案：

- 怪物待机：2-4 帧即可。
- 怪物移动：2-4 帧即可。
- 怪物攻击：3-4 帧即可。
- NPC 站立：1-2 帧即可。
- NPC 简单行走：2-4 帧即可。
- 技能飞弹：3-6 帧即可。
- 命中特效：3-6 帧即可。
- props 动画：1-4 帧即可。

提交时必须说明：

- 每格尺寸。
- 行列数。
- 每个动作名称。
- 每个动作使用的帧序号。
- 是否循环。
- 推荐播放速度。
- 是否需要透明背景。

示例：

```json
{
  "sprite": {
    "path": "assets/enemies/book-mite-sprites-v1.png",
    "frameWidth": 128,
    "frameHeight": 128,
    "columns": 4,
    "rows": 3,
    "animations": {
      "idle": { "row": 0, "frames": [0, 1, 2, 3], "fps": 6, "loop": true },
      "move": { "row": 1, "frames": [0, 1, 2, 3], "fps": 8, "loop": true },
      "attack": { "row": 2, "frames": [0, 1, 2], "fps": 10, "loop": false }
    }
  }
}
```

## 15. 美术风格说明

网页版 `contribution_guide.html` 更适合查看美术参考图。Markdown 无法完整呈现画风，但可以提供素材路径和描述。

项目视觉方向：

- 同济校园。
- 樱花季。
- 学术幻想。
- 轻量 JRPG。
- 清晰线稿。
- 柔和高明度色彩。
- 透明背景精灵。
- 俯视 2D 瓦片地图。
- 边缘干净，适合切片。

请避免：

- 真实校徽。
- 商业商标。
- 照片质感。
- 厚重暗黑风。
- 带水印素材。
- 文字糊成一团的贴图。
- 难以切片的复杂透视。

## 16. 美术参考素材路径

可以把这些路径直接交给 AI，让 AI 读取或参考：

```text
assets/portraits/lina.png
assets/sprites/lina-sprites-v10-anchored-expanded.png
assets/effects/lina-projectiles-atlas-v1.png
assets/maps/playable/previews/zhonghe-plaza-tilemap-playtest-v1-game-view.png
assets/maps/playable/previews/zhonghe-plaza-ground-material-atlas-imagegen-v1.png
assets/maps/playable/previews/zhonghe-plaza-ground-style-imagegen-v1.png
assets/maps/props/zhonghe-plaza-props-atlas-v1.png
assets/enemies/leaf-poring-portrait-v2.png
assets/enemies/leaf-poring-sprites-v2.png
```

这些素材的用途：

- `assets/portraits/lina.png`：角色头像气质。
- `assets/sprites/lina-sprites-v10-anchored-expanded.png`：官方主角精灵表规格。
- `assets/effects/lina-projectiles-atlas-v1.png`：法术效果和色彩反馈。
- `assets/maps/playable/previews/zhonghe-plaza-tilemap-playtest-v1-game-view.png`：游戏实际视角。
- `assets/maps/playable/previews/zhonghe-plaza-ground-material-atlas-imagegen-v1.png`：地图瓦片材质。
- `assets/maps/playable/previews/zhonghe-plaza-ground-style-imagegen-v1.png`：地图整体风格。
- `assets/maps/props/zhonghe-plaza-props-atlas-v1.png`：props 形状和摆放风格。
- `assets/enemies/leaf-poring-portrait-v2.png`：怪物头像方向。
- `assets/enemies/leaf-poring-sprites-v2.png`：怪物动作方向。

## 17. 给 AI 的对话模板

### 17.1 第一步：让 AI 先读规范

```text
你正在为《学术喵的奇幻之旅：樱花同济篇》制作一个同学关卡内容包。
请先读取 contribution_guide.md、contribution_guide.html 和 official-api.js。
我的学号是【2025000000】。

请先不要写代码。
请用简短清单告诉我：
1. 本项目技术栈是什么；
2. 我能提交哪些文件；
3. 哪些文件不能改；
4. 官方 API 能提供什么；
5. 美术风格要参考哪些素材。
```

### 17.2 第二步：让 AI 规划内容包

```text
请帮我规划 contrib/2025000000/ 内容包。
我想做【怪物/NPC/地图角落/props/触发事件】。

正式提交只能包含：
1. 2025000000-level.js
2. assets/
3. data/

请先输出：
1. manifest.json 草案；
2. points.json 草案；
3. triggers.json 草案；
4. 需要准备的素材清单；
5. test_report.md 测试清单。

不要修改 app.js，不要覆盖公共 assets，不要提交 HTML。
```

### 17.3 第三步：让 AI 生成美术素材提示词

```text
请根据 EFVOfficial.getStylePrompt() 和下面参考素材，
帮我写一份给图像生成模型使用的素材提示词。

目标风格：
同济校园、樱花季、学术幻想、轻量 JRPG。

要求：
1. 角色和怪物透明背景；
2. 地图素材适合俯视 2D 瓦片；
3. props 要能独立摆放；
4. 每张图都要说明用途和推荐文件名；
5. 怪物、NPC、技能特效不强制 8 帧，请根据稳定性选择 1、2-4、4-6 或 8 帧；
6. 不要真实校徽、商业商标、水印和照片质感。

请参考：
assets/portraits/lina.png
assets/sprites/lina-sprites-v10-anchored-expanded.png
assets/maps/props/zhonghe-plaza-props-atlas-v1.png
assets/enemies/leaf-poring-portrait-v2.png
assets/maps/playable/previews/zhonghe-plaza-tilemap-playtest-v1-game-view.png
```

### 17.4 第四步：让 AI 自检

```text
请检查我的 contrib/2025000000/ 内容包是否符合规范。

重点检查：
1. 是否只提交 JS、assets、data；
2. 是否没有提交临时 HTML；
3. ID 是否全部使用 s2025000000_ 前缀；
4. manifest.json 是否列出所有素材路径；
5. 是否错误修改 app.js 或公共 assets；
6. test_report.md 是否说明本地测试结果；
7. 素材是否写清用途、尺寸、动作帧数、帧序号或碰撞建议。
```

## 18. 不同能力同学怎么参与

### 18.1 不会写代码的同学

可以提交：

- 怪物设定。
- NPC 设定。
- 对话。
- 任务钩子。
- 美术素材。
- 点位说明。
- 碰撞建议。
- 测试记录。

让 AI 帮你生成 JSON 和 JS 注册文件。

### 18.2 会一点前端的同学

可以补充：

- `2025000000-level.js`
- 本地临时 HTML 预览页
- Phaser 中的简单预览
- 素材路径检查
- JSON 格式检查

正式提交前删除临时 HTML。

### 18.3 会游戏开发的同学

可以补充：

- 怪物行为草案。
- 触发器逻辑草案。
- 动画帧说明。
- 碰撞体建议。
- 合并风险说明。
- 后续需要主程序支持的 API 建议。

仍然不要直接改主程序，先把方案写进个人内容包。

## 19. test_report.md 模板

```md
# 测试记录

- 学号：2025000000
- 内容包：s2025000000_leaf_courtyard
- 测试日期：
- 本地打开方式：
- 是否使用临时 HTML 自测：
- 检查过的素材：
- 检查过的 JSON：
- 浏览器控制台是否有红色错误：
- 是否没有提交临时 HTML：
- 需要技术组合并时处理的事项：
```

## 20. 提交前自查清单

结构：

- [ ] 文件夹名是自己的学号。
- [ ] 只有一个正式 JS 入口。
- [ ] 有 `assets/`。
- [ ] 有 `data/`。
- [ ] 没有提交临时 HTML。
- [ ] 没有修改 `app.js`。
- [ ] 没有覆盖公共 `assets/`。

数据：

- [ ] `manifest.json` 能说明内容包。
- [ ] `points.json` 写清点位。
- [ ] `triggers.json` 写清触发。
- [ ] `dialogue.json` 对话简短清楚。
- [ ] `collisions.json` 写清碰撞建议。
- [ ] 所有 ID 使用 `s学号_` 前缀。

素材：

- [ ] PNG/WebP 能打开。
- [ ] 没有水印。
- [ ] 没有真实校徽或商业商标。
- [ ] 角色、怪物、props 边缘干净。
- [ ] 精灵表写清尺寸、行列、动作、帧数和帧序号。
- [ ] props 写清用途和碰撞建议。

测试：

- [ ] 本地静态服务能打开。
- [ ] 浏览器控制台没有红色错误。
- [ ] 路径没有 404。
- [ ] 测试结果写进 `test_report.md`。

## 21. 最终合并思路

主线合并时，只需要接入某位同学的学号文件夹，读取：

- `manifest.json`
- `2025000000-level.js`
- `EFVContrib.register(...)` 注册结果

这样即使某个内容包暂时不合格，也可以只暂停那个包，不影响主程序和其他同学的内容包。
