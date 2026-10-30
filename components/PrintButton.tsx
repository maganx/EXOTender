"use client";

/** Opens the browser's print dialog, where the report can also be saved as a PDF for the board. */
export function PrintButton({ children }: { children: React.ReactNode }) {
  return (
    <button type="button" className="btn no-print" onClick={() => window.print()}>
      {children}
    </button>
  );
}
