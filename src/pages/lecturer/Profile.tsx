import { useState, FormEvent, useEffect } from "react";
import LecturerLayout from "@/components/LecturerLayout";
import { useToast } from "@/contexts/ToastContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { useTranslation } from "react-i18next";
import { CheckCircle2, XCircle, ChevronDown } from "lucide-react";
import { LANGUAGES, COUNTRIES } from "@/lib/constants";
import AvatarUpload from "@/components/AvatarUpload";

export default function LecturerProfile() {
  const { showToast } = useToast();
  const { profile } = useAuth();
  const { i18n } = useTranslation();
  const lang = (i18n.language.startsWith("fr") ? "fr" : "en") as "en" | "fr";

  const [fullName, setFullName]     = useState(profile?.full_name ?? "");
  const [title, setTitle]           = useState(profile?.title ?? "");
  const [phone, setPhone]           = useState(profile?.phone ?? "");
  const [country, setCountry]       = useState(profile?.country ?? "");
  const [langPref, setLangPref]     = useState<string>(profile?.language_pref ?? "en");
  const [avatarUrl, setAvatarUrl]   = useState<string | null>(profile?.avatar_url ?? null);
  const [saving, setSaving]         = useState(false);
  const [pwdSection, setPwdSection] = useState(false);
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd]         = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [pwdSaving, setPwdSaving]   = useState(false);
  const [msg, setMsg]               = useState<{ type: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name ?? "");
      setTitle(profile.title ?? "");
      setPhone(profile.phone ?? "");
      setCountry(profile.country ?? "");
      setLangPref(profile.language_pref ?? "en");
      setAvatarUrl(profile.avatar_url ?? null);
    }
  }, [profile]);

  const showMsg = (type: "ok" | "err", text: string) => { setMsg({ type, text }); setTimeout(() => setMsg(null), 4000); };

  const onSaveProfile = async (e: FormEvent) => {
    e.preventDefault();
    if (!profile?.id) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({ full_name: fullName, title: title || null, phone, country, language_pref: langPref }).eq("id", profile.id);
    setSaving(false);
    if (!error && langPref !== i18n.language) { i18n.changeLanguage(langPref); localStorage.setItem("lwgsm_lang", langPref); }
    error
      ? showMsg("err", lang === "en" ? "Save failed. Please try again." : "Échec de la sauvegarde.")
      : showMsg("ok",  lang === "en" ? "Profile updated successfully!" : "Profil mis à jour !");
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
    error
      ? showMsg("err", lang === "en" ? "Password change failed." : "Échec du changement de mot de passe.")
      : showMsg("ok",  lang === "en" ? "Password changed!" : "Mot de passe modifié !");
  };

  return (
    <LecturerLayout title={lang === "en" ? "My Profile" : "Mon Profil"}>
      <div className="max-w-xl">
        <div className="mb-6 animate-fade-in-up">
          <h2 className="text-2xl font-black text-ink">{lang === "en" ? "My Profile" : "Mon Profil"}</h2>
          <p className="text-sm text-slate mt-0.5">{lang === "en" ? "Manage your account details" : "Gérez vos informations personnelles"}</p>
        </div>

        <div className="rounded-2xl bg-navy p-6 mb-6 flex items-center gap-5 animate-fade-in-up" style={{ animationDelay: "0.04s" }}>
          {profile && (
            <AvatarUpload
              userId={profile.id}
              fullName={fullName || profile.full_name}
              avatarUrl={avatarUrl}
              lang={lang}
              onUploaded={setAvatarUrl}
            />
          )}
          <div>
            <div className="text-white font-black text-lg leading-tight">{profile?.full_name}</div>
            <div className="text-white/50 text-sm mt-0.5">{profile?.email}</div>
            <span className="inline-block mt-2 text-xs font-bold bg-amber-400/15 text-amber-300 border border-amber-400/25 px-2.5 py-0.5 rounded-full capitalize">
              {profile?.role}
            </span>
          </div>
        </div>

        {msg && (
          <div className={`mb-4 px-4 py-3 rounded-xl text-sm font-semibold flex items-center gap-2 animate-fade-in
            ${msg.type === "ok" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
            {msg.type === "ok" ? <CheckCircle2 className="w-4 h-4" strokeWidth={2} /> : <XCircle className="w-4 h-4" strokeWidth={2} />}
            {msg.text}
          </div>
        )}

        <div className="card p-6 mb-4 animate-fade-in-up" style={{ animationDelay: "0.08s" }}>
          <h3 className="font-bold text-ink mb-5 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-navy/5 flex items-center justify-center text-navy text-xs font-black">1</span>
            {lang === "en" ? "Personal Information" : "Informations Personnelles"}
          </h3>
          <form onSubmit={onSaveProfile} className="space-y-4">
            <div>
              <label className="label">{lang === "en" ? "Full Name" : "Nom Complet"}</label>
              <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} className="input" />
            </div>
            <div>
              <label className="label">{lang === "en" ? "Professional Title" : "Titre Professionnel"}</label>
              <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder={lang === "en" ? "e.g. Senior Lecturer, PhD" : "ex. Maître de Conférences"} className="input" />
              <p className="text-xs text-gray-400 mt-1">{lang === "en" ? "Shown to students on your course pages." : "Affiché aux étudiants sur vos pages de cours."}</p>
            </div>
            <div>
              <label className="label">{lang === "en" ? "Email Address" : "Adresse E-mail"}</label>
              <input type="email" value={profile?.email ?? ""} disabled className="input bg-gray-50 text-gray-400 cursor-not-allowed" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">{lang === "en" ? "Phone" : "Téléphone"}</label>
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} className="input" />
              </div>
              <div>
                <label className="label">{lang === "en" ? "Country" : "Pays"}</label>
                <select value={country} onChange={e => setCountry(e.target.value)} className="input">
                  <option value="">{lang === "en" ? "Select…" : "Sélectionner…"}</option>
                  {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="label">{lang === "en" ? "Preferred Language" : "Langue Préférée"}</label>
              <select value={langPref} onChange={e => setLangPref(e.target.value)} className="input">
                {LANGUAGES.map(l => <option key={l.code} value={l.code}>{lang === "en" ? l.en : l.fr}</option>)}
              </select>
            </div>
            <button type="submit" disabled={saving} className="btn-primary w-full py-2.5 disabled:opacity-60 disabled:translate-y-0">
              {saving ? (lang === "en" ? "Saving…" : "Sauvegarde…") : (lang === "en" ? "Save Changes" : "Enregistrer")}
            </button>
          </form>
        </div>

        <div className="card p-6 animate-fade-in-up" style={{ animationDelay: "0.12s" }}>
          <button onClick={() => setPwdSection(p => !p)} className="w-full flex items-center justify-between">
            <h3 className="font-bold text-ink flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-navy/5 flex items-center justify-center text-navy text-xs font-black">2</span>
              {lang === "en" ? "Change Password" : "Changer le Mot de Passe"}
            </h3>
            <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${pwdSection ? "rotate-180" : ""}`} strokeWidth={2.5} />
          </button>
          {pwdSection && (
            <form onSubmit={onChangePwd} className="mt-5 space-y-4 animate-fade-in">
              <div>
                <label className="label">{lang === "en" ? "Current Password" : "Mot de Passe Actuel"}</label>
                <input type="password" value={currentPwd} onChange={e => setCurrentPwd(e.target.value)} placeholder="••••••••" className="input" />
              </div>
              <div>
                <label className="label">{lang === "en" ? "New Password" : "Nouveau Mot de Passe"}</label>
                <input type="password" value={newPwd} onChange={e => setNewPwd(e.target.value)} placeholder="••••••••" minLength={8} className="input" />
              </div>
              <div>
                <label className="label">{lang === "en" ? "Confirm New Password" : "Confirmer le Nouveau Mot de Passe"}</label>
                <input type="password" value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)} placeholder="••••••••" className="input" />
              </div>
              <button type="submit" disabled={pwdSaving} className="btn-primary w-full py-2.5 disabled:opacity-60 disabled:translate-y-0">
                {pwdSaving ? "…" : (lang === "en" ? "Update Password" : "Mettre à Jour")}
              </button>
            </form>
          )}
        </div>
      </div>
    </LecturerLayout>
  );
}
