# 第三、四关动态怪物图集使用说明

本批资源使用 Codex 内置 `imagegen` 的 `style-transfer` 模式生成，统一采用洋红色键控背景，再通过官方 `remove_chroma_key.py` 做透明化、去溢色和 1px 边缘收缩。运行时仍以项目的 Phaser 动画、碰撞、技能和多人协议为准。

## 图集与动作行

| 图集 | 网格 | 用途与动作行 |
| --- | --- | --- |
| `assets/game/enemies/animated/ch1-m03-garden-patrol-atlas-v3.png` | 8×8，147×147 | 荆棘猎犬：跑/扑/受击死亡；花粉蛾：悬停/播粉/受击死亡；藤蔓园丁：走/根鞭/受击死亡 |
| `assets/game/enemies/animated/ch1-m03-moon-orchid-rare-sheet-v3.png` | 6×8，196×147 | 待机、滑行、月刃、护盾、月镜、受击、激怒、死亡 |
| `assets/game/enemies/animated/ch1-m03-carnivora-boss-sheet-v3.png` | 6×7，196×168 | 待机、根移、种弹、吞噬、荆棘迷宫、受击/激怒、死亡 |
| `assets/game/enemies/animated/ch1-m04-quantum-family-atlas-v2.png` | 8×8，147×147 | 量子学者、波函数使魔、量子纸灵的移动/施法/受击死亡 |
| `assets/game/enemies/animated/ch1-m04-blockchain-family-atlas-v3.png` | 8×8，147×147 | 链铸重兽、验证锁、链爪蜘蛛的移动/攻击/受击死亡 |
| `assets/game/enemies/animated/ch1-m04-aiagent-family-atlas-v3.png` | 7×8，168×147 | Agent 协调法师、数字猫、工具调用猫的移动/攻击/受击死亡 |
| `assets/game/bosses/m04-structural-instability-boss-sheet-v2.png` | 8×7，147×168 | 人形承载机待机/移动/锤击、完整碎裂变形、兽形剪切/扭转、死亡 |

## 技能和关卡节奏

- 花园：荆棘扑袭、花粉扇面、根牢、月刃/月镜、食人花吞噬环与荆棘迷宫。
- 量子：干涉束、相位扑袭、概率切线。
- 区块链：链铸冲锋、验证爆破、链式地雷。
- AI Agent：提示词长枪、数字猫闪现、工具调用区。
- 结构机器人第一形态使用承载坍塌和桁架扇击；生命降到 55% 时播放完整碎裂变形帧并进入高速兽形，第二形态使用交叉剪切和扭转场。
- 三系阶段之间不再自动倒计时开怪。教授移动到下一考场等候，任一在线玩家进入 190px 范围后，由房间协调端统一开启下一阶段。
- 多人血量倍率：普通怪每多一人 +35%，精英/稀有 +60%，BOSS +75%；伤害每多一人 +16%，并随人数增加危险区数量（最多 +3）。

## 最终生成提示词集

以下为本批交付使用的最终提示词集；每张均使用对应旧怪物素材作为风格和角色识别参考，并要求平视 3/4 俯视游戏视角、固定单元格、无文字、无 UI、无阴影底板、纯洋红背景。

### 1. 花园巡逻组三合一

```text
Create a production-ready 2D game sprite atlas for the EFV campus fantasy RPG, preserving the supplied thorn hound, pollen moth, and vine gardener silhouettes, costume motifs, botanical materials, and painterly pixel-anime rendering. Exact 8 columns by 8 rows, every cell centered and isolated with consistent scale and baseline. Rows 1-3: thorn hound run cycle, telegraphed thorn pounce, hit-to-death. Rows 4-6: pollen moth hover cycle, pollen fan casting, hit-to-death. Rows 7-8: vine gardener walk and root-whip attack transitioning into hit/death. Show real limb, wing, leaf, cloth, and body motion; never translate one unchanged cutout. Three-quarter top-down action-game view, crisp pale rim light matching Lina/Zhixia character sprites. Flat #ff00ff background only, no text, no grid lines, no UI, no floor, no cast shadow.
```

### 2. 月兰守卫

```text
Create a production-ready 6-column by 8-row sprite sheet for the supplied Moon Orchid rare guardian. Preserve the elegant moonlit orchid warrior identity, white-blue petals, crescent blade language, proportions, and EFV painterly pixel-anime finish. Rows: idle breathing, gliding locomotion with alternating feet and cloth, outward crescent slash, petal shield, moon-mirror cast, hit reaction, enraged power-up, complete death dissolve. Every frame must be a distinct pose with coherent anticipation/contact/recovery, centered in fixed cells and consistent baseline. Three-quarter top-down RPG view, thin bright character rim, transparent-ready edges. Flat #ff00ff background only; no text, UI, grid, floor, or shadow.
```

### 3. 中央食人花

```text
Create a production-ready 6-column by 7-row boss sprite sheet for the supplied Carnivora botanical boss. Preserve its giant carnivorous flower head, layered leaves, roots, poisonous green-magenta palette, and EFV painterly pixel-anime style. Rows: breathing idle, root-propelled locomotion, seed volley cast, devour bite, thorn-maze ultimate, hit-to-enrage transition, full collapse death. Animate petals, jaw, tongue, vines, roots, and weight transfer; do not slide an unchanged image. Three-quarter top-down action-RPG view, consistent cell scale and ground contact. Flat #ff00ff background only; no labels, UI, grid, floor, or shadow.
```

### 4. 量子系家族

```text
Create a production-ready 8-column by 8-row sprite atlas for three supplied quantum enemies in the EFV campus fantasy RPG: quantum scholar, wave-function familiar, and quantum paper spirit. Preserve recognizable silhouettes, cyan-violet interference glow, academic motifs, and painterly pixel-anime detail. Rows 1-3 scholar locomotion/interference cast/hit-death; rows 4-6 familiar phase-run/phase-pounce/hit-death; rows 7-8 paper spirit flutter/probability-cut-to-death. Each frame must change pose and internal energy flow, with consistent centering, scale and baseline. Three-quarter top-down game view, clean pale rim light. Flat #ff00ff background only, no text, no grid, no UI, no floor, no shadow.
```

### 5. 区块链系家族

```text
Create a production-ready 8-column by 8-row sprite atlas for the supplied blockchain enemies: chain-forged heavy beast, validation lock construct, and chain-claw spider. Reconstruct any weak source cutout into a clear readable game creature while preserving iron, brass, chain, lock, ledger and orange validation-energy motifs in EFV painterly pixel-anime style. Rows 1-3 heavy beast locomotion/chain rush/hit-death; rows 4-6 validation lock hover-slam/verification burst/hit-death; rows 7-8 spider skitter/chain mine-to-death. Real articulated leg, chain, armor and core motion, not a static image sliding. Three-quarter top-down view, fixed 8×8 cells, consistent scale/baseline. Flat #ff00ff only; no text, UI, grid, floor or shadow.
```

### 6. AI Agent 系家族

```text
Create a production-ready 7-column by 8-row sprite atlas for the supplied AI Agent enemies: cyber coordinator mage, digital cat, and tool-call bot cat. Preserve their readable silhouettes, violet-teal holographic language, agent nodes, prompt glyph shapes without literal text, and EFV painterly pixel-anime finish. Rows 1-3 mage locomotion/prompt-lance cast/hit-death; rows 4-6 digital cat run/blink slash/hit-death; rows 7-8 bot-cat run/tool-call cast-to-death. Animate legs, tails, robes, floating nodes and holograms with real anticipation and recovery. Three-quarter top-down RPG view, fixed cells, consistent baseline and thin pale rim light. Flat #ff00ff background only; no words, UI, grid, floor or shadow.
```

### 7. 结构失稳终局 BOSS

```text
Create a production-ready 8-column by 7-row two-form boss sprite sheet using the supplied structural-mechanics humanoid machine as the exact identity reference. Preserve its white steel truss frame, brass joints, cyan stress energy, heavy professor-built engineering aesthetic, and EFV painterly pixel-anime rendering. Rows 1-3: Form I humanoid load-bearing machine idle, heavy walk, hammer/load-collapse attack. Row 4: one continuous readable transformation across all eight frames—outer truss shell cracks, plates and members explode outward, core drops, limbs refold, and the machine locks into a low fast quadruped shear-beast form. Rows 5-6: Form II quadruped run/shear-cross attack/torsion-field attack. Row 7: complete core-overload defeat. Every frame distinct, consistent scale and ground contact, three-quarter top-down action-RPG view, thin cyan-white rim. Flat #ff00ff background only; no text, UI, grid, floor or shadow.
```

## 集成脚本

源图重新落盘时使用 `scripts/integrate-m34-animated-enemies.py`；脚本统一缩放到 1176×1176、生成 RGBA，并检查左上角透明度。
