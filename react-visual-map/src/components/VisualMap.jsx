import { useCallback, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Position,
  useNodesState,
  useEdgesState,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

const statusColors = {
  tested: '#22c55e',
  planned: '#eab308',
  recommended: '#f97316',
  finding: '#ef4444',
  untested: '#94a3b8',
};

const ROOT_X = 500;
const ROOT_Y = 40;
const TARGET_Y = 180;
const TARGET_VERTICAL_GAP = 260;
const URL_START_X = 300;
const URL_GROUP_GAP = 340;
const URL_Y_OFFSET = 88;
const URL_STACK_GAP = 152;
const METHOD_Y_OFFSET = 72;
const METHOD_NODE_GAP = 116;

function safeJson(value) {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string') return value;

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function getPathGroup(url) {
  if (!url || typeof url !== 'string') return '/';

  try {
    const parsed = new URL(url, 'http://local');
    const [firstSegment] = parsed.pathname.split('/').filter(Boolean);
    return firstSegment ? `/${firstSegment}` : '/';
  } catch {
    const [firstSegment] = url.split('?')[0].split('/').filter(Boolean);
    return firstSegment ? `/${firstSegment}` : '/';
  }
}

function buildGroupedLayout(data) {
  const newNodes = [];
  const newEdges = [];
  const targets = data.targets || [];
  const groupOrder = [];
  const groupSeen = new Set();

  targets.forEach(target => {
    (target.urls || []).forEach(urlObj => {
      const groupKey = getPathGroup(urlObj.url);
      if (!groupSeen.has(groupKey)) {
        groupSeen.add(groupKey);
        groupOrder.push(groupKey);
      }
    });
  });

  newNodes.push({
    id: 'root',
    type: 'input',
    data: { label: data.project?.name || 'Project', type: 'root' },
    position: { x: ROOT_X, y: ROOT_Y },
    sourcePosition: Position.Bottom,
    targetPosition: Position.Top,
    style: {
      background: '#fff',
      border: '2px solid #0f766e',
      borderRadius: 8,
      padding: 10,
      minWidth: 180,
      textAlign: 'center',
    },
  });

  groupOrder.forEach((groupKey, groupIndex) => {
    const urlX = URL_START_X + groupIndex * URL_GROUP_GAP;

    newNodes.push({
      id: `group-hint-${groupKey}`,
      data: { label: `Group ${groupKey}`, type: 'group-hint' },
      position: { x: urlX, y: ROOT_Y + 24 },
      draggable: false,
      selectable: false,
      style: {
        background: 'transparent',
        border: 'none',
        color: '#64748b',
        fontSize: 11,
        fontWeight: 600,
        padding: 0,
        width: 220,
      },
    });
  });

  targets.forEach((target, ti) => {
    const targetId = `target-${target.id}`;
    const targetY = TARGET_Y + ti * TARGET_VERTICAL_GAP;
    const targetX = ROOT_X;
    const perGroupCount = {};

    newNodes.push({
      id: targetId,
      data: { label: target.hostname, type: 'target' },
      position: { x: targetX, y: targetY },
      sourcePosition: Position.Right,
      targetPosition: Position.Top,
      style: {
        background: '#dbeafe',
        border: '2px solid #2563eb',
        borderRadius: 8,
        padding: 8,
        width: 220,
        textAlign: 'center',
      },
    });

    newEdges.push({
      id: `e-root-${targetId}`,
      source: 'root',
      target: targetId,
      type: 'smoothstep',
    });

    (target.urls || []).forEach((urlObj, ui) => {
      const groupKey = getPathGroup(urlObj.url);
      const groupIndex = groupOrder.indexOf(groupKey);
      const urlX = URL_START_X + groupIndex * URL_GROUP_GAP;
      const urlIndexInGroup = perGroupCount[groupKey] || 0;
      perGroupCount[groupKey] = urlIndexInGroup + 1;
      const urlId = `url-${target.id}-${ui}`;
      const urlY = targetY + URL_Y_OFFSET + urlIndexInGroup * URL_STACK_GAP;

      newNodes.push({
        id: urlId,
        data: { label: urlObj.url, type: 'url', groupKey },
        position: { x: urlX, y: urlY },
        sourcePosition: Position.Bottom,
        targetPosition: Position.Left,
        style: {
          background: '#ede9fe',
          border: '2px solid #6d28d9',
          borderRadius: 6,
          padding: 6,
          width: 260,
          fontSize: 12,
        },
      });

      newEdges.push({
        id: `e-${targetId}-${urlId}`,
        source: targetId,
        target: urlId,
        type: 'smoothstep',
      });

      (urlObj.endpoints || []).forEach((ep, ei) => {
        const epId = `ep-${ep.id}`;
        const endpointCount = urlObj.endpoints.length;
        const startX = urlX - ((endpointCount - 1) * METHOD_NODE_GAP) / 2;
        const epX = startX + ei * METHOD_NODE_GAP;
        const epY = urlY + METHOD_Y_OFFSET;
        const status = ep.statuses?.[0]?.status || 'untested';

        newNodes.push({
          id: epId,
          data: {
            label: ep.method,
            type: 'endpoint',
            status,
            method: ep.method,
            url: ep.url,
            request: {
              method: ep.method,
              url: ep.url,
              headers: safeJson(ep.request_headers ?? ep.headers ?? null),
              body: safeJson(ep.request_body ?? ep.body ?? null),
            },
            response: {
              statusCode: ep.response_status_code ?? null,
              headers: safeJson(ep.response_headers ?? null),
              body: safeJson(ep.response_body ?? null),
            },
          },
          position: { x: epX, y: epY },
          sourcePosition: Position.Bottom,
          targetPosition: Position.Top,
          style: {
            background: statusColors[status],
            border: '2px solid #fff',
            borderRadius: 20,
            padding: '4px 12px',
            color: '#fff',
            fontWeight: 'bold',
            fontSize: 11,
            width: 92,
            textAlign: 'center',
          },
        });

        newEdges.push({
          id: `e-${urlId}-${epId}`,
          source: urlId,
          target: epId,
          type: 'smoothstep',
        });
      });
    });
  });

  return { newNodes, newEdges };
}

export default function VisualMap({ projectId, onNodeClick }) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  useEffect(() => {
    if (!projectId) {
      setNodes([{
        id: 'root',
        data: { label: 'Select a project', type: 'root' },
        position: { x: ROOT_X, y: ROOT_Y },
        sourcePosition: Position.Bottom,
        targetPosition: Position.Top,
        style: {
          background: '#fff',
          border: '2px solid #0f766e',
          borderRadius: 8,
          padding: 10,
          minWidth: 180,
          textAlign: 'center',
        },
      }]);
      setEdges([]);
      return;
    }

    fetch(`/api/projects/${projectId}/visual-map`)
      .then(res => res.json())
      .then(data => {
        const { newNodes, newEdges } = buildGroupedLayout(data);
        setNodes(newNodes);
        setEdges(newEdges);
      });
  }, [projectId, setNodes, setEdges]);

  const handleNodeClick = useCallback((event, node) => {
    if (onNodeClick) onNodeClick(node);
  }, [onNodeClick]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeClick={handleNodeClick}
      fitView
    >
      <Background color="#e2e8f0" gap={20} />
      <Controls />
      <MiniMap />
    </ReactFlow>
  );
}
