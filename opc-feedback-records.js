(function () {
  "use strict";

  const body = document.querySelector("[data-feedback-record-body]");
  if (!body) return;

  const labels = {
    kind: { positive: "正面反馈", negative: "负面反馈", suggestion: "优化建议" },
    category: {
      character: "角色与 IP",
      game: "游戏内容",
      merchandise: "实体周边",
      payment: "支付订单",
      website: "网站体验",
      cooperation: "商务合作"
    }
  };

  const blueprints = [
    ["character", "positive", "莉娜的治愈系形象很有记忆点", "白发、紫色学院服和猫爪法杖形成了清晰识别，希望后续宣传继续突出温柔守护的定位。"],
    ["character", "positive", "知夏的眼镜与书本设定很贴合学术主题", "角色不仅可爱，也能让人立刻理解远程法术与知识探索的能力方向。"],
    ["character", "suggestion", "希望阿宇增加一套校庆限定服装", "可以保留蓝色学院色，并加入同济校庆纹样与可拆卸披风。"],
    ["character", "negative", "老登部分视觉里的猫爪比例偏大", "猫爪会抢过脸部和服装重点，建议缩小并保留柔软可爱的肉垫细节。"],
    ["character", "suggestion", "建议为江寻增加独立探索支线", "弓箭、追踪和敏捷设定适合制作校园寻宝与线索调查章节。"],
    ["character", "positive", "三位男生的服装与武器区分清楚", "阿宇的剑、江寻的弓和老登的力量感让组队画面容易辨认。"],
    ["character", "suggestion", "希望主要角色增加语音样例", "角色页可以加入问候、战斗与校园日常三类短语音，提升人物生命力。"],
    ["character", "negative", "部分多人海报里的角色脸型不够统一", "建议建立五位角色的头部比例、眼睛形状和发色标准表，减少跨素材偏差。"],
    ["character", "suggestion", "建议开放校庆汉服设定细节页", "想看到服装纹样、配饰寓意以及猫爪与传统服饰结合的设计过程。"],

    ["game", "positive", "校园地图的探索氛围很舒服", "熟悉的校园建筑与幻想元素结合自然，适合慢节奏探索和收集。"],
    ["game", "negative", "手机端首次进入时按钮偏多", "新玩家不容易判断第一步，建议只保留开始任务、角色和设置三个主入口。"],
    ["game", "suggestion", "新手引导可以拆成三个短任务", "移动、交互和战斗分别教学，每一步完成后给出明确反馈。"],
    ["game", "negative", "多人移动偶尔出现短暂回弹", "网络波动时角色位置会被拉回，建议增加插值和弱网状态提示。"],
    ["game", "suggestion", "希望每位角色都有个人剧情", "个人章节可围绕学术方向、伙伴关系与校园事件展开，并提供专属奖励。"],
    ["game", "positive", "樱花校园的音乐和画面很协调", "整体氛围轻松，适合在任务之间停留和拍照。"],
    ["game", "suggestion", "Boss失败后希望快速重试", "建议保留队伍配置和技能选择，减少重复进入关卡的步骤。"],
    ["game", "negative", "部分技能特效会遮挡敌人提示", "高亮效果叠加时看不清预警范围，建议降低透明度并提高警示层级。"],
    ["game", "suggestion", "增加色弱与字体大小选项", "关键状态不要只用颜色区分，并允许调整对话与按钮文字大小。"],
    ["game", "positive", "多人协作的角色分工明确", "治疗、输出、控制和近战定位让组队过程有讨论空间。"],

    ["merchandise", "positive", "莉娜与知夏手办的脸部喷涂很好看", "阳光下眼睛反光与发丝层次自然，适合作为产品页主图。"],
    ["merchandise", "suggestion", "希望补充三位男生的毛绒版本", "阿宇、江寻和老登可以使用不同坐姿，并保留剑、弓与学院外套。"],
    ["merchandise", "negative", "部分手办示意图的脚掌显得太大", "建议缩小猫爪鞋比例，让头部与服装成为主要视觉重点。"],
    ["merchandise", "suggestion", "毛绒玩具可以增加可替换配件", "眼镜、书本、披风和小武器可以做成魔术贴或安全软配件。"],
    ["merchandise", "negative", "手办价格说明缺少规格信息", "188元旁边建议补充高度、材质、底座尺寸和是否含税。"],
    ["merchandise", "positive", "Q版毛绒的刺绣猫爪很可爱", "肉垫清楚但不夸张，适合摆在沙发或书桌上。"],
    ["merchandise", "suggestion", "希望提供预售提醒功能", "可以允许用户选择角色并登记提醒，不需要立即进入支付流程。"],
    ["merchandise", "negative", "担心长发角色运输时容易压变形", "建议包装示意展示头发支撑、透明保护壳和售后补件规则。"],
    ["merchandise", "suggestion", "建议展示手办和毛绒的实际尺寸对比", "加入尺子、书本或手掌作为参照，避免用户误判大小。"],

    ["payment", "negative", "支付成功后订单状态更新较慢", "微信已扣款但页面仍显示待确认，希望展示平台回调与到账确认的处理进度。"],
    ["payment", "suggestion", "希望明确展示支持的支付渠道", "下单页可列出支付宝、微信和聚合支付，并说明退款原路返回。"],
    ["payment", "positive", "退款处理结果说明很清楚", "状态、金额和原支付渠道都有记录，用户容易确认。"],
    ["payment", "negative", "订单详情缺少预计到账时间", "支付成功和财务入账是两个阶段，希望页面说明当前处于哪一步。"],
    ["payment", "suggestion", "建议增加电子发票入口", "订单完成后允许填写抬头和税号，并查看开票进度。"],
    ["payment", "negative", "重复点击支付按钮可能产生多个订单", "应在创建支付请求后锁定按钮，并提供继续支付已有订单的入口。"],
    ["payment", "suggestion", "希望售后页显示退款流水号", "平台退款编号和预计到账日期有助于用户联系支付渠道核对。"],

    ["website", "positive", "产品页大图轮播更容易看清细节", "自动切换速度合适，左右按钮也方便手动比较不同周边。"],
    ["website", "negative", "移动端页面信息密度仍然偏高", "建议缩短中英文重复说明，并把次要内容放入展开区域。"],
    ["website", "suggestion", "商品图片希望支持点击放大", "放大后可以查看面部、猫爪、服装纹理和底座细节。"],
    ["website", "negative", "部分海报说明曾遮挡前景角色", "图片文字应固定在下方信息栏，不要覆盖角色脸部与身体。"],
    ["website", "suggestion", "建议增加夜间阅读模式", "控制台和长表格页面在夜间使用时可以降低白色背景亮度。"],
    ["website", "positive", "客户反馈入口位置清楚", "从产品页可以直接进入，并能理解反馈会如何流转。"],
    ["website", "negative", "首次加载多张高清图片时速度偏慢", "建议使用延迟加载、现代图片格式和合适的缩略图尺寸。"],
    ["website", "suggestion", "轮播需要继续支持键盘操作", "左右方向键、焦点样式和减少动画偏好对无障碍访问很重要。"],

    ["cooperation", "suggestion", "希望提供基础授权报价区间", "可按校园活动、内容联名、实体周边和长期授权展示不同合作范围。"],
    ["cooperation", "positive", "三个主 Agent 的工作闭环表达清楚", "策划、生产和市场之间的责任与接口容易理解。"],
    ["cooperation", "negative", "商务联系页面缺少明确负责人", "建议列出合作类型、响应时间和对应的市场关系 subagent。"],
    ["cooperation", "suggestion", "建议提供可下载的品牌资料包", "资料可包含角色简介、标准色、可用素材范围和合作申请模板。"],
    ["cooperation", "positive", "财务示例报表提升了合作可信度", "支付回调、应收确认和到账入账的区分比较专业。"],
    ["cooperation", "suggestion", "希望反馈台账开放结构化接口", "市场 Agent 可以按日期、分类、优先级和状态抓取汇总数据。"],
    ["cooperation", "negative", "部分页面没有明显标注模拟数据", "演示报表、价格和用户反馈都应持续显示 DEMO 标识，避免被理解为真实经营数据。"]
  ];

  const categoryOwner = {
    character: "策划 Agent · IP策划 subagent",
    game: "生产 Agent · 代码/测试 subagent",
    merchandise: "生产 Agent · 美术 subagent",
    payment: "市场 Agent · 财务 subagent",
    website: "生产 Agent · 代码 subagent",
    cooperation: "市场 Agent · 市场关系 subagent"
  };
  const categoryProduct = {
    character: "学术喵角色资产",
    game: "樱花同济篇 MVP",
    merchandise: "IP 实体周边",
    payment: "支付与订单服务",
    website: "OPC 公司网站",
    cooperation: "IP 合作与授权"
  };
  const channels = ["官方网站", "在线试玩", "微信社群", "小红书", "客户邮件", "支付后回访"];
  const statuses = ["已受理", "分析中", "已转需求", "生产处理中", "待回访", "已闭环"];
  const ratingCycle = {
    positive: [5, 5, 4],
    negative: [2, 1, 2],
    suggestion: [4, 3, 4]
  };
  const baseTime = new Date("2026-07-12T18:48:00+08:00");
  const timeFormatter = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });

  const records = blueprints.map(([category, kind, subject, detail], index) => {
    const rating = ratingCycle[kind][index % ratingCycle[kind].length];
    const priority = kind === "negative" ? (index % 3 === 0 ? "紧急" : "高") : kind === "suggestion" ? "中" : "低";
    const status = statuses[(index * 5 + (kind === "negative" ? 1 : 0)) % statuses.length];
    const submittedAt = new Date(baseTime.getTime() - index * 173 * 60 * 1000);
    return {
      id: `FB-202607-${String(2050 - index).padStart(4, "0")}`,
      time: timeFormatter.format(submittedAt).replace(/\//g, "/"),
      category,
      kind,
      rating,
      subject,
      detail,
      product: categoryProduct[category],
      channel: channels[index % channels.length],
      priority,
      status,
      owner: categoryOwner[category]
    };
  });

  const search = document.querySelector("[data-feedback-search]");
  const kindFilter = document.querySelector("[data-feedback-kind-filter]");
  const categoryFilter = document.querySelector("[data-feedback-category-filter]");
  const statusFilter = document.querySelector("[data-feedback-status-filter]");
  const resultCount = document.querySelector("[data-feedback-result-count]");
  const categorySummary = document.querySelector("[data-feedback-category-summary]");
  const exportButton = document.querySelector("[data-feedback-export]");
  let filteredRecords = records;

  const escapeHtml = value => String(value).replace(/[&<>"]/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;"
  }[character]));

  const statusClass = status => ({
    "已闭环": "ok",
    "待回访": "warning",
    "生产处理中": "pending",
    "已转需求": "pending",
    "分析中": "warning",
    "已受理": "muted"
  }[status] || "muted");

  const priorityClass = priority => priority === "紧急" || priority === "高" ? "danger" : priority === "中" ? "warning" : "muted";

  const updateSummary = source => {
    const countByKind = kind => source.filter(record => record.kind === kind).length;
    const open = source.filter(record => record.status !== "已闭环").length;
    const average = source.length ? source.reduce((sum, record) => sum + record.rating, 0) / source.length : 0;
    const values = {
      total: source.length,
      positive: countByKind("positive"),
      negative: countByKind("negative"),
      suggestion: countByKind("suggestion"),
      open,
      rating: average.toFixed(1)
    };
    Object.entries(values).forEach(([key, value]) => {
      const target = document.querySelector(`[data-feedback-kpi="${key}"]`);
      if (target) target.textContent = String(value);
    });

    if (!categorySummary) return;
    const categoryCounts = Object.keys(labels.category).map(category => ({
      category,
      count: source.filter(record => record.category === category).length
    }));
    const max = Math.max(1, ...categoryCounts.map(item => item.count));
    categorySummary.innerHTML = categoryCounts.map(item => `
      <article class="feedback-category-card">
        <div><b>${escapeHtml(labels.category[item.category])}</b><strong>${item.count}</strong></div>
        <span>${source.length ? Math.round(item.count / source.length * 100) : 0}%</span>
        <i style="--w:${item.count / max * 100}%"></i>
      </article>
    `).join("");
  };

  const render = () => {
    const query = (search?.value || "").trim().toLowerCase();
    const kind = kindFilter?.value || "all";
    const category = categoryFilter?.value || "all";
    const status = statusFilter?.value || "all";

    filteredRecords = records.filter(record => {
      const searchable = `${record.id} ${record.subject} ${record.detail} ${record.product} ${record.channel} ${record.owner}`.toLowerCase();
      return (!query || searchable.includes(query)) &&
        (kind === "all" || record.kind === kind) &&
        (category === "all" || record.category === category) &&
        (status === "all" || record.status === status);
    });

    body.innerHTML = filteredRecords.map(record => `
      <tr>
        <td><code>${escapeHtml(record.id)}</code><small>${escapeHtml(record.time)}</small></td>
        <td><span class="feedback-kind-chip ${escapeHtml(record.kind)}">${escapeHtml(labels.kind[record.kind])}</span></td>
        <td><b>${escapeHtml(labels.category[record.category])}</b></td>
        <td><span class="feedback-rating-value">${record.rating}.0</span><small>满分 5.0</small></td>
        <td class="feedback-content-cell"><b>${escapeHtml(record.subject)}</b><p>${escapeHtml(record.detail)}</p></td>
        <td><b>${escapeHtml(record.product)}</b><small>${escapeHtml(record.channel)}</small></td>
        <td><span class="payment-status ${priorityClass(record.priority)}">${escapeHtml(record.priority)}</span></td>
        <td><span class="payment-status ${statusClass(record.status)}">${escapeHtml(record.status)}</span></td>
        <td><b>${escapeHtml(record.owner)}</b></td>
      </tr>
    `).join("");

    if (resultCount) resultCount.textContent = `显示 ${filteredRecords.length} / ${records.length} 条`;
    updateSummary(filteredRecords);
  };

  const csvEscape = value => `"${String(value).replace(/"/g, "\"\"")}"`;
  exportButton?.addEventListener("click", () => {
    const headers = ["反馈编号", "提交时间", "反馈性质", "业务分类", "评分", "标题", "详细内容", "关联产品", "来源渠道", "优先级", "状态", "责任Agent"];
    const rows = filteredRecords.map(record => [record.id, record.time, labels.kind[record.kind], labels.category[record.category], record.rating, record.subject, record.detail, record.product, record.channel, record.priority, record.status, record.owner]);
    const csv = `\uFEFF${[headers, ...rows].map(row => row.map(csvEscape).join(",")).join("\r\n")}`;
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "opc-feedback-records-demo.csv";
    link.click();
    URL.revokeObjectURL(url);
  });

  [search, kindFilter, categoryFilter, statusFilter].forEach(control => {
    control?.addEventListener(control === search ? "input" : "change", render);
  });

  render();
})();
