export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`bg-canvas border border-border-strong rounded-2xl animate-pulse ${className}`}
      aria-hidden="true"
    />
  );
}
