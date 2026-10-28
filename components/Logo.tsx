/** Tenda Desk mark: three bars, a cross and a gold globe. */
export function Logo({ height = 30 }: { height?: number }) {
  return (
    <svg viewBox="0 0 132 40" style={{ height, width: "auto", display: "block" }} aria-label="Tenda Desk" role="img">
      <rect x="0" y="4" width="26" height="6" fill="#FFFFFF" />
      <rect x="0" y="17" width="20" height="6" fill="#FFFFFF" />
      <rect x="0" y="30" width="26" height="6" fill="#FFFFFF" />
      <path d="M34 4 L56 36 M56 4 L34 36" stroke="#FFFFFF" strokeWidth="5" fill="none" />
      <circle cx="82" cy="20" r="15" fill="none" stroke="#C9A86A" strokeWidth="2.6" />
      <ellipse cx="82" cy="20" rx="7" ry="15" fill="none" stroke="#C9A86A" strokeWidth="1.6" />
      <path d="M67 20 H97 M70 12 H94 M70 28 H94" stroke="#C9A86A" strokeWidth="1.4" fill="none" />
      <path d="M100 9 A20 20 0 0 1 103 27" stroke="#C9A86A" strokeWidth="2" fill="none" />
      <path d="M99 25 L103 29 L106 24" stroke="#C9A86A" strokeWidth="2" fill="none" />
    </svg>
  );
}
