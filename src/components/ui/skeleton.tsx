import { cn } from "@/lib/utils";

function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("rounded-md bg-secondary shimmer", className)}
      aria-hidden="true"
    />
  );
}

export { Skeleton };
