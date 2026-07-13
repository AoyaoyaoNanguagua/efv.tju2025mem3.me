# M02-A 学院大礼堂支线使用说明

## 接入位置

- 地图 ID：`ch1_m02a_auditorium_branch`
- 入口：M02 左上方拱门，向上进入。
- 返回：礼堂南侧唯一一组完全打开的双开门。
- 主线：M02 通往 M03 的原路线与解锁条件不变。

## 运行资产

- 礼堂背景：`assets/chapter1/maps/ch1_m02a_auditorium_branch/background/ch1-m02a-auditorium-bg-v1-3072x2304.png`
- 峹牧精灵图：`assets/game/characters/npcs/ch1-m02a-mumu-sprites-v13-efv.png`
- 小筑精灵图：`assets/game/characters/npcs/ch1-m02a-xiaozhu-sprites-v13-efv.png`
- 校长铜像：`assets/chapter1/maps/ch1_m02a_auditorium_branch/props/ch1-m02a-principal-bronze-statue-v1.png`
- 地图、碰撞、NPC、对话和传送配置：`assets/chapter1/chapter1-maps-v1.json`
- 资源再生产脚本：`scripts/integrate-m02a-auditorium-assets.py`
- 拓扑与协议测试：`scripts/test-m02a-auditorium-branch.mjs`

## 美术与技术约束

- 礼堂保留合作者的暖色舞台、红色座椅、中央过道、讲台与奖杯陈列特色，统一为 EFV 的深蓝、暖金、木石学院与猫爪纹章主题。
- 南门只有左右两扇向外打开的门扇；中央是无阻挡的暗门洞和连续红地毯，不允许再叠加关闭门板。
- 峹牧、小筑按项目统一的 8×8、147×147 单帧精灵协议接入；运行时显示名必须使用“峹牧”。
- 所有地图传送均使用 M01 的 `ch1-map-teleport-portal` 动画与 `0.82` 比例。
- 合作者的 Tiled 图层不直接进入运行时；地图统一使用项目的背景、矩形碰撞、出生点、交互节点和目标地图协议。

## Imagegen 记录

使用 Codex 内置图像生成/编辑模式。

### 礼堂风格融合（`style-transfer`）

```text
Use case: style-transfer
Asset type: top-down/isometric 2D action-RPG playable map background for the EFV cat-academy game
Primary request: Refine the attached auditorium map into the established EFV academy fantasy visual style while preserving the collaborator's distinctive warm auditorium identity.
Input image: Image 1 is the edit target and exact layout reference.
Preserve exactly: the 4:3 overall composition; north stage; large central projection screen; red curtains; central wooden lectern; trophy displays; left and right stage stairs; symmetric red seating blocks; central red-carpet aisle; side aisles; windows; plants; and the single south entrance/exit door. Keep all walkable aisles and obstacle silhouettes in the same places so existing collision geometry remains valid.
Style/medium: polished hand-painted 2D game environment, slightly painterly pixel-inspired edge treatment, matching EFV's dark blue, warm brass, carved wood, stone-academy, cat-paw heraldry, and magical scholarly lighting. Keep the auditorium warmer and brighter than M02 so it remains the collaborator's recognizable space.
Lighting/mood: warm amber lamps and sunlight, subtle cyan magical projector glow on the screen and lectern, readable walkable floor.
Required changes: remove the bottom-right AI-generated watermark completely; replace generic exit-sign glyphs with clean non-text green wayfinding plaques; add restrained navy-and-gold cat-paw academy emblems on banners or trim; clean perspective seams and improve material detail.
Constraints: no characters, no creatures, no UI, no text, no logos, no watermark. Do not add, remove, relocate, or resize doors, chairs, stage, stairs, aisles, lectern, screen, windows, trophies, or plants. Keep the south doorway centered and unobstructed. Keep a clean full-frame map with no border.
```

### 礼堂门修正（`precise-object-edit`，最终背景）

```text
Use case: precise-object-edit
Asset type: EFV auditorium playable map background
Primary request: Fix only the centered south entrance at the bottom of the image. It currently incorrectly shows both an open pair of door leaves and a second closed pair inside the same doorway.
Required edit: make it one architecturally coherent, fully open double-door entrance. Keep exactly two wooden door leaves, one hinged open to the left and one hinged open to the right. Replace the closed central door panels with a dark, unobstructed open doorway and a visible continuation of the red carpet into the doorway. The doorway must clearly read as open and walkable.
Preserve exactly: every other pixel-level composition choice, room geometry, stage, screen, curtains, lectern, trophies, banners, windows, plants, chairs, aisles, lighting, palette, proportions, and 3:2 full-frame crop.
Constraints: change only the south entrance; no characters, no text, no logos, no watermark, no extra doors, no closed door behind the open leaves.
```

### 峹牧风格融合（`style-transfer`）

生成时提示词沿用了素材文件名中的旧转写并误写成“峥牧”；图内没有文字，运行配置和本说明均已按源数据校正为“峹牧”。

```text
Use case: style-transfer
Asset type: 8-by-8 NPC animation spritesheet for the EFV 2D action-RPG, exactly 1176 by 1176 pixels with 147 by 147 pixel cells
Primary request: Redraw the collaborator character 峥牧 from the reference into the established EFV playable-character/NPC chibi rendering style while preserving his identity.
Input image: Image 1 is the identity, outfit, pose-family, and grid reference.
Identity invariants: young Chinese male civil-engineering student; short black hair; friendly open expression; white construction hard hat; vivid orange reflective safety vest over a light work shirt; charcoal work trousers; golden work boots. Do not turn him into a different character.
Style: polished high-detail anime chibi game sprite matching Lina/Zhixia quality, softly painted materials, compact proportions, fine neutral-brown one-pixel outer edge, clean facial features, consistent lighting, no heavy black outline.
Grid/action rows: row 1 calm standing idle; row 2 natural walk cycle; row 3 friendly wave; row 4 reading a field notebook; row 5 crouching to inspect the floor; row 6 light jog; row 7 pointing/directing; row 8 relaxed seated pose. Eight coherent animation phases per row, centered consistently, feet aligned to a common baseline, no clipped hands/helmet/boots, generous safe padding in every cell.
Background: perfectly flat solid #ff00ff chroma-key background across the entire sheet, with no checkerboard, shadows, gradients, texture, grid lines, dividers, labels, or lighting variation. Do not use #ff00ff anywhere in the character.
Constraints: exactly one character per cell; no pets, no statue, no extra people, no tools covering the face, no text, no watermark. Preserve the same clothing colors and construction-student personality.
```

### 小筑风格融合（`style-transfer`）

```text
Use case: style-transfer
Asset type: 8-by-8 companion-pet animation spritesheet for the EFV 2D action-RPG, exactly 1176 by 1176 pixels with 147 by 147 pixel cells
Primary request: Redraw the collaborator pet 小筑 from the reference into the established EFV detailed animal sprite style while preserving its identity.
Input image: Image 1 is the identity, markings, action-family, and grid reference.
Identity invariants: lively black-and-white border collie; symmetrical white facial blaze; white muzzle, chest, paws, and tail tip; black ears and body patches; warm golden eyes; small pale-gold collar. Do not turn it into a cat or another dog breed.
Style: polished high-detail anime game animal sprite, soft fur clusters, readable four-legged anatomy, fine neutral-brown edge, consistent lighting and scale, compatible with the detailed cat sprites already used in EFV.
Grid/action rows: row 1 alert standing idle; row 2 natural four-leg walk; row 3 energetic run with coherent alternating legs; row 4 happy play-bow; row 5 sniffing the floor; row 6 playful hop/roll; row 7 calm lying pose; row 8 seated head-tilt. Eight coherent animation phases per row, centered consistently, paws aligned to a common baseline, no clipped ears/tail/paws, generous safe padding in every cell.
Background: perfectly flat solid #ff00ff chroma-key background across the entire sheet, with no checkerboard, shadows, gradients, texture, grid lines, dividers, labels, or lighting variation. Do not use #ff00ff anywhere in the dog.
Constraints: exactly one dog per cell; no people, no cats, no props, no text, no watermark. Preserve the border-collie markings and cheerful personality.
```
