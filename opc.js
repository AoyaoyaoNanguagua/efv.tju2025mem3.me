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
    decisions: {
      title: "资源配置线 Portfolio Allocation",
      body: "组合分为主生产、玩法验证、增长和战略预留四条资金线。决策 Agent 从财务、反馈、产品和节点容量中识别樱花大道 Boss 机会，再由 Human Owner 决定是否投入。",
      rows: [["主生产线", "48 单位"], ["Boss 预算", "24 Token 单位"], ["最终批准", "Human Owner"]]
    },
    orders: {
      title: "经营订单 Operating Work Orders",
      body: "策划订单验收后，技术生产与市场宣发两张订单并行释放。技术构建进入人工发布门；市场交付沿独立路径写回中台，不构成游戏发版前置条件。",
      rows: [["订单总数", "3 张"], ["并行工作流", "2 条"], ["正式发版", "Human Owner"]]
    },
    nodes: {
      title: "三台工作节点 Three Work Nodes",
      body: "项目经理、策划、技术和市场四个一人 OPC 围绕同一中台运行；物理电脑只是执行节点，工作订单和审计记录才是共享上下文。",
      rows: [["控制塔", "项目经理 OPC"], ["生产节点", "策划 / 技术 OPC"], ["发布节点", "市场 OPC"]]
    },
    approvals: {
      title: "人工审批 Human Approval Gates",
      body: "方向、预算、审美、版本上线和公开内容不会自动越过人类边界。每个关键状态门均保留明确的批准入口和完整审计记录。",
      rows: [["当前待审批", "1 项"], ["批准角色", "Human Owner"], ["审计方式", "中台留痕"]]
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

    const activateConsoleTab = target => {
      consoleRoot.querySelectorAll("[data-console-tab]").forEach(tab => {
        const active = tab.getAttribute("data-console-tab") === target;
        tab.classList.toggle("active", active);
        tab.setAttribute("aria-selected", active ? "true" : "false");
      });
      consoleRoot.querySelectorAll("[data-console-view]").forEach(panel => {
        panel.classList.toggle("active", panel.getAttribute("data-console-view") === target);
      });
    };

    consoleRoot.querySelectorAll("[data-console-tab]").forEach(button => {
      button.addEventListener("click", () => activateConsoleTab(button.getAttribute("data-console-tab")));
    });

    consoleRoot.querySelectorAll("[data-open-console-tab]").forEach(button => {
      button.addEventListener("click", () => activateConsoleTab(button.getAttribute("data-open-console-tab")));
    });

    consoleRoot.querySelectorAll("[data-console-detail]").forEach(button => {
      button.addEventListener("click", () => renderDetail(button.getAttribute("data-console-detail")));
    });

    consoleRoot.querySelectorAll("[data-order-filter]").forEach(button => {
      button.addEventListener("click", () => {
        const target = button.getAttribute("data-order-filter");
        consoleRoot.querySelectorAll("[data-order-filter]").forEach(filter => {
          filter.classList.toggle("active", filter === button);
        });
        consoleRoot.querySelectorAll("[data-order-status]").forEach(order => {
          order.hidden = target !== "all" && order.getAttribute("data-order-status") !== target;
        });
      });
    });
  });

  document.querySelectorAll("[data-merch-carousel]").forEach(carousel => {
    const track = carousel.querySelector("[data-merch-track]");
    const slides = Array.from(carousel.querySelectorAll("[data-merch-slide]"));
    const dots = Array.from(carousel.querySelectorAll("[data-merch-dot]"));
    const previous = carousel.querySelector("[data-merch-prev]");
    const next = carousel.querySelector("[data-merch-next]");
    const count = carousel.querySelector("[data-merch-count]");
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let current = 0;
    let timer = 0;
    let pointerInside = false;

    if (!track || slides.length < 2) return;

    const stop = () => {
      window.clearTimeout(timer);
      timer = 0;
    };

    const show = requestedIndex => {
      current = (requestedIndex + slides.length) % slides.length;
      track.style.transform = `translate3d(-${current * 100}%, 0, 0)`;
      slides.forEach((slide, index) => {
        slide.setAttribute("aria-hidden", index === current ? "false" : "true");
      });
      dots.forEach((dot, index) => {
        dot.setAttribute("aria-current", index === current ? "true" : "false");
      });
      if (count) {
        count.textContent = `${String(current + 1).padStart(2, "0")} / ${String(slides.length).padStart(2, "0")}`;
      }
    };

    const start = () => {
      stop();
      if (reduceMotion || pointerInside || document.hidden) return;
      timer = window.setTimeout(() => {
        show(current + 1);
        start();
      }, 5000);
    };

    previous?.addEventListener("click", () => {
      show(current - 1);
      start();
    });

    next?.addEventListener("click", () => {
      show(current + 1);
      start();
    });

    dots.forEach(dot => {
      dot.addEventListener("click", () => {
        show(Number(dot.getAttribute("data-merch-dot")) || 0);
        start();
      });
    });

    carousel.addEventListener("mouseenter", () => {
      pointerInside = true;
      stop();
    });

    carousel.addEventListener("mouseleave", () => {
      pointerInside = false;
      start();
    });

    carousel.addEventListener("keydown", event => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      show(current + (event.key === "ArrowRight" ? 1 : -1));
      start();
    });

    document.addEventListener("visibilitychange", start);
    show(0);
    start();
  });
})();
