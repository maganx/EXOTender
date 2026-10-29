"use client";

/** A submit button that asks before something is removed, so one stray tap on a phone can't delete data. */
export function ConfirmButton({
  ask,
  label,
  className,
  name,
  value,
  children,
}: {
  ask: string;
  label?: string;
  className?: string;
  name?: string;
  value?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="submit"
      className={className}
      name={name}
      value={value}
      aria-label={label}
      onClick={(e) => {
        if (!window.confirm(ask)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
