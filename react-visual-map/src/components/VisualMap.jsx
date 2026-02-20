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

const ROOT_X = 0;
const ROOT_Y = 20;
const SUBDOMAIN_Y = 170;
const SUBDOMAIN_GAP = 340;
const ENDPOINT_Y_OFFSET = 120;
const ENDPOINT_VERTICAL_GAP = 190;
const METHOD_Y_OFFSET = 88;
const METHOD_HORIZONTAL_GAP = 120;

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

function getEndpointPath(url) {
  if (!url || typeof url !== 'string') return '/';

  try {
    const parsed = new URL(url, 'http://local');
    return `${parsed.pathname || '/'}${parsed.search || ''}`;
  } catch {
    const cleanUrl = url.split('#')[0].trim();
    if (!cleanUrl) return '/';
    if (cleanUrl.startsWith('/')) return cleanUrl;

    const [pathPart = '/'] = cleanUrl.split('?');
    return pathPart || '/';
  }
}

function buildGroupedLayout(data) {
  const newNodes = [];
  const newEdges = [];
  const targets = data.targets || [];
  const totalSubdomainWidth = Math.max(0, (targets.length - 1) * SUBDOMAIN_GAP);

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

  targets.forEach((target, ti) => {
    const subdomainId = `target-${target.id}`;
    const subdomainX = ROOT_X - totalSubdomainWidth / 2 + ti * SUBDOMAIN_GAP;
    const subdomainY = SUBDOMAIN_Y;
    const endpointMap = new Map();

    (target.urls || []).forEach(urlObj => {
      const fallbackPath = getPathGroup(urlObj.url);
      (urlObj.endpoints || []).forEach(ep => {
        const endpointPath = getEndpointPath(ep.url || urlObj.url || fallbackPath);
        if (!endpointMap.has(endpointPath)) {
          endpointMap.set(endpointPath, []);
        }
        endpointMap.get(endpointPath).push(ep);
      });
    });

    newNodes.push({
      id: subdomainId,
      data: { label: target.hostname, type: 'target' },
      position: { x: subdomainX, y: subdomainY },
      sourcePosition: Position.Bottom,
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
      id: `e-root-${subdomainId}`,
      source: 'root',
      target: subdomainId,
      type: 'smoothstep',
    });

    Array.from(endpointMap.entries()).forEach(([endpointPath, methods], endpointIndex) => {
      const endpointId = `route-${target.id}-${endpointIndex}`;
      const endpointX = subdomainX;
      const endpointY = subdomainY + ENDPOINT_Y_OFFSET + endpointIndex * ENDPOINT_VERTICAL_GAP;

      newNodes.push({
        id: endpointId,
        data: { label: endpointPath, type: 'url' },
        position: { x: endpointX, y: endpointY },
        sourcePosition: Position.Bottom,
        targetPosition: Position.Top,
        style: {
          background: '#e0f2fe',
          border: '2px solid #0284c7',
          borderRadius: 6,
          padding: 8,
          width: 260,
          fontSize: 12,
          textAlign: 'center',
        },
      });

      newEdges.push({
        id: `e-${subdomainId}-${endpointId}`,
        source: subdomainId,
        target: endpointId,
        type: 'smoothstep',
      });

      const methodStartX = endpointX - ((methods.length - 1) * METHOD_HORIZONTAL_GAP) / 2;
      methods.forEach((ep, methodIndex) => {
        const methodNodeId = `method-${target.id}-${endpointIndex}-${ep.id || methodIndex}`;
        const methodX = methodStartX + methodIndex * METHOD_HORIZONTAL_GAP;
        const methodY = endpointY + METHOD_Y_OFFSET;
        const status = ep.statuses?.[0]?.status || 'untested';

        newNodes.push({
          id: methodNodeId,
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
          position: { x: methodX, y: methodY },
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
          id: `e-${endpointId}-${methodNodeId}`,
          source: endpointId,
          target: methodNodeId,
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
