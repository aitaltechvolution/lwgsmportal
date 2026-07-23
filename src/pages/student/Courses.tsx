import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import StudentLayout from "@/components/StudentLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { useTranslation } from "react-i18next";
import { Search, BookOpen, User, ArrowRight, GraduationCap } from "lucide-react";
import { Badge, ProgressBar, EmptyState, SkeletonCard } from "@/components/ui/primitives";

interface Enrollment {
  id: string;
  course_id: string;
  status: string;
  enrolled_at: string;
  progress_pct: number | null;
  courses: {
    id: string;
    title: string;
    title_fr: string | null;
    code: string | null;
    description: string | null;
    is_published: boolean;
    profiles: { full_name: string } | null;
  } | null;
}

const STATUS_TABS = [
  { key: "active",    en: "Active",    fr: "Actifs" },
  { key: "completed", en: "Completed", fr: "Terminés" },
  { key: "all",       en: "All",       fr: "Tous" },
];

const PROGRESS_LABEL = (p: number, lang: "en" | "fr") => {
  if (p >= 80) return lang === "en" ? "Almost done" : "Presque terminé";
  if (p >= 40) return lang === "en" ? "In progress" : "En cours";
  return lang === "en" ? "Just started" : "Débuté";
};

export default function StudentCourses() {
  const { profile } = useAuth();
  const { i18n } = useTranslation();
  const lang = (i18n.language.startsWith("fr") ? "fr" : "en") as "en" | "fr";

  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"all" | "active" | "completed">("active");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!profile?.id) return;
    supabase
      .from("enrollments")
      .select(`
        id, course_id, status, enrolled_at, progress_pct,
        courses (id, title, title_fr, code, description, is_published, profiles:lecturer_id(full_name))
      `)
      .eq("student_id", profile.id)
      .order("enrolled_at", { ascending: false })
      .then(({ data }) => {
        setEnrollments((data ?? []) as unknown as Enrollment[]);
        setLoading(false);
      });
  }, [profile?.id]);

  const filtered = enrollments
    .filter((e) => !!e.courses) // course unpublished/removed → RLS returns null; hide entirely, don't show a blank card
    .filter((e) => tab === "all" || e.status === tab)
    .filter((e) => {
      if (!search) return true;
      const q = search.toLowerCase();
      const c = e.courses;
      return (
        c?.title.toLowerCase().includes(q) ||
        c?.title_fr?.toLowerCase().includes(q) ||
        c?.code?.toLowerCase().includes(q) ||
        c?.profiles?.full_name?.toLowerCase().includes(q)
      );
    });

  const getTitle = (c: Enrollment["courses"]) => {
    if (!c) return "—";
    return lang === "fr" && c.title_fr ? c.title_fr : c.title;
  };

  return (
    <StudentLayout title={lang === "en" ? "My Courses" : "Mes Cours"}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 animate-fade-in-up">
        <div>
          <h2 className="text-2xl font-black text-ink">
            {lang === "en" ? "My Courses" : "Mes Cours"}
          </h2>
          <p className="text-sm text-slate mt-0.5">
            {loading ? "…" : `${enrollments.length} ${lang === "en" ? "course(s) enrolled" : "cours inscrits"}`}
            {profile?.matric_number && (
              <span className="ml-2 font-mono text-navy font-semibold">
                · {lang === "en" ? "Matric No." : "N° Matricule"} {profile.matric_number}
              </span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link to="/admissions" className="inline-flex items-center gap-1.5 text-sm font-bold text-navy border border-navy/15 hover:bg-navy hover:text-white rounded-xl px-4 py-2.5 transition-all whitespace-nowrap">
            <GraduationCap className="w-4 h-4" strokeWidth={2} />
            {lang === "en" ? "Apply for Another Course" : "Postuler à un Autre Cours"}
          </Link>
          <div className="relative sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" strokeWidth={2} />
            <input
              type="text"
              placeholder={lang === "en" ? "Search courses…" : "Rechercher…"}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-9"
          />
        </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 mb-6 bg-gray-100 p-1 rounded-xl w-fit animate-fade-in-up" style={{ animationDelay: "0.05s" }}>
        {STATUS_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as typeof tab)}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all duration-150
              ${tab === t.key ? "bg-white text-navy shadow-sm" : "text-slate hover:text-ink"}`}
          >
            {lang === "en" ? t.en : t.fr}
            <span className="ml-1.5 text-xs opacity-60">
              {t.key === "all" ? enrollments.length : enrollments.filter((e) => e.status === t.key).length}
            </span>
          </button>
        ))}
      </div>

      {/* Cards */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title={search
            ? (lang === "en" ? "No matches found" : "Aucun résultat")
            : (lang === "en" ? "No courses yet" : "Aucun cours")}
          description={search
            ? (lang === "en" ? "Try a different search term." : "Essayez un autre terme.")
            : (lang === "en" ? "Contact administration to get enrolled in a course." : "Contactez l'administration pour vous inscrire.")}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 stagger-children">
          {filtered.map((enr) => {
            const c = enr.courses;
            const progress = enr.progress_pct ?? 0;

            return (
              <div key={enr.id} className="card card-hover flex flex-col overflow-hidden group">
                {/* Top section: icon + code + status */}
                <div className="p-5 flex-1 flex flex-col">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-11 h-11 rounded-xl bg-navy/5 flex items-center justify-center group-hover:bg-navy group-hover:text-white transition-colors duration-300">
                      <BookOpen className="w-5 h-5 text-navy group-hover:text-white transition-colors duration-300" strokeWidth={2} />
                    </div>
                    <Badge color={enr.status === "completed" ? "green" : enr.status === "active" ? "blue" : "gray"}>
                      {lang === "en"
                        ? enr.status.charAt(0).toUpperCase() + enr.status.slice(1)
                        : enr.status === "active" ? "Actif" : enr.status === "completed" ? "Terminé" : enr.status}
                    </Badge>
                  </div>

                  {c?.code && (
                    <span className="text-xs font-bold text-brand uppercase tracking-wider mb-1.5">{c.code}</span>
                  )}
                  <h3 className="font-bold text-ink text-[15px] leading-snug mb-2">{getTitle(c)}</h3>

                  {c?.profiles?.full_name && (
                    <div className="flex items-center gap-1.5 mb-4 text-xs text-slate">
                      <User className="w-3.5 h-3.5" strokeWidth={2} />
                      {c.profiles.full_name}
                    </div>
                  )}

                  <div className="mt-auto">
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-xs text-slate font-medium">{PROGRESS_LABEL(progress, lang)}</span>
                      <span className={`text-xs font-black ${progress >= 80 ? "text-green-600" : progress >= 40 ? "text-yellow-600" : "text-navy"}`}>
                        {progress}%
                      </span>
                    </div>
                    <ProgressBar value={progress} size="sm" />
                  </div>
                </div>

                {/* CTA */}
                <div className="px-5 pb-5">
                  <Link
                    to={`/student/courses/${c?.id ?? enr.course_id}`}
                    className="flex items-center justify-center gap-2 text-sm font-bold bg-navy hover:bg-navy-light text-white rounded-xl py-2.5 transition-all duration-200 group-hover:gap-3"
                  >
                    {lang === "en"
                      ? enr.status === "completed" ? "Review Course" : "Continue"
                      : enr.status === "completed" ? "Revoir" : "Continuer"}
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" strokeWidth={2.5} />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </StudentLayout>
  );
}