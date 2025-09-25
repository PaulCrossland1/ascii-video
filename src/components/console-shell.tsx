import clsx from "clsx";
import type { ReactNode } from "react";

export function ConsoleShell({
  children,
  className,
  title = "ASCII Console",
  subtitle,
}: {
  children: ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
}) {
  return (
    <div className={clsx("min-h-screen bg-background text-foreground", className)}>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-8">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold uppercase tracking-[0.16em] text-accent">{title}</h1>
            {subtitle ? (
              <p className="text-[10px] uppercase tracking-[0.2em] text-dim">{subtitle}</p>
            ) : null}
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}
