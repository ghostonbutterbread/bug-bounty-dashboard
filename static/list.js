const projectId = new URLSearchParams(window.location.search).get("project");
const tableBody = document.getElementById("tableBody");

const statusOrder = ["finding", "recommended", "planned", "tested"];
const statusIcon = {
  tested: "✅ tested",
  planned: "📋 planned",
  recommended: "🚀 recommended",
  finding: "🔴 finding",
};

async function api(url) {
  const res = await fetch(url);
  const data = await res.json().catch(() => []);
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

function topStatus(statuses) {
  if (!statuses.length) return "-";
  const candidates = statuses.map((row) => row.status);
  for (const state of statusOrder) {
    if (candidates.includes(state)) return statusIcon[state] || state;
  }
  return statusIcon[candidates[0]] || candidates[0];
}

function escapeHtml(value) {
  const el = document.createElement("div");
  el.textContent = String(value ?? "");
  return el.innerHTML;
}

async function loadData() {
  if (!projectId) {
    tableBody.innerHTML = '<tr><td colspan="6">Select a project from the dashboard</td></tr>';
    return;
  }

  const payload = await api(`/api/projects/${projectId}/visual-map`).catch(() => ({ targets: [] }));
  const targets = payload.targets || [];

  const htmlRows = [];
  targets.forEach((target) => {
    const endpoints = target.endpoints || [];
    const targetRecommendations = target.recommendations || [];
    const recommendationHint = targetRecommendations.length ? ` | ${targetRecommendations.length} recs` : "";

    if (!endpoints.length) {
      htmlRows.push(`
        <tr>
          <td>${escapeHtml(target.hostname)}</td>
          <td>-</td>
          <td>-</td>
          <td>-${recommendationHint}</td>
          <td>0</td>
          <td>${escapeHtml(formatDate(target.updated_at))}</td>
        </tr>
      `);
      return;
    }

    endpoints.forEach((endpoint) => {
      const endpointFindings = (endpoint.findings || []).filter((row) => row.status !== "resolved");
      htmlRows.push(`
        <tr>
          <td>${escapeHtml(target.hostname)}</td>
          <td>${escapeHtml(endpoint.url)}</td>
          <td><span class="endpoint-pill">${escapeHtml(endpoint.method)}</span> ${escapeHtml(endpoint.id)}</td>
          <td>${escapeHtml(topStatus(endpoint.statuses || []))}${escapeHtml(recommendationHint)}</td>
          <td>${escapeHtml(endpointFindings.length)}</td>
          <td>${escapeHtml(formatDate(endpoint.updated_at))}</td>
        </tr>
      `);
    });
  });

  tableBody.innerHTML = htmlRows.join("") || '<tr><td colspan="6">No records found</td></tr>';
}

loadData();
