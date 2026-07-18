import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth, flushPendingProfile } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import AuthCard from "@/components/AuthCard";
import { useToast } from "@/contexts/ToastContext";
import PasswordInput from "@/components/PasswordInput";

export default function Login() {
  const { t } = useTranslation();
  const { signIn } = useAuth();
  const { showToast } = useToast();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      await signIn(email, password);
      const { data: userData } = await supabase.auth.getUser();

      if (userData.user) {
        // If this user just confirmed their email, we may have pending
        // profile data saved in localStorage before confirmation.
        await flushPendingProfile(userData.user.id, userData.user.email ?? email);

        const { data: prof } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", userData.user.id)
          .single();

        const role = (prof as { role?: string } | null)?.role;
        nav(role === "admin" ? "/admin" : role === "lecturer" ? "/lecturer" : "/student");
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "";
      if (msg.toLowerCase().includes("email not confirmed")) {
        setErr("Please confirm your email first. Check your inbox for the confirmation link.");
      } else if (msg.toLowerCase().includes("invalid login")) {
        setErr("Incorrect email or password.");
      } else {
        setErr(t("auth.errors.login_failed"));
      }
      console.error("Login error:", error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthCard title={t("auth.login_title")}>
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="label">{t("auth.email")}</label>
          <input
            type="email"
            required
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <label className="label">{t("auth.password")}</label>
          <PasswordInput
            required
            minLength={6}
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {err && <p className="text-sm text-red-400">{err}</p>}
        <button disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
          {loading ? (
            <>
              <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Signing in…
            </>
          ) : (
            t("auth.submit_login")
          )}
        </button>
        <div className="flex justify-between text-sm">
          <Link to="/forgot-password" className="text-amber-500 hover:underline">
            {t("auth.forgot_link")}
          </Link>
          <Link to="/register" className="text-gray-500 hover:text-amber-500">
            {t("auth.no_account")}
          </Link>
        </div>
      </form>
    </AuthCard>
  );
}
