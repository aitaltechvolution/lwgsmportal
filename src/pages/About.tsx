import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Target, Sparkles, GraduationCap, Handshake, Globe2, Lightbulb, ArrowRight, BookOpen, Flame, HeartHandshake, Users, Droplets, Cross, Bird, Crown, CheckCircle2 } from "lucide-react";

interface LeaderRow {
  id: string;
  name: string;
  title: string | null;
  title_fr: string | null;
  bio: string | null;
  bio_fr: string | null;
  image_url: string | null;
  sort_order: number;
}

const LEADER_COLORS = ["bg-navy", "bg-brand", "bg-purple-600", "bg-blue-600", "bg-emerald-600"];

const VALUES = [
  {
    icon: BookOpen,
    title: "Biblical Integrity",
    fr: "Intégrité Biblique",
    desc: "We uphold the absolute authority of God's Word as the foundation of our teaching, doctrine, and conduct.",
    desc_fr: "Nous soutenons l'autorité absolue de la Parole de Dieu comme fondement de notre enseignement et de notre conduite.",
    verse: "2 Timothy 3:16-17",
  },
  {
    icon: Handshake,
    title: "Prayer & Dependence on the Holy Spirit",
    fr: "Prière et Dépendance du Saint-Esprit",
    desc: "We believe in the power of prayer and the leading, empowerment, and gifts of the Holy Spirit.",
    desc_fr: "Nous croyons en la puissance de la prière et à la direction, l'habilitation et les dons du Saint-Esprit.",
    verse: "Acts 1:8",
  },
  {
    icon: Sparkles,
    title: "Excellence",
    fr: "Excellence",
    desc: "We pursue excellence in leadership, ministry, academics, and service, giving our best to God and humanity.",
    desc_fr: "Nous poursuivons l'excellence en leadership, ministère, académique et service, donnant le meilleur de nous-mêmes.",
    verse: "Colossians 3:23",
  },
  {
    icon: Target,
    title: "Integrity & Godly Character",
    fr: "Intégrité et Caractère Divin",
    desc: "We raise leaders who demonstrate honesty, accountability, humility, and Christ-like character.",
    desc_fr: "Nous formons des leaders qui font preuve d'honnêteté, de responsabilité, d'humilité et d'un caractère christique.",
    verse: "Proverbs 10:9",
  },
  {
    icon: GraduationCap,
    title: "Discipleship & Spiritual Growth",
    fr: "Discipulat et Croissance Spirituelle",
    desc: "We are committed to developing mature disciples who live and teach the principles of Christ.",
    desc_fr: "Nous nous engageons à former des disciples matures qui vivent et enseignent les principes de Christ.",
    verse: "Matthew 28:19-20",
  },
  {
    icon: Lightbulb,
    title: "Servant Leadership",
    fr: "Leadership Serviteur",
    desc: "We train leaders to serve with humility, compassion, and a kingdom mindset.",
    desc_fr: "Nous formons des leaders à servir avec humilité, compassion et un état d'esprit de royaume.",
    verse: "Mark 10:45",
  },
  {
    icon: Globe2,
    title: "Evangelism & Missions",
    fr: "Évangélisation et Missions",
    desc: "We are passionate about reaching nations with the Gospel and equipping believers for global impact.",
    desc_fr: "Nous sommes passionnés par l'atteinte des nations avec l'Évangile et l'équipement des croyants pour un impact mondial.",
    verse: "Mark 16:15",
  },
  {
    icon: Flame,
    title: "Kingdom Transformation",
    fr: "Transformation du Royaume",
    desc: "We believe ministry should transform lives, communities, and nations through the power of God.",
    desc_fr: "Nous croyons que le ministère doit transformer des vies, des communautés et des nations par la puissance de Dieu.",
    verse: "Romans 12:2",
  },
  {
    icon: HeartHandshake,
    title: "Love & Compassion",
    fr: "Amour et Compassion",
    desc: "We demonstrate God's love through service, mentorship, and humanitarian outreach.",
    desc_fr: "Nous démontrons l'amour de Dieu à travers le service, le mentorat et l'aide humanitaire.",
    verse: "John 13:35",
  },
  {
    icon: Users,
    title: "Unity & Collaboration",
    fr: "Unité et Collaboration",
    desc: "We foster a culture of honour, teamwork, and partnership in advancing God's Kingdom.",
    desc_fr: "Nous cultivons une culture d'honneur, de travail d'équipe et de partenariat pour faire avancer le Royaume de Dieu.",
    verse: "Psalm 133:1",
  },
];

// L.I.V.I.N.G. W.A.T.E.R.S. — the core values acronym
const ACRONYM = [
  { letter: "L", en: "Love", fr: "Amour" },
  { letter: "I", en: "Integrity", fr: "Intégrité" },
  { letter: "V", en: "Vision", fr: "Vision" },
  { letter: "I", en: "Intercession", fr: "Intercession" },
  { letter: "N", en: "Nations (Missions)", fr: "Nations (Missions)" },
  { letter: "G", en: "Growth", fr: "Croissance" },
  { letter: "W", en: "Worship", fr: "Adoration" },
  { letter: "A", en: "Accountability", fr: "Responsabilité" },
  { letter: "T", en: "Transformation", fr: "Transformation" },
  { letter: "E", en: "Excellence", fr: "Excellence" },
  { letter: "R", en: "Revival", fr: "Réveil" },
  { letter: "S", en: "Servanthood", fr: "Service" },
];

// Symbols & biblical elements from the branding questionnaire
const SYMBOLS = [
  { icon: Droplets, en: "Flowing Water", fr: "Eau Vive", verse: "John 7:38", desc: "The Holy Spirit, life, cleansing, and revival.", desc_fr: "Le Saint-Esprit, la vie, la purification et le réveil." },
  { icon: Cross, en: "The Cross", fr: "La Croix", verse: "1 Corinthians 2:2", desc: "Salvation, redemption, and the centrality of Christ.", desc_fr: "Le salut, la rédemption et la centralité de Christ." },
  { icon: Flame, en: "Flames of Fire", fr: "Flammes de Feu", verse: "Acts 2:3-4", desc: "The anointing, revival, and the baptism of the Holy Spirit.", desc_fr: "L'onction, le réveil et le baptême du Saint-Esprit." },
  { icon: BookOpen, en: "An Open Bible", fr: "Une Bible Ouverte", verse: "2 Timothy 3:16-17", desc: "Sound biblical teaching and the authority of God's Word.", desc_fr: "Un enseignement biblique solide et l'autorité de la Parole de Dieu." },
  { icon: Bird, en: "A Dove", fr: "Une Colombe", verse: "Matthew 3:16", desc: "The Holy Spirit, peace, and divine guidance.", desc_fr: "Le Saint-Esprit, la paix et la direction divine." },
  { icon: Globe2, en: "A Globe / Nations", fr: "Un Globe / Nations", verse: "Matthew 28:19", desc: "The global vision of raising kingdom leaders to impact nations.", desc_fr: "La vision mondiale de former des leaders pour impacter les nations." },
  { icon: Crown, en: "A Crown", fr: "Une Couronne", verse: "2 Timothy 4:8", desc: "Kingdom leadership, spiritual authority, and excellence in ministry.", desc_fr: "Le leadership du royaume, l'autorité spirituelle et l'excellence." },
];

// What makes LWGSM unique — condensed from the branding questionnaire
const DISTINCTIVES = [
  { en: "Word and Spirit Balanced Education", fr: "Éducation Équilibrée entre la Parole et l'Esprit" },
  { en: "Leadership Beyond the Church Walls", fr: "Leadership au-delà des Murs de l'Église" },
  { en: "Practical Ministry Exposure", fr: "Exposition Pratique au Ministère" },
  { en: "Character and Consecration Formation", fr: "Formation du Caractère et de la Consécration" },
  { en: "Flexible Learning for Busy People", fr: "Apprentissage Flexible pour les Personnes Occupées" },
  { en: "Global Missions Focus", fr: "Accent sur les Missions Mondiales" },
  { en: "Mentorship and Personal Development", fr: "Mentorat et Développement Personnel" },
  { en: "Raising Kingdom Leaders to Transform Nations", fr: "Former des Leaders pour Transformer les Nations" },
];

// Target audience — condensed from the branding questionnaire
const AUDIENCE = [
  { en: "Aspiring Ministers & Church Leaders", fr: "Ministres et Dirigeants d'Église en Devenir" },
  { en: "Pastors & Ministry Workers", fr: "Pasteurs et Ouvriers de Ministère" },
  { en: "Christian Professionals & Marketplace Leaders", fr: "Professionnels Chrétiens et Leaders du Marché" },
  { en: "Young Adults & Emerging Leaders", fr: "Jeunes Adultes et Leaders Émergents" },
  { en: "Missionaries & Evangelists", fr: "Missionnaires et Évangélistes" },
  { en: "Church Members Seeking Spiritual Growth", fr: "Membres d'Église en Croissance Spirituelle" },
  { en: "International Students & Ministers", fr: "Étudiants et Ministres Internationaux" },
];

const STUDY_MODES = [
  { en: "Physical", fr: "Présentiel" },
  { en: "Online", fr: "En Ligne" },
  { en: "Hybrid", fr: "Hybride" },
  { en: "Self-Paced", fr: "Rythme Libre" },
];



export default function About() {
  const { i18n } = useTranslation();
  const lang = i18n.language.startsWith("fr") ? "fr" : "en";
  const [leaders, setLeaders] = useState<LeaderRow[]>([]);

  useEffect(() => {
    supabase.from("leaders").select("*").order("sort_order").then(({ data }) => {
      setLeaders((data ?? []) as LeaderRow[]);
    });
  }, []);

  return (
    <div className="min-h-screen bg-white">

      {/* ── HERO ── */}
      <section className="relative bg-navy py-24 px-4 overflow-hidden">
        {/* Background image */}
        <img
          src="https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=1400&q=80&fit=crop"
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover opacity-10 pointer-events-none select-none"
        />
        <div className="relative max-w-5xl mx-auto text-center animate-fade-in-up">
          <p className="text-amber-400 text-xs uppercase tracking-[0.2em] font-bold mb-4">
            {lang === "en" ? "About LWGSM" : "À Propos de LWGSM"}
          </p>
          <h1 className="text-4xl md:text-5xl font-black text-white mb-4 leading-tight">
            {lang === "en"
              ? "Raising Kingdom Leaders, Globally"
              : "Former des Leaders du Royaume, Mondialement"}
          </h1>
          <p className="text-white/60 text-lg max-w-2xl mx-auto">
            {lang === "en"
              ? "Founded with a mission to deliver world-class ministry education rooted in purpose, integrity, and biblical excellence."
              : "Fondée avec la mission de dispenser une éducation ministérielle de classe mondiale, ancrée dans l'intégrité et l'excellence biblique."}
          </p>
        </div>
      </section>

      {/* ── STORY BANNER ── */}
      <section className="py-0 overflow-hidden">
        <div className="grid md:grid-cols-2 min-h-[340px]">
          <img
            src="https://images.unsplash.com/photo-1531482615713-2afd69097998?w=800&q=80&fit=crop"
            alt="Students collaborating"
            className="w-full h-full object-cover min-h-[220px]"
          />
          <div className="bg-[#FAFBFC] flex items-center p-10">
            <div>
              <p className="text-brand text-xs font-bold uppercase tracking-[0.2em] mb-3">
                {lang === "en" ? "Our Story" : "Notre Histoire"}
              </p>
              <h2 className="text-2xl font-black text-navy mb-4 leading-snug">
                {lang === "en"
                  ? "Born from a Vision to Transform Lives"
                  : "Né d'une Vision pour Transformer des Vies"}
              </h2>
              <p className="text-slate text-sm leading-relaxed">
                {lang === "en"
                  ? "Living Waters Global School of Ministry (LWGSM) is the academic arm of Living Waters Global Ministry — a movement committed to raising men and women who are totally sold out to purpose. We believe that excellence in education is inseparable from excellence in character, and every programme we offer is designed to develop both."
                  : "Living Waters Global School of Ministry (LWGSM) est le bras académique de Living Waters Global Ministry — un mouvement engagé à former des hommes et des femmes dévoués à leur vocation. Nous croyons que l'excellence dans l'éducation est inséparable de l'excellence du caractère."}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── MISSION & VISION ── */}
      <section className="py-16 px-4 bg-white">
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-6">
          <div className="card p-8">
            <div className="w-12 h-12 rounded-2xl bg-orange-50 flex items-center justify-center mb-4">
              <Target className="w-6 h-6 text-brand" strokeWidth={1.75} />
            </div>
            <h2 className="text-xl font-bold text-navy mb-3">{lang === "en" ? "Our Mission" : "Notre Mission"}</h2>
            <p className="text-slate leading-relaxed text-sm">
              {lang === "en"
                ? "To provide accessible, rigorous, and practice-oriented ministry education that equips believers with the skills and kingdom mindset to lead churches and organisations, create value, and drive transformation across the nations."
                : "Fournir une éducation ministérielle accessible, rigoureuse et axée sur la pratique, qui dote les croyants des compétences et de l'état d'esprit nécessaires pour diriger des églises et des organisations, et transformer les nations."}
            </p>
          </div>
          <div className="card p-8">
            <div className="w-12 h-12 rounded-2xl bg-navy/5 flex items-center justify-center mb-4">
              <Sparkles className="w-6 h-6 text-navy" strokeWidth={1.75} />
            </div>
            <h2 className="text-xl font-bold text-navy mb-3">{lang === "en" ? "Our Vision" : "Notre Vision"}</h2>
            <p className="text-slate leading-relaxed text-sm">
              {lang === "en"
                ? "To be a leading global school of ministry, recognised for academic excellence, applied learning, and producing graduates who transform churches, industries and communities across the nations."
                : "Être une école de ministère de référence à l'échelle mondiale, reconnue pour l'excellence académique et la production de diplômés qui transforment les églises, les industries et les communautés à travers les nations."}
            </p>
          </div>
        </div>
      </section>

      {/* ── VALUES ── */}
      <section className="py-16 px-4 bg-[#FAFBFC]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12 animate-fade-in-up">
            <p className="text-brand text-xs font-bold uppercase tracking-[0.2em] mb-3">
              {lang === "en" ? "What Drives Us" : "Ce Qui Nous Anime"}
            </p>
            <h2 className="text-3xl font-black text-navy mb-2">
              {lang === "en" ? "Our Values" : "Nos Valeurs"}
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {VALUES.map((v) => {
              const Icon = v.icon;
              return (
                <div key={v.title} className="card card-hover p-6">
                  <div className="w-12 h-12 rounded-2xl bg-navy/5 flex items-center justify-center mb-4">
                    <Icon className="w-6 h-6 text-navy" strokeWidth={1.75} />
                  </div>
                  <h3 className="font-bold text-navy mb-2">{lang === "en" ? v.title : v.fr}</h3>
                  <p className="text-slate text-sm leading-relaxed mb-2">{lang === "en" ? v.desc : v.desc_fr}</p>
                  <p className="text-xs font-semibold text-brand">{v.verse}</p>
                </div>
              );
            })}
          </div>

          {/* L.I.V.I.N.G. W.A.T.E.R.S. acronym */}
          <div className="mt-14 animate-fade-in-up">
            <p className="text-center text-brand text-xs font-bold uppercase tracking-[0.2em] mb-6">
              {lang === "en" ? "Our Values, Remembered" : "Nos Valeurs, Mémorisées"} — L.I.V.I.N.G. W.A.T.E.R.S.
            </p>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
              {ACRONYM.map((a, i) => (
                <div key={i} className="bg-navy rounded-xl p-3 text-center">
                  <div className="text-brand font-black text-xl mb-0.5">{a.letter}</div>
                  <div className="text-white text-[10px] font-semibold leading-tight">{lang === "en" ? a.en : a.fr}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── SYMBOLS ── */}
      <section className="py-16 px-4 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12 animate-fade-in-up">
            <p className="text-brand text-xs font-bold uppercase tracking-[0.2em] mb-3">
              {lang === "en" ? "Visual Identity" : "Identité Visuelle"}
            </p>
            <h2 className="text-3xl font-black text-navy mb-2">
              {lang === "en" ? "Symbols That Shape Our Story" : "Des Symboles Qui Racontent Notre Histoire"}
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {SYMBOLS.map((s) => {
              const Icon = s.icon;
              return (
                <div key={s.en} className="text-center p-5">
                  <div className="w-14 h-14 rounded-2xl bg-navy/5 flex items-center justify-center mx-auto mb-3">
                    <Icon className="w-7 h-7 text-brand" strokeWidth={1.5} />
                  </div>
                  <h3 className="font-bold text-navy text-sm mb-1">{lang === "en" ? s.en : s.fr}</h3>
                  <p className="text-slate text-xs leading-relaxed mb-1">{lang === "en" ? s.desc : s.desc_fr}</p>
                  <p className="text-[11px] font-semibold text-brand">{s.verse}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── WHAT MAKES US UNIQUE ── */}
      <section className="py-16 px-4 bg-navy">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10 animate-fade-in-up">
            <p className="text-brand text-xs font-bold uppercase tracking-[0.2em] mb-3">
              {lang === "en" ? "The LWGSM Distinctives" : "Les Distinctifs de LWGSM"}
            </p>
            <h2 className="text-3xl font-black text-white mb-4">
              {lang === "en" ? "What Makes Us Unique" : "Ce Qui Nous Rend Uniques"}
            </h2>
            <p className="text-white/60 text-sm max-w-2xl mx-auto leading-relaxed">
              {lang === "en"
                ? "We do not merely train ministers; we raise spiritually empowered, morally sound, and globally relevant kingdom leaders who carry God's presence and transform nations."
                : "Nous ne formons pas simplement des ministres ; nous formons des leaders du royaume spirituellement puissants, moralement sains et pertinents à l'échelle mondiale."}
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-3xl mx-auto">
            {DISTINCTIVES.map((d, i) => (
              <div key={i} className="flex items-center gap-3 bg-white/5 rounded-xl px-4 py-3">
                <CheckCircle2 className="w-5 h-5 text-brand flex-shrink-0" strokeWidth={2} />
                <span className="text-white text-sm font-medium">{lang === "en" ? d.en : d.fr}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── WHO WE SERVE ── */}
      <section className="py-16 px-4 bg-[#FAFBFC]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10 animate-fade-in-up">
            <p className="text-brand text-xs font-bold uppercase tracking-[0.2em] mb-3">
              {lang === "en" ? "Target Audience" : "Public Cible"}
            </p>
            <h2 className="text-3xl font-black text-navy mb-4">
              {lang === "en" ? "Who We Serve" : "Qui Nous Servons"}
            </h2>
            <p className="text-slate text-sm max-w-2xl mx-auto leading-relaxed">
              {lang === "en"
                ? "LWGSM equips believers aged 18 and above — from emerging leaders to seasoned ministers — with biblical knowledge, spiritual formation, and practical leadership skills to transform churches, communities, and nations for Christ."
                : "LWGSM équipe les croyants âgés de 18 ans et plus — des leaders émergents aux ministres chevronnés — avec des connaissances bibliques et des compétences pratiques de leadership."}
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl mx-auto mb-8">
            {AUDIENCE.map((a, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-100 px-4 py-3 text-sm font-semibold text-ink">
                {lang === "en" ? a.en : a.fr}
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <span className="text-xs font-bold text-slate uppercase tracking-wider">{lang === "en" ? "Modes of Study:" : "Modes d'Étude :"}</span>
            {STUDY_MODES.map((m, i) => (
              <span key={i} className="bg-navy/5 text-navy text-xs font-bold px-3 py-1.5 rounded-full">{lang === "en" ? m.en : m.fr}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ── LEADERSHIP ── */}
      <section id="leadership" className="py-16 px-4 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12 animate-fade-in-up">
            <p className="text-brand text-xs font-bold uppercase tracking-[0.2em] mb-3">
              {lang === "en" ? "The People Behind LWGSM" : "Les Personnes Derrière LWGSM"}
            </p>
            <h2 className="text-3xl font-black text-navy mb-2">
              {lang === "en" ? "Leadership Team" : "Équipe de Direction"}
            </h2>
            <p className="text-slate text-sm max-w-xl mx-auto">
              {lang === "en"
                ? "Experienced leaders united by a passion for ministry education, purpose, and the transformation of the nations."
                : "Des leaders expérimentés unis par la passion pour l'éducation ministérielle, la vocation et la transformation des nations."}
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {leaders.map((l, i) => (
              <div key={l.id} className="card card-hover flex gap-5 p-6">
                <div className={`w-16 h-16 rounded-2xl flex-shrink-0 flex items-center justify-center text-white font-black text-xl overflow-hidden ${LEADER_COLORS[i % LEADER_COLORS.length]}`}>
                  {l.image_url
                    ? <img src={l.image_url} alt="" className="w-full h-full object-cover" />
                    : l.name.split(" ").filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase()}
                </div>
                <div>
                  <div className="font-bold text-ink text-base">{l.name}</div>
                  <div className="text-brand text-xs font-semibold mb-2">
                    {lang === "en" ? l.title : (l.title_fr ?? l.title)}
                  </div>
                  <p className="text-slate text-xs leading-relaxed">{(lang === "fr" && l.bio_fr) ? l.bio_fr : l.bio}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── GALLERY STRIP ── */}
      <section className="py-0 overflow-hidden">
        <div className="grid grid-cols-3 h-48 md:h-64">
          <img src="https://images.unsplash.com/photo-1605711285791-0219e80e43a3?w=600&q=80&fit=crop" alt="" aria-hidden className="w-full h-full object-cover" />
          <img src="https://images.unsplash.com/photo-1524178232363-1fb2b075b655?w=600&q=80&fit=crop" alt="" aria-hidden className="w-full h-full object-cover" />
          <img src="https://images.unsplash.com/photo-1571260899304-425eee4c7efc?w=600&q=80&fit=crop" alt="" aria-hidden className="w-full h-full object-cover" />
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-16 px-4 bg-navy relative overflow-hidden">
        <img
          src="https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=1400&q=80&fit=crop"
          alt="" aria-hidden
          className="absolute inset-0 w-full h-full object-cover opacity-10 pointer-events-none"
        />
        <div className="max-w-2xl mx-auto text-center relative animate-fade-in-up">
          <h2 className="text-2xl font-black text-white mb-3">
            {lang === "en" ? "Ready to Join LWGSM?" : "Prêt à Rejoindre LWGSM ?"}
          </h2>
          <p className="text-white/60 mb-6 text-sm">
            {lang === "en"
              ? "Apply today and take the first step toward your business leadership journey."
              : "Candidatez aujourd'hui et faites le premier pas vers votre parcours de leadership."}
          </p>
          <Link to="/admissions" className="btn-primary inline-flex items-center gap-2">
            {lang === "en" ? "Apply Now" : "Candidater Maintenant"}
            <ArrowRight className="w-4 h-4" strokeWidth={2.5} />
          </Link>
        </div>
      </section>
    </div>
  );
}
