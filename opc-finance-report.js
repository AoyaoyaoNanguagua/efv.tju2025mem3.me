(function () {
  "use strict";

  const channelProfiles = [
    { name: "微信支付", prefix: "WX", feeRate: 0.006 },
    { name: "支付宝", prefix: "ALI", feeRate: 0.006 },
    { name: "聚合支付", prefix: "AGG", feeRate: 0.008 }
  ];
  const products = [
    ["60 学术币", 6], ["首充成长礼包", 12], ["校庆季通行证", 18], ["月度研修卡", 30],
    ["300 学术币", 30], ["680 学术币", 68], ["莉娜角色礼包", 88], ["远洋逐梦礼包", 128]
  ];
  const exceptionMap = new Map([
    [13, "回调异常"], [36, "回调异常"], [57, "对账差异"], [82, "对账差异"],
    [28, "已退款"], [73, "已退款"], [94, "待结算"], [95, "待结算"], [96, "待结算"], [97, "待结算"], [98, "待结算"], [99, "待结算"]
  ]);

  const pad = value => String(value).padStart(2, "0");
  const money = value => `¥${Number(value).toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const dateText = value => value ? `${pad(value.getMonth() + 1)}月${pad(value.getDate())}日 ${pad(value.getHours())}:${pad(value.getMinutes())}` : "—";
  const isoText = value => value ? `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())} ${pad(value.getHours())}:${pad(value.getMinutes())}:00` : null;

  const transactions = Array.from({ length: 100 }, (_, index) => {
    const sequence = index + 1;
    const channel = channelProfiles[(index * 7 + (index % 5)) % channelProfiles.length];
    const product = products[(index * 5 + 2) % products.length];
    const amount = product[1] + ((index % 9 === 0) ? 0.01 : 0);
    const paidAt = new Date(2026, 6, 1, 8, 6 + index * 91 + (index * 13) % 29);
    const status = exceptionMap.get(index) || "四账一致";
    const callbackAt = status === "回调异常" ? null : new Date(paidAt.getTime() + (1 + index % 4) * 60000);
    const settlementAt = ["待结算", "回调异常"].includes(status) ? null : new Date(2026, 6, paidAt.getDate() + 1 + (index % 4 === 0 ? 1 : 0), 9 + index % 7, 8 + index % 43);
    const fee = callbackAt && status !== "已退款" ? Number((amount * channel.feeRate).toFixed(2)) : 0;
    const net = settlementAt && status !== "对账差异" && status !== "已退款" ? Number((amount - fee).toFixed(2)) : 0;
    const fulfillment = status === "回调异常" ? "未发货" : status === "已退款" ? "已撤回 / 退款" : index % 4 === 0 ? "已发放·待消耗" : "已履约";
    return {
      sequence, channel: channel.name, channelCode: channel.prefix, product: product[0], amount, paidAt, callbackAt, settlementAt, fee, net, fulfillment, status,
      merchantOrder: `OPC202607${pad(paidAt.getDate())}${pad(paidAt.getHours())}${pad(paidAt.getMinutes())}${String(sequence).padStart(4, "0")}`,
      channelOrder: `${channel.prefix}202607${String(810000000000 + sequence * 7919)}`
    };
  });

  const successful = transactions.filter(item => item.callbackAt && item.status !== "已退款");
  const settled = transactions.filter(item => item.net > 0);
  const paidTotal = successful.reduce((sum, item) => sum + item.amount, 0);
  const settledTotal = settled.reduce((sum, item) => sum + item.net, 0);
  const feeTotal = settled.reduce((sum, item) => sum + item.fee, 0);
  const receivableTotal = successful.filter(item => !item.settlementAt || item.status === "对账差异").reduce((sum, item) => sum + item.amount, 0);
  const exceptions = transactions.filter(item => item.status !== "四账一致");

  const kpis = {
    orders: String(transactions.length), paid: money(paidTotal), settled: money(settledTotal), receivable: money(receivableTotal), fees: money(feeTotal), exceptions: String(exceptions.length)
  };
  Object.entries(kpis).forEach(([key, value]) => {
    const node = document.querySelector(`[data-kpi="${key}"]`);
    if (node) node.textContent = value;
  });

  const channelBreakdown = document.querySelector("[data-channel-breakdown]");
  if (channelBreakdown) {
    channelBreakdown.innerHTML = channelProfiles.map(profile => {
      const rows = successful.filter(item => item.channel === profile.name);
      const gross = rows.reduce((sum, item) => sum + item.amount, 0);
      const share = paidTotal ? gross / paidTotal * 100 : 0;
      const cash = rows.reduce((sum, item) => sum + item.net, 0);
      return `<article><div><b>${profile.name}</b><span>${rows.length} 笔 · 费率示例 ${(profile.feeRate * 100).toFixed(1)}%</span></div><strong>${money(gross)}</strong><i style="--w:${share.toFixed(1)}%"></i><small>占比 ${share.toFixed(1)}% · 已到账 ${money(cash)}</small></article>`;
    }).join("");
  }

  const statusClass = status => ({ "四账一致": "ok", "待结算": "pending", "回调异常": "danger", "对账差异": "warning", "已退款": "muted" }[status] || "muted");
  const rowsRoot = document.querySelector("[data-payment-rows]");
  const countRoot = document.querySelector("[data-record-count]");
  const searchInput = document.querySelector("[data-payment-search]");
  const channelSelect = document.querySelector("[data-payment-channel]");
  const statusSelect = document.querySelector("[data-payment-status]");

  const renderRows = () => {
    const query = (searchInput?.value || "").trim().toLowerCase();
    const channel = channelSelect?.value || "";
    const status = statusSelect?.value || "";
    const filtered = transactions.filter(item => {
      const searchable = `${item.merchantOrder} ${item.channelOrder} ${item.product}`.toLowerCase();
      return (!query || searchable.includes(query)) && (!channel || item.channel === channel) && (!status || item.status === status);
    });
    if (countRoot) countRoot.textContent = `${filtered.length} / ${transactions.length}`;
    if (!rowsRoot) return;
    rowsRoot.innerHTML = filtered.map(item => `<tr class="${item.status !== "四账一致" ? "row-exception" : ""}">
      <td>${String(item.sequence).padStart(3, "0")}</td><td>${dateText(item.paidAt)}</td><td><b>${item.channel}</b></td>
      <td><code>${item.merchantOrder}</code><small>${item.channelOrder}</small></td><td>${item.product}</td><td class="money-cell">${money(item.amount)}</td>
      <td>${dateText(item.callbackAt)}</td><td>${dateText(item.settlementAt)}</td><td>${money(item.fee)}</td><td class="money-cell">${money(item.net)}</td>
      <td>${item.fulfillment}</td><td><span class="payment-status ${statusClass(item.status)}">${item.status}</span></td></tr>`).join("");
  };
  [searchInput, channelSelect, statusSelect].forEach(control => control?.addEventListener("input", renderRows));
  renderRows();

  const exceptionRoot = document.querySelector("[data-exception-list]");
  if (exceptionRoot) {
    exceptionRoot.innerHTML = exceptions.map(item => {
      const advice = item.status === "回调异常" ? "主动查单；验签通过前禁止发货" : item.status === "待结算" ? "等待资金账并于 T+1 复核银行流水" : item.status === "对账差异" ? "核对手续费、调账与结算批次" : "核对退款单并冲销合同负债或收入";
      return `<article><span class="payment-status ${statusClass(item.status)}">${item.status}</span><div><b>${item.merchantOrder}</b><small>${item.channel} · ${money(item.amount)} · ${dateText(item.paidAt)}</small></div><p>${advice}</p></article>`;
    }).join("");
  }

  const exportNode = document.querySelector("[data-agent-export]");
  const exportData = {
    period: "2026-07-01/2026-07-07", currency: "CNY", demo: true, order_count: transactions.length,
    verified_callback_amount: Number(paidTotal.toFixed(2)), bank_settled_net: Number(settledTotal.toFixed(2)),
    channel_receivable: Number(receivableTotal.toFixed(2)), payment_fees: Number(feeTotal.toFixed(2)),
    exceptions: exceptions.reduce((acc, item) => { acc[item.status] = (acc[item.status] || 0) + 1; return acc; }, {}),
    next_action: "reconcile exceptions before period close"
  };
  if (exportNode) exportNode.textContent = JSON.stringify(exportData, null, 2);

  document.querySelector("[data-export-csv]")?.addEventListener("click", () => {
    const header = ["序号", "支付时间", "渠道", "商户订单号", "渠道流水", "商品", "订单金额", "回调时间", "结算时间", "手续费", "银行实收", "履约状态", "核对状态"];
    const body = transactions.map(item => [item.sequence, isoText(item.paidAt), item.channel, item.merchantOrder, item.channelOrder, item.product, item.amount.toFixed(2), isoText(item.callbackAt) || "", isoText(item.settlementAt) || "", item.fee.toFixed(2), item.net.toFixed(2), item.fulfillment, item.status]);
    const csv = [header, ...body].map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = "opc-payment-ledger-demo-2026w27.csv"; link.click(); URL.revokeObjectURL(url);
  });
  document.querySelector("[data-print-report]")?.addEventListener("click", () => window.print());
})();
