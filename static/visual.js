const state = {
  projectId: new URLSearchParams(window.location.search).get("project"),
  selectedNode: null,
  targets: [],
  stats: { targets: 0, urls: 0, endpoints: 0, findings: 0 },
  endpointsByTarget: new Map(),
  statusesByEndpoint: new Map(),
  findingsByEndpoint: new Map(),
  recommendationsByTarget: new Map(),
};

const refs = {
  graphContainer: document.getElementById("graphContainer"),
  nodeTitle: document.getElementById("nodeTitle"),
  nodeMeta: document.getElementById("nodeMeta"),
  checklist: document.getElementById("checklist"),
  recommendations: document.getElementById("recommendations"),
  panelHint: document.getElementById("panelHint"),
  newStatusType: document.getElementById("newStatusType"),
  newStatusTestType: document.getElementById("newStatusTestType"),
  addStatusBtn: document.getElementById("addStatusBtn"),
  newRecommendationText: document.getElementById("newRecommendationText"),
  newRecommendationPriority: document.getElementById("newRecommendationPriority"),
  addRecommendationBtn: document.getElementById("addRecommendationBtn"),
  kpiTargets: document.getElementById("kpiTargets"),
  kpiUrls: document.getElementById("kpiUrls"),
  kpiEndpoints: document.getElementById("kpiEndpoints"),
  kpiFindings: document.getElementById("kpiFindings"),
};

const STATUS_META = {
  tested: { icon: "✅", color: "#16a34a" },
  planned: { icon: "📋", color: "#ca8a04" },
  recommended: { icon: "🚀", color: "#ea580c" },
  finding: { icon: "🔴", color: "#dc2626" },
};

const width = () => refs.graphContainer.clientWidth;
const height = () => refs.graphContainer.clientHeight;

const svg = d3.select(refs.graphContainer).append("svg").attr("width", "100%").attr("height", "100%");
const zoomLayer = svg.append("g").attr("transform", "translate(70,40)");
const linkLayer = zoomLayer.append("g");
const nodeLayer = zoomLayer.append("g");

const zoom = d3
  .zoom()
  .scaleExtent([0.4, 2.5])
  .on("zoom", (event) => {
    zoomLayer.attr("transform", event.transform);
  });
svg.call(zoom).call(zoom.transform, d3.zoomIdentity.translate(70, 40));

async function api(url, options = {}) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

function statusForEndpoint(endpointId) {
  const statuses = state.statusesByEndpoint.get(endpointId) || [];
  if (statuses.some((s) => s.status === "finding")) return "finding";
  if (statuses.some((s) => s.status === "recommended")) return "recommended";
  if (statuses.some((s) => s.status === "planned")) return "planned";
  if (statuses.some((s) => s.status === "tested")) return "tested";
  return null;
}

function statusIcon(status) {
  return STATUS_META[status]?.icon || "⚪";
}

function buildHierarchy() {
  const root = {
    name: "Scope",
    type: "root",
    children: [],
  };

  state.targets.forEach((target) => {
    const targetNode = {
      id: target.id,
      name: target.hostname,
      type: "subdomain",
      raw: target,
      children: [],
    };

    const groupedByUrl = new Map();
    const endpoints = state.endpointsByTarget.get(target.id) || [];
    endpoints.forEach((endpoint) => {
      if (!groupedByUrl.has(endpoint.url)) groupedByUrl.set(endpoint.url, []);
      groupedByUrl.get(endpoint.url).push(endpoint);
    });

    for (const [url, endpointRows] of groupedByUrl) {
      const urlNode = {
        id: `${target.id}:${url}`,
        name: url,
        type: "url",
        targetId: target.id,
        raw: { url },
        children: endpointRows.map((endpoint) => ({
          id: endpoint.id,
          name: `${endpoint.method} endpoint`,
          type: "endpoint",
          targetId: target.id,
          url,
          status: statusForEndpoint(endpoint.id),
          raw: endpoint,
        })),
      };
      targetNode.children.push(urlNode);
    }

    root.children.push(targetNode);
  });

  return root;
}

function nodeColor(node) {
  if (node.type === "subdomain") return "#2563eb";
  if (node.type === "url") return "#6d28d9";
  if (node.type === "endpoint") return STATUS_META[node.status]?.color || "#475569";
  return "#334155";
}

function showEmptyState(message) {
  linkLayer.selectAll("*").remove();
  nodeLayer.selectAll("*").remove();
  nodeLayer
    .append("text")
    .attr("x", 16)
    .attr("y", 28)
    .attr("fill", "#64748b")
    .style("font-size", "14px")
    .text(message);
}

function renderTree() {
  if (!state.projectId) {
    showEmptyState("Select a project from the dashboard to load the visual map.");
    return;
  }

  const data = buildHierarchy();
  if (!data.children.length) {
    showEmptyState("This project has no targets yet.");
    return;
  }

  const root = d3.hierarchy(data);
  const tree = d3.tree().size([Math.max(320, height() - 90), Math.max(640, width() - 240)]);
  tree(root);

  const t = svg.transition().duration(450).ease(d3.easeCubicOut);

  linkLayer
    .selectAll("path.link")
    .data(root.links(), (d) => `${d.source.data.id || "root"}-${d.target.data.id}`)
    .join(
      (enter) =>
        enter
          .append("path")
          .attr("class", "link")
          .attr("d", d3.linkHorizontal().x((d) => d.source.y).y((d) => d.source.x))
          .call((sel) => sel.transition(t).attr("d", d3.linkHorizontal().x((d) => d.y).y((d) => d.x))),
      (update) => update.call((sel) => sel.transition(t).attr("d", d3.linkHorizontal().x((d) => d.y).y((d) => d.x))),
      (exit) => exit.call((sel) => sel.transition(t).style("opacity", 0).remove())
    );

  const nodes = nodeLayer
    .selectAll("g.node")
    .data(root.descendants(), (d) => d.data.id || "root")
    .join(
      (enter) => {
        const group = enter
          .append("g")
          .attr("class", "node")
          .attr("transform", (d) => `translate(${d.parent ? d.parent.y : d.y},${d.parent ? d.parent.x : d.x})`)
          .style("opacity", 0);

        group.append("circle").attr("r", 0);
        group.append("text").attr("class", "node-label");
        group.append("text").attr("class", "node-badge");

        group
          .transition(t)
          .style("opacity", 1)
          .attr("transform", (d) => `translate(${d.y},${d.x})`)
          .select("circle")
          .attr("r", 9);

        return group;
      },
      (update) => update.call((sel) => sel.transition(t).attr("transform", (d) => `translate(${d.y},${d.x})`)),
      (exit) => exit.call((sel) => sel.transition(t).style("opacity", 0).remove())
    );

  nodes
    .attr("data-node-type", (d) => d.data.type)
    .classed("active", (d) => !!state.selectedNode && d.data.type === state.selectedNode.type && d.data.id === state.selectedNode.id)
    .on("click", (_, d) => selectNode(d.data));

  nodes.select("circle").attr("fill", (d) => nodeColor(d.data));

  nodes
    .select("text.node-label")
    .attr("x", (d) => (d.children ? -14 : 14))
    .attr("y", -2)
    .attr("text-anchor", (d) => (d.children ? "end" : "start"))
    .text((d) => {
      const name = d.data.name || "";
      return name.length > 42 ? `${name.slice(0, 42)}...` : name;
    });

  nodes
    .select("text.node-badge")
    .attr("x", (d) => (d.children ? -14 : 14))
    .attr("y", 12)
    .attr("text-anchor", (d) => (d.children ? "end" : "start"))
    .text((d) => (d.data.type === "endpoint" ? statusIcon(d.data.status) : ""))
    .attr("fill", "#334155");
}

function checklistItem(label, meta = "") {
  const li = document.createElement("li");
  li.innerHTML = `<span>${label}</span><small>${meta}</small>`;
  return li;
}

function recommendationItem(text, priority) {
  const li = document.createElement("li");
  li.innerHTML = `<span>${text}</span><small>P${priority}</small>`;
  return li;
}

function clearDetailLists() {
  refs.checklist.innerHTML = "";
  refs.recommendations.innerHTML = "";
}

function recommendationsForTarget(targetId) {
  return state.recommendationsByTarget.get(targetId) || [];
}

function renderRecommendationList(targetId) {
  const recs = recommendationsForTarget(targetId);
  if (recs.length) {
    recs.forEach((rec) => {
      refs.recommendations.appendChild(recommendationItem(rec.recommendation_text, rec.priority));
    });
  } else {
    refs.recommendations.appendChild(checklistItem("No recommendations yet"));
  }
}

function renderStats() {
  refs.kpiTargets.textContent = String(state.stats.targets || 0);
  refs.kpiUrls.textContent = String(state.stats.urls || 0);
  refs.kpiEndpoints.textContent = String(state.stats.endpoints || 0);
  refs.kpiFindings.textContent = String(state.stats.findings || 0);
}

async function selectNode(node) {
  state.selectedNode = node;
  renderTree();
  clearDetailLists();
  refs.nodeTitle.textContent = node.name;

  if (node.type === "subdomain") {
    refs.nodeMeta.textContent = "Subdomain";
    renderRecommendationList(node.id);
    refs.checklist.appendChild(checklistItem("Select a URL or endpoint for test checklist"));
    refs.panelHint.textContent = "You can add recommendations for this subdomain.";
    return;
  }

  if (node.type === "url") {
    refs.nodeMeta.textContent = "URL node";
    const endpoints = (state.endpointsByTarget.get(node.targetId) || []).filter((ep) => ep.url === node.name);
    endpoints.forEach((ep) => {
      const status = statusForEndpoint(ep.id) || "untested";
      refs.checklist.appendChild(checklistItem(`${statusIcon(status)} ${ep.method} endpoint`, ep.url));
    });
    renderRecommendationList(node.targetId);
    refs.panelHint.textContent = "URL nodes summarize endpoint statuses.";
    return;
  }

  if (node.type === "endpoint") {
    refs.nodeMeta.textContent = `${node.raw.method} ${node.raw.url}`;
    const statuses = state.statusesByEndpoint.get(node.id) || [];
    if (statuses.length) {
      statuses.forEach((status) => {
        const label = `${statusIcon(status.status)} ${status.status}`;
        refs.checklist.appendChild(checklistItem(label, status.test_type || "general"));
      });
    } else {
      refs.checklist.appendChild(checklistItem("No testing status recorded"));
    }

    renderRecommendationList(node.targetId);
    refs.panelHint.textContent = "Add status entries as you test this endpoint.";
    return;
  }

  refs.nodeMeta.textContent = "";
}

function rebuildLookup(projectData) {
  state.targets = projectData.targets || [];
  state.stats = projectData.stats || { targets: 0, urls: 0, endpoints: 0, findings: 0 };
  state.endpointsByTarget = new Map();
  state.statusesByEndpoint = new Map();
  state.findingsByEndpoint = new Map();
  state.recommendationsByTarget = new Map();

  state.targets.forEach((target) => {
    const endpoints = target.endpoints || [];
    state.endpointsByTarget.set(target.id, endpoints);
    state.recommendationsByTarget.set(target.id, target.recommendations || []);

    endpoints.forEach((endpoint) => {
      state.statusesByEndpoint.set(endpoint.id, endpoint.statuses || []);
      state.findingsByEndpoint.set(endpoint.id, endpoint.findings || []);
    });
  });
}

function resolveSelectedNode() {
  if (!state.selectedNode) return null;
  const selected = state.selectedNode;

  if (selected.type === "subdomain") {
    return state.targets.find((target) => target.id === selected.id)
      ? { ...selected }
      : null;
  }

  if (selected.type === "url") {
    const targetEndpoints = state.endpointsByTarget.get(selected.targetId) || [];
    const hasUrl = targetEndpoints.some((ep) => ep.url === selected.name);
    return hasUrl ? { ...selected } : null;
  }

  if (selected.type === "endpoint") {
    for (const [targetId, endpoints] of state.endpointsByTarget.entries()) {
      const endpoint = endpoints.find((ep) => ep.id === selected.id);
      if (endpoint) {
        return {
          id: endpoint.id,
          name: `${endpoint.method} endpoint`,
          type: "endpoint",
          targetId,
          url: endpoint.url,
          status: statusForEndpoint(endpoint.id),
          raw: endpoint,
        };
      }
    }
  }

  return null;
}

async function loadData() {
  if (!state.projectId) {
    state.stats = { targets: 0, urls: 0, endpoints: 0, findings: 0 };
    renderStats();
    renderTree();
    return;
  }

  const projectData = await api(`/api/projects/${state.projectId}/visual-map`).catch(() => ({
    targets: [],
    stats: { targets: 0, urls: 0, endpoints: 0, findings: 0 },
  }));
  rebuildLookup(projectData);
  renderStats();
  renderTree();

  const selected = resolveSelectedNode();
  if (selected) {
    await selectNode(selected);
  }
}

refs.addStatusBtn.addEventListener("click", async () => {
  if (!state.selectedNode || state.selectedNode.type !== "endpoint") return;

  const payload = {
    status: refs.newStatusType.value,
    test_type: refs.newStatusTestType.value.trim(),
  };

  await api(`/api/endpoints/${state.selectedNode.id}/status`, {
    method: "POST",
    body: JSON.stringify(payload),
  });

  refs.newStatusTestType.value = "";
  await loadData();
});

refs.addRecommendationBtn.addEventListener("click", async () => {
  if (!state.selectedNode || !["subdomain", "endpoint", "url"].includes(state.selectedNode.type)) return;

  const targetId = state.selectedNode.type === "subdomain" ? state.selectedNode.id : state.selectedNode.targetId;
  const recommendationText = refs.newRecommendationText.value.trim();
  const priority = Number(refs.newRecommendationPriority.value || 5);
  if (!recommendationText) return;

  await api(`/api/targets/${targetId}/recommendations`, {
    method: "POST",
    body: JSON.stringify({ recommendation_text: recommendationText, priority }),
  });

  refs.newRecommendationText.value = "";
  await loadData();
});

window.addEventListener("resize", renderTree);
loadData();
