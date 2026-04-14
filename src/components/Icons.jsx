import React from 'react';

export const Icons = {
  book: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
    </svg>
  ),
  stake: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <line x1="12" y1="6" x2="12" y2="22"/>
      <rect x="8" y="2" width="8" height="4" rx="0.5"/>
    </svg>
  ),
  dove: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M18 8c0-3.3-2.7-6-6-6S6 4.7 6 8c0 1.3.4 2.5 1.1 3.4L4 15l4-1 2 4 3-3h4c2.2 0 4-1.8 4-4s-1.8-3-3-3z"/>
      <path d="M20 14l-2 2"/>
    </svg>
  ),
  star: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  ),
  heart: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
    </svg>
  ),
  scroll: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M8 21h12a2 2 0 0 0 2-2v-2H10v2a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v3h4"/>
      <path d="M19 3H12a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h7"/>
    </svg>
  ),
  lamp: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M9 18h6"/>
      <path d="M10 22h4"/>
      <path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z"/>
    </svg>
  ),
  bell: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
      <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  ),
  shield: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  ),
  flame: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 2c0 4-4 6-4 10a4 4 0 1 0 8 0c0-4-4-6-4-10z"/>
    </svg>
  ),
  trash: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <polyline points="3 6 5 6 21 6"/>
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
    </svg>
  ),
  check: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  ),
};

export const avatarIcons = ['book', 'stake', 'dove', 'star', 'heart', 'scroll', 'lamp', 'bell', 'shield', 'flame'];

export function AvatarIcon({ name, size = 32 }) {
  const Icon = Icons[name];
  if (!Icon) return null;
  return <Icon width={size} height={size} />;
}

function getAvatarColor(name) {
  if (!name) return 'hsl(250, 65%, 42%)';
  const n = name.toLowerCase();
  // Three different hashes XORed for better distribution across the color spectrum
  let h1 = 5381;
  for (let i = 0; i < n.length; i++) h1 = (((h1 << 5) + h1) ^ n.charCodeAt(i)) >>> 0;
  let h2 = 0x811c9dc5;
  for (let i = 0; i < n.length; i++) { h2 ^= n.charCodeAt(i); h2 = (h2 * 0x01000193) >>> 0; }
  let h3 = 0;
  for (let i = 0; i < n.length; i++) h3 = (h3 + n.charCodeAt(i) * (i + 1) * 2654435761) >>> 0;
  const combined = ((h1 ^ h2 ^ h3) >>> 0) % 300;
  // Skip yellow-green range (80-139°) — hard to distinguish for deutan colorblindness
  const hue = combined >= 80 ? (combined + 60) % 360 : combined;
  return `hsl(${hue}, 65%, 42%)`;
}

export function InitialAvatar({ name, size = 32 }) {
  const initial = (name || '?')[0].toUpperCase();
  const color = getAvatarColor(name);
  const fontSize = Math.round(size * 0.45);
  return (
    <svg width={size} height={size} viewBox="0 0 32 32">
      <circle cx="16" cy="16" r="16" fill={color} />
      <text x="16" y="16" textAnchor="middle" dominantBaseline="central"
        fill="white" fontSize={fontSize} fontWeight="bold" fontFamily="system-ui, sans-serif">
        {initial}
      </text>
    </svg>
  );
}
