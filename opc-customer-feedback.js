(function () {
  "use strict";

  const form = document.querySelector("[data-feedback-form]");
  const list = document.querySelector("[data-feedback-list]");
  const status = document.querySelector("[data-feedback-status]");
  const total = document.querySelector("[data-feedback-total]");
  const storageKey = "opc-feedback-demo-v1";

  if (!form || !list) return;

  const kindLabels = {
    positive: "正面反馈",
    negative: "负面反馈",
    suggestion: "优化建议"
  };

  const categoryLabels = {
    character: "角色与 IP 设定",
    game: "游戏内容与玩法",
    merchandise: "手办与毛绒周边",
    payment: "支付、订单与售后",
    website: "网站与页面体验",
    cooperation: "商务合作与授权"
  };

  const sampleTickets = [
    {
      id: "FB-DEMO-2036",
      kind: "positive",
      category: "character",
      subject: "莉娜和知夏的角色辨识度很高",
      detail: "服装配色、猫耳和猫爪细节让角色很容易被记住，希望继续保持。",
      rating: "5",
      time: "2026/07/12 14:26",
      state: "已纳入宣发素材"
    },
    {
      id: "FB-DEMO-2035",
      kind: "negative",
      category: "website",
      subject: "移动端产品信息密度偏高",
      detail: "希望重点按钮更集中，长段介绍可以进一步折叠。",
      rating: "2",
      time: "2026/07/12 11:08",
      state: "生产 Agent 处理中"
    },
    {
      id: "FB-DEMO-2034",
      kind: "suggestion",
      category: "merchandise",
      subject: "希望毛绒玩具增加可替换配件",
      detail: "可以考虑可拆卸眼镜、书本和校庆限定披风。",
      rating: "4",
      time: "2026/07/11 20:41",
      state: "已进入需求候选池"
    }
  ];

  const readSaved = () => {
    try {
      const value = JSON.parse(localStorage.getItem(storageKey) || "[]");
      return Array.isArray(value) ? value : [];
    } catch (_error) {
      return [];
    }
  };

  const escapeHtml = value => String(value).replace(/[&<>"]/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;"
  }[character]));

  const render = () => {
    const saved = readSaved();
    const tickets = [...saved, ...sampleTickets];
    list.innerHTML = tickets.map(ticket => `
      <article class="feedback-ticket ${escapeHtml(ticket.kind)}">
        <div class="feedback-ticket-meta">
          <span>${escapeHtml(kindLabels[ticket.kind] || "客户反馈")}</span>
          <small>${escapeHtml(ticket.id)} · ${escapeHtml(ticket.time)}</small>
        </div>
        <div>
          <b>${escapeHtml(ticket.subject)}</b>
          <p>${escapeHtml(ticket.detail)}</p>
        </div>
        <dl>
          <div><dt>业务分类</dt><dd>${escapeHtml(categoryLabels[ticket.category] || ticket.category)}</dd></div>
          <div><dt>满意度</dt><dd>${escapeHtml(ticket.rating)} / 5</dd></div>
          <div><dt>流转状态</dt><dd>${escapeHtml(ticket.state)}</dd></div>
        </dl>
      </article>
    `).join("");
    if (total) total.textContent = String(36 + saved.length);
  };

  form.addEventListener("submit", event => {
    event.preventDefault();
    if (!form.reportValidity()) return;

    const values = new FormData(form);
    const now = new Date();
    const id = `FB-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(Math.floor(Math.random() * 10000)).padStart(4, "0")}`;
    const ticket = {
      id,
      kind: values.get("kind"),
      category: values.get("category"),
      product: values.get("product"),
      subject: values.get("subject"),
      detail: values.get("detail"),
      rating: values.get("rating"),
      contact: values.get("contact"),
      followup: values.get("followup") === "on",
      time: new Intl.DateTimeFormat("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
      }).format(now).replace(/\//g, "/"),
      state: "客户关系 subagent 已受理"
    };

    const saved = readSaved();
    saved.unshift(ticket);
    try {
      localStorage.setItem(storageKey, JSON.stringify(saved.slice(0, 12)));
    } catch (_error) {
      // The demo still confirms submission when local storage is unavailable.
    }

    render();
    form.reset();
    if (status) {
      status.hidden = false;
      status.innerHTML = `<b>模拟提交成功</b><span>反馈编号：${escapeHtml(id)}。已进入客户关系 → 市场 → 策划的演示流转队列。</span>`;
      status.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  });

  form.addEventListener("reset", () => {
    if (status) status.hidden = true;
  });

  render();
})();
