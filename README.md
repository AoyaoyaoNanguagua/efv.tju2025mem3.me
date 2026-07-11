# 学术喵的奇幻之旅：樱花同济篇

The Erudite Feline's Wonder Voyage, TJU: Cherry Blossom Chronicle。当前阶段先用莉娜做少帧锚定精灵表试水，不接入 MySQL。

## 一、本地预览

```powershell
python -m http.server 4173
```

浏览器打开 `http://127.0.0.1:4173/`，页面可以测试莉娜各个动作、暂停逐帧查看、切换背景，并进入实战测试检查 WASD 移动和左右翻转。

## 二、精灵表约定

当前试水版使用一张 8 列 × 8 行的 PNG，整体 `1176 × 1176`，每格 `147 × 147`：

1. 待机
2. 行走
3. 施法 / 攻击
4. 受击
5. 死亡
6. 人猫互变
7. 猫形移动
8. 猫形跳跃

文件名：

- `assets/sprites/lina-sprites-v10-anchored-expanded.png`
- `assets/sprites/ayu-sprites-v11-q-normalized.png`

如果重新出图，把原图放到 `assets/sprites/original/<角色>-sprites.png`，运行 `python tools/normalize_sprites.py` 即可统一尺寸并去掉棋盘底。

## 三、打部署包

```powershell
powershell -ExecutionPolicy Bypass -File tools\pack_deploy.ps1
```

执行后会生成 `dist\efv.zip`，里面只放运行需要的 HTML/JS/CSS、精灵图、海报和 Phaser。PDF、PPT、草图都不会被打进去。

## 四、宝塔部署（小白版）

> 目标：在阿里云宝塔上新开一个独立站点 `efv`，不动现有项目。

### 准备

- 一台已经装好宝塔面板的阿里云服务器，能正常登录面板。
- 一个能解析到这台服务器的域名或子域名，比如 `efv.你的域名.com`；或者临时用服务器公网 IP + 端口也可以。
- 本地已经生成的 `dist\efv.zip`。

### 步骤 1：在宝塔创建站点

1. 登录宝塔面板 → 左侧菜单 **网站** → 右上角 **添加站点**。
2. **域名** 填 `efv.你的域名.com`（如果只想用 IP 测试，就随便填个域名占位，例如 `efv.local`，后面会用 IP+端口访问）。
3. **根目录** 保留默认，宝塔会自动建 `/www/wwwroot/efv.你的域名.com/`，记下这个路径。
4. **PHP 版本** 选 **纯静态**。
5. **数据库** 不创建，**FTP** 不创建。
6. 点 **提交**。

### 步骤 2：开放访问端口

- 宝塔面板 → **安全** → 放行 `80`（HTTP）；如果以后要 HTTPS，也放行 `443`。
- 阿里云控制台 → 你的 ECS 实例 → **安全组** → 添加规则放行同样的端口（这一步很多人会漏，端口没开就打不开网页）。

### 步骤 3：上传文件

1. 宝塔面板 → 左侧菜单 **文件** → 进入刚才那个根目录 `/www/wwwroot/efv.你的域名.com/`。
2. 把里面默认的 `index.html`、`404.html`、`.user.ini` 等占位文件**保留也行、删掉也行**，只要别把你自己的 `index.html` 覆盖掉就行。
3. 点上方 **上传** → 选择本地的 `dist\efv.zip` → 上传。
4. 上传完成后右键 `efv.zip` → **解压**，解压到当前目录。解压后这个文件夹里应该直接能看到：

   ```
   index.html
   app.js
   styles.css
   README.md
   assets/
   vendor/
   ```

5. 删掉 `efv.zip`（可选，省点空间）。

### 步骤 4：用域名访问

- 解析好的域名 → 浏览器打开 `http://efv.你的域名.com/` 就能看到页面。
- 如果用 IP 测试：宝塔面板 → **网站** → 找到这个站点 → **设置** → **域名管理** → 添加 `服务器公网IP` → 浏览器打开 `http://服务器公网IP/`。注意如果服务器上有多个站点都绑了 80 端口，按 IP 直接访问可能落到其他站点；这时改成 `http://efv.你的域名.com/` 最稳。

### 步骤 5（可选）：开启 HTTPS

1. 宝塔面板 → **网站** → 找到这个站点 → **设置** → **SSL**。
2. 选 **Let's Encrypt** → 勾选域名 → 申请。
3. 申请成功后打开 **强制 HTTPS**。

### 常见坑

- **打开是宝塔默认页**：八成是没把文件解压到站点根目录，或者解压出来多套了一层文件夹。`index.html` 必须直接在站点根目录下。
- **图片 404**：检查 `assets/sprites/` 和 `assets/portraits/` 是不是和 `index.html` 同级。
- **网页打不开**：端口没放行（宝塔安全 + 阿里云安全组都要放）。
- **乱码或精灵不显示**：强刷一下 `Ctrl + F5`，Nginx 默认开启了静态缓存。

### 不影响现有项目

- 整个 EFV 是一个独立的宝塔站点，物理上在自己的目录 `/www/wwwroot/efv.你的域名.com/` 下，和原有的 `/www/wwwroot/旧站点/` 互不干涉。
- 数据库没接，所以也不会动到现有数据库。
- 域名是新的子域名，不影响主域名解析。

## 五、后续更新

页面有改动时，本地重新跑 `tools\pack_deploy.ps1`，把 `dist\efv.zip` 重新上传到站点根目录、覆盖解压即可。也可以只单独覆盖被修改的文件（比如 `app.js`）。
