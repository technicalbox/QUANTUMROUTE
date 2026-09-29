export function MiniVan({ color, className = "h-10 w-20" }: { color: string; className?: string }) {
  return (
    <svg viewBox="0 0 120 48" className={`${className} shrink-0 text-muted-foreground/70`} fill="none" aria-hidden>
      <rect x="4" y="6" width="70" height="30" rx="2" className="fill-secondary" stroke="currentColor" strokeWidth="1" />
      <path d="M74 14h22l14 12v10H74z" className="fill-secondary" stroke="currentColor" strokeWidth="1" />
      <path d="M80 17h14l9 8H80z" className="fill-muted" stroke="currentColor" strokeWidth="0.8" />
      <rect x="4" y="30" width="70" height="2" fill={color} />
      <circle cx="22" cy="38" r="6" className="fill-card" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="94" cy="38" r="6" className="fill-card" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

export default MiniVan;
