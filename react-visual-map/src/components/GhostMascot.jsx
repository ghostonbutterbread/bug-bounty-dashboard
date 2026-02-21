export default function GhostMascot({ x = 120, y = 120, speech = '', showSpeech = false }) {
  return (
    <div
      className="ghost-mascot"
      style={{
        left: `${x}px`,
        top: `${y}px`,
      }}
    >
      <div className={`ghost-speech ${showSpeech ? 'visible' : ''}`}>{speech}</div>
      <span className="ghost-icon" role="img" aria-label="Ghost mascot">
        👻
      </span>
    </div>
  );
}
