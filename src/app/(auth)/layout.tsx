import type { ReactNode } from "react";
import Link from "next/link";
import { ConsoleShell } from "@/components/console-shell";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <ConsoleShell subtitle="authenticate > access premium features">
      <div className="flex justify-end text-[10px] uppercase tracking-[0.18em] text-dim">
        <Link href="/" className="hover:text-accent">
          ← return to console
        </Link>
      </div>
      <div className="mx-auto w-full max-w-md border border-dim/60 bg-black/60/80 p-6 shadow-[0_20px_40px_rgba(0,0,0,0.45)]">
        {children}
      </div>
    </ConsoleShell>
  );
}
