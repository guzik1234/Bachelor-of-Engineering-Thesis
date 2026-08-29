import { cn } from "@/lib/cn";

export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-brand-gradient text-white shadow-glow",
        className
      )}
    >
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M12 2.5 14.4 9.1 21 11.5 14.4 13.9 12 20.5 9.6 13.9 3 11.5 9.6 9.1 12 2.5Z"
          fill="currentColor"
        />
      </svg>
    </span>
  );
}
