import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import LecturerLayout from "@/components/LecturerLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { useTranslation } from "react-i18next";
import { PencilLine, ClipboardCheck, Calendar, Target, ChevronRight } from "lucide-react";
import { Badge, EmptyState, SkeletonRow } from "@/components/ui/primitives";

interface AssignmentRow {
  id: string;
  course_id: string;
  type: "assignment" | "quiz" | "exam";
  title_en: string;
  title_fr: string | null;
  due_date: string | null;
  max_score: number | null;
  courses?: { title: string; title_fr?: string; code?: string } | null;
  submissionCount?: number;
  gradedCount?: number;
}

const TYPE_LABEL: Record<string, { en: string; fr: string }> = {
  assignment: { en: "Assignment", fr: "Devoir" },
  quiz:       { en: "Quiz",       fr: "Quiz" },
  exam:       { en: "Exam",       fr: "Examen" },
};

export default function LecturerAssessments() {
  const { profile } = useAuth();
  const { i18n } = useTranslation();
  const lang = (i18n.language.startsWith("fr") ? "fr" : "en") as "en" | "fr";

  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending">("all");

  useEffect(() => {
    if (!profile?.id) return;
    async function load() {
      const { data: courseData } = await supabase.from("courses").select("id").eq("lecturer_id", profile!.id);
      const courseIds = (courseData ?? []).map((c: { id: string }) => c.id);
      if (courseIds.length === 0) { setLoading(false); return; }

      const { data } = await supabase
        .from("assignments")
        .select("*, courses(title, title_fr, code)")
        .in("course_id", courseIds)
        .order("due_date", { ascending: false, nullsFirst: true });

      const list = (data ?? []) as unknown as AssignmentRow[];

      if (list.length > 0) {
        const subRes = await Promise.all(
          list.map((a) => supabase.from("submissions").select("score", { count: "exact" }).eq("assignment_id", a.id))
        );
        list.forEach((a, i) => {
          a.submissionCount = subRes[i].count ?? 0;
          a.gradedCount = (subRes[i].data ?? []).filter((s: { score: number | null }) => s.score !== null).length;
        });
      }

      setAssignments(list);
      setLoading(false);
    }
    load();
  }, [profile?.id]);

  const filtered = filter === "all" ? assignments : assignments.filter(a => (a.submissionCount ?? 0) > (a.gradedCount ?? 0));
  const totalPending = assignments.reduce((sum, a) => sum + ((a.submissionCount ?? 0) - (a.gradedCount ?? 0)), 0);

  return (
    <LecturerLayout title={lang === "en" ? "Assessments" : "Évaluations"}>
      <div className="mb-6 animate-fade-in-up">
        <h2 className="text-2xl font-black text-ink">{lang === "en" ? "Assessments" : "Évaluations"}</h2>
        <p className="text-sm text-slate mt-0.5">
          {assignments.length} {lang === "en" ? "total" : "au total"}
          {totalPending > 0 && (
            <> · <span className="text-brand font-semibold">{totalPending} {lang === "en" ? "to grade" : "à corriger"}</span></>
          )}
        </p>
      </div>

      <div className="flex gap-1.5 mb-6 bg-gray-100 p-1 rounded-xl w-fit animate-fade-in-up" style={{ animationDelay: "0.04s" }}>
        <button onClick={() => setFilter("all")} className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all duration-150 ${filter === "all" ? "bg-white text-navy shadow-sm" : "text-slate hover:text-ink"}`}>
          {lang === "en" ? "All" : "Tous"} <span className="ml-1 text-xs opacity-60">{assignments.length}</span>
        </button>
        <button onClick={() => setFilter("pending")} className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all duration-150 ${filter === "pending" ? "bg-white text-navy shadow-sm" : "text-slate hover:text-ink"}`}>
          {lang === "en" ? "Needs Grading" : "À Corriger"} <span className="ml-1 text-xs opacity-60">{assignments.filter(a => (a.submissionCount ?? 0) > (a.gradedCount ?? 0)).length}</span>
        </button>
      </div>

      {loading ? (
        <div className="card divide-y divide-gray-50">{Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}</div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={PencilLine}
          title={filter === "pending" ? (lang === "en" ? "All caught up!" : "Tout est à jour !") : (lang === "en" ? "No assessments yet" : "Aucune évaluation")}
          description={filter === "pending" ? (lang === "en" ? "No submissions are awaiting grading." : "Aucune soumission en attente.") : (lang === "en" ? "Create assessments from a course's page." : "Créez des évaluations depuis la page d'un cours.")}
        />
      ) : (
        <div className="card divide-y divide-gray-50 overflow-hidden stagger-children">
          {filtered.map((a) => {
            const title = (lang === "fr" && a.title_fr) ? a.title_fr : a.title_en;
            const cTitle = a.courses ? ((lang === "fr" && a.courses.title_fr) ? a.courses.title_fr : a.courses.title) : "";
            const pending = (a.submissionCount ?? 0) - (a.gradedCount ?? 0);
            const typeLabel = TYPE_LABEL[a.type];
            return (
              <Link key={a.id} to={`/lecturer/assessments/${a.id}/submissions`} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50/60 transition-colors group">
                <div className="w-11 h-11 rounded-xl bg-navy/5 flex items-center justify-center flex-shrink-0">
                  <PencilLine className="w-5 h-5 text-navy" strokeWidth={2} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h3 className="font-bold text-ink text-sm">{title}</h3>
                    <Badge color="navy">{typeLabel ? (lang === "en" ? typeLabel.en : typeLabel.fr) : a.type}</Badge>
                  </div>
                  <p className="text-xs text-slate mb-1.5">{cTitle}{a.courses?.code ? ` · ${a.courses.code}` : ""}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    {a.due_date && (
                      <span className="flex items-center gap-1 text-[11px] text-gray-400">
                        <Calendar className="w-3 h-3" strokeWidth={2} />
                        {new Date(a.due_date).toLocaleDateString(lang === "fr" ? "fr-FR" : "en-GB", { day: "numeric", month: "short", year: "numeric" })}
                      </span>
                    )}
                    {a.max_score && (
                      <span className="flex items-center gap-1 text-[11px] text-gray-400">
                        <Target className="w-3 h-3" strokeWidth={2} />
                        {a.max_score} pts
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex-shrink-0 flex items-center gap-2">
                  <Badge color="gray" icon={ClipboardCheck}>{a.submissionCount ?? 0}</Badge>
                  {pending > 0 && <Badge color="orange">{pending} {lang === "en" ? "pending" : "en attente"}</Badge>}
                  <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-brand transition-colors" strokeWidth={2.5} />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </LecturerLayout>
  );
}
