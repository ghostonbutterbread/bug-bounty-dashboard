import { useState, useEffect } from 'react';
import { Panel, Group, Separator } from 'react-resizable-panels';
import VisualMap from './components/VisualMap';
import '@xyflow/react/dist/style.css';
import './App.css';

const STATUS_LABELS = {
  tested: '✅ Tested',
  planned: '📋 Planned',
  recommended: '🚀 Recommended',
  finding: '🔴 Finding',
  untested: '⬜ Untested',
};

export default function App() {
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [selectedNode, setSelectedNode] = useState(null);
  const [stats, setStats] = useState({ targets: 0, urls: 0, endpoints: 0, findings: 0 });

  useEffect(() => {
    fetch('/api/projects')
      .then(res => res.json())
      .then(data => {
        setProjects(data);
        if (data.length) setSelectedProject(String(data[0].id));
      });
  }, []);

  useEffect(() => {
    if (!selectedProject) return;
    fetch(`/api/projects/${selectedProject}/visual-map`)
      .then(res => res.json())
      .then(data => setStats(data.stats || { targets: 0, urls: 0, endpoints: 0, findings: 0 }));
  }, [selectedProject]);

  const endpointRequest = selectedNode?.data?.request;
  const endpointResponse = selectedNode?.data?.response;
  const isEndpoint = selectedNode?.data?.type === 'endpoint';

  const currentProject = projects.find(p => String(p.id) === String(selectedProject));

  return (
    <div className="app">
      <header className="header-bar">
        <h2 className="header-title">Attack Surface</h2>
        <div className="kpi-strip">
          <div className="kpi-item"><span>Targets</span><strong>{stats.targets}</strong></div>
          <div className="kpi-item"><span>URLs</span><strong>{stats.urls}</strong></div>
          <div className="kpi-item"><span>Endpoints</span><strong>{stats.endpoints}</strong></div>
          <div className="kpi-item"><span>Findings</span><strong>{stats.findings}</strong></div>
        </div>
      </header>

      <Group direction="horizontal">
        <Panel defaultSize={30} minSize={20} maxSize={60}>
          <div className="detail-panel">
            <h3>{selectedNode?.data?.label || 'Select a node'}</h3>
            {selectedNode && (
              <>
                <p className="node-type">Type: {selectedNode.data?.type || 'unknown'}</p>
                {isEndpoint && (
                  <>
                    <h4>Status</h4>
                    <span className="status-badge">
                      {STATUS_LABELS[selectedNode.data?.status] || 'Untested'}
                    </span>

                    <h4>Request</h4>
                    <div className="detail-block">
                      <p><strong>Method:</strong> {endpointRequest?.method || 'No request data recorded'}</p>
                      <p><strong>URL:</strong> {endpointRequest?.url || 'No request data recorded'}</p>
                      <p><strong>Headers:</strong></p>
                      <pre>{endpointRequest?.headers || 'No request data recorded'}</pre>
                      <p><strong>Body:</strong></p>
                      <pre>{endpointRequest?.body || 'No request data recorded'}</pre>
                    </div>

                    <h4>Response</h4>
                    <div className="detail-block">
                      <p><strong>Status code:</strong> {endpointResponse?.statusCode ?? 'No request data recorded'}</p>
                      <p><strong>Headers:</strong></p>
                      <pre>{endpointResponse?.headers || 'No request data recorded'}</pre>
                      <p><strong>Body:</strong></p>
                      <pre>{endpointResponse?.body || 'No request data recorded'}</pre>
                    </div>
                  </>
                )}
              </>
            )}
            {!selectedNode && <p className="hint">Click a node to see details</p>}
          </div>
        </Panel>
        
        <Separator />
        
        <Panel defaultSize={70} minSize={30}>
          <VisualMap projectId={selectedProject} onNodeClick={setSelectedNode} />
        </Panel>
      </Group>
    </div>
  );
}
