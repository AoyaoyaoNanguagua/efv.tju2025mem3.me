(function () {
  "use strict";

  const root = document.querySelector("[data-roadshow-order]");
  if (!root) return;

  const params = new URLSearchParams(window.location.search);
  const cleanDemoId = value => (String(value || "cycle-01").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 32) || "cycle-01");
  const demoId = cleanDemoId(params.get("demo"));
  const validStages = new Set(["planning", "technical", "market", "release"]);
  let selectedStage = validStages.has(params.get("stage")) ? params.get("stage") : "";
  let actionPending = false;
  let pendingDemo = null;

  root.querySelectorAll("[data-demo-id]").forEach(node => { node.textContent = demoId; });
  root.querySelectorAll("[data-return-console]").forEach(link => {
    const destination = new URL(link.getAttribute("href"), window.location.href);
    destination.searchParams.set("demo", demoId);
    link.href = `${destination.pathname.split("/").pop()}?${destination.searchParams.toString()}${destination.hash}`;
  });

  const connection = root.querySelector("[data-roadshow-connection]");
  const setConnection = (label, state) => {
    if (!connection) return;
    connection.className = `roadshow-connection ${state || ""}`.trim();
    connection.lastChild.textContent = label;
  };

  const setSelectedStage = stage => {
    selectedStage = validStages.has(stage) ? stage : "";
    const next = new URL(window.location.href);
    if (selectedStage) next.searchParams.set("stage", selectedStage);
    else next.searchParams.delete("stage");
    window.history.replaceState(null, "", `${next.pathname}?${next.searchParams.toString()}${next.hash}`);
  };

  const api = async (action = "", stage = selectedStage) => {
    const response = action
      ? await fetch("/api/opc/roadshow/action", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ demoId, action, stage })
        })
      : await fetch(`/api/opc/roadshow?demo=${encodeURIComponent(demoId)}`, { cache: "no-store" });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "Agent Hub 暂时不可用");
    return payload.demo;
  };

  const setText = (selector, value) => {
    const target = root.querySelector(selector);
    if (target) target.textContent = value ?? "";
  };

  const renderList = (selector, values) => {
    const target = root.querySelector(selector);
    if (!target) return;
    target.replaceChildren(...(values || []).map(value => {
      const item = document.createElement("li");
      item.textContent = value;
      return item;
    }));
  };

  const getOrderState = (demo, index) => demo.orderStates?.[index] || {
    status: demo.currentOrderIndex === index ? demo.currentStatus : "LOCKED",
    humanApproved: demo.currentOrderIndex === index && demo.humanApproved
  };

  const selectedOrderIndex = demo => {
    const requested = demo.orders.findIndex(order => order.stage === selectedStage);
    if (requested >= 0 && ["WAITING_APPROVAL", "READY"].includes(getOrderState(demo, requested).status)) return requested;
    return demo.currentOrderIndex;
  };

  const render = demo => {
    pendingDemo = null;
    const empty = root.querySelector("[data-order-empty]");
    const complete = root.querySelector("[data-order-complete]");
    const release = root.querySelector("[data-order-release]");
    const card = root.querySelector("[data-order-card]");
    const releaseVisible = !demo.completed && demo.releaseReady && !demo.published && (selectedStage === "release" || demo.currentOrderIndex < 0);
    const index = selectedOrderIndex(demo);
    const state = index >= 0 ? getOrderState(demo, index) : null;
    const hasOrder = demo.started && !demo.completed && !releaseVisible && index >= 0 && ["WAITING_APPROVAL", "READY"].includes(state?.status);

    if (empty) empty.hidden = demo.started || releaseVisible;
    if (complete) complete.hidden = !demo.completed;
    if (release) release.hidden = !releaseVisible;
    if (card) card.hidden = !hasOrder;
    setConnection("Agent Hub 已连接 · 共享状态在线", "online");
    if (demo.completed || releaseVisible || !hasOrder) return;

    const order = demo.orders[index];
    const stageName = ({ planning: "策划 Agent", technical: "技术 Agent", market: "市场 Agent" })[order.stage] || order.assignedRole;
    const approved = Boolean(state.humanApproved);
    setText("[data-order-stage]", `${String(order.stageIndex + 1).padStart(2, "0")} / 04 · ${stageName} · ${order.scheduledAt}`);
    setText("[data-order-id]", order.id);
    setText("[data-order-title]", order.title);
    setText("[data-order-objective]", order.objective);
    setText("[data-order-creator]", order.createdBy);
    setText("[data-order-role]", order.assignedRole);
    setText("[data-order-time]", order.scheduledAt);
    setText("[data-order-status]", state.status.replaceAll("_", " "));
    setText("[data-order-status-note]", approved ? "Human Owner 已批准，对应 Agent 可以领取并执行。" : "Human Owner 尚未批准，Agent 不得领取。 ");
    renderList("[data-order-inputs]", order.inputs);
    renderList("[data-order-deliverables]", order.deliverables);
    renderList("[data-order-acceptance]", order.acceptance);
    setText("[data-order-envelope]", JSON.stringify({
      work_order_id: order.id,
      assigned_role: order.assignedRole,
      objective: order.objective,
      inputs: order.inputs,
      deliverables: order.deliverables,
      acceptance: order.acceptance,
      approval_gate: "Human Owner",
      status: state.status
    }, null, 2));

    const approve = root.querySelector("[data-order-approve]");
    const completeAction = root.querySelector("[data-order-complete-action]");
    if (approve) {
      approve.disabled = approved || actionPending;
      approve.textContent = approved ? "人工审批已通过" : "人工同意并下发";
    }
    if (completeAction) {
      completeAction.disabled = !approved || actionPending;
      completeAction.textContent = `${stageName} 执行并提交证据（DEMO）`;
    }
    setText("[data-gate-title]", approved ? "已批准 · Agent 可领取" : "等待人工同意");
    setText("[data-gate-copy]", approved
      ? order.stage === "planning"
        ? "策划交付验收后，中台将并行释放技术与市场工单。"
        : order.stage === "technical"
          ? "技术交付验收后只会开启人工发布门，Agent 无权自动发版。"
          : "市场交付独立写回中台，不阻塞技术验收与游戏发版。"
      : "同意后，订单才会变为 READY，并出现在对应 Agent 的可领取队列。 ");

    const resultPanel = root.querySelector("[data-order-result]");
    if (resultPanel) resultPanel.hidden = true;
  };

  const refresh = async () => {
    try {
      render(await api());
    } catch (error) {
      setConnection(error.message || "Agent Hub 连接失败", "offline");
    }
  };

  const runAction = async action => {
    if (actionPending) return;
    actionPending = true;
    try {
      const before = await api();
      const index = selectedOrderIndex(before);
      const current = index >= 0 ? before.orders[index] : null;
      if (action === "complete" && current) {
        const panel = root.querySelector("[data-order-result]");
        if (panel) panel.hidden = false;
        setText("[data-order-result-title]", current.result.summary);
        renderList("[data-order-result-evidence]", current.result.evidence);
      }
      const demo = await api(action, current?.stage || selectedStage);
      if (action === "complete") {
        pendingDemo = demo;
        const approve = root.querySelector("[data-order-approve]");
        const completeAction = root.querySelector("[data-order-complete-action]");
        const next = root.querySelector("[data-order-next]");
        if (approve) approve.disabled = true;
        if (completeAction) completeAction.disabled = true;
        if (next) {
          if (current?.stage === "technical" && demo.releaseReady && !demo.published) next.textContent = "进入人工发布门";
          else if (demo.currentOrderIndex >= 0) next.textContent = `查看${demo.orders[demo.currentOrderIndex].assignedRole}工单`;
          else if (demo.releaseReady && !demo.published) next.textContent = "进入人工发布门";
          else next.textContent = "查看闭环结果";
        }
      } else {
        actionPending = false;
        render(demo);
      }
    } catch (error) {
      setConnection(error.message || "操作失败", "offline");
    } finally {
      actionPending = false;
    }
  };

  const publish = async () => {
    if (actionPending) return;
    actionPending = true;
    const publishButton = root.querySelector("[data-order-publish]");
    if (publishButton) publishButton.disabled = true;
    try {
      const demo = await api("publish", "release");
      if (!demo.completed && demo.currentOrderIndex >= 0) setSelectedStage(demo.orders[demo.currentOrderIndex].stage);
      else setSelectedStage("");
      render(demo);
    } catch (error) {
      setConnection(error.message || "人工发版失败", "offline");
      if (publishButton) publishButton.disabled = false;
    } finally {
      actionPending = false;
    }
  };

  root.querySelector("[data-order-approve]")?.addEventListener("click", () => runAction("approve"));
  root.querySelector("[data-order-complete-action]")?.addEventListener("click", () => runAction("complete"));
  root.querySelector("[data-order-publish]")?.addEventListener("click", publish);
  root.querySelector("[data-order-next]")?.addEventListener("click", () => {
    if (!pendingDemo) return;
    if (selectedStage === "technical" && pendingDemo.releaseReady && !pendingDemo.published) setSelectedStage("release");
    else if (pendingDemo.currentOrderIndex >= 0) setSelectedStage(pendingDemo.orders[pendingDemo.currentOrderIndex].stage);
    else if (pendingDemo.releaseReady && !pendingDemo.published) setSelectedStage("release");
    else setSelectedStage("");
    render(pendingDemo);
  });
  refresh();
})();
