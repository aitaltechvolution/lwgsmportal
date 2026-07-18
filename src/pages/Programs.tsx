import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/lib/supabase";
import { Clock, ArrowRight } from "lucide-react";

interface Program {
  id: string;
  title: string;
  title_fr: string | null;
  type: string;
  duration?: string | null;
  short_desc?: string | null;
  short_desc_fr?: string | null;
  image_url?: string | null;
}

const FILTERS = [
  { key: "all",         en: "All Programmes",   fr: "Tous les Programmes" },
  { key: "certificate", en: "Certificate",       fr: "Certificat" },
  { key: "diploma",     en: "Diploma",           fr: "Diplôme" },
  { key: "pastoral",    en: "Pastoral Ordination & Licensing", fr: "Ordination et Licence Pastorale" },
];

const BADGE: Record<string, string> = {
  certificate: "bg-amber-100 text-amber-600",
  diploma:     "bg-purple-100 text-purple-600",
  pastoral:    "bg-blue-100 text-blue-700",
};

export default function Programs() {
  const { i18n } = useTranslation();
  const lang = i18n.language.startsWith("fr") ? "fr" : "en";
  const [programs, setPrograms] = useState<Program[]>([]);
  const [searchParams, setSearchParams] = useSearchParams();
  const urlType = searchParams.get("type");
  const [filter, setFilter] = useState(
    urlType && ["certificate", "diploma", "pastoral"].includes(urlType) ? urlType : "all"
  );
  const [loading, setLoading] = useState(true);

  // Keep filter in sync if the URL changes (e.g. clicking a footer link while already on this page)
  useEffect(() => {
    const t = searchParams.get("type");
    if (t && ["certificate", "diploma", "pastoral"].includes(t)) {
      setFilter(t);
    } else if (!t) {
      setFilter("all");
    }
  }, [searchParams]);

  const handleFilterClick = (key: string) => {
    setFilter(key);
    if (key === "all") {
      setSearchParams({});
    } else {
      setSearchParams({ type: key });
    }
  };

  useEffect(() => {
    supabase
      .from("programs")
      .select("id,title,title_fr,type,duration,short_desc,short_desc_fr,image_url")
      .order("type")
      .order("title")
      .then(({ data, error }) => {
        if (error) console.error("Programs error:", error.message);
        if (data && data.length > 0) setPrograms(data);
        setLoading(false);
      });
  }, []);

  const filtered = filter === "all" ? programs : programs.filter((p) => p.type === filter);

  if (loading) {
    return (
      <div className="min-h-screen px-4 py-16">
        <div className="max-w-5xl mx-auto grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="animate-pulse space-y-3 card p-6">
              <div className="skeleton h-4 w-1/3 rounded" />
              <div className="skeleton h-6 w-2/3 rounded" />
              <div className="skeleton h-3 w-full rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <section className="bg-navy py-16 px-4 text-center">
        <h1 className="text-4xl font-black text-white mb-3">
          {lang === "en" ? "Our Programmes" : "Nos Programmes"}
        </h1>
        <p className="text-white/60 max-w-xl mx-auto text-sm">
          {lang === "en"
            ? "Ministry and leadership qualifications for kingdom-minded believers, worldwide."
            : "Des qualifications en ministère et en leadership pour des croyants engagés, partout dans le monde."}
        </p>
      </section>

      <section className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-3">
        <div className="max-w-5xl mx-auto flex gap-2 overflow-x-auto">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => handleFilterClick(f.key)}
              className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-semibold transition-all ${
                filter === f.key ? "bg-navy text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              }`}
            >
              {lang === "fr" ? f.fr : f.en}
            </button>
          ))}
        </div>
      </section>

      <section className="py-12 px-4">
        <div className="max-w-5xl mx-auto grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((p) => (
            <Link key={p.id} to={`/programs/${p.id}`} className="card card-hover flex flex-col group overflow-hidden">
              {/* Program image */}
              <div className="relative h-44 overflow-hidden bg-navy/5">
                {p.image_url ? (
                  <img
                    src={p.image_url}
                    alt=""
                    aria-hidden
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-navy/10 to-brand/10 flex items-center justify-center">
                    <ArrowRight className="w-8 h-8 text-navy/20" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
                <span className={`absolute top-3 left-3 text-xs font-bold px-2 py-0.5 rounded-full ${BADGE[p.type] ?? "bg-gray-100 text-gray-600"}`}>
                  {p.type.charAt(0).toUpperCase() + p.type.slice(1)}
                </span>
              </div>
              <div className="p-5 flex flex-col gap-2 flex-1">
                <h3 className="font-bold text-ink text-base leading-snug group-hover:text-brand transition-colors">
                  {lang === "fr" ? (p.title_fr ?? p.title) : p.title}
                </h3>
                {p.duration && (
                  <div className="flex items-center gap-1.5 text-xs text-gray-400">
                    <Clock className="w-3.5 h-3.5" strokeWidth={2} />
                    <span>{p.duration}</span>
                  </div>
                )}
                <p className="text-xs text-slate leading-relaxed flex-1 line-clamp-2">
                  {lang === "fr" ? (p.short_desc_fr ?? p.short_desc) : p.short_desc}
                </p>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-brand mt-1">
                  {lang === "en" ? "View Programme" : "Voir le Programme"}
                  <ArrowRight className="w-3.5 h-3.5" strokeWidth={2.5} />
                </span>
              </div>
            </Link>
          ))}
          {filtered.length === 0 && !loading && (
            <p className="col-span-3 text-center text-gray-400 py-16">
              {lang === "en" ? "No programmes found." : "Aucun programme trouvé."}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
