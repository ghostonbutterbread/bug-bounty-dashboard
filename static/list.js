const projectId = new URLSearchParams(window.location.search).get("project");

const refs = {
  tableBody: document.getElementById("tableBody"),
  searchInput: document.getElementById("searchInput"),
  targetFilter: document.getElementById("targetFilter"),
  endpointNavigator: document.getElementById("endpointNavigator"),
  detailTitle: document.getElementById("detailTitle"),
  detailMeta: document.getElementById("detailMeta"),
  statusType: document.getElementById("statusType"),
  statusTestType: document.getElementById("statusTestType"),
  statusNotes: document.getElementById("statusNotes"),
  saveStatusBtn: document.getElementById("saveStatusBtn"),
  coverageList: document.getElementById("coverageList"),
  findingsList: document.getElementById("findingsList"),
  recommendationsList: document.getElementById("recommendationsList"),
  notesList: document.getElementById("notesList"),
  historyList: document.getElementById("historyList"),
  requestResponseBlock: document.getElementById("requestResponseBlock"),
};

const state = {
  targets: [],
  rows: [],
  selectedEndpointId: null,
};

const statusOrder = ["finding", "recommended", "planned", "tested"];
const statusIcon = {
  tested: "✅ tested",
  planned: "📋 planned",
  recommended: "🚀 recommended",
  finding: "🔴 finding",
};

async function api(url, options = {}) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

function topStatusValue(statuses) {
  if (!statuses.length) return "-";
  const candidates = statuses.map((row) => row.status);
  for (const current of statusOrder) {
    if (candidates.includes(current)) return current;
  }
  return candidates[0] || "-";
}

function topStatusLabel(statuses) {
  const top = topStatusValue(statuses);
  if (top === "-") return "-";
  return statusIcon[top] || top;
}

function endpointSearchText(row) {
  const statusText = row.endpoint.statuses
    .map((s) => `${s.status || ""} ${s.test_type || ""} ${s.notes || ""}`)
    .join(" ");
  const findingsText = row.endpoint.findings
    .map((f) => `${f.title || ""} ${f.description || ""} ${f.status || ""} ${f.severity || ""}`)
    .join(" ");
  return [
    row.target.hostname,
    row.target.notes || "",
    row.endpoint.url,
    row.endpoint.method,
    row.endpoint.notes || "",
    statusText,
    findingsText,
  ]
    .join(" ")
    .toLowerCase();
}

function buildRows(targets) {
  const rows = [];
  targets.forEach((target) => {
    const endpoints = target.endpoints || [];
    if (!endpoints.length) {
      rows.push({
        type: "target-only",
        key: `target-empty-${target.id}`,
        target,
      });
      return;
    }

    endpoints.forEach((endpoint) => {
      rows.push({
        type: "endpoint",
        key: `endpoint-${endpoint.id}`,
        target,
        endpoint: {
          ...endpoint,
          statuses: endpoint.statuses || [],
          findings: (endpoint.findings || []).filter((f) => f.status !== "resolved"),
        },
      });
    });
  });
  return rows;
}

function selectedEndpointRow() {
  return state.rows.find((row) => row.type === "endpoint" && row.endpoint.id === state.selectedEndpointId) || null;
}

function clearList(el) {
  el.innerHTML = "";
}

function appendListItem(list, text, meta = "") {
  const li = document.createElement("li");
  li.innerHTML = `<span>${escapeHtml(text)}</span><small>${escapeHtml(meta)}</small>`;
  list.appendChild(li);
}

function escapeHtml(value) {
  const el = document.createElement("div");
  el.textContent = String(value ?? "");
  return el.innerHTML;
}

function resetDetailPanel() {
  refs.detailTitle.textContent = "Select an endpoint";
  refs.detailMeta.textContent = "Choose a row or use the endpoint dropdown.";
  refs.statusType.value = "tested";
  refs.statusTestType.value = "";
  refs.statusNotes.value = "";
  refs.saveStatusBtn.disabled = true;
  clearList(refs.coverageList);
  clearList(refs.findingsList);
  clearList(refs.recommendationsList);
  clearList(refs.notesList);
  clearList(refs.historyList);
  refs.requestResponseBlock.textContent = "No request/response recorded.";
}

function renderDetailPanel() {
  const row = selectedEndpointRow();
  if (!row) {
    resetDetailPanel();
    return;
  }

  const endpoint = row.endpoint;
  const target = row.target;
  const statuses = endpoint.statuses || [];
  const findings = endpoint.findings || [];
  const topStatus = topStatusValue(statuses);
  const latestStatus = statuses[0] || null;

  refs.detailTitle.textContent = `${endpoint.method} ${endpoint.url}`;
  refs.detailMeta.textContent = `${target.hostname} • Endpoint #${endpoint.id}`;
  refs.statusType.value = topStatus === "-" ? "tested" : topStatus;
  refs.statusTestType.value = latestStatus?.test_type || "";
  refs.statusNotes.value = latestStatus?.notes || "";
  refs.saveStatusBtn.disabled = false;

  clearList(refs.coverageList);
  if (statuses.length) {
    const tests = new Set();
    statuses.forEach((s) => {
      if (s.test_type) tests.add(s.test_type);
    });
    appendListItem(refs.coverageList, `Current: ${topStatusLabel(statuses)}`);
    appendListItem(refs.coverageList, `Status entries: ${statuses.length}`);
    appendListItem(refs.coverageList, `Unique test types: ${tests.size}`);
  } else {
    appendListItem(refs.coverageList, "No testing status recorded");
  }

  clearList(refs.findingsList);
  if (findings.length) {
    findings.forEach((finding) => {
      appendListItem(refs.findingsList, finding.title || "Untitled finding", `${finding.severity || "unknown"} • ${finding.status || "open"}`);
    });
  } else {
    appendListItem(refs.findingsList, "No active findings");
  }

  clearList(refs.recommendationsList);
  const recommendations = target.recommendations || [];
  if (recommendations.length) {
    recommendations.forEach((rec) => {
      appendListItem(refs.recommendationsList, rec.recommendation_text || "Recommendation", `P${rec.priority ?? 5}`);
    });
  } else {
    appendListItem(refs.recommendationsList, "No recommendations");
  }

  clearList(refs.notesList);
  appendListItem(refs.notesList, endpoint.notes || "No endpoint notes", "Endpoint");
  appendListItem(refs.notesList, target.notes || "No target notes", "Target");
  if (latestStatus?.notes) {
    appendListItem(refs.notesList, latestStatus.notes, "Latest status note");
  }

  clearList(refs.historyList);
  if (statuses.length) {
    statuses.forEach((s) => {
      appendListItem(
        refs.historyList,
        `${statusIcon[s.status] || s.status} ${s.test_type || "general"}`,
        formatDate(s.updated_at || s.created_at)
      );
    });
  } else {
    appendListItem(refs.historyList, "No status history");
  }

  const requestData = endpoint.request || endpoint.request_data || null;
  const responseData = endpoint.response || endpoint.response_data || null;
  if (!requestData && !responseData) {
    refs.requestResponseBlock.textContent = "No request/response recorded.";
  } else {
    const lines = [];
    if (requestData) lines.push(`Request:\n${JSON.stringify(requestData, null, 2)}`);
    if (responseData) lines.push(`Response:\n${JSON.stringify(responseData, null, 2)}`);
    refs.requestResponseBlock.textContent = lines.join("\n\n");
  }
}

function targetRowsForDisplay() {
  const filterTarget = refs.targetFilter.value;
  const query = refs.searchInput.value.trim().toLowerCase();

  return state.rows.filter((row) => {
    if (filterTarget && String(row.target.id) !== filterTarget) return false;
    if (!query) return true;
    if (row.type !== "endpoint") return row.target.hostname.toLowerCase().includes(query);
    return endpointSearchText(row).includes(query);
  });
}

function renderTable() {
  const visibleRows = targetRowsForDisplay();
  const htmlRows = visibleRows.map((row) => {
    if (row.type === "target-only") {
      return `
        <tr data-row-key="${escapeHtml(row.key)}">
          <td>${escapeHtml(row.target.hostname)}</td>
          <td>-</td>
          <td>-</td>
          <td>-</td>
          <td>0</td>
          <td>${escapeHtml(formatDate(row.target.updated_at))}</td>
        </tr>
      `;
    }

    const endpoint = row.endpoint;
    const recommendationHint = (row.target.recommendations || []).length ? ` | ${(row.target.recommendations || []).length} recs` : "";
    const isSelected = endpoint.id === state.selectedEndpointId;
    return `
      <tr class="${isSelected ? "selected-row" : ""}" data-row-key="${escapeHtml(row.key)}" data-endpoint-id="${escapeHtml(endpoint.id)}">
        <td>${escapeHtml(row.target.hostname)}</td>
        <td>${escapeHtml(endpoint.url)}</td>
        <td><span class="endpoint-pill">${escapeHtml(endpoint.method)}</span> ${escapeHtml(endpoint.id)}</td>
        <td>${escapeHtml(topStatusLabel(endpoint.statuses || []))}${escapeHtml(recommendationHint)}</td>
        <td>${escapeHtml(endpoint.findings.length)}</td>
        <td>${escapeHtml(formatDate(endpoint.updated_at))}</td>
      </tr>
    `;
  });

  refs.tableBody.innerHTML = htmlRows.join("") || '<tr><td colspan="6">No records found</td></tr>';
}

function renderTargetFilter() {
  const previous = refs.targetFilter.value;
  refs.targetFilter.innerHTML = '<option value="">All subdomains</option>';
  state.targets.forEach((target) => {
    const option = document.createElement("option");
    option.value = String(target.id);
    option.textContent = target.hostname;
    refs.targetFilter.appendChild(option);
  });
  refs.targetFilter.value = previous && [...refs.targetFilter.options].some((opt) => opt.value === previous) ? previous : "";
}

function renderEndpointNavigator() {
  const previous = refs.endpointNavigator.value;
  refs.endpointNavigator.innerHTML = '<option value="">Select an endpoint...</option>';
  state.targets.forEach((target) => {
    const endpoints = target.endpoints || [];
    if (!endpoints.length) return;

    const group = document.createElement("optgroup");
    group.label = target.hostname;
    endpoints.forEach((endpoint) => {
      const option = document.createElement("option");
      option.value = String(endpoint.id);
      option.textContent = `${endpoint.method} ${endpoint.url}`;
      group.appendChild(option);
    });
    refs.endpointNavigator.appendChild(group);
  });
  refs.endpointNavigator.value =
    previous && [...refs.endpointNavigator.options].some((opt) => opt.value === previous) ? previous : "";
}

function selectEndpoint(endpointId, shouldJump = false) {
  const idNum = Number(endpointId);
  if (!Number.isFinite(idNum)) return;
  const endpointRow = state.rows.find((row) => row.type === "endpoint" && row.endpoint.id === idNum);
  if (!endpointRow) return;

  if (shouldJump) {
    refs.targetFilter.value = String(endpointRow.target.id);
    refs.searchInput.value = "";
  }

  state.selectedEndpointId = idNum;
  refs.endpointNavigator.value = String(idNum);
  renderTable();
  renderDetailPanel();

  if (shouldJump) {
    const row = refs.tableBody.querySelector(`tr[data-endpoint-id="${idNum}"]`);
    if (row) row.scrollIntoView({ behavior: "smooth", block: "center" });
  }
}

function bindEvents() {
  refs.searchInput.addEventListener("input", () => {
    renderTable();
  });

  refs.targetFilter.addEventListener("change", () => {
    renderTable();
  });

  refs.endpointNavigator.addEventListener("change", () => {
    if (!refs.endpointNavigator.value) return;
    selectEndpoint(refs.endpointNavigator.value, true);
  });

  refs.tableBody.addEventListener("click", (event) => {
    const row = event.target.closest("tr[data-endpoint-id]");
    if (!row) return;
    selectEndpoint(row.dataset.endpointId, false);
  });

  refs.saveStatusBtn.addEventListener("click", async () => {
    const selected = selectedEndpointRow();
    if (!selected) return;

    const endpoint = selected.endpoint;
    const latestStatus = endpoint.statuses[0];
    const payload = {
      status: refs.statusType.value,
      test_type: refs.statusTestType.value.trim() || null,
      notes: refs.statusNotes.value.trim() || null,
    };

    const numericId = latestStatus && Number.isFinite(Number(latestStatus.id)) ? Number(latestStatus.id) : null;
    if (numericId) {
      await api(`/api/status/${numericId}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
    } else {
      await api(`/api/endpoints/${endpoint.id}/status`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
    }

    await loadData(endpoint.id);
  });
}

async function loadData(preselectEndpointId = null) {
  if (!projectId) {
    refs.tableBody.innerHTML = '<tr><td colspan="6">Select a project from the dashboard</td></tr>';
    resetDetailPanel();
    return;
  }

  const payload = await api(`/api/projects/${projectId}/visual-map`).catch(() => ({ targets: [] }));
  state.targets = payload.targets || [];
  state.rows = buildRows(state.targets);

  renderTargetFilter();
  renderEndpointNavigator();

  if (preselectEndpointId) {
    state.selectedEndpointId = Number(preselectEndpointId);
    refs.endpointNavigator.value = String(preselectEndpointId);
  } else if (!selectedEndpointRow()) {
    state.selectedEndpointId = null;
    refs.endpointNavigator.value = "";
  }

  renderTable();
  renderDetailPanel();
}

bindEvents();
resetDetailPanel();
loadData();
