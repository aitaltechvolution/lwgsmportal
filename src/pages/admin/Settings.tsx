import AdminLayout from "@/components/AdminLayout";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useState, FormEvent, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import {
  CheckCircle2, XCircle, ChevronDown, DollarSign, CreditCard, Building2,
  Plus, Trash2, Loader2, Eye, EyeOff, School, Bell,
} from "lucide-react";
import { ToggleSwitch } from "@/components/ui/primitives";
import { useConfirm } from "@/contexts/ConfirmContext";
import AvatarUpload from "@/components/AvatarUpload";

interface BankAccount {
  id: string;
  bank_name: string;
  account_name: string;
  account_number: string;
  currency: string;
  is_active: boolean;
  sort_order: number;
}

export default function AdminSettings() {
  const { profile } = useAuth();
  const { i18n } = useTranslation();
  const lang = (i18n.language.startsWith("fr") ? "fr" : "en") as "en" | "fr";
  const { exchangeRate, setExchangeRate, usdToEur, setUsdToEur, currency, setCurrency } = useCurrency();
  const confirm = useConfirm();
  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile?.avatar_url ?? null);
  const [saving, setSaving] = useState(false);
  const [pwdSection, setPwdSection] = useState(false);
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState(""); const [confirmPwd, setConfirmPwd] = useState(""); const [pwdSaving, setPwdSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [rateInput, setRateInput] = useState(String(exchangeRate));
  const [eurInput, setEurInput] = useState(String(usdToEur ?? 0.92));
  const [eurSaving, setEurSaving] = useState(false);
  const [rateSaving, setRateSaving] = useState(false);

  const onSaveEurRate = async (e: React.FormEvent) => {
    e.preventDefault();
    const rate = parseFloat(eurInput);
    if (!rate || rate <= 0) { showMsg("err", lang === "en" ? "Enter a valid EUR rate." : "Entrez un taux EUR valide."); return; }
    setEurSaving(true);
    try {
      await setUsdToEur(rate);
      showMsg("ok", lang === "en" ? "EUR rate updated!" : "Taux EUR mis à jour !");
    } catch { showMsg("err", lang === "en" ? "Failed to save EUR rate." : "Échec."); }
    finally { setEurSaving(false); }
  };

  // Payment settings
  const [paystackKey, setPaystackKey] = useState("");
  const [showPaystackKey, setShowPaystackKey] = useState(false);
  const [feeRegCertificate, setFeeRegCertificate] = useState("");
  const [feeRegDiploma, setFeeRegDiploma] = useState("");
  const [feeRegPastoral, setFeeRegPastoral] = useState("");
  const [feeCertificate, setFeeCertificate] = useState("");
  const [paymentSettingsSaving, setPaymentSettingsSaving] = useState(false);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [bankAccountsLoading, setBankAccountsLoading] = useState(true);
  const [savingBankId, setSavingBankId] = useState<string | null>(null);

  // School info
  const [schoolNameEn, setSchoolNameEn] = useState("");
  const [schoolNameFr, setSchoolNameFr] = useState("");
  const [taglineEn, setTaglineEn] = useState("");
  const [taglineFr, setTaglineFr] = useState("");
  const [schoolInfoSaving, setSchoolInfoSaving] = useState(false);

  // Notification settings
  const [notifyEnrollment, setNotifyEnrollment] = useState(true);
  const [notifyPayment, setNotifyPayment] = useState(true);
  const [notifyCertificate, setNotifyCertificate] = useState(true);
  const [notifySms, setNotifySms] = useState(false);
  const [notifSaving, setNotifSaving] = useState(false);

  useEffect(() => {
    supabase.from("site_settings").select("key, value").in("key", [
      "paystack_public_key", "fee_reg_certificate", "fee_reg_diploma", "fee_reg_pastoral", "fee_certificate",
      "school_name_en", "school_name_fr", "school_tagline_en", "school_tagline_fr",
      "notify_new_enrollment", "notify_payment_received", "notify_certificate_issued", "notify_sms_enabled",
    ]).then(({ data }) => {
      const map = new Map((data ?? []).map((r: { key: string; value: string }) => [r.key, r.value]));
      setPaystackKey(map.get("paystack_public_key") ?? "");
      setFeeRegCertificate(map.get("fee_reg_certificate") ?? "10000");
      setFeeRegDiploma(map.get("fee_reg_diploma") ?? "");
      setFeeRegPastoral(map.get("fee_reg_pastoral") ?? "");
      setFeeCertificate(map.get("fee_certificate") ?? "");
      setSchoolNameEn(map.get("school_name_en") ?? "Living Waters Global School of Ministry");
      setSchoolNameFr(map.get("school_name_fr") ?? "École Mondiale du Ministère des Eaux Vives");
      setTaglineEn(map.get("school_tagline_en") ?? "");
      setTaglineFr(map.get("school_tagline_fr") ?? "");
      setNotifyEnrollment((map.get("notify_new_enrollment") ?? "true") === "true");
      setNotifyPayment((map.get("notify_payment_received") ?? "true") === "true");
      setNotifyCertificate((map.get("notify_certificate_issued") ?? "true") === "true");
      setNotifySms((map.get("notify_sms_enabled") ?? "false") === "true");
    });
    loadBankAccounts();
  }, []);

  const loadBankAccounts = () => {
    setBankAccountsLoading(true);
    supabase.from("bank_accounts").select("*").order("sort_order")
      .then(({ data }) => { setBankAccounts((data ?? []) as BankAccount[]); setBankAccountsLoading(false); });
  };

  useEffect(() => { setRateInput(String(exchangeRate)); }, [exchangeRate]);

  useEffect(() => { if (profile) { setFullName(profile.full_name ?? ""); setPhone(profile.phone ?? ""); setAvatarUrl(profile.avatar_url ?? null); } }, [profile]);

  const showMsg = (type: "ok" | "err", text: string) => { setMsg({ type, text }); setTimeout(() => setMsg(null), 4000); };

  const onSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!profile?.id) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({ full_name: fullName, phone }).eq("id", profile.id);
    setSaving(false);
    error ? showMsg("err", lang === "en" ? "Save failed." : "Échec.") : showMsg("ok", lang === "en" ? "Profile updated!" : "Profil mis à jour !");
  };

  const onSaveRate = async (e: FormEvent) => {
    e.preventDefault();
    const rate = Number(rateInput);
    if (!rate || rate <= 0) { showMsg("err", lang === "en" ? "Enter a valid exchange rate." : "Entrez un taux de change valide."); return; }
    setRateSaving(true);
    try {
      await setExchangeRate(rate);
      showMsg("ok", lang === "en" ? "Exchange rate updated!" : "Taux de change mis à jour !");
    } catch {
      showMsg("err", lang === "en" ? "Failed to save exchange rate." : "Échec de l'enregistrement.");
    } finally {
      setRateSaving(false);
    }
  };

  const onChangePwd = async (e: FormEvent) => {
    e.preventDefault();
    if (!currentPwd) { showMsg("err", lang === "en" ? "Enter your current password." : "Entrez votre mot de passe actuel."); return; }
    if (newPwd !== confirmPwd) { showMsg("err", lang === "en" ? "Passwords do not match." : "Les mots de passe ne correspondent pas."); return; }
    if (newPwd.length < 8) { showMsg("err", lang === "en" ? "Password must be at least 8 characters." : "8 caractères minimum."); return; }
    setPwdSaving(true);
    const { error: verifyErr } = await supabase.auth.signInWithPassword({ email: profile?.email ?? "", password: currentPwd });
    if (verifyErr) {
      setPwdSaving(false);
      showMsg("err", lang === "en" ? "Current password is incorrect." : "Mot de passe actuel incorrect.");
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: newPwd });
    setPwdSaving(false);
    if (!error) { setCurrentPwd(""); setNewPwd(""); setConfirmPwd(""); setPwdSection(false); }
    error ? showMsg("err", lang === "en" ? "Password change failed." : "Échec.") : showMsg("ok", lang === "en" ? "Password changed!" : "Mot de passe modifié !");
  };

  const onSaveSchoolInfo = async (e: FormEvent) => {
    e.preventDefault();
    setSchoolInfoSaving(true);
    try {
      const updates = [
        { key: "school_name_en", value: schoolNameEn.trim() },
        { key: "school_name_fr", value: schoolNameFr.trim() },
        { key: "school_tagline_en", value: taglineEn.trim() },
        { key: "school_tagline_fr", value: taglineFr.trim() },
      ];
      const { error } = await supabase.from("site_settings").upsert(updates.map(u => ({ ...u, updated_at: new Date().toISOString() })));
      if (error) throw error;
      showMsg("ok", lang === "en" ? "School information saved!" : "Informations de l'école enregistrées !");
    } catch {
      showMsg("err", lang === "en" ? "Failed to save." : "Échec de l'enregistrement.");
    } finally {
      setSchoolInfoSaving(false);
    }
  };

  const onSaveNotifications = async (next: { notifyEnrollment?: boolean; notifyPayment?: boolean; notifyCertificate?: boolean; notifySms?: boolean }) => {
    setNotifSaving(true);
    try {
      const values = {
        notify_new_enrollment: String(next.notifyEnrollment ?? notifyEnrollment),
        notify_payment_received: String(next.notifyPayment ?? notifyPayment),
        notify_certificate_issued: String(next.notifyCertificate ?? notifyCertificate),
        notify_sms_enabled: String(next.notifySms ?? notifySms),
      };
      const { error } = await supabase.from("site_settings").upsert(
        Object.entries(values).map(([key, value]) => ({ key, value, updated_at: new Date().toISOString() }))
      );
      if (error) throw error;
    } catch {
      showMsg("err", lang === "en" ? "Failed to save notification settings." : "Échec de l'enregistrement.");
    } finally {
      setNotifSaving(false);
    }
  };

  const onSavePaymentSettings = async (e: FormEvent) => {
    e.preventDefault();
    setPaymentSettingsSaving(true);
    try {
      const updates = [
        { key: "paystack_public_key", value: paystackKey.trim() },
        { key: "fee_reg_certificate", value: feeRegCertificate || "10000" },
        { key: "fee_reg_diploma", value: feeRegDiploma || "0" },
        { key: "fee_reg_pastoral", value: feeRegPastoral || "0" },
        { key: "fee_certificate", value: feeCertificate || "0" },
      ];
      const { error } = await supabase.from("site_settings").upsert(updates.map(u => ({ ...u, updated_at: new Date().toISOString() })));
      if (error) throw error;
      showMsg("ok", lang === "en" ? "Payment settings saved!" : "Paramètres de paiement enregistrés !");
    } catch {
      showMsg("err", lang === "en" ? "Failed to save payment settings." : "Échec de l'enregistrement.");
    } finally {
      setPaymentSettingsSaving(false);
    }
  };

  const addBankAccount = () => {
    setBankAccounts(prev => [
      ...prev,
      { id: `new-${Date.now()}`, bank_name: "", account_name: "", account_number: "", currency: "NGN", is_active: false, sort_order: prev.length },
    ]);
  };

  const updateBankAccountLocal = (id: string, patch: Partial<BankAccount>) => {
    setBankAccounts(prev => prev.map(a => (a.id === id ? { ...a, ...patch } : a)));
  };

  const saveBankAccount = async (acc: BankAccount) => {
    if (!acc.bank_name.trim() || !acc.account_name.trim() || !acc.account_number.trim()) {
      showMsg("err", lang === "en" ? "Fill in all bank account fields before saving." : "Remplissez tous les champs avant d'enregistrer.");
      return;
    }
    setSavingBankId(acc.id);
    try {
      const payload = {
        bank_name: acc.bank_name.trim(),
        account_name: acc.account_name.trim(),
        account_number: acc.account_number.trim(),
        currency: acc.currency,
        is_active: acc.is_active,
        sort_order: acc.sort_order,
      };
      if (acc.id.startsWith("new-")) {
        const { data, error } = await supabase.from("bank_accounts").insert(payload).select().single();
        if (error) throw error;
        setBankAccounts(prev => prev.map(a => (a.id === acc.id ? (data as BankAccount) : a)));
      } else {
        const { error } = await supabase.from("bank_accounts").update(payload).eq("id", acc.id);
        if (error) throw error;
      }
      showMsg("ok", lang === "en" ? "Bank account saved!" : "Compte bancaire enregistré !");
    } catch {
      showMsg("err", lang === "en" ? "Failed to save bank account." : "Échec de l'enregistrement.");
    } finally {
      setSavingBankId(null);
    }
  };

  const deleteBankAccount = async (acc: BankAccount) => {
    const ok = await confirm({
      title: lang === "en" ? "Remove bank account?" : "Supprimer ce compte bancaire ?",
      message: lang === "en" ? "Students will no longer see this account for manual transfers." : "Les étudiants ne verront plus ce compte pour les virements manuels.",
      confirmLabel: lang === "en" ? "Remove" : "Supprimer",
      cancelLabel: lang === "en" ? "Cancel" : "Annuler",
      tone: "danger",
    });
    if (!ok) return;
    setBankAccounts(prev => prev.filter(a => a.id !== acc.id));
    if (!acc.id.startsWith("new-")) await supabase.from("bank_accounts").delete().eq("id", acc.id);
  };

  return (
    <AdminLayout title={lang === "en" ? "Settings" : "Paramètres"}>
      <div className="max-w-2xl">
        <div className="mb-6"><h2 className="text-2xl font-black text-ink">{lang === "en" ? "Settings" : "Paramètres"}</h2></div>
        <div className="rounded-2xl bg-navy p-6 mb-6 flex items-center gap-5 animate-fade-in-up">
          {profile && (
            <AvatarUpload
              userId={profile.id}
              fullName={fullName || profile.full_name}
              avatarUrl={avatarUrl}
              lang={lang}
              onUploaded={setAvatarUrl}
            />
          )}
          <div><div className="text-white font-black text-lg">{profile?.full_name}</div><div className="text-white/50 text-sm">{profile?.email}</div><span className="inline-block mt-2 text-xs font-bold bg-amber-400/15 text-amber-300 border border-amber-400/25 px-2.5 py-0.5 rounded-full">Administrator</span></div>
        </div>
        {msg && <div className={`mb-4 px-4 py-3 rounded-xl text-sm font-semibold flex items-center gap-2 animate-fade-in ${msg.type === "ok" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>{msg.type === "ok" ? <CheckCircle2 className="w-4 h-4" strokeWidth={2} /> : <XCircle className="w-4 h-4" strokeWidth={2} />}{msg.text}</div>}
        <div className="card p-6 mb-4 animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
          <h3 className="font-bold text-ink mb-1 flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-navy" strokeWidth={2} />
            {lang === "en" ? "Currency Settings" : "Paramètres de Devise"}
          </h3>
          <p className="text-xs text-slate mb-4">
            {lang === "en"
              ? "All amounts are stored in USD. Set the exchange rate used to display amounts in Naira across the site."
              : "Tous les montants sont enregistrés en USD. Définissez le taux utilisé pour afficher les montants en Naira."}
          </p>
          <div className="mb-4">
            <label className="label">{lang === "en" ? "Your display currency" : "Votre devise d'affichage"}</label>
            <div className="flex gap-2">
              {(["USD", "EUR", "NGN"] as const).map(cur => (
                <button
                  key={cur}
                  type="button"
                  onClick={() => setCurrency(cur)}
                  className={`flex-1 py-2 rounded-xl border text-sm font-bold transition-all duration-150
                    ${currency === cur ? "border-navy bg-navy/5 text-navy" : "border-gray-200 text-slate hover:border-navy/30"}`}
                >
                  {cur === "USD" ? "$ USD" : cur === "EUR" ? "€ EUR" : "₦ NGN"}
                </button>
              ))}
            </div>
          </div>
          <form onSubmit={onSaveRate} className="space-y-2">
            <label className="label">{lang === "en" ? "Exchange Rate (1 USD = ? NGN)" : "Taux de Change (1 USD = ? NGN)"}</label>
            <div className="flex gap-3">
              <input type="number" min="1" step="0.01" value={rateInput} onChange={e => setRateInput(e.target.value)} className="input" />
              <button type="submit" disabled={rateSaving} className="btn-primary px-5 disabled:opacity-60 disabled:translate-y-0 whitespace-nowrap">
                {rateSaving ? "…" : (lang === "en" ? "Save" : "Enregistrer")}
              </button>
            </div>
            <p className="text-xs text-gray-400">
              {lang === "en" ? "This rate applies site-wide for anyone viewing amounts in Naira." : "Ce taux s'applique à l'ensemble du site pour les montants affichés en Naira."}
            </p>
          </form>

          {/* EUR Rate */}
          <form onSubmit={onSaveEurRate} className="space-y-2 mt-5 pt-5 border-t border-gray-100">
            <label className="label">{lang === "en" ? "EUR Exchange Rate (1 USD = ? EUR)" : "Taux EUR (1 USD = ? EUR)"}</label>
            <div className="flex gap-3">
              <input type="number" min="0.01" step="0.001" value={eurInput} onChange={e => setEurInput(e.target.value)} className="input" />
              <button type="submit" disabled={eurSaving} className="btn-primary px-5 disabled:opacity-60 disabled:translate-y-0 whitespace-nowrap">
                {eurSaving ? "…" : (lang === "en" ? "Save EUR" : "Sauver EUR")}
              </button>
            </div>
            <p className="text-xs text-gray-400">
              {lang === "en" ? `Current: $1 USD = €${usdToEur ?? 0.92}` : `Actuel : 1$ USD = €${usdToEur ?? 0.92}`}
            </p>
          </form>
        </div>

        <div className="card p-6 mb-4 animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
          <h3 className="font-bold text-ink mb-1 flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-navy" strokeWidth={2} />
            {lang === "en" ? "Payment Settings" : "Paramètres de Paiement"}
          </h3>
          <p className="text-xs text-slate mb-4">
            {lang === "en"
              ? "Configure Paystack and the fixed fee amounts shown on the student payment form."
              : "Configurez Paystack et les montants fixes affichés sur le formulaire de paiement."}
          </p>
          <form onSubmit={onSavePaymentSettings} className="space-y-4">
            <div>
              <label className="label">Paystack Public Key</label>
              <div className="relative">
                <input
                  type={showPaystackKey ? "text" : "password"}
                  value={paystackKey}
                  onChange={e => setPaystackKey(e.target.value)}
                  placeholder="pk_live_…"
                  className="input pr-10 font-mono text-xs"
                />
                <button type="button" onClick={() => setShowPaystackKey(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-ink transition-colors">
                  {showPaystackKey ? <EyeOff className="w-4 h-4" strokeWidth={2} /> : <Eye className="w-4 h-4" strokeWidth={2} />}
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                {lang === "en"
                  ? "Public key only — never paste a secret key here. The secret key lives only in your verify-paystack-payment Edge Function's environment."
                  : "Clé publique uniquement — ne collez jamais une clé secrète ici."}
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="label">{lang === "en" ? "Certificate Programme — Registration Fee (₦)" : "Programme Certificat — Frais d'Inscription (₦)"}</label>
                <input type="number" min="0" step="0.01" value={feeRegCertificate} onChange={e => setFeeRegCertificate(e.target.value)} className="input" />
                <p className="text-xs text-gray-400 mt-1">{lang === "en" ? "Default ₦10,000, applies to every Certificate programme." : "Par défaut ₦10 000, s'applique à tous les programmes Certificat."}</p>
              </div>
              <div>
                <label className="label">{lang === "en" ? "Diploma Programme — Registration Fee (₦)" : "Programme Diplôme — Frais d'Inscription (₦)"}</label>
                <input type="number" min="0" step="0.01" value={feeRegDiploma} onChange={e => setFeeRegDiploma(e.target.value)} className="input" />
              </div>
              <div>
                <label className="label">{lang === "en" ? "Pastoral Ordination & Licensing — Registration Fee (₦)" : "Ordination et Licence Pastorale — Frais d'Inscription (₦)"}</label>
                <input type="number" min="0" step="0.01" value={feeRegPastoral} onChange={e => setFeeRegPastoral(e.target.value)} className="input" />
              </div>
            </div>
            <div className="mt-4">
              <div>
                <label className="label">{lang === "en" ? "Certificate Fee (USD)" : "Frais de Certificat (USD)"}</label>
                <input type="number" min="0" step="0.01" value={feeCertificate} onChange={e => setFeeCertificate(e.target.value)} className="input" />
              </div>
            </div>
            <button type="submit" disabled={paymentSettingsSaving} className="btn-primary w-full py-2.5 disabled:opacity-60 disabled:translate-y-0">
              {paymentSettingsSaving ? "…" : (lang === "en" ? "Save Payment Settings" : "Enregistrer")}
            </button>
          </form>
        </div>

        <div className="card p-6 mb-4 animate-fade-in-up" style={{ animationDelay: "0.11s" }}>
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-bold text-ink flex items-center gap-2">
              <Building2 className="w-4 h-4 text-navy" strokeWidth={2} />
              {lang === "en" ? "Bank Accounts" : "Comptes Bancaires"}
            </h3>
            <button onClick={addBankAccount} className="flex items-center gap-1.5 text-xs font-bold text-navy hover:text-brand transition-colors">
              <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
              {lang === "en" ? "Add Account" : "Ajouter"}
            </button>
          </div>
          <p className="text-xs text-slate mb-4">
            {lang === "en"
              ? "Shown to students choosing Bank Transfer on the payment form. Only active accounts are visible to students."
              : "Affichés aux étudiants qui choisissent le virement bancaire. Seuls les comptes actifs sont visibles."}
          </p>
          {bankAccountsLoading ? (
            <div className="space-y-3">{Array.from({ length: 2 }).map((_, i) => <div key={i} className="skeleton h-24 rounded-xl" />)}</div>
          ) : bankAccounts.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">{lang === "en" ? "No bank accounts yet." : "Aucun compte bancaire."}</p>
          ) : (
            <div className="space-y-3">
              {bankAccounts.map(acc => (
                <div key={acc.id} className="bg-gray-50 rounded-xl p-4 border border-gray-100 space-y-2.5">
                  <div className="grid grid-cols-2 gap-2.5">
                    <input type="text" value={acc.bank_name} onChange={e => updateBankAccountLocal(acc.id, { bank_name: e.target.value })} placeholder={lang === "en" ? "Bank name (e.g. FCMB)" : "Nom de la banque"} className="input text-sm" />
                    <select value={acc.currency} onChange={e => updateBankAccountLocal(acc.id, { currency: e.target.value })} className="input text-sm">
                      <option value="NGN">NGN</option>
                      <option value="USD">USD</option>
                    </select>
                  </div>
                  <input type="text" value={acc.account_name} onChange={e => updateBankAccountLocal(acc.id, { account_name: e.target.value })} placeholder={lang === "en" ? "Account name" : "Nom du compte"} className="input text-sm" />
                  <input type="text" value={acc.account_number} onChange={e => updateBankAccountLocal(acc.id, { account_number: e.target.value })} placeholder={lang === "en" ? "Account number" : "Numéro de compte"} className="input text-sm font-mono" />
                  <div className="flex items-center justify-between pt-1">
                    <ToggleSwitch checked={acc.is_active} onChange={(v) => updateBankAccountLocal(acc.id, { is_active: v })} label={lang === "en" ? "Active" : "Actif"} />
                    <div className="flex items-center gap-2">
                      <button onClick={() => deleteBankAccount(acc)} className="text-gray-400 hover:text-red-500 transition-colors p-1.5">
                        <Trash2 className="w-4 h-4" strokeWidth={2} />
                      </button>
                      <button onClick={() => saveBankAccount(acc)} disabled={savingBankId === acc.id} className="btn-primary px-4 py-1.5 text-xs disabled:opacity-60 disabled:translate-y-0">
                        {savingBankId === acc.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={2.5} /> : (lang === "en" ? "Save" : "Enregistrer")}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card p-6 mb-4 animate-fade-in-up" style={{ animationDelay: "0.06s" }}>
          <h3 className="font-bold text-ink mb-1 flex items-center gap-2">
            <School className="w-4 h-4 text-navy" strokeWidth={2} />
            {lang === "en" ? "School Information" : "Informations de l'École"}
          </h3>
          <p className="text-xs text-slate mb-4">
            {lang === "en" ? "Shown across the public site and on certificates." : "Affiché sur le site public et sur les certificats."}
          </p>
          <form onSubmit={onSaveSchoolInfo} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="label">{lang === "en" ? "School Name (English)" : "Nom de l'École (Anglais)"}</label>
                <input type="text" value={schoolNameEn} onChange={e => setSchoolNameEn(e.target.value)} className="input" />
              </div>
              <div>
                <label className="label">{lang === "en" ? "School Name (French)" : "Nom de l'École (Français)"}</label>
                <input type="text" value={schoolNameFr} onChange={e => setSchoolNameFr(e.target.value)} className="input" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="label">{lang === "en" ? "Tagline (English)" : "Slogan (Anglais)"}</label>
                <input type="text" value={taglineEn} onChange={e => setTaglineEn(e.target.value)} className="input" />
              </div>
              <div>
                <label className="label">{lang === "en" ? "Tagline (French)" : "Slogan (Français)"}</label>
                <input type="text" value={taglineFr} onChange={e => setTaglineFr(e.target.value)} className="input" />
              </div>
            </div>
            <button type="submit" disabled={schoolInfoSaving} className="btn-primary w-full py-2.5 disabled:opacity-60 disabled:translate-y-0">
              {schoolInfoSaving ? "…" : (lang === "en" ? "Save School Information" : "Enregistrer")}
            </button>
          </form>
        </div>

        <div className="card p-6 mb-4 animate-fade-in-up" style={{ animationDelay: "0.07s" }}>
          <h3 className="font-bold text-ink mb-1 flex items-center gap-2">
            <Bell className="w-4 h-4 text-navy" strokeWidth={2} />
            {lang === "en" ? "Notification Settings" : "Paramètres de Notification"}
          </h3>
          <p className="text-xs text-slate mb-4">
            {lang === "en" ? "Choose which events trigger notifications to admins and students." : "Choisissez les événements qui déclenchent des notifications."}
          </p>
          <div className="space-y-3">
            <div className="flex items-center justify-between bg-gray-50 rounded-xl p-3.5">
              <div>
                <p className="text-sm font-semibold text-ink">{lang === "en" ? "New Enrollment" : "Nouvelle Inscription"}</p>
                <p className="text-xs text-gray-400">{lang === "en" ? "Email when a student enrolls in a course" : "E-mail lors d'une inscription"}</p>
              </div>
              <ToggleSwitch checked={notifyEnrollment} onChange={(v) => { setNotifyEnrollment(v); onSaveNotifications({ notifyEnrollment: v }); }} disabled={notifSaving} />
            </div>
            <div className="flex items-center justify-between bg-gray-50 rounded-xl p-3.5">
              <div>
                <p className="text-sm font-semibold text-ink">{lang === "en" ? "Payment Received" : "Paiement Reçu"}</p>
                <p className="text-xs text-gray-400">{lang === "en" ? "Email when a payment succeeds or a transfer is confirmed" : "E-mail lors d'un paiement confirmé"}</p>
              </div>
              <ToggleSwitch checked={notifyPayment} onChange={(v) => { setNotifyPayment(v); onSaveNotifications({ notifyPayment: v }); }} disabled={notifSaving} />
            </div>
            <div className="flex items-center justify-between bg-gray-50 rounded-xl p-3.5">
              <div>
                <p className="text-sm font-semibold text-ink">{lang === "en" ? "Certificate Issued" : "Certificat Émis"}</p>
                <p className="text-xs text-gray-400">{lang === "en" ? "Email when a certificate is issued to a student" : "E-mail lors de l'émission d'un certificat"}</p>
              </div>
              <ToggleSwitch checked={notifyCertificate} onChange={(v) => { setNotifyCertificate(v); onSaveNotifications({ notifyCertificate: v }); }} disabled={notifSaving} />
            </div>
            <div className="flex items-center justify-between bg-gray-50 rounded-xl p-3.5">
              <div>
                <p className="text-sm font-semibold text-ink">{lang === "en" ? "SMS Notifications" : "Notifications SMS"}</p>
                <p className="text-xs text-gray-400">{lang === "en" ? "Send SMS in addition to email for the events above" : "Envoyer un SMS en plus de l'e-mail"}</p>
              </div>
              <ToggleSwitch checked={notifySms} onChange={(v) => { setNotifySms(v); onSaveNotifications({ notifySms: v }); }} disabled={notifSaving} />
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-3">
            {lang === "en"
              ? "These toggles control whether notifications are sent; actual email/SMS delivery requires a configured provider."
              : "Ces options contrôlent l'envoi des notifications ; la livraison réelle nécessite un fournisseur configuré."}
          </p>
        </div>

        <div className="card p-6 mb-4 animate-fade-in-up" style={{ animationDelay: "0.08s" }}>
          <h3 className="font-bold text-ink mb-4">{lang === "en" ? "Admin Information" : "Informations Admin"}</h3>
          <form onSubmit={onSave} className="space-y-4">
            <div><label className="label">{lang === "en" ? "Full Name" : "Nom Complet"}</label><input type="text" value={fullName} onChange={e => setFullName(e.target.value)} className="input" /></div>
            <div><label className="label">{lang === "en" ? "Email" : "E-mail"}</label><input type="email" value={profile?.email ?? ""} disabled className="input bg-gray-50 text-gray-400 cursor-not-allowed" /></div>
            <div><label className="label">{lang === "en" ? "Phone" : "Téléphone"}</label><input type="tel" value={phone} onChange={e => setPhone(e.target.value)} className="input" /></div>
            <button type="submit" disabled={saving} className="btn-primary w-full py-2.5 disabled:opacity-60 disabled:translate-y-0">{saving ? "…" : (lang === "en" ? "Save Changes" : "Enregistrer")}</button>
          </form>
        </div>
        <div className="card p-6 animate-fade-in-up" style={{ animationDelay: "0.12s" }}>
          <button onClick={() => setPwdSection(p => !p)} className="w-full flex items-center justify-between">
            <h3 className="font-bold text-ink">{lang === "en" ? "Change Password" : "Changer le Mot de Passe"}</h3>
            <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${pwdSection ? "rotate-180" : ""}`} strokeWidth={2.5} />
          </button>
          {pwdSection && <form onSubmit={onChangePwd} className="mt-5 space-y-4 animate-fade-in">
            <div><label className="label">{lang === "en" ? "Current Password" : "Mot de Passe Actuel"}</label><input type="password" value={currentPwd} onChange={e => setCurrentPwd(e.target.value)} placeholder="••••••••" className="input" /></div>
            <div><label className="label">{lang === "en" ? "New Password" : "Nouveau Mot de Passe"}</label><input type="password" value={newPwd} onChange={e => setNewPwd(e.target.value)} placeholder="••••••••" minLength={8} className="input" /></div>
            <div><label className="label">{lang === "en" ? "Confirm New Password" : "Confirmer le Nouveau Mot de Passe"}</label><input type="password" value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)} placeholder="••••••••" className="input" /></div>
            <button type="submit" disabled={pwdSaving} className="btn-primary w-full py-2.5 disabled:opacity-60 disabled:translate-y-0">{pwdSaving ? "…" : (lang === "en" ? "Update Password" : "Mettre à Jour")}</button>
          </form>}
        </div>
      </div>
    </AdminLayout>
  );
}
