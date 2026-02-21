import { useEffect, useState } from 'react';
import { DEFAULT_EMOTION_IMAGE, getEmotionImageName } from '../emotionMap';
import angryGhost from '../assets/emotions/angry_ghost_transparent.png';
import breadGhost from '../assets/emotions/bread_transparent.png';
import celebratoryGhost from '../assets/emotions/celebratory_ghost_transparent.png';
import deepthinkingGhost from '../assets/emotions/deepthinking_ghost_transparent.png';
import defaultGhost from '../assets/emotions/default_ghost_transparent.png';
import findingGhost from '../assets/emotions/Ghost_found_vulnerability_transparent.png';
import researchingGhost from '../assets/emotions/Ghost_Reading_Documentation_transparent.png';
import restingGhost from '../assets/emotions/Ghost_taking_break_transparent.png';
import scanningGhost from '../assets/emotions/Ghost_Testing_Endpoint_transparent.png';
import exploitingGhost from '../assets/emotions/Ghost_Writing_Exploit_transparent.png';
import happyGhost from '../assets/emotions/happy_ghost_transparent.png';
import nervousGhost from '../assets/emotions/nervous_ghost_transparent.png';
import questioningGhost from '../assets/emotions/questioning_ghost_transparent.png';
import sadGhost from '../assets/emotions/sad_ghost_transparent.png';
import sleepyGhost from '../assets/emotions/sleepy_ghost_transparent.png';
import workingGhost from '../assets/emotions/working_ghost_transparent.png';

const EMOTION_IMAGES = {
  'angry_ghost_transparent.png': angryGhost,
  'bread_transparent.png': breadGhost,
  'celebratory_ghost_transparent.png': celebratoryGhost,
  'deepthinking_ghost_transparent.png': deepthinkingGhost,
  'default_ghost_transparent.png': defaultGhost,
  'Ghost_found_vulnerability_transparent.png': findingGhost,
  'Ghost_Reading_Documentation_transparent.png': researchingGhost,
  'Ghost_taking_break_transparent.png': restingGhost,
  'Ghost_Testing_Endpoint_transparent.png': scanningGhost,
  'Ghost_Writing_Exploit_transparent.png': exploitingGhost,
  'happy_ghost_transparent.png': happyGhost,
  'nervous_ghost_transparent.png': nervousGhost,
  'questioning_ghost_transparent.png': questioningGhost,
  'sad_ghost_transparent.png': sadGhost,
  'sleepy_ghost_transparent.png': sleepyGhost,
  'working_ghost_transparent.png': workingGhost,
};

export default function GhostMascot({
  x = 120,
  y = 120,
  activity = 'Idle',
  status = 'waiting',
  target = '',
}) {
  const [hovered, setHovered] = useState(false);
  const [imageLoadFailed, setImageLoadFailed] = useState(false);

  const emotionImageName = getEmotionImageName(activity, status);
  const fallbackImage = EMOTION_IMAGES[DEFAULT_EMOTION_IMAGE];
  const mappedImage = EMOTION_IMAGES[emotionImageName];
  const imageSrc = !imageLoadFailed && mappedImage ? mappedImage : fallbackImage;

  useEffect(() => {
    setImageLoadFailed(false);
  }, [emotionImageName]);

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
      <img
        className="ghost-icon"
        src={imageSrc}
        alt="Ghost mascot"
        onError={() => setImageLoadFailed(true)}
      />
    </div>
  );
}
