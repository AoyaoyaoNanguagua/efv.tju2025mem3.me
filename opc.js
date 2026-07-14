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
      body: "组合分为主生产、玩法验证、增长和战略预留四条资金线。正式系统将从订单消耗、财务和客户信号自动汇总，而不是依靠 Agent 之间口头交接。",
      rows: [["主生产线", "48 单位"], ["重新评估", "23:00"], ["最终批准", "Human Owner"]]
    },
    orders: {
      title: "活跃订单 Active Work Orders",
      body: "订单包含所属 IP、目标、负责人、预算、依赖、交付物、验收、证据和审批门。Agent 只能领取自己角色和权限范围内的订单。",
      rows: [["当前活跃", "12 项"], ["等待验收", "3 项"], ["保持阻塞", "2 项"]]
    },
    nodes: {
      title: "三台工作节点 Three Work Nodes",
      body: "控制塔、生产工厂和市场发布节点围绕同一数据中枢运行。同一账户提供统一身份，仓库、Skill 和订单协议提供一致上下文。",
      rows: [["控制塔", "Node A"], ["生产工厂", "Node B"], ["市场发布", "Node C"]]
    },
    approvals: {
      title: "人工审批 Human Approval Gates",
      body: "上线、公开内容、资金行为和敏感数据操作不会自动越过人类边界。中枢会保留证据、建议、批准人与时间记录。",
      rows: [["待审批", "3 项"], ["最高优先级", "版本上线"], ["隐私阻塞", "1 项"]]
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
