import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import AuthCard from "@/components/AuthCard";

export default function ForgotPassword() {
  const { t } = useTranslation();
  const { forgotPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr(null); setMsg(null); setLoading(true);
    try {
      await forgotPassword(email);
      setMsg(t("auth.errors.reset_sent"));
    } catch {
      setErr(t("auth.errors.login_failed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthCard title={t("auth.forgot_title")}>
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="label">{t("auth.email")}</label>
          <input type="email" required className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        {msg && <p className="text-sm text-green-400">{msg}</p>}
        {err && <p className="text-sm text-red-400">{err}</p>}
        <button disabled={loading} className="btn-primary w-full">{t("auth.submit_forgot")}</button>
        <p className="text-sm text-center">
          <Link to="/login" className="text-amber-500 hover:underline">{t("nav.login")}</Link>
        </p>
      </form>
    </AuthCard>
  );
}
