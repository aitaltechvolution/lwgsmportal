import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/lib/supabase";
import { Clock, ArrowRight, ArrowLeft, MessageCircle } from "lucide-react";

interface Program {
  id: string;
  title: string;
  title_fr: string | null;
  type: string;
  duration?: string | null;
  description?: string | null;
  description_fr?: string | null;
  image_url?: string | null;
}

interface Course {
  id: string;
  title: string;
  title_fr: string | null;
  code?: string | null;
  description?: string | null;
}

const TYPE_LABEL: Record<string, { en: string; fr: string }> = {
  certificate: { en: "Certificate",      fr: "Certificat" },
  diploma:     { en: "Diploma",          fr: "Diplôme" },
  advanced:    { en: "Advanced Diploma", fr: "Diplôme Avancé" },
};

export default function ProgramDetail() {
  const { id } = useParams<{ id: string }>();
  const { i18n } = useTranslation();
  const lang = i18n.language.startsWith("fr") ? "fr" : "en";
  const [program, setProgram] = useState<Program | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      supabase
        .from("programs")
        .select("id,title,title_fr,type,duration,description,description_fr,image_url")
        .eq("id", id)
        .maybeSingle(),
      supabase
        .from("courses")
        .select("id,title,title_fr,code,description")
        .eq("program_id", id)
        .eq("is_published", true),
    ]).then(([pRes, cRes]) => {
      if (!pRes.data) setNotFound(true);
      setProgram(pRes.data);
      setCourses(cRes.data ?? []);
      setLoading(false);
    });
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen px-4 py-16 bg-white">
        <div className="max-w-4xl mx-auto animate-pulse space-y-4">
          <div className="skeleton h-6 w-1/3" />
          <div className="skeleton h-10 w-2/3" />
          <div className="skeleton h-4 w-full" />
        </div>
      </div>
    );
  }

  if (notFound || !program) {
    return (
      <div className="min-h-screen flex items-center justify-center text-center px-4 bg-white">
        <div>
          <p className="text-2xl font-bold text-ink mb-2">Programme not found</p>
          <Link to="/programs" className="text-brand hover:underline text-sm font-semibold inline-flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> Back to programmes
          </Link>
        </div>
      </div>
    );
  }

  const typeLabel = TYPE_LABEL[program.type];
  const title       = lang === "fr" ? (program.title_fr ?? program.title) : program.title;
  const description = lang === "fr" ? (program.description_fr ?? program.description) : program.description;

  return (
    <div className="min-h-screen bg-white">
      <section className="relative bg-navy overflow-hidden">
        {/* Hero image */}
        {program.image_url && (
          <img
            src={program.image_url}
            alt=""
            aria-hidden
            className="absolute inset-0 w-full h-full object-cover opacity-20 pointer-events-none"
          />
        )}
        <div className="relative max-w-4xl mx-auto px-4 py-16">
          <Link to="/programs" className="text-white/40 hover:text-white text-xs transition-colors block mb-3">
            ← {lang === "en" ? "All Programmes" : "Tous les Programmes"}
          </Link>
          <span className="inline-block text-xs font-bold text-amber-400 uppercase tracking-wider bg-amber-400/10 px-3 py-1 rounded-full mb-4">
            {typeLabel ? (lang === "en" ? typeLabel.en : typeLabel.fr) : program.type}
          </span>
          <h1 className="text-4xl font-black text-white mb-4 leading-tight">{title}</h1>
          {program.duration && (
            <div className="flex items-center gap-2 text-white/60 text-sm">
              <Clock className="w-4 h-4" strokeWidth={2} />
              <span>{program.duration}</span>
            </div>
          )}
        </div>
      </section>

      <section className="py-12 px-4">
        <div className="max-w-4xl mx-auto grid md:grid-cols-3 gap-8">
          <div className="md:col-span-2 space-y-8">
            <div>
              <h2 className="font-bold text-ink text-lg mb-3">
                {lang === "en" ? "Programme Overview" : "Aperçu du Programme"}
              </h2>
              <p className="text-slate leading-relaxed text-sm">
                {description ?? (lang === "en" ? "Programme details coming soon." : "Détails bientôt disponibles.")}
              </p>
            </div>

            {courses.length > 0 && (
              <div>
                <h2 className="font-bold text-ink text-lg mb-3">
                  {lang === "en" ? "Courses Offered" : "Cours Proposés"}
                </h2>
                <div className="space-y-2">
                  {courses.map((c) => (
                    <div key={c.id} className="flex items-start gap-3 card card-hover p-4">
                      <span className="text-amber-500 font-bold text-xs mt-0.5 flex-shrink-0">{c.code ?? "—"}</span>
                      <div>
                        <div className="font-semibold text-ink text-sm">
                          {lang === "fr" ? (c.title_fr ?? c.title) : c.title}
                        </div>
                        {c.description && (
                          <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{c.description}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {courses.length === 0 && (
              <p className="text-sm text-gray-400 italic">
                {lang === "en" ? "Course list coming soon." : "Liste des cours bientôt disponible."}
              </p>
            )}
          </div>

          <div className="space-y-4">
            <div className="card p-5">
              <h3 className="font-bold text-ink mb-3 text-sm">
                {lang === "en" ? "Programme Details" : "Détails du Programme"}
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate">{lang === "en" ? "Level" : "Niveau"}</span>
                  <span className="font-semibold text-ink">
                    {typeLabel ? (lang === "en" ? typeLabel.en : typeLabel.fr) : program.type}
                  </span>
                </div>
                {program.duration && (
                  <div className="flex justify-between">
                    <span className="text-slate">{lang === "en" ? "Duration" : "Durée"}</span>
                    <span className="font-semibold text-ink">{program.duration}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate">{lang === "en" ? "Delivery" : "Mode"}</span>
                  <span className="font-semibold text-ink">
                    {lang === "en" ? "Online / Blended" : "En ligne / Hybride"}
                  </span>
                </div>
              </div>
            </div>
            <Link to="/admissions" className="btn-primary w-full flex items-center justify-center gap-2">
              {lang === "en" ? "Apply Now" : "Candidater"}
              <ArrowRight className="w-4 h-4" strokeWidth={2.5} />
            </Link>
            <Link to="/contact" className="flex items-center justify-center gap-2 w-full border border-navy/15 text-navy hover:bg-navy hover:text-white font-semibold py-2.5 rounded-xl transition-all duration-200 text-sm">
              <MessageCircle className="w-4 h-4" strokeWidth={2} />
              {lang === "en" ? "Ask a Question" : "Poser une Question"}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
