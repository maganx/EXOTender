/** The EXO Global globe: the logo's gold "O", a wireframe globe with an orbit arrow. */
function Globe({ x, y, size }: { x: number; y: number; size: number }) {
  const s = size / 100;
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} style={{ color: "#C9A86A" }}>
      <g fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round">
        <circle cx="50" cy="50" r="34" />
        <ellipse cx="50" cy="50" rx="15" ry="34" />
        <line x1="16" y1="50" x2="84" y2="50" />
        <path d="M21 33 Q50 40 79 33" />
        <path d="M21 67 Q50 60 79 67" />
        <path d="M86 32 A42 42 0 1 0 90 58" />
      </g>
      <path d="M78 22 L93 27 L83 39 Z" fill="currentColor" />
    </g>
  );
}

/** EXO Global logo, as on the company website. `full` adds the "GLOBAL LIMITED" line. */
export function Logo({ height = 30, full = false }: { height?: number; full?: boolean }) {
  return (
    <svg
      viewBox={full ? "0 0 330 150" : "0 0 330 126"}
      style={{ height, width: "auto", display: "block" }}
      aria-label="EXO Global Limited"
      role="img"
    >
      <g fill="#FFFFFF">
        <rect x="0" y="12" width="78" height="20" rx="2" />
        <rect x="0" y="52" width="66" height="20" rx="2" />
        <rect x="0" y="92" width="78" height="20" rx="2" />
        <path d="M98 12 h22 l22 34 l22 -34 h22 l-33 50 l33 50 h-22 l-22 -34 l-22 34 h-22 l33 -50 z" />
      </g>
      <Globe x={198} y={-2} size={128} />
      {full && (
        <text x="0" y="146" fill="#FFFFFF" fontFamily="Montserrat, Arial, sans-serif" fontSize="21" fontWeight="400" textLength="320" lengthAdjust="spacing">
          GLOBAL LIMITED
        </text>
      )}
    </svg>
  );
}

/** The globe on its own, for decoration. */
export function GlobeMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <Globe x={0} y={0} size={100} />
    </svg>
  );
}
