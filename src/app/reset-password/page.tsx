"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";

import { ConsoleShell } from "@/components/console-shell";
import { useAuth } from "@/contexts/auth-context";

function parseHashParams(hash: string) {
  const trimmed = hash.startsWith("#") ? hash.slice(1) : hash;
  return new URLSearchParams(trimmed);
}

export default function ResetPasswordPage() {
  const router = useRouter();
  const { supabase, refreshProfile } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const ensureSession = async () => {
      if (typeof window === "undefined") return;
      if (sessionReady) return;

      const hash = window.location.hash ?? "";
      if (!hash) {
        setSessionReady(true);
        return;
      }

      const params = parseHashParams(hash);
      const accessToken = params.get("access_token");
      const refreshToken = params.get("refresh_token");

      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
        if (error && isMounted) {
          setStatus(`error> ${error.message}`);
        }
      }

      if (isMounted) {
        setSessionReady(true);
      }
    };

    void ensureSession();

    return () => {
      isMounted = false;
    };
  }, [supabase, sessionReady]);

  const ready = useMemo(() => sessionReady, [sessionReady]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!ready || submitting) return;

    if (password !== confirm) {
      setStatus("error> passwords do not match");
      return;
    }

    setSubmitting(true);
    setStatus("reset> updating credentials _");

    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setStatus(`error> ${error.message}`);
        return;
      }

      await refreshProfile();
      setStatus("reset> password updated _");
      router.push("/login");
    } catch (error) {
      const message = error instanceof Error ? error.message : "unexpected issue";
      setStatus(`error> ${message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ConsoleShell subtitle="authenticate > reset credentials">
      <div className="mx-auto w-full max-w-md border border-dim/60 bg-black/60/80 p-6">
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="space-y-2">
            <h2 className="text-sm uppercase tracking-[0.22em] text-accent">set new password</h2>
            <p className="text-[11px] leading-relaxed text-dim">
              enter your new access key. once updated, we will redirect you back to the login console.
            </p>
          </div>
          <label className="flex flex-col gap-1 text-[10px] uppercase tracking-[0.2em]">
            new password
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
          <button
            type="submit"
            disabled={!ready || submitting}
            className="border border-accent px-4 py-2 text-[11px] uppercase tracking-[0.2em] hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            update password
          </button>
          {status ? <p className="text-[10px] uppercase tracking-[0.18em] text-dim">{status}</p> : null}
          <div className="flex justify-between text-[10px] uppercase tracking-[0.18em] text-dim">
            <Link href="/" className="hover:text-accent">
              ← return home
            </Link>
            <Link href="/login" className="hover:text-accent">
              login
            </Link>
          </div>
        </form>
      </div>
    </ConsoleShell>
  );
}
