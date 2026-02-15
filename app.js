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
    defaultLabor: [{ hours: "" }],
    helperLabor: [{ hours: "" }],
    discountLabor: [{ hours: "" }],
    materialCosts: [{ amount: "" }],
    rentalCosts: [{ amount: "" }]
  };
}

const state = {
  settings: {
    defaultLaborRate: 85,
    helperLaborRate: 120,
    discountLaborRate: 65,
    materialMarkupRate: 0.15,
    rentalMarkupRate: 0.10,
    creditCardFeeRate: 0.03,
    syncEndpoint: "",
    syncKey: ""
  },
  draft: makeDraft(),
  savedJobs: [],
  lastCalculatedJobId: null
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
    numInput.inputMode = "decimal";
    numInput.setAttribute("enterkeyhint", "next");
    const rawValue = row[fieldKey];
    numInput.value = rawValue === undefined ? "" : rawValue;
    numInput.addEventListener("input", (e) => {
      const raw = e.target.value;
      state.draft[listKey][idx][fieldKey] = raw === "" ? "" : numberOrZero(raw);
      saveState();
      renderSummary();
    });
    numInput.addEventListener("change", () => {
      const raw = state.draft[listKey][idx][fieldKey];
      if (raw !== "" && idx === state.draft[listKey].length - 1) {
        state.draft[listKey].push(fieldKey === "hours" ? { hours: "" } : { amount: "" });
        saveState();
        renderAllRows();
        // Keep keyboard flow on iOS by moving focus to the next numeric input.
        requestAnimationFrame(() => focusNextNumberInput(tbodyId, idx));
      }
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
        state.draft[listKey].push(fieldKey === "hours" ? { hours: "" } : { amount: "" });
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

function focusNextNumberInput(tbodyId, currentIndex) {
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return;
  const inputs = tbody.querySelectorAll('input[type="number"]');
  const next = inputs[currentIndex + 1];
  if (next) next.focus();
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
  state.draft[listKey].push(fieldKey === "hours" ? { hours: "" } : { amount: "" });
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
  document.getElementById("setting-sync-endpoint").value = state.settings.syncEndpoint || "";
  document.getElementById("setting-sync-key").value = state.settings.syncKey || "";
}

function renderMainTotals(sum, settings) {
  const rateToLabel = (rate) => `${money.format(numberOrZero(rate))}/hr`;

  document.getElementById("main-default-rate-label").textContent = rateToLabel(settings.defaultLaborRate);
  document.getElementById("main-helper-rate-label").textContent = rateToLabel(settings.helperLaborRate);
  document.getElementById("main-discount-rate-label").textContent = rateToLabel(settings.discountLaborRate);
  document.getElementById("main-default-labor").textContent = money.format(sum.totalDefaultLaborCost);
  document.getElementById("main-helper-labor").textContent = money.format(sum.totalHelperLaborCost);
  document.getElementById("main-discount-labor").textContent = money.format(sum.totalDiscountLaborCost);
  document.getElementById("main-material-base").textContent = money.format(sum.baseMaterialCost);
  document.getElementById("main-material-markup").textContent = money.format(sum.totalMaterialCostWithMarkup);
  document.getElementById("main-rental-base").textContent = money.format(sum.baseRentalCost);
  document.getElementById("main-rental-markup").textContent = money.format(sum.totalRentalCostWithMarkup);
}

function renderSummaryDetails(sum, settings) {
  const rateToLabel = (rate) => `${money.format(numberOrZero(rate))}/hr`;
  const percentLabel = (rate) => `${(numberOrZero(rate) * 100).toFixed(2)}%`;

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

function renderSummary() {
  const sum = calcSummary();
  const settings = state.settings;
  renderMainTotals(sum, settings);
  renderSummaryDetails(sum, settings);
}

function summaryFromSavedJob(job) {
  return {
    sum: {
      totalDefaultLaborCost: numberOrZero(job.totalDefaultLaborCost),
      totalHelperLaborCost: numberOrZero(job.totalHelperLaborCost),
      totalDiscountLaborCost: numberOrZero(job.totalDiscountLaborCost),
      totalLaborCost: numberOrZero(job.totalLaborCost),
      baseMaterialCost: numberOrZero(job.baseMaterialCost),
      baseRentalCost: numberOrZero(job.baseRentalCost),
      totalMaterialCostWithMarkup: numberOrZero(job.totalMaterialCostWithMarkup),
      totalRentalCostWithMarkup: numberOrZero(job.totalRentalCostWithMarkup),
      materialMarkupAmount: numberOrZero(job.totalMaterialCostWithMarkup) - numberOrZero(job.baseMaterialCost),
      rentalMarkupAmount: numberOrZero(job.totalRentalCostWithMarkup) - numberOrZero(job.baseRentalCost),
      subTotal: numberOrZero(job.subTotal),
      ccFee: numberOrZero(job.ccFee),
      grandTotal: numberOrZero(job.grandTotal)
    },
    settings: {
      defaultLaborRate: numberOrZero(job.defaultLaborRate),
      helperLaborRate: numberOrZero(job.helperLaborRate),
      discountLaborRate: numberOrZero(job.discountLaborRate),
      materialMarkupRate: numberOrZero(job.materialMarkupRate),
      rentalMarkupRate: numberOrZero(job.rentalMarkupRate)
    }
  };
}

function ensureRows(list, field) {
  const safe = Array.isArray(list) ? list : [];
  const cleaned = safe
    .map((row) => ({ [field]: row && row[field] !== undefined ? row[field] : "" }))
    .filter((row) => row[field] !== "");
  cleaned.push({ [field]: "" });
  return cleaned;
}

function buildDraftPayload() {
  return {
    clientName: state.draft.clientName || "",
    createdDate: state.draft.createdDate,
    jobId: state.draft.jobId,
    defaultLabor: ensureRows(state.draft.defaultLabor, "hours"),
    helperLabor: ensureRows(state.draft.helperLabor, "hours"),
    discountLabor: ensureRows(state.draft.discountLabor, "hours"),
    materialCosts: ensureRows(state.draft.materialCosts, "amount"),
    rentalCosts: ensureRows(state.draft.rentalCosts, "amount")
  };
}

function loadSavedJobIntoDraft(job) {
  if (!job) return;
  if (!job.draftData) {
    alert("This older saved record cannot be edited because line-item data was not stored yet.");
    return;
  }

  const d = job.draftData;
  state.draft = {
    clientName: d.clientName || "",
    createdDate: d.createdDate || new Date().toISOString(),
    jobId: d.jobId || makeJobId(new Date()),
    defaultLabor: ensureRows(d.defaultLabor, "hours"),
    helperLabor: ensureRows(d.helperLabor, "hours"),
    discountLabor: ensureRows(d.discountLabor, "hours"),
    materialCosts: ensureRows(d.materialCosts, "amount"),
    rentalCosts: ensureRows(d.rentalCosts, "amount")
  };

  if (job.defaultLaborRate !== undefined) state.settings.defaultLaborRate = numberOrZero(job.defaultLaborRate);
  if (job.helperLaborRate !== undefined) state.settings.helperLaborRate = numberOrZero(job.helperLaborRate);
  if (job.discountLaborRate !== undefined) state.settings.discountLaborRate = numberOrZero(job.discountLaborRate);
  if (job.materialMarkupRate !== undefined) state.settings.materialMarkupRate = numberOrZero(job.materialMarkupRate);
  if (job.rentalMarkupRate !== undefined) state.settings.rentalMarkupRate = numberOrZero(job.rentalMarkupRate);
  if (job.creditCardFeeRate !== undefined) state.settings.creditCardFeeRate = numberOrZero(job.creditCardFeeRate);

  saveState();
  renderHeaderFields();
  renderAllRows();
  renderSummary();
  setActiveTab("main");
}

function snapshotCurrentJob() {
  const sum = calcSummary();
  return {
    jobId: state.draft.jobId,
    updatedAt: new Date().toISOString(),
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
    grandTotal: sum.grandTotal,
    draftData: buildDraftPayload()
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
      <td class="saved-actions">
        <button class="row-load" aria-label="Load">Load</button>
        <button class="row-delete" aria-label="Delete">X</button>
      </td>
    `;

    tr.querySelector(".row-load").addEventListener("click", () => {
      loadSavedJobIntoDraft(job);
    });

    tr.querySelector(".row-delete").addEventListener("click", () => {
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
  document.getElementById("setting-sync-endpoint").addEventListener("input", (e) => {
    state.settings.syncEndpoint = (e.target.value || "").trim();
    saveState();
  });
  document.getElementById("setting-sync-key").addEventListener("input", (e) => {
    state.settings.syncKey = (e.target.value || "").trim();
    saveState();
  });

  document.getElementById("calculate-job").addEventListener("click", () => {
    const snapshot = snapshotCurrentJob();
    const existingIdx = state.savedJobs.findIndex((j) => j.jobId === snapshot.jobId);
    if (existingIdx >= 0) {
      state.savedJobs[existingIdx] = snapshot;
    } else {
      state.savedJobs.unshift(snapshot);
    }
    state.lastCalculatedJobId = snapshot.jobId;
    saveState();
    renderSavedJobs();
    const summaryView = summaryFromSavedJob(snapshot);
    renderSummaryDetails(summaryView.sum, summaryView.settings);
    setActiveTab("summary");

    // Clear Main for next entry; Edit Job restores this saved record.
    state.draft = makeDraft();
    saveState();
    renderHeaderFields();
    renderAllRows();
    renderMainTotals(calcSummary(), state.settings);

    void syncCloud();
  });

  document.getElementById("edit-job").addEventListener("click", () => {
    if (!state.lastCalculatedJobId) {
      setActiveTab("main");
      return;
    }
    const job = state.savedJobs.find((j) => j.jobId === state.lastCalculatedJobId);
    if (!job) {
      setActiveTab("main");
      return;
    }
    loadSavedJobIntoDraft(job);
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
  document.getElementById("sync-cloud").addEventListener("click", () => {
    void syncCloud(true);
  });
  document.getElementById("clear-saved").addEventListener("click", () => {
    if (!state.savedJobs.length) return;
    const ok = confirm("Clear all saved jobs?");
    if (!ok) return;
    state.savedJobs = [];
    saveState();
    renderSavedJobs();
  });
}

function mergeJobs(localJobs, remoteJobs) {
  const map = new Map();
  const add = (job) => {
    if (!job || !job.jobId) return;
    const existing = map.get(job.jobId);
    if (!existing) {
      map.set(job.jobId, job);
      return;
    }
    const existingTime = Date.parse(existing.updatedAt || existing.createdDate || 0);
    const incomingTime = Date.parse(job.updatedAt || job.createdDate || 0);
    const winner = incomingTime >= existingTime ? job : existing;
    const loser = incomingTime >= existingTime ? existing : job;
    if (!winner.draftData && loser.draftData) {
      winner.draftData = loser.draftData;
    }
    map.set(job.jobId, winner);
  };

  localJobs.forEach(add);
  remoteJobs.forEach(add);
  return [...map.values()].sort((a, b) => Date.parse(b.createdDate || 0) - Date.parse(a.createdDate || 0));
}

async function syncCloud(showAlert = false) {
  const endpoint = (state.settings.syncEndpoint || "").trim();
  const key = (state.settings.syncKey || "").trim();
  if (!endpoint || !key) {
    if (showAlert) alert("Set Sync Endpoint URL and Sync Key in Settings first.");
    return;
  }

  const payloadBody = JSON.stringify({
    key,
    jobs: state.savedJobs
  });

  async function tryPost(url) {
    return fetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: payloadBody,
      cache: "no-store",
      credentials: "omit",
      mode: "cors",
      redirect: "follow"
    });
  }

  try {
    let response = await tryPost(endpoint);
    // iOS Safari can fail POST redirects from /exec; fallback to resolved final URL.
    if (!response.ok) {
      const resolve = await fetch(endpoint, {
        method: "GET",
        cache: "no-store",
        credentials: "omit",
        mode: "cors",
        redirect: "follow"
      });
      if (resolve.ok && resolve.url && resolve.url !== endpoint) {
        response = await tryPost(resolve.url);
      }
    }

    if (!response.ok) throw new Error(`Sync request failed (${response.status})`);
    const payload = await response.json();
    const remoteJobs = Array.isArray(payload.jobs) ? payload.jobs : [];
    state.savedJobs = mergeJobs(state.savedJobs, remoteJobs);
    saveState();
    renderSavedJobs();
    if (showAlert) alert("Cloud sync completed.");
  } catch (err) {
    if (showAlert) alert(`Cloud sync failed: ${err.message}. Check endpoint URL, deployment access, and sync key.`);
  }
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
  void syncCloud();
}

init();
