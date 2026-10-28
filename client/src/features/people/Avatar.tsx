// Photo or deterministic initials circle.
const COLORS = ['#F5225A', '#FF8A00', '#30B651', '#1E9BF5', '#8B5CF6', '#C03CF0', '#0EA5E9', '#E5197E', '#10B981', '#D97706'];

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

export function colorFor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return COLORS[h % COLORS.length];
}

export function Avatar({ name, photoUrl, size = 40, seed }: { name: string; photoUrl?: string | null; size?: number; seed?: string }) {
  const style = { width: size, height: size };
  if (photoUrl) {
    return <img src={photoUrl} alt="" referrerPolicy="no-referrer" className="shrink-0 rounded-full object-cover" style={style} />;
  }
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full font-semibold text-white"
      style={{ ...style, backgroundColor: colorFor(seed ?? name), fontSize: size * 0.38 }}
    >
      {initials(name)}
    </span>
  );
}
