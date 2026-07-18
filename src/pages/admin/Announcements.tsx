import { useState, FormEvent } from "react";
import AdminLayout from "@/components/AdminLayout";
import AnnouncementsPage from "@/pages/shared/AnnouncementsPage";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "react-i18next";
import { Megaphone, Plus, Send, Calendar, Users, X, Loader2, CheckCircle } from "lucide-react";

const AUDIENCES = [
  { value: "",          en: "Everyone (in-app)", fr: "Tous (dans l'app)" },
  { value: "student",   en: "Students",  fr: "Étudiants" },
  { value: "lecturer",  en: "Lecturers", fr: "Enseignants" },
  { value: "admin",     en: "Admins",    fr: "Administrateurs" },
  { value: "public",    en: "Public (website)", fr: "Public (site web)" },
];

export default function AdminAnnouncements() {
  const { profile } = useAuth();
  const { i18n } = useTranslation();
  const lang = (i18n.language.startsWith("fr") ? "fr" : "en") as "en" | "fr";
  const t = (en: string, fr: string) => lang === "fr" ? fr : en;

  const [showForm, setShowForm] = useState(false);
  const [titleEn, setTitleEn] = useState("");
  const [titleFr, setTitleFr] = useState("");
  const [bodyEn, setBodyEn] = useState("");
  const [bodyFr, setBodyFr] = useState("");
  const [audience, setAudience] = useState("");
  const [scheduleAt, setScheduleAt] = useState("");
  const [sendNow, setSendNow] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const reset = () => {
    setTitleEn(""); setTitleFr(""); setBodyEn(""); setBodyFr("");
    setAudience(""); setScheduleAt(""); setSendNow(true);
    setError(""); setSuccess(false);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!titleEn.trim() || !bodyEn.trim()) { setError(t("English title and body are required.", "Le titre et le corps en anglais sont requis.")); return; }
    setSubmitting(true); setError("");
    const { error: err } = await supabase.from("announcements").insert({
      title_en: titleEn.trim(),
      title_fr: titleFr.trim() || null,
      body_en: bodyEn.trim(),
      body_fr: bodyFr.trim() || null,
      target_role: audience || null,
      scheduled_at: sendNow ? new Date().toISOString() : scheduleAt || new Date().toISOString(),
      author_id: profile?.id,
    });
    setSubmitting(false);
    if (err) { setError(err.message); return; }
    setSuccess(true);
    setTimeout(() => { reset(); setShowForm(false); }, 2000);
  };

  return (
    <AdminLayout breadcrumbs={[{ label: t("Dashboard","Tableau de bord"), to: "/admin" }, { label: t("Announcements","Annonces") }]}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-black text-[#0A1628] text-2xl">{t("Announcements","Annonces")}</h1>
            <p className="text-gray-500 text-sm mt-1">{t("Broadcast messages to your school community","Diffusez des messages à votre communauté scolaire")}</p>
          </div>
          <button onClick={() => { setShowForm(true); reset(); }}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#F97316] text-white font-bold rounded-xl hover:bg-amber-600 transition-colors text-sm">
            <Plus className="w-4 h-4" strokeWidth={2.5} />
            {t("New Announcement","Nouvelle Annonce")}
          </button>
        </div>

        {/* Create form */}
        {showForm && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#F97316]/10 flex items-center justify-center">
                  <Megaphone className="w-4 h-4 text-[#F97316]" strokeWidth={2} />
                </div>
                <h2 className="font-bold text-[#0A1628] text-base">{t("Create Announcement","Créer une Annonce")}</h2>
              </div>
              <button onClick={() => setShowForm(false)} className="text-gray-300 hover:text-gray-500 transition-colors"><X className="w-5 h-5" strokeWidth={2} /></button>
            </div>

            <form onSubmit={submit} className="p-6 space-y-5">
              {success && (
                <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-green-700 text-sm font-semibold">
                  <CheckCircle className="w-4 h-4" strokeWidth={2.5} />{t("Announcement published!","Annonce publiée!")}
                </div>
              )}
              {error && <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700 text-sm">{error}</div>}

              {/* Bilingual titles */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                    {t("Title (English)","Titre (Anglais)")} <span className="text-red-400">*</span>
                  </label>
                  <input type="text" value={titleEn} onChange={e => setTitleEn(e.target.value)} required
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/20 focus:border-[#F97316]" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">{t("Title (French)","Titre (Français)")}</label>
                  <input type="text" value={titleFr} onChange={e => setTitleFr(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/20 focus:border-[#F97316]" />
                </div>
              </div>

              {/* Bilingual bodies */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                    {t("Body (English)","Corps (Anglais)")} <span className="text-red-400">*</span>
                  </label>
                  <textarea rows={5} value={bodyEn} onChange={e => setBodyEn(e.target.value)} required
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/20 focus:border-[#F97316] resize-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">{t("Body (French)","Corps (Français)")}</label>
                  <textarea rows={5} value={bodyFr} onChange={e => setBodyFr(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/20 focus:border-[#F97316] resize-none" />
                </div>
              </div>

              {/* Audience + Schedule */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                    <Users className="inline w-3 h-3 mr-1" strokeWidth={2.5} />{t("Target Audience","Audience Cible")}
                  </label>
                  <select value={audience} onChange={e => setAudience(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/20 focus:border-[#F97316] bg-white">
                    {AUDIENCES.map(a => <option key={a.value} value={a.value}>{lang === "fr" ? a.fr : a.en}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                    <Calendar className="inline w-3 h-3 mr-1" strokeWidth={2.5} />{t("Publish","Publier")}
                  </label>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" checked={sendNow} onChange={() => setSendNow(true)} className="accent-[#F97316]" />
                      <span className="text-sm text-gray-600">{t("Now","Maintenant")}</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" checked={!sendNow} onChange={() => setSendNow(false)} className="accent-[#F97316]" />
                      <span className="text-sm text-gray-600">{t("Schedule","Planifier")}</span>
                    </label>
                  </div>
                  {!sendNow && (
                    <input type="datetime-local" value={scheduleAt} onChange={e => setScheduleAt(e.target.value)} min={new Date().toISOString().slice(0,16)}
                      className="mt-2 w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/20 focus:border-[#F97316]" />
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button type="submit" disabled={submitting}
                  className="flex items-center gap-2 px-5 py-2.5 bg-[#F97316] text-white font-bold rounded-xl hover:bg-amber-600 transition-colors disabled:opacity-50 text-sm">
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2.5} /> : <Send className="w-4 h-4" strokeWidth={2.5} />}
                  {sendNow ? t("Publish Now","Publier Maintenant") : t("Schedule","Planifier")}
                </button>
                <button type="button" onClick={() => { setShowForm(false); reset(); }}
                  className="px-5 py-2.5 border border-gray-200 text-gray-600 font-semibold rounded-xl hover:bg-gray-50 transition-colors text-sm">
                  {t("Cancel","Annuler")}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* List */}
        <div>
          <h2 className="font-bold text-[#0A1628] text-base mb-3">{t("Published Announcements","Annonces Publiées")}</h2>
          <AnnouncementsPage role="admin" />
        </div>
      </div>
    </AdminLayout>
  );
}
