(function () {
  "use strict";

  const navToggle = document.querySelector("[data-nav-toggle]");
  const navLinks = document.querySelector("[data-nav-links]");

  navToggle?.addEventListener("click", () => {
    const open = navLinks?.classList.toggle("open");
    navToggle.setAttribute("aria-expanded", open ? "true" : "false");
  });

  document.querySelectorAll("[data-tab]").forEach(button => {
    button.addEventListener("click", () => {
      const target = button.getAttribute("data-tab");
      document.querySelectorAll("[data-tab]").forEach(tab => {
        tab.setAttribute("aria-selected", tab === button ? "true" : "false");
      });
      document.querySelectorAll("[data-panel]").forEach(panel => {
        panel.classList.toggle("active", panel.getAttribute("data-panel") === target);
      });
    });
  });

  const detailCopy = {
    assets: {
      title: "资产总量 IP Assets",
      body: "本周期累计 128 项资产，其中视觉资产 64 项、代码与工具 27 项、宣发素材 24 项、文档与协议 13 项。资产进入复用库后，会服务后续关卡、角色活动和宣发包。",
      rows: [["本周新增", "+19 项"], ["可复用率", "76%"], ["下周重点", "敌人层级与关卡包"]]
    },
    agents: {
      title: "活跃 Agent Active Agents",
      body: "6 类 Agent 共同推进产品、视觉、代码、测试、宣发和财务复盘。主理人负责方向、验收与资源配置。",
      rows: [["高负载 Agent", "美术 / 宣发"], ["待验收任务", "7 项"], ["自动检查", "页面 / 视频 / 链接"]]
    },
    campaign: {
      title: "宣发素材 Campaign Items",
      body: "当前队列包含角色 PV、短视频切条、封面、图文标题和平台标签。素材会按小红书等渠道进行差异化包装。",
      rows: [["待审核", "14 项"], ["已入库", "10 项"], ["主推内容", "莉娜 / 知夏 / 校园地图"]]
    },
    finance: {
      title: "周报收入 Weekly Revenue",
      body: "收入采用模拟周报口径，合并赞助意向、付费测试、授权沟通和合作报价，用于展示 OPC 财务反馈闭环。",
      rows: [["W6 收入", "¥3,860"], ["W6 成本", "¥840"], ["W6 净额", "¥3,020"]]
    },
    build: {
      title: "产品版本 Product Build",
      body: "本周产品重点是多人同步、角色手感、页面发布和公开试玩路径，验证玩家是否能稳定进入核心体验。",
      rows: [["版本状态", "可试玩"], ["核心风险", "移动端同步"], ["下一步", "体验复盘"]]
    }
  };

  document.querySelectorAll("[data-console]").forEach(consoleRoot => {
    const detailPanel = consoleRoot.querySelector("[data-console-detail-panel]");

    const renderDetail = key => {
      const data = detailCopy[key];
      if (!data || !detailPanel) return;
      detailPanel.innerHTML = `
        <b>${data.title}</b>
        <p>${data.body}</p>
        <dl>${data.rows.map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`).join("")}</dl>
      `;
      consoleRoot.querySelectorAll("[data-console-detail]").forEach(button => {
        button.classList.toggle("active", button.getAttribute("data-console-detail") === key);
      });
    };

    consoleRoot.querySelectorAll("[data-console-tab]").forEach(button => {
      button.addEventListener("click", () => {
        const target = button.getAttribute("data-console-tab");
        consoleRoot.querySelectorAll("[data-console-tab]").forEach(tab => {
          tab.classList.toggle("active", tab === button);
        });
        consoleRoot.querySelectorAll("[data-console-view]").forEach(panel => {
          panel.classList.toggle("active", panel.getAttribute("data-console-view") === target);
        });
      });
    });

    consoleRoot.querySelectorAll("[data-console-detail]").forEach(button => {
      button.addEventListener("click", () => renderDetail(button.getAttribute("data-console-detail")));
    });
  });
})();
