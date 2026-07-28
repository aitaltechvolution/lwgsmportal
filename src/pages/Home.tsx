import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/lib/supabase";
import {
  ArrowRight, GraduationCap, Award, Star, ShieldCheck,
  Users, Globe2, TrendingUp, MapPin, Calendar, MessageCircle, Search, FileEdit,
} from "lucide-react";
import GradientBlobs from "@/components/ui/GradientBlobs";
import { EmptyState } from "@/components/ui/primitives";

interface Announcement {
  id: string;
  title_en: string;
  title_fr: string;
  body_en: string;
  body_fr: string;
  created_at: string;
}

const TESTIMONIALS = [
  {
    name: "Pastor James Obi",
    role: "Diploma in Christian Ministry, 2025",
    role_fr: "Diplôme en Ministère Chrétien, 2025",
    en: "LWGSM completely transformed how I lead my church. The Servant Leadership and Governance courses gave me tools I use every week in ministry. This school equips you to run God's house with excellence.",
    fr: "LWGSM a complètement transformé ma façon de diriger mon église. Les cours de Leadership Serviteur m'ont donné des outils que j'utilise chaque semaine. Cette école vous équipe pour gérer la maison de Dieu avec excellence.",
  },
  {
    name: "Deaconess Grace Nwosu",
    role: "Diploma in Ministry Leadership & Management, 2025",
    role_fr: "Diplôme en Leadership Ministériel et Management, 2025",
    en: "As a ministry administrator, I needed practical skills grounded in the Word. LWGSM delivered exactly that — operations, finance and leadership all through a biblical lens. I now run our church administration with confidence.",
    fr: "En tant qu'administratrice ministérielle, j'avais besoin de compétences pratiques ancrées dans la Parole. LWGSM a fourni exactement cela — opérations, finances et leadership à travers un prisme biblique.",
  },
  {
    name: "Evangelist Samuel Femi",
    role: "Certificate in Kingdom Business Administration, 2025",
    role_fr: "Certificat en Administration des Affaires du Royaume, 2025",
    en: "I run a faith-based enterprise and needed business skills that aligned with my values. The Kingdom Business course opened my eyes to stewarding finances and serving customers as unto the Lord. Highly recommended.",
    fr: "Je dirige une entreprise confessionnelle et j'avais besoin de compétences commerciales alignées sur mes valeurs. Le cours sur l'Entreprise du Royaume m'a ouvert les yeux sur l'intendance des finances au service du Seigneur.",
  },
];

const NATIONS = ["Nigeria", "Ghana", "Côte d'Ivoire", "Cameroon", "UK", "USA"];

const PROGRAMS = [
  { key: "cert", id: "certificate", icon: FileEdit,    duration: "2 weeks – 12 months",  color: "bg-blue-50 text-blue-600" },
  { key: "dip",  id: "diploma",     icon: GraduationCap, duration: "6–18 months", color: "bg-purple-50 text-purple-600" },
  { key: "adv",  id: "pastoral",    icon: Award,       duration: "10 weeks",   color: "bg-amber-50 text-brand" },
];

const QUICK_LINKS = [
  { key: "quick_apply",   icon: FileEdit,      to: "/admissions" },
  { key: "quick_student", icon: GraduationCap, to: "/student" },
  { key: "quick_verify",  icon: ShieldCheck,    to: "/verify" },
  { key: "quick_contact", icon: MessageCircle, to: "/contact" },
];

const WHY_ITEMS = [
  { key: "why_1", icon: TrendingUp },
  { key: "why_2", icon: Globe2 },
  { key: "why_3", icon: ShieldCheck },
  { key: "why_4", icon: Users },
];

const STATS = [
  { value: "100+",  labelKey: "stats_students",    icon: Users },
  { value: "21+",     labelKey: "stats_programmes",  icon: GraduationCap },
  { value: "6",      labelKey: "stats_countries", icon: Globe2 },
];

export default function Home() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language.startsWith("fr") ? "fr" : "en";
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [activeTestimonial, setActiveTestimonial] = useState(0);

  useEffect(() => {
    supabase
      .from("announcements")
      .select("*")
      .or("target_role.eq.public,target_role.is.null")
      .order("created_at", { ascending: false })
      .limit(4)
      .then(({ data }) => {
        setAnnouncements((data ?? []) as Announcement[]);
        setLoadingEvents(false);
      });
  }, []);

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString(lang === "fr" ? "fr-FR" : "en-GB", { day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="min-h-screen bg-white">
      {/* ── 1. HERO ─────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-navy">
        <GradientBlobs variant="dark" />
        {/* Background hero image — subtle overlay */}
        <img
          src="/imgs/class 2.jpg"
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover opacity-[0.08] pointer-events-none select-none"
        />
        <div className="relative mx-auto max-w-7xl px-4 py-20 md:py-28">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left: copy */}
            <div className="animate-fade-in-up">
              <div className="inline-flex items-center gap-2 rounded-full border border-brand/30 bg-brand/10 px-4 py-1.5 text-xs font-bold text-amber-400 tracking-widest uppercase mb-6">
                <span className="h-1.5 w-1.5 rounded-full bg-brand animate-pulse" />
                Living Waters Global School of Ministry
              </div>

              <h1 className="text-4xl sm:text-5xl md:text-6xl font-black text-white leading-[1.1] mb-6">
                {t("home.hero_title")}
              </h1>

              <p className="text-lg text-white/60 max-w-xl mb-8 leading-relaxed">
                {t("home.hero_sub")}
              </p>

              <div className="flex flex-wrap gap-3">
                <Link to="/admissions" className="btn-primary text-base px-6 py-3">
                  {t("home.cta_apply")}
                  <ArrowRight className="w-4 h-4" strokeWidth={2.5} />
                </Link>
                <Link to="/programs" className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 px-6 py-3 text-base font-bold text-white transition-all duration-200 hover:bg-white/5 hover:-translate-y-0.5">
                  {t("home.cta_explore")}
                </Link>
              </div>

              {/* trust row */}
              <div className="mt-10 flex items-center gap-6 flex-wrap">
                <div className="flex items-center gap-1.5 text-white/50 text-sm">
                  <Star className="w-4 h-4 text-amber-400 fill-amber-400" strokeWidth={0} />
                  <Star className="w-4 h-4 text-amber-400 fill-amber-400" strokeWidth={0} />
                  <Star className="w-4 h-4 text-amber-400 fill-amber-400" strokeWidth={0} />
                  <Star className="w-4 h-4 text-amber-400 fill-amber-400" strokeWidth={0} />
                  <Star className="w-4 h-4 text-amber-400 fill-amber-400" strokeWidth={0} />
                  <span className="ml-1">4.8/5 {lang === "en" ? "student rating" : "note étudiante"}</span>
                </div>
              </div>
            </div>

            {/* Right: floating image + stats */}
            <div className="relative animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
              <div className="relative rounded-3xl overflow-hidden mb-4 shadow-2xl">
                <img
                  src="/imgs/class 3.jpg"
                  alt="Ministry students in a collaborative session"
                  className="w-full h-64 object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-navy/70 to-transparent" />
                <div className="absolute bottom-4 left-4 right-4">
                  <p className="text-white text-xs font-semibold opacity-90">
                    {lang === "en" ? "Equipping believers to lead with excellence in ministry and marketplace" : "Équiper les croyants pour diriger avec excellence dans le ministère et le marché"}
                  </p>
                </div>
              </div>
              <div className="bg-white/[0.04] backdrop-blur-sm border border-white/10 rounded-3xl p-5">
                <div className="grid grid-cols-3 gap-3">
                  {STATS.map((s, i) => {
                    const Icon = s.icon;
                    return (
                      <div key={i} className="bg-white/[0.04] rounded-2xl p-4">
                        <Icon className="w-5 h-5 text-amber-400 mb-2" strokeWidth={2} />
                        <div className="text-2xl font-black text-white mb-0.5">{s.value}</div>
                        <div className="text-xs text-white/40 font-medium leading-tight">{t(`home.${s.labelKey}`)}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── SCHOOL SCRIPTURE ─────────────────────────────────────────────── */}
      <section className="py-14 px-4 bg-[#FAFBFC] border-b border-gray-100">
        <div className="max-w-3xl mx-auto text-center animate-fade-in-up">
          <p className="text-brand text-xs font-bold uppercase tracking-[0.2em] mb-4">
            {lang === "en" ? "Our School Scripture" : "Notre Verset Fondateur"}
          </p>
          <blockquote className="text-xl md:text-2xl font-bold text-navy leading-snug italic">
            {lang === "en"
              ? "\u201cTo equip the saints for the work of ministry, for the edifying of the body of Christ.\u201d"
              : "\u00ab Pour le perfectionnement des saints en vue de l'\u0153uvre du ministère, pour l'édification du corps de Christ. \u00bb"}
          </blockquote>
          <p className="text-slate text-sm font-semibold mt-3">Ephesians 4:12 (NKJV)</p>
        </div>
      </section>

      {/* ── 2. WHY CHOOSE LWGSM ──────────────────────────────────────────── */}
      <section className="py-20 px-4 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14 animate-fade-in-up">
            <p className="text-brand text-xs font-bold uppercase tracking-[0.2em] mb-3">{t("home.why_title")}</p>
            <h2 className="text-3xl md:text-4xl font-black text-ink max-w-2xl mx-auto">{t("home.why_sub")}</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 stagger-children">
            {WHY_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.key} className="card card-hover p-6">
                  <div className="w-12 h-12 rounded-2xl bg-navy/5 flex items-center justify-center mb-4">
                    <Icon className="w-6 h-6 text-navy" strokeWidth={1.75} />
                  </div>
                  <h3 className="font-bold text-ink mb-2">{t(`home.${item.key}_title`)}</h3>
                  <p className="text-sm text-slate leading-relaxed">{t(`home.${item.key}_desc`)}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── 3. FEATURED PROGRAMMES ──────────────────────────────────────── */}
      <section className="py-20 px-4 bg-[#FAFBFC]">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-12 animate-fade-in-up">
            <div>
              <p className="text-brand text-xs font-bold uppercase tracking-[0.2em] mb-3">{lang === "en" ? "Programmes" : "Programmes"}</p>
              <h2 className="text-3xl md:text-4xl font-black text-ink">{t("home.programs_title")}</h2>
              <p className="text-slate mt-2 max-w-xl">{t("home.programs_sub")}</p>
            </div>
            <Link to="/programs" className="inline-flex items-center gap-1.5 text-sm font-bold text-navy hover:text-brand transition-colors flex-shrink-0">
              {lang === "en" ? "View all programmes" : "Voir tous les programmes"}
              <ArrowRight className="w-4 h-4" strokeWidth={2.5} />
            </Link>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 stagger-children">
            {PROGRAMS.map((p) => {
              const Icon = p.icon;
              return (
                <div key={p.key} className="card card-hover flex flex-col overflow-hidden group">
                  <div className="p-6 flex-1 flex flex-col">
                    <div className={`w-12 h-12 rounded-2xl ${p.color} flex items-center justify-center mb-4`}>
                      <Icon className="w-6 h-6" strokeWidth={1.75} />
                    </div>
                    <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">{p.duration}</div>
                    <h3 className="text-lg font-bold text-ink mb-2">
                      {t(`home.program_${p.key === "cert" ? "cert" : p.key === "dip" ? "dip" : "adv"}_title`)}
                    </h3>
                    <p className="text-slate text-sm leading-relaxed flex-1 mb-6">
                      {t(`home.program_${p.key === "cert" ? "cert" : p.key === "dip" ? "dip" : "adv"}_desc`)}
                    </p>
                    <Link to={`/programs?type=${p.id}`} className="inline-flex items-center gap-1.5 text-sm font-bold text-navy group-hover:text-brand transition-colors">
                      {t("home.learn_more")}
                      <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" strokeWidth={2.5} />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── 4. NEWS & ANNOUNCEMENTS ─────────────────────────────────────── */}
      <section className="py-20 px-4 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12 animate-fade-in-up">
            <p className="text-brand text-xs font-bold uppercase tracking-[0.2em] mb-3">{lang === "en" ? "Latest" : "Actualités"}</p>
            <h2 className="text-3xl md:text-4xl font-black text-ink mb-3">{t("home.events_title")}</h2>
            <p className="text-slate max-w-xl mx-auto">{t("home.events_sub")}</p>
          </div>

          {loadingEvents ? (
            <div className="grid gap-4 md:grid-cols-2 max-w-4xl mx-auto">
              {[1, 2].map((i) => (
                <div key={i} className="card p-6">
                  <div className="skeleton h-3 w-1/4 mb-3" />
                  <div className="skeleton h-5 w-3/4 mb-2" />
                  <div className="skeleton h-3 w-full" />
                </div>
              ))}
            </div>
          ) : announcements.length === 0 ? (
            <div className="max-w-md mx-auto">
              <EmptyState icon={Calendar} title={t("home.events_empty")} />
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 max-w-4xl mx-auto stagger-children">
              {announcements.map((a) => (
                <div key={a.id} className="card card-hover flex gap-4 p-5">
                  <div className="flex-shrink-0 w-14 h-14 rounded-2xl bg-navy/5 flex flex-col items-center justify-center text-navy">
                    <span className="text-lg font-black leading-none">{new Date(a.created_at).getDate()}</span>
                    <span className="text-[10px] font-bold uppercase">{new Date(a.created_at).toLocaleString(lang === "fr" ? "fr-FR" : "en-GB", { month: "short" })}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-gray-400 mb-1">{fmtDate(a.created_at)}</p>
                    <h3 className="font-bold text-ink mb-1 leading-snug">{lang === "fr" ? a.title_fr : a.title_en}</h3>
                    <p className="text-sm text-slate line-clamp-2 leading-relaxed">{lang === "fr" ? a.body_fr : a.body_en}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── 5. TESTIMONIALS ─────────────────────────────────────────────── */}
      <section className="py-20 px-4 bg-navy relative overflow-hidden">
        <GradientBlobs variant="dark" />
        <div className="relative max-w-4xl mx-auto">
          <div className="text-center mb-12 animate-fade-in-up">
            <p className="text-brand text-xs font-bold uppercase tracking-[0.2em] mb-3">{lang === "en" ? "Testimonials" : "Témoignages"}</p>
            <h2 className="text-3xl md:text-4xl font-black text-white mb-3">{t("home.testimonials_title")}</h2>
            <p className="text-white/50 max-w-xl mx-auto">{t("home.testimonials_sub")}</p>
          </div>

          {/* Featured testimonial */}
          <div className="bg-white/[0.04] backdrop-blur-sm border border-white/10 rounded-3xl p-8 md:p-10 animate-fade-in-up" style={{ animationDelay: "0.05s" }}>
            <div className="flex gap-1 mb-5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className="w-4 h-4 text-amber-400 fill-amber-400" strokeWidth={0} />
              ))}
            </div>
            <p className="text-white/85 leading-relaxed text-lg mb-6">
              {lang === "fr" ? TESTIMONIALS[activeTestimonial].fr : TESTIMONIALS[activeTestimonial].en}
            </p>
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-gradient-to-br from-brand to-amber-600 flex items-center justify-center text-white font-black text-sm flex-shrink-0">
                {TESTIMONIALS[activeTestimonial].name[0]}
              </div>
              <div>
                <p className="font-bold text-white text-sm">{TESTIMONIALS[activeTestimonial].name}</p>
                <p className="text-white/40 text-xs">{lang === "fr" ? TESTIMONIALS[activeTestimonial].role_fr : TESTIMONIALS[activeTestimonial].role}</p>
              </div>
            </div>
          </div>

          {/* Dots nav */}
          <div className="flex justify-center gap-2 mt-6">
            {TESTIMONIALS.map((_, i) => (
              <button
                key={i}
                onClick={() => setActiveTestimonial(i)}
                aria-label={`Testimonial ${i + 1}`}
                className={`h-2 rounded-full transition-all duration-300 ${i === activeTestimonial ? "w-8 bg-brand" : "w-2 bg-white/15 hover:bg-white/30"}`}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ── 6. NATIONS / GLOBAL REACH ───────────────────────────────────── */}
      <section className="py-16 px-4 bg-[#FAFBFC]">
        <div className="max-w-5xl mx-auto text-center animate-fade-in-up">
          <p className="text-brand text-xs font-bold uppercase tracking-[0.2em] mb-3">{t("home.nations_title")}</p>
          <p className="text-slate mb-6 max-w-xl mx-auto">{t("home.nations_sub")}</p>
          <div className="flex flex-wrap justify-center gap-3">
            {NATIONS.map((n) => (
              <span key={n} className="flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-ink">
                <MapPin className="w-3.5 h-3.5 text-brand" strokeWidth={2} />
                {n}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── 7. QUICK ACCESS ─────────────────────────────────────────────── */}
      <section className="py-20 px-4 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12 animate-fade-in-up">
            <h2 className="text-3xl font-black text-ink">{t("home.quick_title")}</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 stagger-children">
            {QUICK_LINKS.map((ql) => {
              const Icon = ql.icon;
              return (
                <Link key={ql.key} to={ql.to} className="card card-hover flex flex-col items-center gap-3 py-8 text-center group">
                  <div className="w-12 h-12 rounded-2xl bg-navy/5 flex items-center justify-center group-hover:bg-navy transition-colors duration-300">
                    <Icon className="w-6 h-6 text-navy group-hover:text-white transition-colors duration-300" strokeWidth={1.75} />
                  </div>
                  <span className="text-sm font-bold text-ink">{t(`home.${ql.key}`)}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── 8. FINAL CTA ────────────────────────────────────────────────── */}
      <section className="py-20 px-4 bg-navy relative overflow-hidden">
        <GradientBlobs variant="dark" />
        <div className="relative max-w-2xl mx-auto text-center animate-fade-in-up">
          <h2 className="text-3xl md:text-4xl font-black text-white mb-4">
            {lang === "en" ? "Ready to take the next step?" : "Prêt à passer à l'étape suivante ?"}
          </h2>
          <p className="text-white/60 mb-8">
            {lang === "en"
              ? "Applications are open year-round. Apply today and join thousands of professionals building their future with LWGSM."
              : "Les candidatures sont ouvertes toute l'année. Candidatez dès aujourd'hui et rejoignez des milliers de professionnels qui construisent leur avenir avec LWGSM."}
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link to="/admissions" className="btn-primary text-base px-8 py-3">
              {t("home.cta_apply")}
              <ArrowRight className="w-4 h-4" strokeWidth={2.5} />
            </Link>
            <Link to="/contact" className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 px-8 py-3 text-base font-bold text-white transition-all duration-200 hover:bg-white/5 hover:-translate-y-0.5">
              <Search className="w-4 h-4" strokeWidth={2} />
              {lang === "en" ? "Talk to Admissions" : "Parler aux Admissions"}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
