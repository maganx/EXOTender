import type { T } from "@/lib/i18n";
import { WON, dueLabel, type Stage } from "@/lib/domain";

export function StageTag({ stage, t }: { stage: Stage; t: T }) {
  const cls = stage === "lost" ? "lost" : stage === "closed" ? "closed" : (WON as readonly string[]).includes(stage) ? "won" : "";
  return <span className={`stage ${cls}`}>{t(`s_${stage}`)}</span>;
}

export function DueChip({ date, t }: { date: string | null | undefined; t: T }) {
  const d = dueLabel(date, t);
  if (!d) return null;
  return <span className={`chip ${d.cls}`}>{d.text}</span>;
}

export function Kpi({ label, value, sub, hot }: { label: string; value: string | number; sub: string; hot?: boolean }) {
  return (
    <div className={`kpi${hot ? " hot" : ""}`}>
      <div className="l">{label}</div>
      <div className="v num">{value}</div>
      <div className="s">{sub}</div>
    </div>
  );
}
