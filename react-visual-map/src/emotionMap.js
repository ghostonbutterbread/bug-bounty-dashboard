export const DEFAULT_EMOTION_IMAGE = 'default_ghost_transparent.png';

export const EMOTION_MAP = {
  working: 'working_ghost_transparent.png',
  scanning: 'Ghost_Testing_Endpoint_transparent.png',
  researching: 'Ghost_Reading_Documentation_transparent.png',
  exploiting: 'Ghost_Writing_Exploit_transparent.png',
  finding: 'Ghost_found_vulnerability_transparent.png',
  celebrating: 'celebratory_ghost_transparent.png',
  idle: 'deepthinking_ghost_transparent.png',
  resting: 'Ghost_taking_break_transparent.png',
  default: DEFAULT_EMOTION_IMAGE,
};

export function getEmotionImageName(activity, status) {
  const keys = [activity, status]
    .map((value) => String(value || '').trim().toLowerCase())
    .filter(Boolean);

  for (const key of keys) {
    if (EMOTION_MAP[key]) {
      return EMOTION_MAP[key];
    }
  }

  return DEFAULT_EMOTION_IMAGE;
}
