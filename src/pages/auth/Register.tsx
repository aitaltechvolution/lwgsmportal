import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import AuthCard from "@/components/AuthCard";
import { useToast } from "@/contexts/ToastContext";
import PasswordInput from "@/components/PasswordInput";
import { COUNTRIES, LANGUAGES } from "@/lib/constants";

export default function Register() {
  const { t, i18n } = useTranslation();
  const lang = (i18n.language.startsWith("fr") ? "fr" : "en") as "en" | "fr";
  const { signUp } = useAuth();
  const { showToast } = useToast();
  const nav = useNavigate();
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    password: "",
    phone: "",
    country: "Nigeria",
    nationality: "Nigeria",
    language_pref: "en",
  });
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm({ ...form, [k]: e.target.value });

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      const { confirmationSent } = await signUp(form);
      if (confirmationSent) {
        setConfirmationSent(true);
      showToast("info", lang === "en" ? "Confirmation email sent. Please check your inbox." : "Email de confirmation envoyé. Vérifiez votre boîte de réception.");
      } else {
        showToast("success", lang === "en" ? "Account created! Welcome to LWGSM." : "Compte créé ! Bienvenue à LWGSM.");
      nav("/student");
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "";
      if (msg.toLowerCase().includes("already registered") || msg.toLowerCase().includes("already exists")) {
        setErr("An account with this email already exists. Please log in instead.");
      } else {
        setErr(t("auth.errors.register_failed"));
      }
      console.error("Register error:", error);
    } finally {
      setLoading(false);
    }
  }

  if (confirmationSent) {
    return (
      <AuthCard title="Check your email">
        <div className="text-center space-y-4 py-4">
          <div className="text-5xl">📧</div>
          <p className="text-gray-300">
            We sent a confirmation link to <strong className="text-white">{form.email}</strong>.
          </p>
          <p className="text-gray-400 text-sm">
            Click the link in the email to activate your account, then come back to log in.
          </p>
          <Link to="/login" className="btn-primary inline-block mt-2">
            Go to Login
          </Link>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard title={t("auth.register_title")}>
      <form onSubmit={onSubmit} className="space-y-3">
        <div>
          <label className="label">{t("auth.full_name")}</label>
          <input required className="input" value={form.full_name} onChange={set("full_name")} />
        </div>
        <div>
          <label className="label">{t("auth.email")}</label>
          <input type="email" required className="input" value={form.email} onChange={set("email")} />
        </div>
        <div>
          <label className="label">{t("auth.password")}</label>
          <PasswordInput required minLength={6} className="input" value={form.password} onChange={set("password")} />
        </div>
        <div>
          <label className="label">{t("auth.phone")}</label>
          <input className="input" value={form.phone} onChange={set("phone")} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">{t("auth.country")}</label>
            <select className="input" value={form.country} onChange={set("country")}>
              {COUNTRIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">{t("auth.nationality")}</label>
            <select className="input" value={form.nationality} onChange={set("nationality")}>
              {COUNTRIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="label">{t("auth.language_pref")}</label>
          <select className="input" value={form.language_pref} onChange={set("language_pref")}>
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>{l.en}</option>
            ))}
          </select>
        </div>
        {err && <p className="text-sm text-red-400">{err}</p>}
        <button disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
          {loading ? (
            <>
              <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Creating account…
            </>
          ) : (
            t("auth.submit_register")
          )}
        </button>
        <p className="text-sm text-center text-gray-500">
          {t("auth.have_account")}{" "}
          <Link to="/login" className="text-amber-500 hover:underline">
            {t("nav.login")}
          </Link>
        </p>
      </form>
    </AuthCard>
  );
}