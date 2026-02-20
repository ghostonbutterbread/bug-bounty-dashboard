import { useState, useEffect } from 'react';
import { Panel, Group, Separator } from 'react-resizable-panels';
import VisualMap from './components/VisualMap';
import '@xyflow/react/dist/style.css';
import './App.css';

const STATUS_META = {
  tested: { label: '✅ Tested', kind: 'tested' },
  planned: { label: '📋 Planned', kind: 'planned' },
  recommended: { label: '🚀 Recommended', kind: 'recommended' },
  finding: { label: '🔴 Finding', kind: 'finding' },
  untested: { label: '⬜ Untested', kind: 'untested' },
};

function formatDate(value) {
  if (!value) return 'Unknown time';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
}

function uniq(values) {
  return [...new Set(values.filter(Boolean))];
}

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
  const endpointNotes = selectedNode?.data?.endpointNotes;
  const endpointStatuses = selectedNode?.data?.statuses || [];
  const endpointFindings = selectedNode?.data?.findings || [];
  const isEndpoint = selectedNode?.data?.type === 'endpoint';
  const testedTypes = uniq(
    endpointStatuses
      .filter(status => status.status === 'tested' || status.status === 'finding')
      .map(status => status.test_type),
  );
  const plannedTypes = uniq(
    endpointStatuses
      .filter(status => status.status === 'planned')
      .map(status => status.test_type),
  );
  const recommendedTypes = uniq(
    endpointStatuses
      .filter(status => status.status === 'recommended')
      .map(status => status.test_type),
  );

  return (
    <div className="app">
      <header className="header-bar">
        <div className="kpi-strip">
          <div className="kpi-item"><span>Targets</span><strong>{stats.targets}</strong></div>
          <div className="kpi-item"><span>URLs</span><strong>{stats.urls}</strong></div>
          <div className="kpi-item"><span>Endpoints</span><strong>{stats.endpoints}</strong></div>
          <div className="kpi-item"><span>Findings</span><strong>{stats.findings}</strong></div>
        </div>
      </header>

      <Group className="main-panels" direction="horizontal">
        <Panel defaultSize={68} minSize={15}>
          <VisualMap projectId={selectedProject} onNodeClick={setSelectedNode} />
        </Panel>

        <Separator />

        <Panel defaultSize={32} minSize={15}>
          <div className="detail-panel">
            <h3>{selectedNode?.data?.label || 'Select a node'}</h3>
            {selectedNode && (
              <>
                <p className="node-type">Type: {selectedNode.data?.type || 'unknown'}</p>
                {isEndpoint && (
                  <>
                    <h4>Status</h4>
                    <span className={`status-badge ${STATUS_META[selectedNode.data?.status]?.kind || 'untested'}`}>
                      {STATUS_META[selectedNode.data?.status]?.label || '⬜ Untested'}
                    </span>

                    <h4>Testing Coverage</h4>
                    <div className="detail-block">
                      <p><strong>Tested:</strong> {testedTypes.length ? testedTypes.join(', ') : 'No completed tests recorded'}</p>
                      <p><strong>Planned:</strong> {plannedTypes.length ? plannedTypes.join(', ') : 'No planned tests recorded'}</p>
                      <p><strong>Recommended:</strong> {recommendedTypes.length ? recommendedTypes.join(', ') : 'No recommendations recorded'}</p>
                    </div>

                    <h4>Findings</h4>
                    <div className="detail-block">
                      {endpointFindings.length > 0 ? (
                        <ul className="detail-list">
                          {endpointFindings.map((finding) => (
                            <li key={finding.id}>
                              <p>
                                <strong>{finding.title || 'Untitled finding'}</strong>
                                {' '}
                                ({finding.severity || 'unknown severity'}, {finding.status || 'unknown status'})
                              </p>
                              <p>{finding.description || 'No description provided'}</p>
                              <p><strong>Updated:</strong> {formatDate(finding.updated_at || finding.created_at)}</p>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p>No vulnerabilities discovered for this endpoint yet.</p>
                      )}
                    </div>

                    <h4>Endpoint Logic / Notes</h4>
                    <div className="detail-block">
                      <pre>{endpointNotes || 'No endpoint logic or notes recorded.'}</pre>
                    </div>

                    <h4>Status History</h4>
                    <div className="detail-block">
                      {endpointStatuses.length > 0 ? (
                        <ul className="detail-list">
                          {endpointStatuses.map((status) => (
                            <li key={status.id}>
                              <p>
                                <span className={`status-pill ${STATUS_META[status.status]?.kind || 'untested'}`}>
                                  {STATUS_META[status.status]?.label || status.status || 'unknown'}
                                </span>
                                {status.test_type ? ` ${status.test_type}` : ' general'}
                              </p>
                              <p>{status.notes || 'No notes for this status update.'}</p>
                              <p><strong>Updated:</strong> {formatDate(status.updated_at || status.created_at)}</p>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p>No status updates recorded.</p>
                      )}
                    </div>

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
      </Group>
    </div>
  );
}
