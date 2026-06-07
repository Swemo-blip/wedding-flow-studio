type ProgressProps = {
  label: string;
  value: number;
};

export function Progress({ label, value }: ProgressProps) {
  const clamped = Math.max(0, Math.min(100, value));

  return (
    <div aria-label={`${label}: ${clamped}%`}>
      <div className="progress-track" role="progressbar" aria-valuemax={100} aria-valuemin={0} aria-valuenow={clamped}>
        <div className="progress-fill" style={{ width: `${clamped}%` }} />
      </div>
    </div>
  );
}
