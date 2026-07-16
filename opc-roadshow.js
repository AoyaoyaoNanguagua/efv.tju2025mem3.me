(function () {
  "use strict";

  const consoleRoot = document.querySelector("[data-roadshow-console]");
  if (!consoleRoot) return;
  document.documentElement.classList.add("roadshow-presentation");

  const cleanDemoId = value => (String(value || "cycle-01").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 32) || "cycle-01");
  const params = new URLSearchParams(window.location.search);
  const demoId = cleanDemoId(params.get("demo"));
  const escapeHtml = value => String(value ?? "").replace(/[&<>\"]/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;"
  }[character]));

  const slides = Array.from(document.querySelectorAll("[data-roadshow-slide]"));
  const pageValue = document.querySelector("[data-roadshow-page]");
  const pagesValue = document.querySelector("[data-roadshow-pages]");
  let currentSlide = 0;
  let currentDemo = null;
  let actionPending = false;

  if (pagesValue) pagesValue.textContent = String(slides.length).padStart(2, "0");
  document.querySelectorAll("[data-demo-id]").forEach(node => { node.textContent = demoId; });

  const scrollToSlide = index => {
    if (!slides.length) return;
    currentSlide = Math.max(0, Math.min(slides.length - 1, index));
    slides[currentSlide].scrollIntoView({ behavior: "smooth", block: "start" });
    if (pageValue) pageValue.textContent = String(currentSlide + 1).padStart(2, "0");
  };

  document.querySelectorAll("[data-roadshow-next]").forEach(button => {
    button.addEventListener("click", () => scrollToSlide(currentSlide + 1));
  });
  document.querySelectorAll("[data-roadshow-prev]").forEach(button => {
    button.addEventListener("click", () => scrollToSlide(currentSlide - 1));
  });

  document.addEventListener("keydown", event => {
    const tag = document.activeElement?.tagName || "";
    if (["INPUT", "TEXTAREA", "SELECT"].includes(tag) || document.activeElement?.isContentEditable) return;
    if (["ArrowDown", "ArrowRight", "PageDown"].includes(event.key)) {
      event.preventDefault();
      scrollToSlide(currentSlide + 1);
    }
    if (["ArrowUp", "ArrowLeft", "PageUp"].includes(event.key)) {
      event.preventDefault();
      scrollToSlide(currentSlide - 1);
    }
  });

  if ("IntersectionObserver" in window && slides.length) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting || entry.intersectionRatio < 0.55) return;
        const index = slides.indexOf(entry.target);
        if (index < 0) return;
        currentSlide = index;
        if (pageValue) pageValue.textContent = String(index + 1).padStart(2, "0");
      });
    }, { threshold: [0.55, 0.72] });
    slides.forEach(slide => observer.observe(slide));
  }

  const connection = document.querySelector("[data-roadshow-connection]");
  const setConnection = (label, state) => {
    if (!connection) return;
    connection.className = `roadshow-connection ${state || ""}`.trim();
    connection.innerHTML = `<i></i>${escapeHtml(label)}`;
  };

  const api = async (action = "") => {
    const response = action
      ? await fetch("/api/opc/roadshow/action", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ demoId, action })
        })
      : await fetch(`/api/opc/roadshow?demo=${encodeURIComponent(demoId)}`, { cache: "no-store" });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "Agent Hub 暂时不可用");
    return payload.demo;
  };

  const setStepState = (stage, status, label) => {
    const card = document.querySelector(`[data-roadshow-step="${stage}"]`);
    if (!card) return;
    card.classList.remove("active", "done", "locked");
    card.classList.add(status);
    const value = card.querySelector("i");
    if (value) value.textContent = label;
  };

  const renderSignals = demo => {
    const root = document.querySelector("[data-roadshow-signals]");
    if (!root) return;
    root.innerHTML = demo.signals.map(signal => `
      <article>
        <span>${escapeHtml(signal.source)}</span>
        <strong>${escapeHtml(signal.value)}</strong>
        <p>${escapeHtml(signal.label)}</p>
        <em>${escapeHtml(signal.trend)}</em>
      </article>
    `).join("");
  };

  const renderDecision = demo => {
    const memo = demo.decisionMemo || {};
    const title = document.querySelector("[data-decision-title]");
    const summary = document.querySelector("[data-decision-summary]");
    const reasoning = document.querySelector("[data-decision-reasoning]");
    if (title) title.textContent = memo.title || "决策建议";
    if (summary) summary.textContent = memo.summary || "";
    if (reasoning) reasoning.innerHTML = (memo.reasoning || []).map(item => `<span>${escapeHtml(item)}</span>`).join("");

    const runButton = document.querySelector("[data-run-decision]");
    const note = document.querySelector("[data-decision-action-note]");
    if (runButton) {
      runButton.disabled = demo.started || actionPending;
      runButton.textContent = demo.started ? "决策已完成 · 首张工单已创建" : "运行决策 Agent，创建策划工单";
    }
    if (note) note.textContent = demo.started
      ? "策划工单已进入 Human Owner 审批状态。"
      : "中枢将创建首张策划工单，并进入 Human Owner 审批状态。";
  };

  const renderCurrentOrder = demo => {
    const empty = document.querySelector("[data-current-order-empty]");
    const orderPanel = document.querySelector("[data-current-order]");
    const complete = document.querySelector("[data-roadshow-complete]");
    const hasOrder = demo.started && demo.currentOrderIndex >= 0 && !demo.completed;
    if (empty) empty.hidden = demo.started;
    if (orderPanel) orderPanel.hidden = !hasOrder;
    if (complete) complete.hidden = !demo.completed;
    if (!hasOrder) return;

    const order = demo.orders[demo.currentOrderIndex];
    const fields = {
      "[data-current-order-id]": order.id,
      "[data-current-order-title]": order.title,
      "[data-current-order-objective]": order.objective,
      "[data-current-order-creator]": order.createdBy,
      "[data-current-order-role]": order.assignedRole,
      "[data-current-order-time]": order.scheduledAt,
      "[data-current-status]": demo.currentStatus.replaceAll("_", " ")
    };
    Object.entries(fields).forEach(([selector, value]) => {
      const target = document.querySelector(selector);
      if (target) target.textContent = value;
    });
    const link = document.querySelector("[data-open-current-order]");
    if (link) link.href = `opc-order.html?demo=${encodeURIComponent(demoId)}`;
  };

  const renderAudit = demo => {
    const root = document.querySelector("[data-roadshow-audit]");
    if (!root) return;
    root.innerHTML = demo.audit.slice(-8).map(item => `
      <article><time>${escapeHtml(item.time)}</time><b>${escapeHtml(item.actor)}</b><span>${escapeHtml(item.event)}</span></article>
    `).join("");
  };

  const renderSteps = demo => {
    setStepState("decision", demo.started ? "done" : "active", demo.started ? "DONE" : "READY");
    ["planning", "technical", "market"].forEach((stage, index) => {
      const order = demo.orders[index];
      const completed = demo.completedOrders.some(item => item.id === order.id);
      const active = demo.started && !demo.completed && demo.currentOrderIndex === index;
      setStepState(stage, completed ? "done" : active ? "active" : "locked", completed ? "DONE" : active ? demo.currentStatus.replaceAll("_", " ") : "LOCKED");
    });
  };

  const render = demo => {
    currentDemo = demo;
    renderSignals(demo);
    renderDecision(demo);
    renderCurrentOrder(demo);
    renderAudit(demo);
    renderSteps(demo);
    setConnection("Agent Hub 已连接 · 共享状态在线", "online");
  };

  const refresh = async () => {
    try {
      render(await api());
    } catch (error) {
      setConnection(error.message || "Agent Hub 连接失败", "offline");
    }
  };

  const runAction = async (action, nextSlide = null) => {
    if (actionPending) return;
    actionPending = true;
    try {
      render(await api(action));
      if (Number.isInteger(nextSlide)) scrollToSlide(nextSlide);
    } catch (error) {
      setConnection(error.message || "操作失败", "offline");
    } finally {
      actionPending = false;
      if (currentDemo) renderDecision(currentDemo);
    }
  };

  document.querySelector("[data-run-decision]")?.addEventListener("click", () => runAction("run-decision", 2));
  document.querySelectorAll("[data-roadshow-reset]").forEach(button => {
    button.addEventListener("click", () => runAction("reset", 1));
  });

  refresh();
  window.setInterval(() => {
    if (!document.hidden && !actionPending) refresh();
  }, 2500);
})();
