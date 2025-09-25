'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';

import { createSupabaseBrowserClient } from '@/lib/supabase-browser';

type EntitlementTier = 'free' | 'premium';

type ProfileRow = {
  id: string;
  entitlement: EntitlementTier;
  stripe_customer_id?: string | null;
  updated_at?: string | null;
};

type AuthContextValue = {
  supabase: ReturnType<typeof createSupabaseBrowserClient>;
  session: Session | null;
  user: User | null;
  profile: ProfileRow | null;
  entitlement: EntitlementTier;
  loadingSession: boolean;
  loadingProfile: boolean;
  lastError: string | null;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    setLoadingSession(true);

    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!isMounted) return;
        if (error) {
          setSession(null);
          setLastError(error.message);
        } else {
          setSession(data.session ?? null);
        }
      })
      .finally(() => {
        if (isMounted) {
          setLoadingSession(false);
        }
      });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!isMounted) return;
      setSession(nextSession);
    });

    return () => {
      isMounted = false;
      listener.subscription.unsubscribe();
    };
  }, [supabase]);

  const fetchProfile = useCallback(async () => {
    if (!session?.user) {
      setProfile(null);
      return;
    }

    setLoadingProfile(true);
    setLastError(null);

    const { data, error } = await supabase
      .from('profiles')
      .select('id, entitlement, stripe_customer_id, updated_at')
      .eq('id', session.user.id)
      .maybeSingle();

    if (error) {
      setLastError(error.message);
      setLoadingProfile(false);
      return;
    }

    if (data) {
      setProfile(data as ProfileRow);
      setLoadingProfile(false);
      return;
    }

    const { data: inserted, error: insertError } = await supabase
      .from('profiles')
      .upsert({ id: session.user.id, entitlement: 'free' }, { onConflict: 'id', ignoreDuplicates: false })
      .select()
      .maybeSingle();

    if (insertError) {
      setLastError(insertError.message);
      setLoadingProfile(false);
      return;
    }

    setProfile(inserted as ProfileRow);
    setLoadingProfile(false);
  }, [session?.user, supabase]);

  useEffect(() => {
    if (!session?.user) {
      setProfile(null);
      setLoadingProfile(false);
      return;
    }

    fetchProfile();
  }, [session?.user, fetchProfile]);

  const refreshProfile = useCallback(async () => {
    await fetchProfile();
  }, [fetchProfile]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
  }, [supabase]);

  const value = useMemo<AuthContextValue>(
    () => ({
      supabase,
      session,
      user: session?.user ?? null,
      profile,
      entitlement: profile?.entitlement ?? 'free',
      loadingSession,
      loadingProfile,
      lastError,
      refreshProfile,
      signOut,
    }),
    [supabase, session, profile, loadingSession, loadingProfile, lastError, refreshProfile, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
