import { useState, useEffect, useMemo } from 'react';
import { Panel, Group, Separator } from 'react-resizable-panels';
import VisualMap from './components/VisualMap';
import GhostMascot from './components/GhostMascot';
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

function getProjectIdFromSearch() {
  return new URLSearchParams(window.location.search).get('project') || '';
}

function getGhostSpeech(node) {
  const type = node?.data?.type;

  if (type === 'root') return 'Analyzing attack surface...';
  if (type === 'target') return `Found subdomain: ${node?.data?.label || 'unknown'}`;
  if (type === 'url') return `Discovered endpoint: ${node?.data?.label || '/'}`;
  if (type === 'endpoint') {
    const method = node?.data?.method || node?.data?.label || 'request';
    const url = node?.data?.url || '/';
    return `Testing ${method} on ${url}`;
  }

  return '';
}

function matchSearch(endpoint, query) {
  if (!query) return true;

  const url = String(endpoint?.url || '').toLowerCase();
  const method = String(endpoint?.method || '').toLowerCase();
  return url.includes(query) || method.includes(query);
}

function filterMapData(rawData, { searchQuery, targetFilter, methodFilter }) {
  if (!rawData) return null;

  const normalizedSearch = searchQuery.trim().toLowerCase();
  const filteredTargets = (rawData.targets || [])
    .filter((target) => !targetFilter || String(target.id) === String(targetFilter))
    .map((target) => {
      const filteredUrls = (target.urls || [])
        .map((urlObj) => {
          const filteredEndpoints = (urlObj.endpoints || []).filter((endpoint) => {
            if (methodFilter !== 'ALL' && String(endpoint.method || '').toUpperCase() !== methodFilter) {
              return false;
            }

            return matchSearch(endpoint, normalizedSearch);
          });

          return {
            ...urlObj,
            endpoints: filteredEndpoints,
          };
        })
        .filter((urlObj) => urlObj.endpoints.length > 0);

      return {
        ...target,
        urls: filteredUrls,
      };
    })
    .filter((target) => target.urls.length > 0);

  let urlsCount = 0;
  let endpointsCount = 0;
  let findingsCount = 0;

  filteredTargets.forEach((target) => {
    urlsCount += target.urls.length;
    target.urls.forEach((urlObj) => {
      endpointsCount += urlObj.endpoints.length;
      urlObj.endpoints.forEach((endpoint) => {
        findingsCount += (endpoint.findings || []).length;
      });
    });
  });

  return {
    ...rawData,
    targets: filteredTargets,
    stats: {
      targets: filteredTargets.length,
      urls: urlsCount,
      endpoints: endpointsCount,
      findings: findingsCount,
    },
  };
}

export default function App() {
  const [selectedProject, setSelectedProject] = useState(() => getProjectIdFromSearch());
  const [selectedNode, setSelectedNode] = useState(null);
  const [stats, setStats] = useState({ targets: 0, urls: 0, endpoints: 0, findings: 0 });
  const [mapData, setMapData] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [targetFilter, setTargetFilter] = useState('');
  const [methodFilter, setMethodFilter] = useState('ALL');
  const [ghostPosition, setGhostPosition] = useState({ x: 120, y: 120 });
  const [ghostSpeech, setGhostSpeech] = useState('');
  const [showGhostSpeech, setShowGhostSpeech] = useState(false);

  useEffect(() => {
    if (selectedProject) return;
    fetch('/api/projects')
      .then(res => res.json())
      .then(data => {
        if (data.length) setSelectedProject(String(data[0].id));
      });
  }, [selectedProject]);

  useEffect(() => {
    if (!selectedProject) {
      setMapData(null);
      setStats({ targets: 0, urls: 0, endpoints: 0, findings: 0 });
      setTargetFilter('');
      setMethodFilter('ALL');
      setSelectedNode(null);
      return;
    }

    const controller = new AbortController();

    fetch(`/api/projects/${selectedProject}/visual-map`, { signal: controller.signal })
      .then(res => res.json())
      .then((data) => {
        setMapData(data);
        setTargetFilter('');
        setMethodFilter('ALL');
        setSelectedNode(null);
      })
      .catch((error) => {
        if (error.name !== 'AbortError') {
          console.error('Failed to fetch visual map:', error);
          setMapData(null);
        }
      });

    return () => {
      controller.abort();
    };
  }, [selectedProject]);

  const targetOptions = useMemo(() => {
    if (!mapData) return [];
    return (mapData.targets || []).map((target) => ({
      id: target.id,
      hostname: target.hostname || `Target ${target.id}`,
    }));
  }, [mapData]);

  const methodOptions = useMemo(() => {
    if (!mapData) return [];
    const methods = new Set();
    (mapData.targets || []).forEach((target) => {
      (target.urls || []).forEach((urlObj) => {
        (urlObj.endpoints || []).forEach((endpoint) => {
          if (endpoint?.method) methods.add(String(endpoint.method).toUpperCase());
        });
      });
    });
    return [...methods].sort();
  }, [mapData]);

  const filteredMapData = useMemo(
    () => filterMapData(mapData, { searchQuery, targetFilter, methodFilter }),
    [mapData, searchQuery, targetFilter, methodFilter],
  );

  useEffect(() => {
    setSelectedNode(null);
  }, [searchQuery, targetFilter, methodFilter]);

  useEffect(() => {
    setStats(filteredMapData?.stats || { targets: 0, urls: 0, endpoints: 0, findings: 0 });
  }, [filteredMapData]);

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

  const handleNodeClick = (node) => {
    setSelectedNode(node);
    setGhostSpeech(getGhostSpeech(node));
    setShowGhostSpeech(true);
  };

  const handleNodeMouseEnter = (node) => {
    setGhostSpeech(getGhostSpeech(node));
    setShowGhostSpeech(true);
  };

  const handleNodeMouseLeave = () => {
    setShowGhostSpeech(false);
  };

  const handleMapMouseMove = (position) => {
    setGhostPosition(position);
  };

  return (
    <div className="app">
      <header className="header-bar">
        <div className="header-controls">
          <div className="field-block">
            <label htmlFor="visual-search">Search</label>
            <input
              id="visual-search"
              type="search"
              placeholder="Filter by URL or method..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </div>
          <div className="field-block">
            <label htmlFor="visual-target-filter">Subdomain</label>
            <select
              id="visual-target-filter"
              value={targetFilter}
              onChange={(event) => setTargetFilter(event.target.value)}
            >
              <option value="">All subdomains</option>
              {targetOptions.map((target) => (
                <option key={target.id} value={String(target.id)}>
                  {target.hostname}
                </option>
              ))}
            </select>
          </div>
          <div className="field-block">
            <label htmlFor="visual-method-filter">Method</label>
            <select
              id="visual-method-filter"
              value={methodFilter}
              onChange={(event) => setMethodFilter(event.target.value)}
            >
              <option value="ALL">All methods</option>
              {methodOptions.map((method) => (
                <option key={method} value={method}>
                  {method}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="kpi-strip">
          <div className="kpi-item"><span>Targets</span><strong>{stats.targets}</strong></div>
          <div className="kpi-item"><span>URLs</span><strong>{stats.urls}</strong></div>
          <div className="kpi-item"><span>Endpoints</span><strong>{stats.endpoints}</strong></div>
          <div className="kpi-item"><span>Findings</span><strong>{stats.findings}</strong></div>
        </div>
      </header>

      <Group className="main-panels" direction="horizontal">
        <Panel defaultSize={68} minSize={15}>
          <div className="visual-map-container">
            <VisualMap
              projectId={selectedProject}
              data={filteredMapData}
              onNodeClick={handleNodeClick}
              onNodeMouseEnter={handleNodeMouseEnter}
              onNodeMouseLeave={handleNodeMouseLeave}
              onMapMouseMove={handleMapMouseMove}
            />
            <GhostMascot
              x={ghostPosition.x}
              y={ghostPosition.y}
              speech={ghostSpeech}
              showSpeech={showGhostSpeech}
            />
          </div>
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
