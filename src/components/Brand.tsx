import { cn } from "../lib/utils";
import Link from "next/link";

export function Brand({ className }: { className?: string }) {
  return (
    <Link
      href="/#inicio"
      className={cn(
        "group inline-flex items-center gap-2 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold sm:gap-3",
        className,
      )}
      aria-label="Império Sofás — voltar ao início"
    >
      <img
        src="/imperio-sofas-logo-128.webp"
        alt="Logo oficial da Império Sofás"
        width="128"
        height="128"
        className="size-12 shrink-0 [clip-path:circle(46%)] sm:size-14"
      />
      <span className="leading-none">
        <span className="block whitespace-nowrap font-display text-[.96rem] font-semibold tracking-[.01em] text-ivory sm:text-[1.08rem] sm:tracking-[.02em]">
          Império Sofás
        </span>
        <span className="mt-1 block text-[.66rem] font-semibold uppercase tracking-[.2em] text-gold">
          Vale do Paraíba
        </span>
      </span>
    </Link>
  );
}
