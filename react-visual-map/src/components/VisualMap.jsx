import { useCallback, useEffect, useState } from 'react';
import { ReactFlow, Background, Controls, MiniMap, useNodesState, useEdgesState } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

const statusColors = {
  tested: '#22c55e',
  planned: '#eab308',
  recommended: '#f97316',
  finding: '#ef4444',
  untested: '#94a3b8',
};

export default function VisualMap({ projectId, onNodeClick }) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  useEffect(() => {
    if (!projectId) {
      setNodes([{ id: 'root', data: { label: 'Select a project' }, position: { x: 250, y: 0 } }]);
      setEdges([]);
      return;
    }

    fetch(`/api/projects/${projectId}/visual-map`)
      .then(res => res.json())
      .then(data => {
        const newNodes = [];
        const newEdges = [];
        let yOffset = 50;
        
        newNodes.push({
          id: 'root',
          type: 'input',
          data: { label: data.project?.name || 'Project' },
          position: { x: 400, y: 0 },
          style: { background: '#fff', border: '2px solid #0f766e', borderRadius: 8, padding: 10 },
        });

        (data.targets || []).forEach((target, ti) => {
          const targetId = `target-${target.id}`;
          const targetY = yOffset + (ti * 250);
          
          newNodes.push({
            id: targetId,
            data: { label: target.hostname, type: 'target' },
            position: { x: 400, y: targetY },
            style: { background: '#dbeafe', border: '2px solid #2563eb', borderRadius: 8, padding: 8, width: 180 },
          });

          newEdges.push({ id: `e-root-${targetId}`, source: 'root', target: targetId });

          (target.urls || []).forEach((urlObj, ui) => {
            const urlId = `url-${target.id}-${ui}`;
            const urlX = 650 + (ui * 250);
            
            newNodes.push({
              id: urlId,
              data: { label: urlObj.url, type: 'url' },
              position: { x: urlX, y: targetY },
              style: { background: '#ede9fe', border: '2px solid #6d28d9', borderRadius: 6, padding: 6, width: 200 },
            });

            newEdges.push({ id: `e-${targetId}-${urlId}`, source: targetId, target: urlId });

            (urlObj.endpoints || []).forEach((ep, ei) => {
              const epId = `ep-${ep.id}`;
              const epY = targetY + 60 + (ei * 50);
              const status = ep.statuses?.[0]?.status || 'untested';
              
              newNodes.push({
                id: epId,
                data: { label: `${ep.method}`, type: 'endpoint', status },
                position: { x: urlX + 20, y: epY },
                style: { 
                  background: statusColors[status], 
                  border: '2px solid #fff', 
                  borderRadius: 20, 
                  padding: '4px 12px',
                  color: '#fff',
                  fontWeight: 'bold',
                  fontSize: 11,
                },
              });

              newEdges.push({ id: `e-${urlId}-${epId}`, source: urlId, target: epId });
            });
          });

          yOffset += 350;
        });

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
