import Link from "next/link";

import { ConsoleShell } from "@/components/console-shell";

export default function UpgradeCancelledPage() {
  return (
    <ConsoleShell subtitle="upgrade > cancelled">
      <div className="mx-auto flex max-w-xl flex-col gap-4 border border-dim/60 bg-black/60 p-6 text-[11px] uppercase tracking-[0.18em] text-dim">
        <h2 className="text-sm text-accent">checkout aborted</h2>
        <p>no changes made. you can restart the upgrade anytime from the console sidebar.</p>
        <Link href="/" className="text-accent hover:underline">
          ← return to console
        </Link>
      </div>
    </ConsoleShell>
  );
}
