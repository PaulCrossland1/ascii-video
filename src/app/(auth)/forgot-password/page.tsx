"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

import { useAuth } from "@/contexts/auth-context";

export default function ForgotPasswordPage() {
  const { supabase } = useAuth();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setStatus("reset> dispatching reset link _");

    try {
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const options = origin ? { redirectTo: `${origin}/reset-password` } : undefined;
      const { error } = await supabase.auth.resetPasswordForEmail(email, options);
      if (error) {
        setStatus(`error> ${error.message}`);
        return;
      }

      setStatus("reset> instructions transmitted _");
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
        <h2 className="text-sm uppercase tracking-[0.22em] text-accent">reset access</h2>
        <p className="text-[11px] leading-relaxed text-dim">
          enter the email linked to your ascii.video id. we will transmit a reset token using standard retro protocols.
        </p>
      </div>
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
      <button
        type="submit"
        disabled={submitting}
        className="border border-accent px-4 py-2 text-[11px] uppercase tracking-[0.2em] hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-60"
      >
        dispatch reset link
      </button>
      {status ? <p className="text-[10px] uppercase tracking-[0.18em] text-dim">{status}</p> : null}
      <div className="flex justify-between text-[10px] uppercase tracking-[0.18em] text-dim">
        <Link href="/login" className="hover:text-accent">
          ← back to login
        </Link>
        <Link href="/register" className="hover:text-accent">
          need an account?
        </Link>
      </div>
    </form>
  );
}
