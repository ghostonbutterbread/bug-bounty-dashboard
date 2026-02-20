const state = {
  tree: [],
  nodeIndex: new Map(),
  expanded: new Set(),
  selectedKey: null,
  sessions: [],
  currentSessionId: null,
  timeline: [],
  timelineIndex: 0,
  playing: false,
  speed: 1,
  timer: null,
};

const SPEED_MS = { 1: 1400, 2: 800, 5: 350 };

const refs = {
  treeRoot: document.getElementById("treeRoot"),
  selectionTitle: document.getElementById("selectionTitle"),
  selectionMeta: document.getElementById("selectionMeta"),
  itemDetails: document.getElementById("itemDetails"),
  projectName: document.getElementById("projectName"),
  createProjectBtn: document.getElementById("createProjectBtn"),
  sessionList: document.getElementById("sessionList"),
  playPauseBtn: document.getElementById("playPauseBtn"),
  speedBtns: Array.from(document.querySelectorAll(".speed-btn")),
  skipFindingBtn: document.getElementById("skipFindingBtn"),
  timelineProgress: document.getElementById("timelineProgress"),
  progressLabel: document.getElementById("progressLabel"),
  ghostStatus: document.getElementById("ghostStatus"),
  timelineList: document.getElementById("timelineList"),
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

function keyFor(type, id) {
  return `${type}:${id}`;
}

function formatDate(iso) {
  if (!iso) return "N/A";
  return new Date(iso).toLocaleString();
}

function stopPlayback() {
  state.playing = false;
  clearInterval(state.timer);
  state.timer = null;
  refs.playPauseBtn.textContent = "Play";
}

function startPlayback() {
  if (!state.timeline.length) return;
  state.playing = true;
  refs.playPauseBtn.textContent = "Pause";
  clearInterval(state.timer);
  state.timer = setInterval(() => {
    if (state.timelineIndex >= state.timeline.length - 1) {
      stopPlayback();
      return;
    }
    focusTimeline(state.timelineIndex + 1);
  }, SPEED_MS[state.speed]);
}

function setSpeed(speed) {
  state.speed = speed;
  refs.speedBtns.forEach((btn) => btn.classList.toggle("active", Number(btn.dataset.speed) === speed));
  if (state.playing) startPlayback();
}

function clearGhostMarker() {
  refs.treeRoot.querySelectorAll(".ghost-node").forEach((n) => n.classList.remove("ghost-node"));
}

function expandPathTo(key) {
  let cursor = state.nodeIndex.get(key);
  while (cursor && cursor.parentKey) {
    state.expanded.add(cursor.parentKey);
    cursor = state.nodeIndex.get(cursor.parentKey);
  }
}

function applyGhost(activity) {
  clearGhostMarker();
  if (!activity) {
    refs.ghostStatus.textContent = "👻 Waiting for timeline data.";
    return;
  }

  let key = null;
  if (activity.endpoint_id) key = keyFor("endpoint", activity.endpoint_id);
  else if (activity.target_id) key = keyFor("target", activity.target_id);

  if (!key || !state.nodeIndex.has(key)) {
    refs.ghostStatus.textContent = `👻 ${activity.action} -> ${activity.result}`;
    return;
  }

  expandPathTo(key);
  renderTree();
  const row = refs.treeRoot.querySelector(`[data-key="${key}"] .tree-row`);
  if (row) row.classList.add("ghost-node");
  refs.ghostStatus.textContent = `👻 ${activity.action} @ ${activity.timestamp}`;
}

function renderDetails(node) {
  refs.itemDetails.innerHTML = "";
  if (!node) return;

  const pairs = [];
  if (node.type === "project") {
    refs.selectionTitle.textContent = `📁 ${node.name}`;
    refs.selectionMeta.textContent = `Project #${node.id}`;
    pairs.push(["Type", "Project"], ["ID", node.id], ["Description", node.description || "N/A"], ["Created", formatDate(node.created_at)]);
  } else if (node.type === "target") {
    refs.selectionTitle.textContent = `🎯 ${node.name}`;
    refs.selectionMeta.textContent = `Target for project #${node.project_id}`;
    pairs.push(["Type", "Target"], ["ID", node.id], ["Hostname", node.hostname], ["Project ID", node.project_id], ["Created", formatDate(node.created_at)]);
  } else if (node.type === "endpoint") {
    refs.selectionTitle.textContent = `🔗 ${node.method} ${node.url}`;
    refs.selectionMeta.textContent = `Endpoint on target #${node.target_id}`;
    pairs.push(["Type", "Endpoint"], ["ID", node.id], ["Method", node.method], ["URL", node.url], ["Target ID", node.target_id], ["Created", formatDate(node.created_at)]);
  }

  pairs.forEach(([k, v]) => {
    const dt = document.createElement("dt");
    dt.textContent = k;
    const dd = document.createElement("dd");
    dd.textContent = String(v);
    refs.itemDetails.appendChild(dt);
    refs.itemDetails.appendChild(dd);
  });
}

function renderTree() {
  state.nodeIndex.clear();
  refs.treeRoot.innerHTML = "";

  const rootList = document.createElement("ul");
  rootList.className = "tree-list";
  refs.treeRoot.appendChild(rootList);

  function addNode(container, node, parentKey = null) {
    const key = keyFor(node.type, node.id);
    state.nodeIndex.set(key, { ...node, key, parentKey });
    const hasChildren = node.type !== "endpoint" && Array.isArray(node.children) && node.children.length > 0;

    const item = document.createElement("li");
    item.className = "tree-item";
    item.dataset.key = key;
    if (state.expanded.has(key)) item.classList.add("expanded");

    const row = document.createElement("div");
    row.className = "tree-row";
    if (state.selectedKey === key) row.classList.add("active");

    const toggle = document.createElement("button");
    toggle.className = `tree-toggle${hasChildren ? "" : " empty"}`;
    toggle.textContent = hasChildren ? (state.expanded.has(key) ? "▾" : "▸") : "";
    toggle.onclick = (e) => {
      e.stopPropagation();
      if (!hasChildren) return;
      if (state.expanded.has(key)) state.expanded.delete(key);
      else state.expanded.add(key);
      renderTree();
    };

    const label = document.createElement("button");
    label.className = "tree-label";
    if (node.type === "project") {
      label.textContent = `${state.expanded.has(key) ? "📂" : "📁"} ${node.name}`;
    } else if (node.type === "target") {
      label.textContent = `🎯 ${node.name}`;
    } else {
      label.textContent = `🔗 ${node.method} ${node.url}`;
    }
    label.onclick = () => selectNode(key);

    row.appendChild(toggle);
    row.appendChild(label);
    item.appendChild(row);

    if (hasChildren) {
      const children = document.createElement("ul");
      children.className = "tree-children";
      node.children.forEach((child) => addNode(children, child, key));
      item.appendChild(children);
    }

    container.appendChild(item);
  }

  state.tree.forEach((project) => addNode(rootList, project, null));
}

async function loadTree() {
  const raw = await api("/api/projects/tree");
  state.tree = raw.map((project) => ({
    ...project,
    type: "project",
    children: (project.targets || []).map((target) => ({
      ...target,
      type: "target",
      children: (target.endpoints || []).map((endpoint) => ({
        ...endpoint,
        project_id: project.id,
        type: "endpoint",
      })),
    })),
  }));
  raw.forEach((p) => state.expanded.add(keyFor("project", p.id)));
  renderTree();
}

function activeProjectId() {
  if (!state.selectedKey) return null;
  const node = state.nodeIndex.get(state.selectedKey);
  if (!node) return null;
  if (node.type === "project") return node.id;
  return node.project_id;
}

async function loadSessions(projectId) {
  if (!projectId) {
    state.sessions = [];
    state.currentSessionId = null;
    renderSessions();
    return;
  }
  state.sessions = await api(`/api/projects/${projectId}/sessions`);
  renderSessions();
  if (!state.sessions.length) {
    state.currentSessionId = null;
    state.timeline = [];
    renderTimeline();
    applyGhost(null);
    return;
  }
  const stillValid = state.sessions.some((s) => s.id === state.currentSessionId);
  await selectSession(stillValid ? state.currentSessionId : state.sessions[0].id);
}

function renderSessions() {
  refs.sessionList.innerHTML = "";
  if (!state.sessions.length) {
    const li = document.createElement("li");
    li.textContent = "No sessions for this project.";
    refs.sessionList.appendChild(li);
    return;
  }
  state.sessions.forEach((s) => {
    const li = document.createElement("li");
    li.className = "session-item";
    const btn = document.createElement("button");
    btn.classList.toggle("active", state.currentSessionId === s.id);
    const label = s.label || `Session #${s.id}`;
    btn.textContent = `${label} (${formatDate(s.started_at)} -> ${formatDate(s.ended_at)})`;
    btn.onclick = () => selectSession(s.id).catch((err) => alert(err.message));
    li.appendChild(btn);
    refs.sessionList.appendChild(li);
  });
}

function renderTimeline() {
  refs.timelineList.innerHTML = "";
  const total = state.timeline.length;
  refs.timelineProgress.max = Math.max(total - 1, 0);
  refs.timelineProgress.value = total ? state.timelineIndex : 0;
  refs.progressLabel.textContent = `${total ? state.timelineIndex + 1 : 0}/${total}`;

  if (!total) {
    const li = document.createElement("li");
    li.textContent = "No timeline data for this session.";
    refs.timelineList.appendChild(li);
    return;
  }

  state.timeline.forEach((item, idx) => {
    const li = document.createElement("li");
    li.className = "timeline-item";
    if (idx === state.timelineIndex) li.classList.add("active");
    if (item.is_finding) li.classList.add("finding");
    li.onclick = () => focusTimeline(idx);

    const title = document.createElement("div");
    title.textContent = `${item.action} -> ${item.result}`;

    const meta = document.createElement("div");
    meta.className = "timeline-meta";
    meta.textContent = `${new Date(item.timestamp).toLocaleTimeString()} | ${item.severity || "N/A"} | ${item.tools.join(", ") || "no tools"}`;

    li.appendChild(title);
    li.appendChild(meta);
    refs.timelineList.appendChild(li);
  });
}

function focusTimeline(index) {
  if (!state.timeline.length) return;
  state.timelineIndex = Math.max(0, Math.min(index, state.timeline.length - 1));
  refs.timelineProgress.value = state.timelineIndex;
  refs.progressLabel.textContent = `${state.timelineIndex + 1}/${state.timeline.length}`;
  renderTimeline();
  applyGhost(state.timeline[state.timelineIndex]);
}

async function selectSession(sessionId) {
  state.currentSessionId = sessionId;
  renderSessions();
  stopPlayback();
  const data = await api(`/api/sessions/${sessionId}/timeline`);
  state.timeline = data.activities || [];
  state.timelineIndex = 0;
  renderTimeline();
  applyGhost(state.timeline[0] || null);
}

async function selectNode(key) {
  state.selectedKey = key;
  const node = state.nodeIndex.get(key);
  renderTree();
  renderDetails(node);
  stopPlayback();
  await loadSessions(activeProjectId());
}

async function createProject() {
  const name = refs.projectName.value.trim();
  if (!name) return;
  await api("/api/projects", { method: "POST", body: JSON.stringify({ name }) });
  refs.projectName.value = "";
  await loadTree();
}

function wireEvents() {
  refs.createProjectBtn.onclick = () => createProject().catch((err) => alert(err.message));

  refs.playPauseBtn.onclick = () => {
    if (!state.timeline.length) return;
    if (state.playing) stopPlayback();
    else startPlayback();
  };

  refs.speedBtns.forEach((btn) => {
    btn.onclick = () => setSpeed(Number(btn.dataset.speed));
  });

  refs.skipFindingBtn.onclick = () => {
    if (!state.timeline.length) return;
    const next = state.timeline.findIndex((item, idx) => idx > state.timelineIndex && item.is_finding);
    if (next >= 0) focusTimeline(next);
  };

  refs.timelineProgress.oninput = (e) => {
    stopPlayback();
    focusTimeline(Number(e.target.value));
  };
}

async function init() {
  wireEvents();
  await loadTree();
  renderDetails(null);
  renderSessions();
  renderTimeline();
  setSpeed(1);
}

init().catch((err) => {
  console.error(err);
  alert(err.message);
});
