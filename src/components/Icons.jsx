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
