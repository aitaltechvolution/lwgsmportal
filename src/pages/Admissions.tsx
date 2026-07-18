import { useState, FormEvent, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/lib/supabase";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2, ArrowLeft, Search, Loader2 } from "lucide-react";
import { useToast } from "@/contexts/ToastContext";

interface Program { id: string; title: string; title_fr?: string | null; type: string; }

const STEPS = [
  { num: 1, en: "Choose Your Programme",  fr: "Choisissez votre programme",  desc_en: "Browse our ministry and leadership programmes and select the one that matches your calling.", desc_fr: "Parcourez nos programmes de ministère et de leadership." },
  { num: 2, en: "Prepare Documents",      fr: "Préparez vos documents",       desc_en: "Gather your ID, photo, transcripts and any required references or pastoral recommendations.", desc_fr: "Rassemblez votre pièce d'identité, photo, relevés de notes et recommandations pastorales." },
  { num: 3, en: "Submit Application",     fr: "Soumettez votre candidature",  desc_en: "Complete the online form below. Our admissions team will acknowledge within 48 hours.", desc_fr: "Remplissez le formulaire ci-dessous. Notre équipe vous accusera réception sous 48 heures." },
  { num: 4, en: "Await Decision",         fr: "Attendez la décision",          desc_en: "Our admissions team reviews every application prayerfully within 5–10 business days.", desc_fr: "Notre équipe examine chaque candidature dans la prière sous 5 à 10 jours ouvrables." },
  { num: 5, en: "Enrolment",              fr: "Inscription",                   desc_en: "Upon approval, complete your enrolment and fee payment to secure your place and begin your journey.", desc_fr: "Après approbation, complétez votre inscription et le paiement pour commencer votre parcours." },
];

export default function Admissions() {
  const { i18n } = useTranslation();
  const lang = i18n.language.startsWith("fr") ? "fr" : "en";
  const { showToast } = useToast();

  // ✅ FIX #2: Read program_id from URL query param
  const [searchParams] = useSearchParams();
  const prefilledProgramId = searchParams.get("program_id") ?? "";

  const [programs, setPrograms] = useState<Program[]>([]);
  const [programSearch, setProgramSearch] = useState("");
  const [form, setForm] = useState({
    first_name: "", last_name: "", email: "", phone: "",
    program_id: prefilledProgramId,
    country: "", message: "",
  });
  const [status, setStatus] = useState<"idle" | "sending" | "ok" | "err">("idle");

  useEffect(() => {
    supabase.from("programs").select("id,title,title_fr,type").order("type").order("title")
      .then(({ data }) => setPrograms(data ?? []));
  }, []);

  // ✅ FIX #2: When programs load and we have a prefilled ID, update form
  useEffect(() => {
    if (prefilledProgramId && programs.length > 0) {
      setForm(f => ({ ...f, program_id: prefilledProgramId }));
    }
  }, [prefilledProgramId, programs]);

  const set = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [k]: e.target.value }));

  const filteredPrograms = programs.filter(p => {
    if (!programSearch) return true;
    const q = programSearch.toLowerCase();
    return p.title.toLowerCase().includes(q) || (p.title_fr ?? "").toLowerCase().includes(q);
  });

  const selectedProgram = programs.find(p => p.id === form.program_id);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setStatus("sending");
    const { error } = await supabase.from("applications").insert({
      applicant_name:  `${form.first_name} ${form.last_name}`.trim(),
      applicant_email: form.email,
      phone:           form.phone || null,
      program_id:      form.program_id || null,
      nationality:     form.country || null,
      work_experience: form.message || null,
      status:          "pending",
    });
    if (error) {
      setStatus("err");
      showToast("error", lang === "en" ? "Submission failed. Please try again." : "Échec. Veuillez réessayer.");
    } else {
      setStatus("ok");
      showToast("success",
        lang === "en" ? "Application submitted! We'll be in touch shortly." : "Candidature soumise ! Nous vous contacterons bientôt."
      );
    }
  };

  const inputCls = "w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-navy/50 focus:ring-2 focus:ring-navy/10 transition-all shadow-sm";

  return (
    <div className="min-h-screen bg-white">

      {/* ── Hero ── */}
      <section className="relative bg-navy py-20 px-4 overflow-hidden">
        <img src="https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=1400&q=80&fit=crop"
          alt="" aria-hidden
          className="absolute inset-0 w-full h-full object-cover opacity-10 pointer-events-none" />
        <div className="relative max-w-4xl mx-auto text-center animate-fade-in-up">
          <p className="text-amber-400 text-xs uppercase tracking-[0.2em] font-bold mb-4">
            {lang === "en" ? "Admissions" : "Admissions"}
          </p>
          <h1 className="text-4xl md:text-5xl font-black text-white mb-4 leading-tight">
            {lang === "en"
              ? "Answer Your Calling with Excellence"
              : "Répondez à Votre Vocation avec Excellence"}
          </h1>
          <p className="text-white/60 max-w-xl mx-auto text-sm leading-relaxed">
            {lang === "en"
              ? "Living Waters Global School of Ministry equips ministers, marketplace leaders and kingdom entrepreneurs with the skills to lead God's work with excellence. Applications are open year-round."
              : "Living Waters Global School of Ministry équipe les ministres et les leaders du marché avec les compétences pour diriger l'œuvre de Dieu avec excellence."}
          </p>
        </div>
      </section>

      {/* ── Steps ── */}
      <section className="py-14 px-4 bg-gray-50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-black text-navy text-center mb-10">
            {lang === "en" ? "How to Apply" : "Comment Candidater"}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-5">
            {STEPS.map((s, i) => (
              <div key={s.num} className="relative text-center group animate-fade-in-up" style={{ animationDelay: `${i * 0.08}s` }}>
                {i < STEPS.length - 1 && (
                  <div className="hidden sm:block absolute top-5 left-[60%] w-full h-0.5 bg-navy/10" />
                )}
                <div className="w-10 h-10 rounded-full bg-navy text-white font-black text-lg flex items-center justify-center mx-auto mb-3 shadow-lg group-hover:bg-brand transition-colors duration-200 relative z-10">
                  {s.num}
                </div>
                <div className="font-bold text-navy text-sm mb-1">{lang === "en" ? s.en : s.fr}</div>
                <p className="text-xs text-gray-400 leading-relaxed">{lang === "en" ? s.desc_en : s.desc_fr}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Form ── */}
      <section className="py-16 px-4 bg-white">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-8 animate-fade-in-up">
            <h2 className="text-2xl font-black text-navy mb-2">
              {lang === "en" ? "Application Form" : "Formulaire de Candidature"}
            </h2>
            <p className="text-gray-400 text-sm">
              {lang === "en"
                ? "Fill in your details and our admissions team will contact you within 5–10 business days."
                : "Remplissez vos informations et notre équipe vous contactera sous 5 à 10 jours ouvrables."}
            </p>
          </div>

          {status === "ok" ? (
            <div className="bg-green-50 border border-green-100 rounded-2xl p-10 text-center animate-scale-in shadow-lg">
              <div className="w-14 h-14 rounded-2xl bg-green-100 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-7 h-7 text-green-600" strokeWidth={2} />
              </div>
              <h3 className="font-bold text-green-700 text-xl mb-2">
                {lang === "en" ? "Application Submitted!" : "Candidature Soumise !"}
              </h3>
              <p className="text-green-600 text-sm mb-2">
                {lang === "en"
                  ? "We've received your application. Our admissions team will review it prayerfully and contact you within 5–10 business days."
                  : "Nous avons reçu votre candidature. Notre équipe la reviewera avec soin et vous contactera sous 5 à 10 jours ouvrables."}
              </p>
              {selectedProgram && (
                <p className="text-green-700 font-semibold text-sm mb-5">
                  📚 {lang === "en" ? "Applied for:" : "Programme choisi :"}{" "}
                  {(lang === "fr" && selectedProgram.title_fr) ? selectedProgram.title_fr : selectedProgram.title}
                </p>
              )}
              <Link to="/" className="inline-flex items-center gap-1.5 text-navy text-sm hover:underline font-semibold">
                <ArrowLeft className="w-4 h-4" strokeWidth={2.5} />
                {lang === "en" ? "Back to home" : "Retour à l'accueil"}
              </Link>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-5 animate-fade-in-up bg-white rounded-2xl border border-gray-100 shadow-xl p-7">

              {/* ✅ FIX #2: Programme selector with search + auto-fill */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  {lang === "en" ? "Programme of Interest" : "Programme Souhaité"} *
                </label>

                {/* Show selected programme badge if prefilled */}
                {selectedProgram && (
                  <div className="mb-2 flex items-center gap-2 bg-navy/5 border border-navy/15 rounded-xl px-3.5 py-2.5">
                    <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" strokeWidth={2.5} />
                    <span className="text-sm font-semibold text-navy truncate">
                      {(lang === "fr" && selectedProgram.title_fr) ? selectedProgram.title_fr : selectedProgram.title}
                    </span>
                    <button type="button" onClick={() => setForm(f => ({ ...f, program_id: "" }))}
                      className="ml-auto text-gray-400 hover:text-red-500 text-xs transition-colors">
                      ✕
                    </button>
                  </div>
                )}

                {/* Search + dropdown */}
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" strokeWidth={2} />
                  <input
                    type="text"
                    placeholder={lang === "en" ? "Search programmes…" : "Rechercher un programme…"}
                    value={programSearch}
                    onChange={e => setProgramSearch(e.target.value)}
                    className={`${inputCls} pl-10`}
                  />
                </div>
                {programSearch && (
                  <div className="mt-1 border border-gray-200 rounded-xl overflow-hidden shadow-lg max-h-52 overflow-y-auto">
                    {filteredPrograms.length === 0 ? (
                      <p className="text-sm text-gray-400 px-4 py-3">{lang === "en" ? "No programmes found." : "Aucun programme trouvé."}</p>
                    ) : filteredPrograms.map(p => (
                      <button key={p.id} type="button"
                        onClick={() => { setForm(f => ({ ...f, program_id: p.id })); setProgramSearch(""); }}
                        className={`w-full text-left px-4 py-3 text-sm hover:bg-orange-50 hover:text-brand transition-colors
                          ${form.program_id === p.id ? "bg-navy/5 text-navy font-bold" : "text-ink"}`}>
                        <span className="font-medium">{(lang === "fr" && p.title_fr) ? p.title_fr : p.title}</span>
                        <span className="ml-2 text-xs text-gray-400 capitalize">{p.type}</span>
                      </button>
                    ))}
                  </div>
                )}
                {!programSearch && !selectedProgram && (
                  <div className="mt-1 border border-gray-200 rounded-xl overflow-hidden max-h-52 overflow-y-auto">
                    {programs.map(p => (
                      <button key={p.id} type="button"
                        onClick={() => setForm(f => ({ ...f, program_id: p.id }))}
                        className={`w-full text-left px-4 py-3 text-sm hover:bg-orange-50 hover:text-brand transition-colors border-b border-gray-50 last:border-b-0
                          ${form.program_id === p.id ? "bg-navy/5 text-navy font-bold" : "text-ink"}`}>
                        <span className="font-medium">{(lang === "fr" && p.title_fr) ? p.title_fr : p.title}</span>
                        <span className="ml-2 text-xs text-gray-400 capitalize">{p.type}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">{lang === "en" ? "First Name" : "Prénom"} *</label>
                  <input type="text" required value={form.first_name} onChange={set("first_name")} className={inputCls} />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">{lang === "en" ? "Last Name" : "Nom de Famille"} *</label>
                  <input type="text" required value={form.last_name} onChange={set("last_name")} className={inputCls} />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">{lang === "en" ? "Email Address" : "Adresse E-mail"} *</label>
                <input type="email" required value={form.email} onChange={set("email")} className={inputCls} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">{lang === "en" ? "Phone" : "Téléphone"}</label>
                  <input type="tel" value={form.phone} onChange={set("phone")} className={inputCls} />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">{lang === "en" ? "Country" : "Pays"}</label>
                  <input type="text" value={form.country} onChange={set("country")} className={inputCls} />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  {lang === "en" ? "Tell us about your ministry or vocation (optional)" : "Parlez-nous de votre ministère ou vocation (facultatif)"}
                </label>
                <textarea rows={3} value={form.message} onChange={set("message")}
                  placeholder={lang === "en" ? "e.g. I pastor a church in Lagos and want to improve my administrative and leadership skills…" : "ex. Je suis pasteur à Lagos et souhaite améliorer mes compétences en administration et en leadership…"}
                  className={`${inputCls} resize-none`} />
              </div>

              {status === "err" && (
                <p className="text-red-500 text-sm">{lang === "en" ? "Submission failed. Please try again." : "Échec. Veuillez réessayer."}</p>
              )}

              <button type="submit" disabled={status === "sending" || !form.program_id}
                className="w-full bg-brand hover:bg-brand/90 text-white font-bold py-3.5 rounded-xl transition-all duration-200 hover:-translate-y-0.5 shadow-glow disabled:opacity-60 disabled:translate-y-0 flex items-center justify-center gap-2">
                {status === "sending"
                  ? <><Loader2 className="w-4 h-4 animate-spin" strokeWidth={2.5} />{lang === "en" ? "Submitting…" : "Envoi…"}</>
                  : (lang === "en" ? "Submit Application" : "Soumettre la Candidature")}
              </button>

              <p className="text-center text-xs text-gray-400">
                {lang === "en"
                  ? "By submitting, you agree to be contacted by LWGSM regarding your application."
                  : "En soumettant, vous acceptez d'être contacté par LWGSM concernant votre candidature."}
              </p>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}
