import { cn } from "@/lib/utils";

export function MeridianMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={cn("size-7 text-foreground", className)}
      aria-hidden="true"
    >
      <rect width="32" height="32" rx="8" fill="currentColor" opacity="0.08" />
      <path
        d="M16 6v20"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="16" cy="16" r="5.5" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="16" cy="16" r="1.6" fill="currentColor" />
    </svg>
  );
}

export function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <MeridianMark />
      <div className="flex items-baseline gap-2">
        <span className="font-display text-3xl leading-none italic tracking-tight">
          Meridian
        </span>
        {!compact && (
          <span className="hidden text-xs font-medium uppercase tracking-label text-muted-foreground sm:inline">
            Signals
          </span>
        )}
      </div>
    </div>
  );
}
