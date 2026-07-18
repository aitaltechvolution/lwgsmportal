import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { Profile, Role } from "@/types";
import i18n from "@/i18n/config";
import { logUsageEvent } from "@/lib/usageEvents";

interface AuthContextValue {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (data: SignUpData) => Promise<{ confirmationSent: boolean }>;
  signInWithGoogle: () => Promise<void>;
  completeProfile: (data: Partial<SignUpData>) => Promise<void>;
  signOut: () => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
}

export interface SignUpData {
  email: string;
  password: string;
  full_name: string;
  phone: string;
  country: string;
  nationality: string;
  language_pref: string;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadProfile(userId: string) {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (error) {
      console.error("loadProfile error:", error.message);
      setProfile(null);
      return;
    }

    const p = (data as Profile) ?? null;
    setProfile(p);
    if (p?.language_pref && p.language_pref !== i18n.language) {
      i18n.changeLanguage(p.language_pref);
      localStorage.setItem("lwgsm_lang", p.language_pref);
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session?.user) {
        loadProfile(data.session.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (s?.user) {
        loadProfile(s.user.id);
        if (event === "SIGNED_IN") logUsageEvent(s.user.id, "login");
      } else {
        setProfile(null);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signUp = async (d: SignUpData): Promise<{ confirmationSent: boolean }> => {
    const { data, error } = await supabase.auth.signUp({
      email: d.email,
      password: d.password,
      options: {
        // Use the production URL if set, otherwise fall back to origin.
        // Set VITE_SITE_URL in your .env for production.
        emailRedirectTo: `${import.meta.env.VITE_SITE_URL || window.location.origin}/login`,
        data: { full_name: d.full_name },
      },
    });
    if (error) throw error;

    // If email confirmation is enabled, data.session is null here —
    // the user exists in auth.users but isn't confirmed yet.
    // We store the profile details in user_metadata (already done above via `data`)
    // and write to profiles only after they confirm and get a real session.
    // The onAuthStateChange SIGNED_IN event will fire after confirmation.

    if (data.session && data.user) {
      // Email confirmation is DISABLED — user is immediately active.
      // Safe to write the profile row now.
      const { error: pErr } = await supabase.from("profiles").upsert({
        id: data.user.id,
        role: "student" as Role,
        full_name: d.full_name,
        email: d.email,
        phone: d.phone,
        country: d.country,
        nationality: d.nationality,
        language_pref: d.language_pref,
      });
      if (pErr) throw pErr;
      return { confirmationSent: false };
    }

    // Email confirmation is ENABLED — session is null.
    // Store extra fields temporarily so we can write them after confirmation.
    // We use localStorage as a lightweight bridge across the redirect.
    localStorage.setItem(
      "lwgsm_pending_profile",
      JSON.stringify({
        full_name: d.full_name,
        phone: d.phone,
        country: d.country,
        nationality: d.nationality,
        language_pref: d.language_pref,
      })
    );
    return { confirmationSent: true };
  };

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${import.meta.env.VITE_SITE_URL || window.location.origin}/student` },
    });
    if (error) throw error;
  };

  const completeProfile = async (d: Partial<SignUpData>) => {
    if (!session?.user) throw new Error("Not signed in");
    const payload: Record<string, unknown> = {};
    if (d.phone !== undefined) payload.phone = d.phone;
    if (d.country !== undefined) payload.country = d.country;
    if (d.nationality !== undefined) payload.nationality = d.nationality;
    if (d.language_pref !== undefined) payload.language_pref = d.language_pref;
    if (d.full_name !== undefined) payload.full_name = d.full_name;
    const { error } = await supabase.from("profiles").update(payload).eq("id", session.user.id);
    if (error) throw error;
    await loadProfile(session.user.id);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const forgotPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${import.meta.env.VITE_SITE_URL || window.location.origin}/reset-password`,
    });
    if (error) throw error;
  };

  const updatePassword = async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
  };

  return (
    <AuthContext.Provider
      value={{ session, profile, loading, signIn, signUp, signInWithGoogle, completeProfile, signOut, forgotPassword, updatePassword }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// After email confirmation, the user lands on /login with a session.
// This helper is called from Login.tsx to flush the pending profile if present.
export async function flushPendingProfile(userId: string, email: string) {
  const raw = localStorage.getItem("lwgsm_pending_profile");
  if (!raw) return;
  try {
    const extra = JSON.parse(raw);
    await supabase.from("profiles").upsert({
      id: userId,
      role: "student" as Role,
      email,
      ...extra,
    });
    localStorage.removeItem("lwgsm_pending_profile");
  } catch (e) {
    console.error("flushPendingProfile error:", e);
  }
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
