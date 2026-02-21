import { useState } from 'react';

export default function GhostMascot({
  x = 120,
  y = 120,
  activity = 'Idle',
  status = 'waiting',
  target = '',
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="ghost-mascot"
      style={{
        left: `${x}px`,
        top: `${y}px`,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className={`ghost-speech ${hovered ? 'visible' : ''}`}>
        <p className="ghost-speech-title">{activity || 'Idle'}</p>
        <p className="ghost-speech-meta">
          <span className={`ghost-status ${String(status || 'waiting').toLowerCase()}`}>
            {status || 'waiting'}
          </span>
          {target ? <span className="ghost-target">{target}</span> : null}
        </p>
      </div>
      <span className="ghost-icon" role="img" aria-label="Ghost mascot">
        👻
      </span>
    </div>
  );
}
