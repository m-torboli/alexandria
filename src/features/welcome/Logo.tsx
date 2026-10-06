/** Marchio di Alexandria: libri su uno scaffale, uno appoggiato. */
export function Logo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="14" fill="currentColor" />
      <g fill="var(--bg)">
        <rect x="15" y="17" width="7" height="30" rx="1.5" />
        <rect x="24" y="13" width="7" height="34" rx="1.5" />
        <rect x="33" y="20" width="7" height="27" rx="1.5" />
        <rect x="41.5" y="18" width="7" height="30" rx="1.5" transform="rotate(-16 45 47)" />
        <rect x="12" y="49" width="40" height="2.5" rx="1.25" />
      </g>
    </svg>
  );
}
