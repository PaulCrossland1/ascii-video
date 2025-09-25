"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import { useAuth } from "@/contexts/auth-context";

export default function RegisterPage() {
  const router = useRouter();
  const { supabase, refreshProfile } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;

    if (password !== confirm) {
      setStatus("error> passwords do not match");
      return;
    }

    setSubmitting(true);
    setStatus("register> opening channel _");

    try {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setStatus(`error> ${error.message}`);
        return;
      }

      if (data.session) {
        await refreshProfile();
        setStatus("register> access granted _ redirecting");
        router.push("/");
        return;
      }

      setStatus("register> check your inbox to confirm access");
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
        <h2 className="text-sm uppercase tracking-[0.22em] text-accent">register</h2>
        <p className="text-[11px] leading-relaxed text-dim">
          create an ascii.video id to unlock premium exports. one payment unlocks lifetime access.
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
        <label className="flex flex-col gap-1 text-[10px] uppercase tracking-[0.2em]">
          confirm password
          <input
            type="password"
            required
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            className="border border-dim/60 bg-black/40 px-3 py-2 text-[12px] uppercase tracking-[0.12em] focus:border-accent focus:outline-none"
          />
        </label>
      </div>
      <button
        type="submit"
        disabled={submitting}
        className="border border-accent px-4 py-2 text-[11px] uppercase tracking-[0.2em] hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-60"
      >
        create id
      </button>
      {status ? <p className="text-[10px] uppercase tracking-[0.18em] text-dim">{status}</p> : null}
      <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.18em] text-dim">
        <Link href="/forgot-password" className="hover:text-accent">reset password</Link>
        <span>
          already registered? {" "}
          <Link href="/login" className="text-foreground hover:text-accent">login</Link>
        </span>
      </div>
    </form>
  );
}
