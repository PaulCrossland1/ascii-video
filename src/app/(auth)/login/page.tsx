"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import { useAuth } from "@/contexts/auth-context";

export default function LoginPage() {
  const router = useRouter();
  const { supabase, refreshProfile } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setStatus("login> verifying credentials _");

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setStatus(`error> ${error.message}`);
        return;
      }

      await refreshProfile();
      setStatus("login> access granted _");
      router.push("/");
    } catch (error) {
      const message = error instanceof Error ? error.message : "unexpected issue";
      setStatus(`error> ${message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="space-y-2">
        <h2 className="text-sm uppercase tracking-[0.22em] text-accent">login</h2>
        <p className="text-[11px] leading-relaxed text-dim">
          enter credentials to unlock premium export mode. accounts created today receive lifetime retro perks.
        </p>
      </div>
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-[10px] uppercase tracking-[0.2em]">
          email
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="border border-dim/60 bg-black/40 px-3 py-2 text-[12px] uppercase tracking-[0.12em] focus:border-accent focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1 text-[10px] uppercase tracking-[0.2em]">
          password
          <input
            type="password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="border border-dim/60 bg-black/40 px-3 py-2 text-[12px] uppercase tracking-[0.12em] focus:border-accent focus:outline-none"
          />
        </label>
      </div>
      <button
        type="submit"
        disabled={submitting}
        className="border border-accent px-4 py-2 text-[11px] uppercase tracking-[0.2em] hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-60"
      >
        engage access
      </button>
      {status ? <p className="text-[10px] uppercase tracking-[0.18em] text-dim">{status}</p> : null}
      <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.18em] text-dim">
        <Link href="/forgot-password" className="hover:text-accent">reset password</Link>
        <span>
          need an account? {" "}
          <Link href="/register" className="text-foreground hover:text-accent">register now</Link>
        </span>
      </div>
    </form>
  );
}
