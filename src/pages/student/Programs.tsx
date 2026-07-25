import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import StudentLayout from "@/components/StudentLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { useTranslation } from "react-i18next";
import { Search, GraduationCap, ArrowRight, Lock, CheckCircle2 } from "lucide-react";
import { Badge, EmptyState, SkeletonCard } from "@/components/ui/primitives";

interface EnrollmentRow {
  id: string;
  status: string;
  program_id: string | null;
  programs: {
    id: string;
    title: string;
    title_fr: string | null;
    type: string;
    delivery_mode: "online" | "onsite" | "self_paced" | null;
  } | null;
}

interface ProgramCard {
  id: string;
  title: string;
  title_fr: string | null;
  type: string;
  delivery_mode: "online" | "onsite" | "self_paced" | null;
  courseCount: number;
  anyActive: boolean;
  anyCompleted: boolean;
  isPaid: boolean;
}

const DELIVERY_MODE_LABEL: Record<string, { en: string; fr: string; color: "blue" | "green" | "yellow" }> = {
  online:     { en: "Online",     fr: "En Ligne", color: "blue" },
  onsite:     { en: "Onsite",     fr: "Sur Site",  color: "green" },
  self_paced: { en: "Self-Paced", fr: "Autonome",  color: "yellow" },
};

export default function StudentPrograms() {
  const { profile } = useAuth();
  const { i18n } = useTranslation();
  const lang = (i18n.language.startsWith("fr") ? "fr" : "en") as "en" | "fr";

  const [programs, setPrograms] = useState<ProgramCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!profile?.id) return;
    (async () => {
      setLoading(true);
      const [{ data: enrData }, { data: payData }] = await Promise.all([
        supabase
          .from("enrollments")
          .select("id, status, program_id, programs:program_id(id, title, title_fr, type, delivery_mode)")
          .eq("student_id", profile.id),
        // A single registration payment, tied to program_id (not
        // course_id), unlocks every course under that programme — see
        // Payments.tsx's registerProgram flow.
        supabase.from("payments").select("program_id, status, manual_confirmed")
          .eq("student_id", profile.id).eq("type", "registration").not("program_id", "is", null),
      ]);

      const paidProgramIds = new Set(
        (payData ?? [])
          .filter((p: { status: string; manual_confirmed: boolean }) => p.status === "success" || p.manual_confirmed)
          .map((p: { program_id: string }) => p.program_id)
      );

      const byProgram = new Map<string, ProgramCard>();
      ((enrData ?? []) as unknown as EnrollmentRow[]).forEach(e => {
        if (!e.programs || !e.program_id) return; // program removed/unpublished → RLS returns null; skip entirely
        const existing = byProgram.get(e.program_id);
        if (existing) {
          existing.courseCount += 1;
          if (e.status === "active") existing.anyActive = true;
          if (e.status === "completed") existing.anyCompleted = true;
        } else {
          byProgram.set(e.program_id, {
            id: e.programs.id,
            title: e.programs.title,
            title_fr: e.programs.title_fr,
            type: e.programs.type,
            delivery_mode: e.programs.delivery_mode,
            courseCount: 1,
            anyActive: e.status === "active",
            anyCompleted: e.status === "completed",
            isPaid: paidProgramIds.has(e.program_id),
          });
        }
      });

      setPrograms(Array.from(byProgram.values()).sort((a, b) =>
        (lang === "fr" && a.title_fr ? a.title_fr : a.title).localeCompare(lang === "fr" && b.title_fr ? b.title_fr : b.title)
      ));
      setLoading(false);
    })();
  }, [profile?.id, lang]);

  const getTitle = (p: ProgramCard) => (lang === "fr" && p.title_fr) ? p.title_fr : p.title;

  const filtered = programs.filter(p => {
    if (!search) return true;
    return getTitle(p).toLowerCase().includes(search.toLowerCase());
  });

  return (
    <StudentLayout title={lang === "en" ? "My Programmes" : "Mes Programmes"}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 animate-fade-in-up">
        <div>
          <h2 className="text-2xl font-black text-ink">{lang === "en" ? "My Programmes" : "Mes Programmes"}</h2>
          <p className="text-sm text-slate mt-0.5">
            {loading ? "…" : `${programs.length} ${lang === "en" ? "programme(s) enrolled" : "programme(s) inscrits"}`}
            {profile?.matric_number && (
              <span className="ml-2 font-mono text-navy font-semibold">
                · {lang === "en" ? "Matric No." : "N° Matricule"} {profile.matric_number}
              </span>
            )}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
          <Link to="/admissions" className="inline-flex items-center justify-center gap-1.5 text-sm font-bold text-navy border border-navy/15 hover:bg-navy hover:text-white rounded-xl px-4 py-2.5 transition-all whitespace-nowrap">
            <GraduationCap className="w-4 h-4" strokeWidth={2} />
            {lang === "en" ? "Apply for Another Programme" : "Postuler à un Autre Programme"}
          </Link>
          <div className="relative sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" strokeWidth={2} />
            <input
              type="text"
              placeholder={lang === "en" ? "Search programmes…" : "Rechercher…"}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-9"
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title={search ? (lang === "en" ? "No matches found" : "Aucun résultat") : (lang === "en" ? "No programmes yet" : "Aucun programme")}
          description={search
            ? (lang === "en" ? "Try a different search term." : "Essayez un autre terme.")
            : (lang === "en" ? "Apply to a programme to get started." : "Postulez à un programme pour commencer.")}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 stagger-children">
          {filtered.map(p => (
            <Link key={p.id} to={`/student/courses/program/${p.id}`} className="card card-hover flex flex-col overflow-hidden group">
              <div className="p-5 flex-1 flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-11 h-11 rounded-xl bg-navy/5 flex items-center justify-center group-hover:bg-navy group-hover:text-white transition-colors duration-300">
                    <GraduationCap className="w-5 h-5 text-navy group-hover:text-white transition-colors duration-300" strokeWidth={2} />
                  </div>
                  {p.delivery_mode && (
                    <Badge color={DELIVERY_MODE_LABEL[p.delivery_mode].color}>
                      {lang === "fr" ? DELIVERY_MODE_LABEL[p.delivery_mode].fr : DELIVERY_MODE_LABEL[p.delivery_mode].en}
                    </Badge>
                  )}
                </div>

                <h3 className="font-bold text-ink text-[15px] leading-snug mb-2">{getTitle(p)}</h3>
                <p className="text-xs text-slate mb-4">
                  {p.courseCount} {p.courseCount === 1 ? (lang === "en" ? "course" : "cours") : (lang === "en" ? "courses" : "cours")}
                </p>

                <div className="mt-auto flex items-center gap-1.5 text-xs font-bold">
                  {p.isPaid ? (
                    <span className="flex items-center gap-1 text-green-600"><CheckCircle2 className="w-3.5 h-3.5" strokeWidth={2} /> {lang === "en" ? "Registration paid" : "Inscription payée"}</span>
                  ) : (
                    <span className="flex items-center gap-1 text-amber-600"><Lock className="w-3.5 h-3.5" strokeWidth={2} /> {lang === "en" ? "Registration required" : "Inscription requise"}</span>
                  )}
                </div>
              </div>

              <div className="px-5 pb-5">
                <div className="flex items-center justify-center gap-2 text-sm font-bold bg-navy group-hover:bg-navy-light text-white rounded-xl py-2.5 transition-all duration-200 group-hover:gap-3">
                  {p.isPaid ? (lang === "en" ? "View Courses" : "Voir les Cours") : (lang === "en" ? "Continue" : "Continuer")}
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" strokeWidth={2.5} />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </StudentLayout>
  );
}