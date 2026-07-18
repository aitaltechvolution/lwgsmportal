import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import AuthCard from "@/components/AuthCard";
import { useToast } from "@/contexts/ToastContext";
import PasswordInput from "@/components/PasswordInput";

export default function ResetPassword() {
  const { t } = useTranslation();
  const { updatePassword } = useAuth();
  const { showToast } = useToast();
  const nav = useNavigate();
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr(null); setMsg(null); setLoading(true);
    try {
      await updatePassword(password);
      setMsg(t("auth.errors.reset_success"));
      showToast("success", "Password changed successfully! Please sign in.");
      setTimeout(() => nav("/login"), 1500);
    } catch {
      setErr(t("auth.errors.login_failed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthCard title={t("auth.reset_title")}>
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="label">{t("auth.password")}</label>
          <PasswordInput required minLength={6} className="input" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {msg && <p className="text-sm text-green-400">{msg}</p>}
        {err && <p className="text-sm text-red-400">{err}</p>}
        <button disabled={loading} className="btn-primary w-full">{t("auth.submit_reset")}</button>
      </form>
    </AuthCard>
  );
}
