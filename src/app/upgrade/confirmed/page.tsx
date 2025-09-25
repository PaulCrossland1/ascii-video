import Link from "next/link";

import { ConsoleShell } from "@/components/console-shell";

export default function UpgradeConfirmedPage() {
  return (
    <ConsoleShell subtitle="upgrade > payment received">
      <div className="mx-auto flex max-w-xl flex-col gap-4 border border-dim/60 bg-black/60 p-6 text-[11px] uppercase tracking-[0.18em] text-dim">
        <h2 className="text-sm text-accent">checkout complete</h2>
        <p>
          thanks for supporting ascii.video. premium exports are unlocked once an admin confirms your payment against the
          email used at checkout.
        </p>
        <p>
          if you do not see premium access within a few minutes, contact support with your receipt and we will upgrade
          your profile manually.
        </p>
        <Link href="/" className="text-accent hover:underline">
          ← return to console
        </Link>
      </div>
    </ConsoleShell>
  );
}
