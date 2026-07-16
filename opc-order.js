(function () {
  "use strict";

  const root = document.querySelector("[data-roadshow-order]");
  if (!root) return;

  const cleanDemoId = value => (String(value || "cycle-01").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 32) || "cycle-01");
  const demoId = cleanDemoId(new URLSearchParams(window.location.search).get("demo"));
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

  const render = demo => {
    pendingDemo = null;
    const empty = root.querySelector("[data-order-empty]");
    const complete = root.querySelector("[data-order-complete]");
    const card = root.querySelector("[data-order-card]");
    const hasOrder = demo.started && demo.currentOrderIndex >= 0 && !demo.completed;
    if (empty) empty.hidden = demo.started;
    if (complete) complete.hidden = !demo.completed;
    if (card) card.hidden = !hasOrder;
    setConnection("Agent Hub 已连接 · 共享状态在线", "online");
    if (!hasOrder) return;

    const order = demo.orders[demo.currentOrderIndex];
    const stageName = ({ planning: "策划 OPC", technical: "技术 OPC", market: "市场 OPC" })[order.stage] || order.assignedRole;
    setText("[data-order-stage]", `${String(order.stageIndex + 1).padStart(2, "0")} / 04 · ${stageName} · ${order.scheduledAt}`);
    setText("[data-order-id]", order.id);
    setText("[data-order-title]", order.title);
    setText("[data-order-objective]", order.objective);
    setText("[data-order-creator]", order.createdBy);
    setText("[data-order-role]", order.assignedRole);
    setText("[data-order-time]", order.scheduledAt);
    setText("[data-order-status]", demo.currentStatus.replaceAll("_", " "));
    setText("[data-order-status-note]", demo.humanApproved ? "Human Owner 已批准，对应 Agent 可以领取并执行。" : "Human Owner 尚未批准，Agent 不得领取。 ");
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
      status: demo.currentStatus
    }, null, 2));

    const approve = root.querySelector("[data-order-approve]");
    const completeAction = root.querySelector("[data-order-complete-action]");
    if (approve) {
      approve.disabled = demo.humanApproved || actionPending;
      approve.textContent = demo.humanApproved ? "人工审批已通过" : "人工同意并下发";
    }
    if (completeAction) {
      completeAction.disabled = !demo.humanApproved || actionPending;
      completeAction.textContent = `${stageName} 执行并提交证据（DEMO）`;
    }
    setText("[data-gate-title]", demo.humanApproved ? "已批准 · Agent 可领取" : "等待人工同意");
    setText("[data-gate-copy]", demo.humanApproved
      ? "订单已经进入 READY。Agent 完成后必须提交交付物和证据，中台才会创建下一张工单。"
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
      const current = before.orders[before.currentOrderIndex];
      if (action === "complete" && current) {
        const panel = root.querySelector("[data-order-result]");
        if (panel) panel.hidden = false;
        setText("[data-order-result-title]", current.result.summary);
        renderList("[data-order-result-evidence]", current.result.evidence);
      }
      const demo = await api(action);
      if (action === "complete") {
        pendingDemo = demo;
        const approve = root.querySelector("[data-order-approve]");
        const completeAction = root.querySelector("[data-order-complete-action]");
        const next = root.querySelector("[data-order-next]");
        if (approve) approve.disabled = true;
        if (completeAction) completeAction.disabled = true;
        if (next) next.textContent = demo.completed ? "查看闭环结果" : "查看下一张工单";
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

  root.querySelector("[data-order-approve]")?.addEventListener("click", () => runAction("approve"));
  root.querySelector("[data-order-complete-action]")?.addEventListener("click", () => runAction("complete"));
  root.querySelector("[data-order-next]")?.addEventListener("click", () => {
    if (pendingDemo) render(pendingDemo);
  });
  refresh();
})();
