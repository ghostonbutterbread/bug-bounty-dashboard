import { useEffect, useMemo, useState } from 'react';
import VisualMap from './components/VisualMap';
import GhostMascot from './components/GhostMascot';
import '@xyflow/react/dist/style.css';
import './App.css';

const STATUS_META = {
  tested: { label: 'Tested', kind: 'tested' },
  planned: { label: 'Planned', kind: 'planned' },
  recommended: { label: 'Recommended', kind: 'recommended' },
  finding: { label: 'Finding', kind: 'finding' },
  untested: { label: 'Untested', kind: 'untested' },
};

const EMPTY_STATS = { targets: 0, urls: 0, endpoints: 0, findings: 0 };

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

function matchSearch(endpoint, query) {
  if (!query) return true;
  const normalized = query.toLowerCase();
  const url = String(endpoint?.url || '').toLowerCase();
  const method = String(endpoint?.method || '').toLowerCase();
  const statuses = (endpoint?.statuses || [])
    .map((status) => `${status.status || ''} ${status.test_type || ''}`.trim().toLowerCase())
    .join(' ');

  return url.includes(normalized) || method.includes(normalized) || statuses.includes(normalized);
}

function endpointCurrentStatus(endpoint) {
  return endpoint?.statuses?.[0]?.status || 'untested';
}

function filterMapData(rawData, { searchQuery, targetFilter, methodFilter, statusFilter }) {
  if (!rawData) return null;

  const filteredTargets = (rawData.targets || [])
    .filter((target) => !targetFilter || String(target.id) === String(targetFilter))
    .map((target) => {
      const filteredUrls = (target.urls || [])
        .map((urlObj) => {
          const filteredEndpoints = (urlObj.endpoints || []).filter((endpoint) => {
            if (methodFilter !== 'ALL' && String(endpoint.method || '').toUpperCase() !== methodFilter) {
              return false;
            }
            if (statusFilter !== 'ALL' && endpointCurrentStatus(endpoint) !== statusFilter) {
              return false;
            }
            return matchSearch(endpoint, searchQuery.trim());
          });

          return { ...urlObj, endpoints: filteredEndpoints };
        })
        .filter((urlObj) => urlObj.endpoints.length > 0);

      return { ...target, urls: filteredUrls };
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

function EndpointModal({ endpointNode, onClose }) {
  if (!endpointNode) return null;

  const endpointRequest = endpointNode.data?.request;
  const endpointResponse = endpointNode.data?.response;
  const endpointNotes = endpointNode.data?.endpointNotes;
  const endpointStatuses = endpointNode.data?.statuses || [];
  const endpointFindings = endpointNode.data?.findings || [];

  const testedTypes = uniq(
    endpointStatuses
      .filter((status) => status.status === 'tested' || status.status === 'finding')
      .map((status) => status.test_type),
  );
  const plannedTypes = uniq(
    endpointStatuses.filter((status) => status.status === 'planned').map((status) => status.test_type),
  );
  const recommendedTypes = uniq(
    endpointStatuses
      .filter((status) => status.status === 'recommended')
      .map((status) => status.test_type),
  );

  return (
    <div className="endpoint-modal-overlay" onClick={onClose}>
      <section className="endpoint-modal" onClick={(event) => event.stopPropagation()}>
        <button className="endpoint-close" type="button" onClick={onClose} aria-label="Close endpoint details">
          ×
        </button>

        <h3>{endpointNode.data?.url || endpointNode.data?.label}</h3>
        <p className="node-type">Endpoint method node</p>

        <div className="modal-grid">
          <div className="detail-block">
            <p><strong>URL:</strong> {endpointNode.data?.url || 'N/A'}</p>
            <p><strong>Method:</strong> {endpointNode.data?.method || endpointNode.data?.label || 'N/A'}</p>
            <p>
              <strong>Status:</strong>{' '}
              <span className={`status-pill ${STATUS_META[endpointNode.data?.status]?.kind || 'untested'}`}>
                {STATUS_META[endpointNode.data?.status]?.label || 'Untested'}
              </span>
            </p>
          </div>

          <div className="detail-block">
            <p><strong>Testing Coverage</strong></p>
            <p><strong>Tested:</strong> {testedTypes.length ? testedTypes.join(', ') : 'No completed tests recorded'}</p>
            <p><strong>Planned:</strong> {plannedTypes.length ? plannedTypes.join(', ') : 'No planned tests recorded'}</p>
            <p><strong>Recommended:</strong> {recommendedTypes.length ? recommendedTypes.join(', ') : 'No recommendations recorded'}</p>
          </div>
        </div>

        <h4>Findings</h4>
        <div className="detail-block">
          {endpointFindings.length > 0 ? (
            <ul className="detail-list">
              {endpointFindings.map((finding) => (
                <li key={finding.id}>
                  <p>
                    <strong>{finding.title || 'Untitled finding'}</strong>{' '}
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

        <h4>Notes</h4>
        <div className="detail-block">
          <pre>{endpointNotes || 'No endpoint logic or notes recorded.'}</pre>
        </div>

        <h4>History</h4>
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
          <p><strong>Status code:</strong> {endpointResponse?.statusCode ?? 'No response data recorded'}</p>
          <p><strong>Headers:</strong></p>
          <pre>{endpointResponse?.headers || 'No response data recorded'}</pre>
          <p><strong>Body:</strong></p>
          <pre>{endpointResponse?.body || 'No response data recorded'}</pre>
        </div>
      </section>
    </div>
  );
}

export default function App() {
  const [selectedProject, setSelectedProject] = useState(() => getProjectIdFromSearch());
  const [stats, setStats] = useState(EMPTY_STATS);
  const [mapData, setMapData] = useState(null);
  const [selectedEndpointNode, setSelectedEndpointNode] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [targetFilter, setTargetFilter] = useState('');
  const [methodFilter, setMethodFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [ghostPosition, setGhostPosition] = useState({ x: 120, y: 120 });
  const [ghostActivity, setGhostActivity] = useState({
    activity: 'Idle',
    target: '',
    status: 'waiting',
  });

  useEffect(() => {
    if (selectedProject) return;
    fetch('/api/projects')
      .then((res) => res.json())
      .then((data) => {
        if (data.length) setSelectedProject(String(data[0].id));
      });
  }, [selectedProject]);

  useEffect(() => {
    if (!selectedProject) {
      setMapData(null);
      setStats(EMPTY_STATS);
      setTargetFilter('');
      setMethodFilter('ALL');
      setStatusFilter('ALL');
      setSelectedEndpointNode(null);
      return;
    }

    const controller = new AbortController();
    fetch(`/api/projects/${selectedProject}/visual-map`, { signal: controller.signal })
      .then((res) => res.json())
      .then((data) => {
        setMapData(data);
        setTargetFilter('');
        setMethodFilter('ALL');
        setStatusFilter('ALL');
        setSelectedEndpointNode(null);
      })
      .catch((error) => {
        if (error.name !== 'AbortError') {
          console.error('Failed to fetch visual map:', error);
          setMapData(null);
        }
      });

    return () => controller.abort();
  }, [selectedProject]);

  useEffect(() => {
    let active = true;

    const syncGhostActivity = () => {
      fetch('/api/ghost-activity')
        .then((res) => res.json())
        .then((payload) => {
          if (!active) return;
          setGhostActivity({
            activity: String(payload.activity || 'Idle'),
            target: String(payload.target || ''),
            status: String(payload.status || 'waiting'),
          });
        })
        .catch((error) => {
          console.error('Failed to load ghost activity:', error);
        });
    };

    syncGhostActivity();
    const timer = window.setInterval(syncGhostActivity, 2000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

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
    () => filterMapData(mapData, { searchQuery, targetFilter, methodFilter, statusFilter }),
    [mapData, searchQuery, targetFilter, methodFilter, statusFilter],
  );

  useEffect(() => {
    setSelectedEndpointNode(null);
  }, [searchQuery, targetFilter, methodFilter, statusFilter]);

  useEffect(() => {
    setStats(filteredMapData?.stats || EMPTY_STATS);
  }, [filteredMapData]);

  const handleNodeClick = (node) => {
    if (node?.data?.type === 'endpoint') {
      setSelectedEndpointNode(node);
    }
  };

  return (
    <div className="app">
      <header className="header-bar">
        <div className="toolbar-row">
          <div className="kpi-strip">
            <button type="button" className="kpi-item"><span>Targets</span><strong>{stats.targets}</strong></button>
            <button type="button" className="kpi-item"><span>URLs</span><strong>{stats.urls}</strong></button>
            <button type="button" className="kpi-item"><span>Endpoints</span><strong>{stats.endpoints}</strong></button>
            <button type="button" className="kpi-item"><span>Findings</span><strong>{stats.findings}</strong></button>
          </div>

          <div className="inline-filters">
            <input
              id="visual-search"
              type="search"
              placeholder="Search URL, method, status"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />

            <select
              id="visual-target-filter"
              value={targetFilter}
              onChange={(event) => setTargetFilter(event.target.value)}
            >
              <option value="">All targets</option>
              {targetOptions.map((target) => (
                <option key={target.id} value={String(target.id)}>
                  {target.hostname}
                </option>
              ))}
            </select>

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

            <select
              id="visual-status-filter"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="ALL">All statuses</option>
              <option value="tested">Tested</option>
              <option value="planned">Planned</option>
              <option value="recommended">Recommended</option>
              <option value="finding">Finding</option>
              <option value="untested">Untested</option>
            </select>
          </div>
        </div>
      </header>

      <main className="map-stage">
        <div className="visual-map-container">
          <VisualMap
            projectId={selectedProject}
            data={filteredMapData}
            onNodeClick={handleNodeClick}
            ghostTarget={ghostActivity.target}
            onGhostTargetPosition={setGhostPosition}
          />
          <GhostMascot
            x={ghostPosition.x}
            y={ghostPosition.y}
            activity={ghostActivity.activity}
            target={ghostActivity.target}
            status={ghostActivity.status}
          />
        </div>
      </main>

      <EndpointModal endpointNode={selectedEndpointNode} onClose={() => setSelectedEndpointNode(null)} />
    </div>
  );
}
