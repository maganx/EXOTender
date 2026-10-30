"use client";

/** Opens the browser's print dialog, where the report can also be saved as a PDF for the board. */
export function PrintButton({ children, className = "btn" }: { children: React.ReactNode; className?: string }) {
  return (
    <button type="button" className={`${className} no-print`} onClick={() => window.print()}>
      {children}
    </button>
  );
}
