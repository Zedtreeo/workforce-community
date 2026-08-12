// ────────────────────────────────────────────────────────
//  Avatar — initials-based avatar with optional image
// ────────────────────────────────────────────────────────

interface AvatarProps {
  name: string;
  src?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_MAP = {
  xs: 'h-6 w-6 text-[10px]',
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-14 w-14 text-base',
};

// Deterministic color from name string
const COLORS = [
  'bg-brand-100 text-brand-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700',
  'bg-violet-100 text-violet-700',
  'bg-cyan-100 text-cyan-700',
  'bg-orange-100 text-orange-700',
  'bg-teal-100 text-teal-700',
];

function getColorForName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return COLORS[Math.abs(hash) % COLORS.length];
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return (parts[0]?.[0] ?? '?').toUpperCase();
}

export function Avatar({ name, src, size = 'md', className = '' }: AvatarProps) {
  const sizeClass = SIZE_MAP[size];
  const colorClass = getColorForName(name);

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={`${sizeClass} rounded-full object-cover shrink-0 ${className}`}
      />
    );
  }

  return (
    <div
      className={`${sizeClass} ${colorClass} rounded-full flex items-center justify-center font-semibold shrink-0 ${className}`}
      title={name}
    >
      {getInitials(name)}
    </div>
  );
}

// ────────────────────────────────────────────────────────
//  AvatarGroup — overlapping avatar stack
// ────────────────────────────────────────────────────────

interface AvatarGroupProps {
  items: { name: string; src?: string | null }[];
  max?: number;
  size?: 'xs' | 'sm' | 'md';
}

export function AvatarGroup({ items, max = 4, size = 'sm' }: AvatarGroupProps) {
  const visible = items.slice(0, max);
  const remaining = items.length - max;

  return (
    <div className="flex -space-x-2">
      {visible.map((item, i) => (
        <Avatar
          key={i}
          name={item.name}
          src={item.src}
          size={size}
          className="ring-2 ring-white"
        />
      ))}
      {remaining > 0 && (
        <div
          className={`${SIZE_MAP[size]} rounded-full bg-surface-200 text-content-secondary flex items-center justify-center font-medium ring-2 ring-white shrink-0`}
        >
          +{remaining}
        </div>
      )}
    </div>
  );
}
