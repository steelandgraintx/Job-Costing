const STORAGE_KEYS = {
  draft: "job_costing_pwa_draft",
  settings: "job_costing_pwa_settings",
  savedJobs: "job_costing_pwa_saved_jobs"
};

function makeJobId(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return `JOB-${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

function makeDraft() {
  const now = new Date();
  return {
    clientName: "",
    createdDate: now.toISOString(),
    jobId: makeJobId(now),
    defaultLabor: [{ description: "", hours: 0 }],
    helperLabor: [{ description: "", hours: 0 }],
    discountLabor: [{ description: "", hours: 0 }],
    materialCosts: [{ description: "", amount: 0 }],
    rentalCosts: [{ description: "", amount: 0 }]
  };
}

const state = {
  settings: {
    defaultLaborRate: 85,
    helperLaborRate: 120,
    discountLaborRate: 65,
    materialMarkupRate: 0.15,
    rentalMarkupRate: 0.10,
    creditCardFeeRate: 0.03
  },
  draft: makeDraft(),
  savedJobs: []
};

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

function numberOrZero(value) {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

function sumBy(items, field) {
  return items.reduce((acc, item) => acc + numberOrZero(item[field]), 0);
}

function calcSummary() {
  const d = state.draft;
  const s = state.settings;

  const defaultHours = sumBy(d.defaultLabor, "hours");
  const helperHours = sumBy(d.helperLabor, "hours");
  const discountHours = sumBy(d.discountLabor, "hours");

  const totalDefaultLaborCost = defaultHours * numberOrZero(s.defaultLaborRate);
  const totalHelperLaborCost = helperHours * numberOrZero(s.helperLaborRate);
  const totalDiscountLaborCost = discountHours * numberOrZero(s.discountLaborRate);
  const totalLaborCost = totalDefaultLaborCost + totalHelperLaborCost + totalDiscountLaborCost;

  const baseMaterialCost = sumBy(d.materialCosts, "amount");
  const baseRentalCost = sumBy(d.rentalCosts, "amount");
  const materialMarkupAmount = baseMaterialCost * numberOrZero(s.materialMarkupRate);
  const rentalMarkupAmount = baseRentalCost * numberOrZero(s.rentalMarkupRate);

  const totalMaterialCostWithMarkup = baseMaterialCost + materialMarkupAmount;
  const totalRentalCostWithMarkup = baseRentalCost + rentalMarkupAmount;

  const subTotal = totalLaborCost + totalMaterialCostWithMarkup + totalRentalCostWithMarkup;
  const ccFee = subTotal * numberOrZero(s.creditCardFeeRate);
  const grandTotal = subTotal + ccFee;

  return {
    defaultHours,
    helperHours,
    discountHours,
    baseMaterialCost,
    baseRentalCost,
    materialMarkupAmount,
    rentalMarkupAmount,
    totalDefaultLaborCost,
    totalHelperLaborCost,
    totalDiscountLaborCost,
    totalLaborCost,
    totalMaterialCostWithMarkup,
    totalRentalCostWithMarkup,
    subTotal,
    ccFee,
    grandTotal
  };
}

function saveState() {
  localStorage.setItem(STORAGE_KEYS.draft, JSON.stringify(state.draft));
  localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(state.settings));
  localStorage.setItem(STORAGE_KEYS.savedJobs, JSON.stringify(state.savedJobs));
}

function loadState() {
  try {
    const draft = JSON.parse(localStorage.getItem(STORAGE_KEYS.draft));
    const settings = JSON.parse(localStorage.getItem(STORAGE_KEYS.settings));
    const savedJobs = JSON.parse(localStorage.getItem(STORAGE_KEYS.savedJobs));

    if (draft && typeof draft === "object") state.draft = draft;
    if (settings && typeof settings === "object") {
      state.settings = { ...state.settings, ...settings };
    }
    if (Array.isArray(savedJobs)) state.savedJobs = savedJobs;
  } catch (_) {
    // ignore bad local state
  }
}

function bindTabs() {
  const tabButtons = document.querySelectorAll(".tab");
  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => setActiveTab(btn.dataset.tab));
  });
}

function setActiveTab(tabName) {
  document.querySelectorAll(".tab").forEach((x) => x.classList.remove("active"));
  document.querySelectorAll(".panel").forEach((x) => x.classList.remove("active"));
  const selectedTab = document.querySelector(`.tab[data-tab="${tabName}"]`);
  if (selectedTab) selectedTab.classList.add("active");
  const selectedPanel = document.getElementById(`tab-${tabName}`);
  if (selectedPanel) selectedPanel.classList.add("active");
}

function renderLaborRows(tbodyId, listKey, fieldKey) {
  const tbody = document.getElementById(tbodyId);
  const rows = state.draft[listKey];
  tbody.innerHTML = "";

  rows.forEach((row, idx) => {
    const tr = document.createElement("tr");

    const tdNum = document.createElement("td");
    const numInput = document.createElement("input");
    numInput.type = "number";
    numInput.step = "0.01";
    numInput.min = "0";
    numInput.value = numberOrZero(row[fieldKey]);
    numInput.addEventListener("input", (e) => {
      state.draft[listKey][idx][fieldKey] = numberOrZero(e.target.value);
      saveState();
      renderSummary();
    });
    tdNum.appendChild(numInput);

    const tdDelete = document.createElement("td");
    const deleteBtn = document.createElement("button");
    deleteBtn.className = "row-delete";
    deleteBtn.textContent = "X";
    deleteBtn.title = "Delete row";
    deleteBtn.addEventListener("click", () => {
      state.draft[listKey].splice(idx, 1);
      if (state.draft[listKey].length === 0) {
        state.draft[listKey].push(fieldKey === "hours" ? { description: "", hours: 0 } : { description: "", amount: 0 });
      }
      saveState();
      renderAllRows();
      renderSummary();
    });
    tdDelete.appendChild(deleteBtn);

    tr.appendChild(tdNum);
    tr.appendChild(tdDelete);
    tbody.appendChild(tr);
  });
}

function renderCostRows(tbodyId, listKey) {
  renderLaborRows(tbodyId, listKey, "amount");
}

function renderAllRows() {
  renderLaborRows("default-labor-body", "defaultLabor", "hours");
  renderLaborRows("helper-labor-body", "helperLabor", "hours");
  renderLaborRows("discount-labor-body", "discountLabor", "hours");
  renderCostRows("material-body", "materialCosts");
  renderCostRows("rental-body", "rentalCosts");
}

function addRow(listKey, fieldKey) {
  state.draft[listKey].push(fieldKey === "hours" ? { description: "", hours: 0 } : { description: "", amount: 0 });
  saveState();
  renderAllRows();
}

function renderHeaderFields() {
  const d = state.draft;
  document.getElementById("client-name").value = d.clientName || "";

  document.getElementById("setting-default-rate").value = numberOrZero(state.settings.defaultLaborRate);
  document.getElementById("setting-helper-rate").value = numberOrZero(state.settings.helperLaborRate);
  document.getElementById("setting-discount-rate").value = numberOrZero(state.settings.discountLaborRate);
  document.getElementById("setting-material-markup").value = numberOrZero(state.settings.materialMarkupRate);
  document.getElementById("setting-rental-markup").value = numberOrZero(state.settings.rentalMarkupRate);
  document.getElementById("setting-cc-fee").value = numberOrZero(state.settings.creditCardFeeRate);
}

function renderSummary() {
  const sum = calcSummary();
  const settings = state.settings;

  const rateToLabel = (rate) => `${money.format(numberOrZero(rate))}/hr`;
  const percentLabel = (rate) => `${(numberOrZero(rate) * 100).toFixed(2)}%`;

  document.getElementById("main-default-labor").textContent = money.format(sum.totalDefaultLaborCost);
  document.getElementById("main-helper-labor").textContent = money.format(sum.totalHelperLaborCost);
  document.getElementById("main-discount-labor").textContent = money.format(sum.totalDiscountLaborCost);
  document.getElementById("main-total-labor").textContent = money.format(sum.totalLaborCost);
  document.getElementById("main-material-base").textContent = money.format(sum.baseMaterialCost);
  document.getElementById("main-material-markup").textContent = money.format(sum.totalMaterialCostWithMarkup);
  document.getElementById("main-rental-base").textContent = money.format(sum.baseRentalCost);
  document.getElementById("main-rental-markup").textContent = money.format(sum.totalRentalCostWithMarkup);

  document.getElementById("sum-total-job-cost").textContent = money.format(sum.subTotal);
  document.getElementById("sum-cc-fee-markup").textContent = money.format(sum.ccFee);
  document.getElementById("sum-grand-job-cost").textContent = money.format(sum.grandTotal);

  document.getElementById("sum-labor-total").textContent = money.format(sum.totalLaborCost);
  document.getElementById("sum-default-labor").textContent = money.format(sum.totalDefaultLaborCost);
  document.getElementById("sum-helper-labor").textContent = money.format(sum.totalHelperLaborCost);
  document.getElementById("sum-discount-labor").textContent = money.format(sum.totalDiscountLaborCost);
  document.getElementById("sum-default-rate-label").textContent = rateToLabel(settings.defaultLaborRate);
  document.getElementById("sum-helper-rate-label").textContent = rateToLabel(settings.helperLaborRate);
  document.getElementById("sum-discount-rate-label").textContent = rateToLabel(settings.discountLaborRate);

  document.getElementById("sum-material-total").textContent = money.format(sum.totalMaterialCostWithMarkup);
  document.getElementById("sum-material-subtotal").textContent = money.format(sum.baseMaterialCost);
  document.getElementById("sum-material-rate-label").textContent = percentLabel(settings.materialMarkupRate);
  document.getElementById("sum-material-markup-amount").textContent = money.format(sum.materialMarkupAmount);

  document.getElementById("sum-rental-total").textContent = money.format(sum.totalRentalCostWithMarkup);
  document.getElementById("sum-rental-subtotal").textContent = money.format(sum.baseRentalCost);
  document.getElementById("sum-rental-rate-label").textContent = percentLabel(settings.rentalMarkupRate);
  document.getElementById("sum-rental-markup-amount").textContent = money.format(sum.rentalMarkupAmount);
}

function snapshotCurrentJob() {
  const sum = calcSummary();
  return {
    jobId: state.draft.jobId,
    createdDate: state.draft.createdDate,
    clientName: state.draft.clientName,
    defaultLaborHours: sum.defaultHours,
    helperLaborHours: sum.helperHours,
    discountLaborHours: sum.discountHours,
    defaultLaborRate: numberOrZero(state.settings.defaultLaborRate),
    helperLaborRate: numberOrZero(state.settings.helperLaborRate),
    discountLaborRate: numberOrZero(state.settings.discountLaborRate),
    baseMaterialCost: sum.baseMaterialCost,
    baseRentalCost: sum.baseRentalCost,
    materialMarkupRate: numberOrZero(state.settings.materialMarkupRate),
    rentalMarkupRate: numberOrZero(state.settings.rentalMarkupRate),
    creditCardFeeRate: numberOrZero(state.settings.creditCardFeeRate),
    totalDefaultLaborCost: sum.totalDefaultLaborCost,
    totalHelperLaborCost: sum.totalHelperLaborCost,
    totalDiscountLaborCost: sum.totalDiscountLaborCost,
    totalLaborCost: sum.totalLaborCost,
    totalMaterialCostWithMarkup: sum.totalMaterialCostWithMarkup,
    totalRentalCostWithMarkup: sum.totalRentalCostWithMarkup,
    subTotal: sum.subTotal,
    ccFee: sum.ccFee,
    grandTotal: sum.grandTotal
  };
}

function renderSavedJobs() {
  const body = document.getElementById("saved-body");
  body.innerHTML = "";

  state.savedJobs.forEach((job, idx) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(job.jobId)}</td>
      <td>${new Date(job.createdDate).toLocaleString()}</td>
      <td>${escapeHtml(job.clientName || "Unassigned")}</td>
      <td>${money.format(numberOrZero(job.grandTotal))}</td>
      <td><button class="row-delete" aria-label="Delete">X</button></td>
    `;

    tr.querySelector("button").addEventListener("click", () => {
      state.savedJobs.splice(idx, 1);
      saveState();
      renderSavedJobs();
    });

    body.appendChild(tr);
  });

  document.getElementById("saved-count").textContent = `${state.savedJobs.length} saved job record(s)`;
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function toCsvCell(value) {
  const text = String(value ?? "").replaceAll('"', '""');
  return `"${text}"`;
}

function exportCsv() {
  if (!state.savedJobs.length) {
    alert("No saved jobs to export.");
    return;
  }

  const header = [
    "Job ID", "Date", "Client",
    "Default Labor Hours", "Helper Labor Hours", "Discount Labor Hours",
    "Default Labor Rate", "Helper Labor Rate", "Discount Labor Rate",
    "Base Material Cost", "Base Rental Cost",
    "Material Markup Rate", "Rental Markup Rate", "Credit Card Fee Rate",
    "Total Default Labor Cost", "Total Helper Labor Cost", "Total Discount Labor Cost",
    "Total Labor Cost", "Total Material Cost (with markup)", "Total Rental Cost (with markup)",
    "Sub Total", "CC Fee", "Grand Total"
  ];

  const rows = state.savedJobs.map((job) => [
    job.jobId,
    new Date(job.createdDate).toISOString(),
    job.clientName,
    job.defaultLaborHours,
    job.helperLaborHours,
    job.discountLaborHours,
    job.defaultLaborRate,
    job.helperLaborRate,
    job.discountLaborRate,
    job.baseMaterialCost,
    job.baseRentalCost,
    job.materialMarkupRate,
    job.rentalMarkupRate,
    job.creditCardFeeRate,
    job.totalDefaultLaborCost,
    job.totalHelperLaborCost,
    job.totalDiscountLaborCost,
    job.totalLaborCost,
    job.totalMaterialCostWithMarkup,
    job.totalRentalCostWithMarkup,
    job.subTotal,
    job.ccFee,
    job.grandTotal
  ]);

  const csv = [header, ...rows]
    .map((row) => row.map(toCsvCell).join(","))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `job_cost_report_${Date.now()}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function bindInputs() {
  document.getElementById("client-name").addEventListener("input", (e) => {
    state.draft.clientName = e.target.value;
    saveState();
  });

  document.getElementById("setting-default-rate").addEventListener("input", (e) => {
    state.settings.defaultLaborRate = numberOrZero(e.target.value);
    saveState();
    renderSummary();
  });
  document.getElementById("setting-helper-rate").addEventListener("input", (e) => {
    state.settings.helperLaborRate = numberOrZero(e.target.value);
    saveState();
    renderSummary();
  });
  document.getElementById("setting-discount-rate").addEventListener("input", (e) => {
    state.settings.discountLaborRate = numberOrZero(e.target.value);
    saveState();
    renderSummary();
  });

  document.getElementById("setting-material-markup").addEventListener("input", (e) => {
    state.settings.materialMarkupRate = numberOrZero(e.target.value);
    saveState();
    renderSummary();
  });
  document.getElementById("setting-rental-markup").addEventListener("input", (e) => {
    state.settings.rentalMarkupRate = numberOrZero(e.target.value);
    saveState();
    renderSummary();
  });
  document.getElementById("setting-cc-fee").addEventListener("input", (e) => {
    state.settings.creditCardFeeRate = numberOrZero(e.target.value);
    saveState();
    renderSummary();
  });

  document.getElementById("add-default-labor").addEventListener("click", () => addRow("defaultLabor", "hours"));
  document.getElementById("add-helper-labor").addEventListener("click", () => addRow("helperLabor", "hours"));
  document.getElementById("add-discount-labor").addEventListener("click", () => addRow("discountLabor", "hours"));
  document.getElementById("add-material").addEventListener("click", () => addRow("materialCosts", "amount"));
  document.getElementById("add-rental").addEventListener("click", () => addRow("rentalCosts", "amount"));

  document.getElementById("calculate-job").addEventListener("click", () => {
    const snapshot = snapshotCurrentJob();
    const existingIdx = state.savedJobs.findIndex((j) => j.jobId === snapshot.jobId);
    if (existingIdx >= 0) {
      state.savedJobs[existingIdx] = snapshot;
    } else {
      state.savedJobs.unshift(snapshot);
    }
    saveState();
    renderSavedJobs();
    renderSummary();
    setActiveTab("summary");
  });

  document.getElementById("edit-job").addEventListener("click", () => {
    setActiveTab("main");
  });

  document.getElementById("new-job").addEventListener("click", () => {
    state.draft = makeDraft();
    saveState();
    renderHeaderFields();
    renderAllRows();
    renderSummary();
    setActiveTab("main");
  });

  document.getElementById("export-csv").addEventListener("click", exportCsv);
  document.getElementById("clear-saved").addEventListener("click", () => {
    if (!state.savedJobs.length) return;
    const ok = confirm("Clear all saved jobs?");
    if (!ok) return;
    state.savedJobs = [];
    saveState();
    renderSavedJobs();
  });
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("service-worker.js").catch(() => {
      // ignore registration errors
    });
  }
}

function init() {
  loadState();
  bindTabs();
  bindInputs();
  renderHeaderFields();
  renderAllRows();
  renderSummary();
  renderSavedJobs();
  registerServiceWorker();
}

init();
