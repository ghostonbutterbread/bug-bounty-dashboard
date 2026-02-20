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
const TARGET_BRANCH_GAP = 420;
const URL_VERTICAL_GAP = 150;
const ENDPOINT_VERTICAL_GAP = 72;

function buildVerticalTreeLayout(data) {
  const newNodes = [];
  const newEdges = [];
  const targets = data.targets || [];
  const targetCenterIndex = (targets.length - 1) / 2;

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
    const targetId = `target-${target.id}`;
    const branchX = ROOT_X + (ti - targetCenterIndex) * TARGET_BRANCH_GAP;
    const targetY = TARGET_Y;

    newNodes.push({
      id: targetId,
      data: { label: target.hostname, type: 'target' },
      position: { x: branchX, y: targetY },
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
      id: `e-root-${targetId}`,
      source: 'root',
      target: targetId,
      type: 'smoothstep',
    });

    (target.urls || []).forEach((urlObj, ui) => {
      const urlId = `url-${target.id}-${ui}`;
      const urlY = targetY + URL_VERTICAL_GAP * (ui + 1);

      newNodes.push({
        id: urlId,
        data: { label: urlObj.url, type: 'url' },
        position: { x: branchX, y: urlY },
        sourcePosition: Position.Bottom,
        targetPosition: Position.Top,
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
        const epY = urlY + ENDPOINT_VERTICAL_GAP * (ei + 1);
        const status = ep.statuses?.[0]?.status || 'untested';

        newNodes.push({
          id: epId,
          data: { label: ep.method, type: 'endpoint', status },
          position: { x: branchX, y: epY },
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
            width: 120,
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
        const { newNodes, newEdges } = buildVerticalTreeLayout(data);
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
