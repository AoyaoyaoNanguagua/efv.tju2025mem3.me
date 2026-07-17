# 程序化技能特效实现指南 — Phaser 3(落雷 + 火焰双案例)

> 本文档面向 AI Agent 与开发者,讲解如何**不依赖任何美术资源**、纯代码实现主机游戏质感的技能特效。
> 方法论来自 EFV 项目机械终章 BOSS 战,包含两个已验证的完整案例:三阶段"落雷点名"(第三~六节)
> 和火焰系"爆炸 + 地面灼烧 + 烈焰之径"(第七节),均运行于 Phaser 3.60+。
> 所有代码自包含,可直接移植到任何 Phaser 3 项目;分层思路同样适用于 PixiJS / Canvas / 其他引擎。
>
> 阅读顺序建议:先读第一、二节建立方法论,再挑一个案例精读,最后看第九节的迁移公式。

---

## 一、为什么"几何线条"看起来廉价,而这套方案不会

大多数程序化特效显得廉价,根源只有两个:

1. **硬边图形**:`Graphics.lineStyle` 画出的线条边缘是 1 像素锐利截断的,没有光晕,不像"发光体"。
2. **没有加法混合**:光效叠加时颜色不会互相"曝光",亮部堆不起来。

解决方案也只有两个,是整套技术的分水岭:

1. **柔边渐变纹理**:用 Canvas `createRadialGradient` / `createLinearGradient` 在运行时生成带透明衰减的纹理,代替硬边几何。
2. **ADD(加法)混合模式**:所有发光元素设置 `setBlendMode(Phaser.BlendModes.ADD)`,重叠处自动过曝变白,产生真实的"光"的观感。

其余一切(分层描边、镜头震动、粒子)都建立在这两点之上。

---

## 二、效果解剖:一次落雷的四幕结构

好的技能特效是一段有节奏的"表演",拆成四幕:

| 幕 | 时长 | 内容 | 作用 |
|---|---|---|---|
| 1. 预警 (Telegraph) | 1.5~2.5s | 地面点名圈 + 旋转符文环 + 能量汇聚粒子 + 天光预兆 | 游戏性可读(玩家要走位),情绪蓄力 |
| 2. 打击 (Strike) | 0.2~0.35s | 体积光柱 + 三层描边曲折主雷 + 二次回击残影 | 一瞬间的视觉高潮,越短越有力 |
| 3. 冲击 (Impact) | 0.3~0.6s | 辉光球闪光 + 地面冲击波环 ×2 + 重力碎屑粒子 + 镜头白闪/震屏 | 传达"命中了、很痛" |
| 4. 残留 (Residue) | 0.6~1.6s | 地面爬行电弧 + 焦痕淡出 | 余韵,让世界"记住"这次打击 |

**时间结构口诀:长预警、短打击、有余韵。** 打击瞬间元素越多、持续越短,冲击力越强。

---

## 三、第一步:运行时生成两张关键纹理

游戏启动时(场景 `create` 阶段)生成一次,全局复用。这两张纹理是所有柔光效果的基石。

### 3.1 柔边辉光球(64×64,径向渐变)

用途:粒子、命中闪光、汇聚能量点。中心白热 → 亮蓝 → 深蓝 → 透明。

```javascript
const GLOW_ORB_KEY = "vfx-glow-orb";

function ensureGlowOrbTexture(scene) {
  if (scene.textures.exists(GLOW_ORB_KEY)) return;
  const texture = scene.textures.createCanvas(GLOW_ORB_KEY, 64, 64);
  const context = texture.getContext();
  const gradient = context.createRadialGradient(32, 32, 2, 32, 32, 31);
  gradient.addColorStop(0,    "rgba(244,253,255,1)");   // 白热核心
  gradient.addColorStop(0.24, "rgba(158,224,255,0.92)"); // 亮蓝
  gradient.addColorStop(0.58, "rgba(58,142,255,0.4)");   // 主色衰减
  gradient.addColorStop(1,    "rgba(22,62,180,0)");      // 边缘全透明
  context.fillStyle = gradient;
  context.fillRect(0, 0, 64, 64);
  texture.refresh();
}
```

> 换属性只需换色相:火焰用 `#fff→#ffd27a→#ff7a2a→透明`,毒用绿系,神圣用金白系。

### 3.2 体积光柱(96×512,双向渐变)

用途:落雷瞬间从天而降的"光之圆柱"。技巧是**两次渐变叠加**:
横向渐变做出"中间亮芯、两侧衰减"的圆柱截面感;再用 `destination-in` 合成模式叠一层纵向渐变,让柱体顶部淡出(伸向天空)、底部微淡。

```javascript
const PILLAR_KEY = "vfx-light-pillar";

function ensurePillarTexture(scene) {
  if (scene.textures.exists(PILLAR_KEY)) return;
  const texture = scene.textures.createCanvas(PILLAR_KEY, 96, 512);
  const context = texture.getContext();
  // 横向:两侧透明、中间白热
  const horizontal = context.createLinearGradient(0, 0, 96, 0);
  horizontal.addColorStop(0,   "rgba(44,118,255,0)");
  horizontal.addColorStop(0.3, "rgba(96,182,255,0.5)");
  horizontal.addColorStop(0.5, "rgba(238,251,255,1)");
  horizontal.addColorStop(0.7, "rgba(96,182,255,0.5)");
  horizontal.addColorStop(1,   "rgba(44,118,255,0)");
  context.fillStyle = horizontal;
  context.fillRect(0, 0, 96, 512);
  // 纵向:用 destination-in 把已有像素按纵向渐变"抠淡"
  const vertical = context.createLinearGradient(0, 0, 0, 512);
  vertical.addColorStop(0,    "rgba(255,255,255,0.14)"); // 顶部几乎消失
  vertical.addColorStop(0.45, "rgba(255,255,255,1)");
  vertical.addColorStop(1,    "rgba(255,255,255,0.92)");
  context.globalCompositeOperation = "destination-in";
  context.fillStyle = vertical;
  context.fillRect(0, 0, 96, 512);
  context.globalCompositeOperation = "source-over";
  texture.refresh();
}
```

---

## 四、第二幕:打击瞬间(主雷)

### 4.1 体积光柱闪现

一瞬间点亮,随后**横向收窄 + 淡出**同时进行——模拟闪电通道冷却收缩。

```javascript
function playPillarFlash(scene, x, groundY, skyY, intensity = 1) {
  const pillar = scene.add.image(x, groundY + 10, PILLAR_KEY)
    .setOrigin(0.5, 1)                          // 底部锚定在地面
    .setBlendMode(Phaser.BlendModes.ADD)
    .setDepth(groundY + 88)
    .setAlpha(0.95);
  pillar.setDisplaySize(150 * intensity, (groundY + 10 - skyY) * 1.05);
  scene.tweens.add({
    targets: pillar,
    alpha: 0,
    scaleX: pillar.scaleX * 0.22,               // 收窄到 22%
    duration: 320,
    ease: "Cubic.easeIn",
    onComplete: () => pillar.destroy()
  });
}
```

### 4.2 三层描边曲折主雷 + 分叉 + 二次回击

真实闪电的三个特征,逐一对应实现:

- **曲折路径**:把垂直线段拆成 9 段,每个中间节点做随机横向抖动。抖动幅度乘以 `sin(t·π)` 包络——两端(云端出发点、落点)固定为 0,中段摆动最大,保证"打得准"。
- **辉光层次**:同一条折线画三遍——宽深蓝(外辉光)→ 中亮蓝(过渡)→ 细白(内芯)。配合 ADD 混合,三层叠出体积光。
- **二次回击 (Return Stroke)**:真实闪电总是"闪两下"。55ms 后用**新的随机抖动**再画一条更细、更透明的雷,廉价但极大提升真实感。

```javascript
function drawJaggedBolt(scene, x, groundY, skyY, jitter, widthScale, alpha, depth) {
  const bolt = scene.add.graphics()
    .setDepth(depth)
    .setBlendMode(Phaser.BlendModes.ADD)
    .setAlpha(alpha);
  const segments = 9;
  const points = [];
  for (let i = 0; i <= segments; i += 1) {
    const t = i / segments;
    const sway = Math.sin(t * Math.PI) * jitter;   // 两端为0的包络
    points.push({
      x: x + (i === 0 || i === segments ? 0 : Phaser.Math.Between(-sway, sway)),
      y: Phaser.Math.Linear(skyY, groundY, t)
    });
  }
  // 三层描边:[宽度, 颜色, 不透明度],由外到内
  [[15 * widthScale, 0x1c49b8, 0.42],
   [ 7 * widthScale, 0x35a4ff, 0.80],
   [2.6 * widthScale, 0xeafcff, 1.00]].forEach(([width, color, lineAlpha]) => {
    bolt.lineStyle(width, color, lineAlpha);
    bolt.beginPath();
    points.forEach((p, i) => i ? bolt.lineTo(p.x, p.y) : bolt.moveTo(p.x, p.y));
    bolt.strokePath();
  });
  // 两条随机分叉支线(从主干中段岔出,斜向下)
  for (let branch = 0; branch < 2; branch += 1) {
    const origin = points[Phaser.Math.Between(3, segments - 3)];
    const dirX = branch ? 1 : -1;
    bolt.lineStyle(2 * widthScale, 0x8fd8ff, 0.85);
    bolt.beginPath();
    bolt.moveTo(origin.x, origin.y);
    bolt.lineTo(origin.x + dirX * Phaser.Math.Between(24, 46), origin.y + Phaser.Math.Between(26, 52));
    bolt.lineTo(origin.x + dirX * Phaser.Math.Between(40, 78), origin.y + Phaser.Math.Between(60, 110));
    bolt.strokePath();
  }
  scene.tweens.add({
    targets: bolt, alpha: 0, duration: 240, ease: "Cubic.easeIn",
    onComplete: () => bolt.destroy()
  });
}

// 组合调用:主雷 + 55ms 后的二次回击(更细、更飘)
function playSkyLightningStrike(scene, x, groundY, intensity = 1) {
  const skyY = groundY - 470;
  playPillarFlash(scene, x, groundY, skyY, intensity);
  drawJaggedBolt(scene, x, groundY, skyY, 30 * intensity, intensity, 1, groundY + 91);
  scene.time.delayedCall(55, () =>
    drawJaggedBolt(scene, x, groundY, skyY, 38 * intensity, intensity * 0.55, 0.85, groundY + 91));
  playLightningImpact(scene, x, groundY, intensity);   // 见第五节
}
```

---

## 五、第三、四幕:冲击与残留

```javascript
function playLightningImpact(scene, x, y, power = 1) {
  const depthBase = y + 90;

  // ① 命中闪光球:辉光纹理瞬间放大并淡出
  const orb = scene.add.image(x, y - 2, GLOW_ORB_KEY)
    .setBlendMode(Phaser.BlendModes.ADD).setDepth(depthBase + 4)
    .setScale(1.4 * power).setAlpha(0.98);
  scene.tweens.add({
    targets: orb, scale: 3.6 * power, alpha: 0,
    duration: 240, ease: "Cubic.easeOut", onComplete: () => orb.destroy()
  });

  // ② 双层地面冲击波:关键是"透视压扁的椭圆"(60×24 而非正圆),
  //    俯视角游戏中椭圆才像贴着地面扩散;第二环延迟 90ms,层次感来自时间差
  [0, 90].forEach((delay, index) => {
    scene.time.delayedCall(delay, () => {
      const ring = scene.add.graphics()
        .setPosition(x, y + 6).setDepth(depthBase + 2)
        .setBlendMode(Phaser.BlendModes.ADD);
      ring.lineStyle(index ? 3 : 5, index ? 0x63b8ff : 0xd8f6ff, 0.9);
      ring.strokeEllipse(0, 0, 60, 24);
      ring.setScale(0.34).setAlpha(0.95);
      scene.tweens.add({
        targets: ring,
        scaleX: (3.2 + index * 1.3) * power,
        scaleY: (3.2 + index * 1.3) * power,
        alpha: 0, duration: 330 + index * 90, ease: "Cubic.easeOut",
        onComplete: () => ring.destroy()
      });
    });
  });

  // ③ 重力碎屑:辉光粒子向上喷射后受重力下落,angle 限制在上半圆
  const burst = scene.add.particles(x, y - 4, GLOW_ORB_KEY, {
    emitting: false,
    speed: { min: 130 * power, max: 430 * power },
    angle: { min: 195, max: 345 },        // 只朝上半圆喷
    scale: { start: 0.52 * power, end: 0 },
    alpha: { start: 0.95, end: 0 },
    lifespan: { min: 260, max: 640 },
    gravityY: 640,                         // 重力让轨迹变成抛物线,真实感关键
    blendMode: "ADD"
  }).setDepth(depthBase + 3);
  burst.explode(Math.max(6, Math.round(16 * power)), 0, 0);
  scene.time.delayedCall(900, () => burst.destroy());

  // ④ 残留电弧:命中后 60~280ms 内,3 条小折线电弧在地面随机方向"爬行"
  //    (实现同 drawJaggedBolt,更短更细即可,注意 y 方向压扁 0.4 模拟贴地)

  // ⑤ 焦痕:深色椭圆 + 带电蓝描边,1.6 秒淡出——世界"记住"这次打击
  const scorch = scene.add.graphics().setPosition(x, y + 6).setDepth(y - 6);
  scorch.fillStyle(0x101a30, 0.5).fillEllipse(0, 0, 92 * power, 34 * power);
  scorch.lineStyle(2, 0x3f8cff, 0.5).strokeEllipse(0, 0, 96 * power, 37 * power);
  scorch.setAlpha(0.85);
  scene.tweens.add({
    targets: scorch, alpha: 0, duration: 1600, delay: 250,
    ease: "Sine.easeIn", onComplete: () => scorch.destroy()
  });
}
```

### 镜头与音效反馈(和视觉同等重要)

```javascript
scene.cameras.main.flash(160, 150, 215, 255, false);  // 蓝白闪屏
scene.cameras.main.shake(420, 0.013);                  // 震屏
```

WebAudio 雷鸣的分层配方(时间上错开,模拟"劈裂→轰鸣→回响"):

| 延迟 | 成分 | 参数示意 |
|---|---|---|
| 0ms | 高频劈裂 | 白噪声 0.14s + highpass 2500Hz;锯齿波 1650→180Hz 扫频 |
| 0ms | 低频轰鸣 | 白噪声 0.46s + lowpass 230Hz;44Hz 锯齿波 0.42s |
| 70ms | 中频躯干 | 白噪声 0.3s + bandpass 640Hz |
| 140ms | 泛音 | 122Hz 三角波 0.18s |
| 240ms | 尾音 | 白噪声 0.22s + lowpass 320Hz |

---

## 六、第一幕:预警(Telegraph)

预警首先是**游戏性语言**(玩家要看懂并走位),其次才是演出。在静态点名圈上叠三样"活"的东西:

1. **旋转符文环**:三段圆弧 + 三个能量三角画进一个 `Graphics`,然后 tween 它的 `angle` 匀速转一圈、`alpha` 呼吸脉动。静止的圈只是标记,旋转的圈是"正在运作的法阵"。

```javascript
const rune = scene.add.graphics().setPosition(cx, cy).setDepth(cy - 1);
rune.lineStyle(3, 0x6fd2ff, 0.85);
for (let arc = 0; arc < 3; arc += 1) {
  rune.beginPath();
  rune.arc(0, 0, radius * 0.55, (arc * Math.PI * 2) / 3, (arc * Math.PI * 2) / 3 + Math.PI * 0.42);
  rune.strokePath();
}
scene.tweens.add({ targets: rune, angle: 360, duration: telegraphMs, ease: "Linear" });
scene.tweens.add({ targets: rune, alpha: 0.45, duration: 240, yoyo: true, repeat: -1 });
```

2. **能量汇聚粒子**:每 130ms 在圈外随机角度生成一个辉光球,tween 到圆心并缩小淡出——"能量正在聚集"的暗示。用 `scene.time.addEvent({ delay: 130, repeat: N })` 驱动。

3. **天光预兆**:落雷前 0.7 秒,把光柱纹理以 `alpha 0.17` 在落点上方闪烁两下——给玩家最后的走位窗口,也让打击瞬间不显得突兀。

---

## 七、第二个完整案例:火焰系(爆炸 + 地面灼烧 + 烈焰之径)

这一节演示第九节迁移公式的实战:把同一套方法论换成火属性。三个组件层层复用——
爆炸调用灼烧、烈焰之径调用爆炸。

### 7.1 暖色辉光纹理(火系的基石)

和雷电的冷色辉光球做法完全一样,只换调色:白热 → 亮金 → 橙 → 暗红透明。

```javascript
const FIRE_GLOW_KEY = "vfx-fire-glow-orb";

function ensureFireGlowTexture(scene) {
  if (scene.textures.exists(FIRE_GLOW_KEY)) return;
  const texture = scene.textures.createCanvas(FIRE_GLOW_KEY, 64, 64);
  const context = texture.getContext();
  const gradient = context.createRadialGradient(32, 32, 2, 32, 32, 31);
  gradient.addColorStop(0,    "rgba(255,248,224,1)");
  gradient.addColorStop(0.22, "rgba(255,205,110,0.95)");
  gradient.addColorStop(0.55, "rgba(255,122,42,0.45)");
  gradient.addColorStop(1,    "rgba(190,44,16,0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 64, 64);
  texture.refresh();
}
```

烟雾层还需要一张暗色软斑纹理(同样的径向渐变套路,只是颜色暗、整体半透明):

```javascript
const SMOKE_TEXTURE_KEY = "vfx-smoke-puff";

function ensureSmokeTexture(scene) {
  if (scene.textures.exists(SMOKE_TEXTURE_KEY)) return;
  const texture = scene.textures.createCanvas(SMOKE_TEXTURE_KEY, 48, 48);
  const context = texture.getContext();
  const gradient = context.createRadialGradient(24, 24, 3, 24, 24, 23);
  gradient.addColorStop(0,    "rgba(151,79,48,0.64)");
  gradient.addColorStop(0.42, "rgba(92,54,45,0.42)");
  gradient.addColorStop(1,    "rgba(45,34,35,0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 48, 48);
  texture.refresh();
}
```

### 7.2 持续灼烧残留(spawnGroundBurnPatch)

火系的"残留"不是一闪而过的焦痕,而是**持续燃烧一段时间再熄灭**的地面状态,
由三层组成:焦痕(静态)、余温辉光(呼吸)、小火苗(持续粒子)。

```javascript
function spawnGroundBurnPatch(scene, x, y, { power = 1, durationMs = 2600 } = {}) {
  const depth = y - 4;                       // 沉到角色脚下
  // ① 焦痕:双层暗色椭圆 + 余温橙边
  const scorch = scene.add.graphics().setPosition(x, y).setDepth(depth);
  scorch.fillStyle(0x1c0f0a, 0.55).fillEllipse(0, 0, 104 * power, 40 * power);
  scorch.fillStyle(0x3a1710, 0.5).fillEllipse(0, 0, 74 * power, 28 * power);
  scorch.lineStyle(2, 0xff7a36, 0.4).strokeEllipse(0, 0, 108 * power, 42 * power);
  // ② 余温辉光:辉光球压扁贴地(scaleY≈0.36×scaleX),明暗呼吸
  const glow = scene.add.image(x, y, FIRE_GLOW_KEY)
    .setBlendMode(Phaser.BlendModes.ADD).setDepth(depth + 1)
    .setAlpha(0.5).setScale(1.7 * power, 0.62 * power);
  scene.tweens.add({ targets: glow, alpha: 0.22, duration: 300, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
  // ③ 小火苗:椭圆发射区内持续升腾的连续粒子(注意这是 frequency 驱动的
  //    连续发射器,不是 explode 一次性爆发)
  const embers = scene.add.particles(x, y - 4, FIRE_GLOW_KEY, {
    lifespan: { min: 380, max: 760 },
    speedY: { min: -66, max: -22 },
    speedX: { min: -18, max: 18 },
    scale: { start: 0.3 * power, end: 0 },
    alpha: { start: 0.85, end: 0 },
    frequency: Math.round(90 / power),
    emitZone: { type: "random", source: new Phaser.Geom.Ellipse(0, 0, 88 * power, 30 * power) },
    blendMode: "ADD"
  }).setDepth(depth + 2);
  // 到时熄灭:先 stop() 让存量粒子飞完,再淡出焦痕,最后 destroy
  scene.time.delayedCall(durationMs, () => {
    embers.stop();
    scene.tweens.killTweensOf(glow);
    scene.tweens.add({
      targets: [scorch, glow], alpha: 0, duration: 900, ease: "Sine.easeIn",
      onComplete: () => { scorch.destroy(); glow.destroy(); }
    });
    scene.time.delayedCall(820, () => embers.destroy());
  });
}
```

### 7.3 火焰爆炸(playFireExplosion)

对照落雷的冲击层,火焰爆炸多了两个专属手法:**升腾火球的色温演变**和
**普通混合的烟雾对比**。

```javascript
function playFireExplosion(scene, x, y, power = 1, options = {}) {
  const depthBase = y + 90;
  // ① 白热闪光(同雷系命中闪光,换纹理即可)
  const flash = scene.add.image(x, y - 12, FIRE_GLOW_KEY)
    .setBlendMode(Phaser.BlendModes.ADD).setDepth(depthBase + 5)
    .setScale(1.5 * power).setAlpha(1);
  scene.tweens.add({ targets: flash, scale: 4.2 * power, alpha: 0, duration: 260, ease: "Cubic.easeOut", onComplete: () => flash.destroy() });
  // ② 升腾火球:三个辉光球依次上升、膨胀、由白热转暗红——
  //    tint 序列 [白, 金, 橙] 模拟爆炸核心冷却的色温变化,是火焰质感的关键
  const ballTints = [0xffffff, 0xffc06a, 0xff8a3a];
  for (let index = 0; index < 3; index += 1) {
    const ball = scene.add.image(x + Phaser.Math.Between(-14, 14) * power, y - 8, FIRE_GLOW_KEY)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(depthBase + 4 - index)
      .setScale((1.1 - index * 0.25) * power)
      .setAlpha(0.92)
      .setTint(ballTints[index]);
    scene.tweens.add({
      targets: ball,
      y: y - (70 + index * 34) * power,
      scale: (2 + index * 0.5) * power,
      alpha: 0,
      duration: 460 + index * 130,
      delay: index * 60,
      ease: "Cubic.easeOut",
      onComplete: () => ball.destroy()
    });
  }
  // ③ 地面冲击波双环:与雷系相同,颜色换暖(0xffd8a8 / 0xff7a36)
  // ④ 火星迸射:与雷系碎屑相同,gravityY 加大到 720,火星回落更快更重
  // (③④ 代码与第五节相同,仅调色,略)
  // ⑤ 烟雾:用 NORMAL(默认)混合而不是 ADD!全 ADD 的画面"轻飘飘",
  //    暗色烟雾提供了物质感对比,让火光显得更亮
  const smoke = scene.add.particles(x, y - 16, SMOKE_TEXTURE_KEY, {
    emitting: false,
    lifespan: { min: 620, max: 1100 },
    speed: { min: 26, max: 74 },
    angle: { min: 235, max: 305 },
    gravityY: -60,
    scale: { start: 0.24 * power, end: 0.8 * power },
    alpha: { start: 0.34, end: 0 },
    tint: [0x6a3028, 0x3d2b30, 0x26242b]
  }).setDepth(depthBase + 1);
  smoke.explode(Math.max(3, Math.round(5 * power)), 0, 0);
  scene.time.delayedCall(1300, () => smoke.destroy());
  // ⑥ 灼烧残留(组件复用)
  if (options.burn !== false) {
    spawnGroundBurnPatch(scene, x, y + 4, { power: power * 0.9, durationMs: Math.round(2400 * power) });
  }
  scene.cameras.main.shake(Math.round(240 * power), 0.008 * Math.min(1.4, power));
}
```

### 7.4 烈焰之径:线状持续灼烧 + 连锁引爆

BOSS 冲刺后在地面留下一条燃烧路径,存续 5 秒后爆炸。两个关键手法:

**存续期——错相呼吸的熔岩辉光。** 沿线段每 ~88px 铺一个压扁的辉光斑,
每个的呼吸动画带 `delay: index * 90`:相位差让整条路径产生"火在流动"的错觉,
而不是整条线一起闪。

```javascript
const emberGlows = [];
const patchCount = Math.max(2, Math.round(pathLength / 88));
for (let index = 0; index <= patchCount; index += 1) {
  const ratio = index / patchCount;
  const ember = scene.add.image(
    start.x + (end.x - start.x) * ratio,
    start.y + (end.y - start.y) * ratio,
    FIRE_GLOW_KEY
  ).setBlendMode(Phaser.BlendModes.ADD).setDepth(depth - 1)
    .setAlpha(0.42).setScale(1.05, 0.4);          // 压扁贴地
  scene.tweens.add({
    targets: ember, alpha: 0.16, scaleX: 0.8,
    duration: 320, delay: index * 90,              // ← 相位差是"流动感"的来源
    yoyo: true, repeat: -1, ease: "Sine.easeInOut"
  });
  emberGlows.push(ember);
}
```

**引爆期——沿路径的连锁爆炸。** 不要在中点放一个大爆炸(线状区域一个圆形爆炸
覆盖不了),而是主爆点(power 1.2)在中点先炸,再沿路径每 ~170px 一个副爆点
(power 0.62)以 60ms 步进错时引爆,偶数位留下灼烧残留:

```javascript
playFireExplosion(scene, midX, midY, 1.2);
const chainCount = Math.max(1, Math.round(pathLength / 170));
for (let index = 0; index <= chainCount; index += 1) {
  if (index === Math.round(chainCount / 2)) continue;   // 中点已炸过
  const ratio = index / chainCount;
  scene.time.delayedCall(70 + index * 60, () =>
    playFireExplosion(scene, start.x + dx * ratio, start.y + dy * ratio, 0.62, { burn: index % 2 === 0 }));
}
```

> 清理提醒:路径可能被提前打断(BOSS 死亡/切图),所有 emberGlows 的无限循环
> tween 必须在 cleanup 里 `killTweensOf` 后统一淡出销毁,并用 `cleaned` 标志防止
> cleanup 重入(定时引爆和手动清理可能同时到达)。

---

## 八、工程注意事项(踩过的坑)

1. **清理是纪律**:每个 tween 的 `onComplete` 必须 `destroy()`;技能被打断/目标死亡时,必须 `tweens.killTweensOf(obj)` + `obj.destroy()` + `timer.remove(false)` 一起做。漏一个就是泄漏或"幽灵图形"。
2. **深度排序**:2.5D 俯视角下用 `y` 坐标当深度基准(本文的 `depthBase = y + 90`),焦痕要低于角色(`y - 6`),闪光要高于角色。
3. **纹理只生成一次**:所有 `ensure*Texture` 用 `textures.exists()` 守卫,放在场景 `create` 里统一调用。
4. **强度参数化**:所有函数带 `intensity`/`power` 缩放系数,同一套代码就能做"BOSS 大招落雷(1.25)"和"连锁小雷(0.55)"。
5. **随机要有包络**:抖动幅度乘 `sin(t·π)` 保证端点精确;分叉起点限制在中段。完全均匀的随机反而显得假。
6. **多人同步只同步"决定",不同步"演出"**:网络只广播落点坐标和时间戳,每个客户端本地各自随机生成雷的形状——省流量,且每个人看到的都是完整演出。
7. **`Phaser.Math.Between` 返回整数**,传入浮点会被取整,做小幅抖动时注意精度是否够用。
8. **性能**:单次落雷 ≈ 3 个 Graphics + 2 个 Image + 1 个粒子发射器,全部 1.6 秒内销毁,可以放心在 5 人同屏时使用。避免在预警期每帧重画 Graphics(画一次然后 tween 变换即可)。
9. **连续粒子发射器的关闭顺序**:`frequency` 驱动的持续发射器(如灼烧火苗)必须先 `stop()` 停止产出、等最长 lifespan 过完让存量粒子自然飞尽,再 `destroy()`。直接 destroy 会让画面上的粒子瞬间消失,穿帮。
10. **不要全 ADD**:烟雾、碎屑等"物质"元素用默认 NORMAL 混合。全 ADD 的画面轻飘飘没有重量,暗色元素的对比反而让光更亮(见 7.3 的烟雾层)。
11. **连锁演出限量**:烈焰之径引爆时若路径很长,副爆点数量要封顶(每 ~170px 一个已足够),每个爆炸自带震屏,连锁过密会让镜头持续晃动且掉帧。
12. **持续灼烧的伤害与视觉分离**:灼烧区的视觉存续时间(2.4~2.6s)和实际伤害判定 tick 各自独立配置,调演出时不改数值,反之亦然。

---

## 九、迁移到其他属性/技能的通用公式

```
任何"打击类"技能特效 = 预警(可读性) + 光柱/弹道(方向感) + 多层描边主体(体积感)
                      + 冲击波环(力量感) + 重力粒子(物质感) + 残留痕迹(余韵)
                      + 镜头反馈(触感) + 分层音效(打击感)
```

换属性 = 换调色板 + 换主体形态:

| 属性 | 调色板(外→内) | 主体形态 | 残留 | 本文实现 |
|---|---|---|---|---|
| 雷电 | 深蓝 → 亮蓝 → 白 | 曲折折线 + 分叉 | 爬行电弧 + 蓝边焦痕 | 第三~六节 |
| 火焰 | 暗红 → 橙 → 黄白 | 升腾火球(白热→暗红) | 持续灼烧区 + 小火苗 | 第七节 |
| 冰霜 | 深青 → 冰蓝 → 白 | 尖锐多边形冰晶 | 冰面碎裂纹理 | — |
| 神圣 | 金 → 淡金 → 白 | 平滑光柱 + 羽毛粒子 | 金色符文淡出 | — |

对照两个已实现案例可以看到公式的稳定性:雷和火共用同一张辉光纹理生成代码
(只换渐变色)、同一套冲击波环、同一套重力碎屑;真正的属性差异只在
**主体形态**(折线 vs 升腾火球)和**残留形式**(瞬时焦痕 vs 持续灼烧)。

核心不变:**柔边渐变纹理 + ADD 混合 + 四幕时间结构**。
