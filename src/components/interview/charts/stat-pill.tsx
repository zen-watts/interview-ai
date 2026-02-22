interface StatPillProps {
  value: string;
  label: string;
  sublabel?: string;
}

export function StatPill({ value, label, sublabel }: StatPillProps) {
  return (
    <div className="text-center">
      <p className="text-2xl font-semibold text-paper-ink">{value}</p>
      <p className="font-sans text-xs font-semibold uppercase tracking-[0.08em] text-paper-muted">
        {label}
      </p>
      {sublabel ? (
        <p className="font-sans text-[10px] text-paper-muted">{sublabel}</p>
      ) : null}
    </div>
  );
}
