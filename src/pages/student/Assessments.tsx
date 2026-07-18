import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import StudentLayout from "@/components/StudentLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { useTranslation } from "react-i18next";
import { PencilLine, HelpCircle, FileSpreadsheet, ChevronRight, Send } from "lucide-react";
import { Badge, EmptyState, SkeletonRow } from "@/components/ui/primitives";

interface Assignment {
  id: string;
  course_id: string;
  type: "assignment" | "quiz" | "exam";
  title_en: string;
  title_fr: string | null;
  description_en: string | null;
  description_fr: string | null;
  due_date: string | null;
  max_score: number | null;
  courses?: { title: string; title_fr?: string; code?: string } | null;
}

interface Submission {
  assignment_id: string;
  submitted_at: string;
  score: number | null;
}

type TypeTab = "assignment" | "quiz" | "exam";
type StatusFilter = "all" | "pending" | "submitted" | "graded" | "overdue";

const TYPE_TABS: { key: TypeTab; en: string; fr: string; icon: typeof PencilLine }[] = [
  { key: "assignment", en: "Assignments", fr: "Devoirs", icon: PencilLine },
  { key: "quiz",       en: "Quizzes",     fr: "Quiz",    icon: HelpCircle },
  { key: "exam",       en: "Exams",       fr: "Examens", icon: FileSpreadsheet },
];

const STATUS_FILTERS: { key: StatusFilter; en: string; fr: string }[] = [
  { key: "all",       en: "All",       fr: "Tous" },
  { key: "pending",   en: "Pending",   fr: "En attente" },
  { key: "submitted", en: "Submitted", fr: "Soumis" },
  { key: "graded",    en: "Graded",    fr: "Notés" },
  { key: "overdue",   en: "Overdue",   fr: "En retard" },
];

function daysUntil(iso: string) {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
}

export default function StudentAssessments() {
  const { profile } = useAuth();
  const { i18n } = useTranslation();
  const lang = (i18n.language.startsWith("fr") ? "fr" : "en") as "en" | "fr";

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeTab, setTypeTab] = useState<TypeTab>("assignment");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  useEffect(() => {
    if (!profile?.id) return;

    async function load() {
      const { data: enrData } = await supabase
        .from("enrollments")
        .select("course_id")
        .eq("student_id", profile!.id)
        .eq("status", "active");

      const courseIds = (enrData ?? []).map((e: { course_id: string }) => e.course_id).filter(Boolean);
      if (courseIds.length === 0) { setLoading(false); return; }

      const [asgnRes, subRes] = await Promise.all([
        supabase
          .from("assignments")
          .select("*, courses(title, title_fr, code)")
          .in("course_id", courseIds)
          .order("due_date", { ascending: true, nullsFirst: false }),
        supabase
          .from("submissions")
          .select("assignment_id, submitted_at, score")
          .eq("student_id", profile!.id),
      ]);

      setAssignments((asgnRes.data ?? []) as unknown as Assignment[]);
      setSubmissions((subRes.data ?? []) as Submission[]);
      setLoading(false);
    }

    load();
  }, [profile?.id]);

  const subMap = new Map(submissions.map(s => [s.assignment_id, s]));

  function getStatus(a: Assignment): "pending" | "submitted" | "graded" | "overdue" {
    const sub = subMap.get(a.id);
    if (sub) return sub.score !== null ? "graded" : "submitted";
    if (a.due_date && daysUntil(a.due_date) < 0) return "overdue";
    return "pending";
  }

  const byType = assignments.filter(a => a.type === typeTab);
  const filtered = statusFilter === "all" ? byType : byType.filter(a => getStatus(a) === statusFilter);

  const STATUS_COLOR: Record<string, "blue" | "yellow" | "green" | "red"> = {
    pending: "blue", submitted: "yellow", graded: "green", overdue: "red",
  };
  const STATUS_LABEL: Record<string, { en: string; fr: string }> = {
    pending:   { en: "Pending",   fr: "En attente" },
    submitted: { en: "Submitted", fr: "Soumis" },
    graded:    { en: "Graded",    fr: "Noté" },
    overdue:   { en: "Overdue",   fr: "En retard" },
  };

  const activeTypeMeta = TYPE_TABS.find(t => t.key === typeTab)!;

  return (
    <StudentLayout title={lang === "en" ? "Assessments" : "Évaluations"}>
      <div className="mb-6 animate-fade-in-up">
        <h2 className="text-2xl font-black text-ink">{lang === "en" ? "Assessments" : "Évaluations"}</h2>
        <p className="text-sm text-slate mt-0.5">{assignments.length} {lang === "en" ? "total" : "au total"}</p>
      </div>

      {/* Type tabs */}
      <div className="flex gap-2 mb-4 flex-wrap animate-fade-in-up" style={{ animationDelay: "0.04s" }}>
        {TYPE_TABS.map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => { setTypeTab(t.key); setStatusFilter("all"); }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all duration-150 border
                ${typeTab === t.key
                  ? "bg-navy text-white border-navy shadow-md"
                  : "bg-white text-slate border-gray-200 hover:border-navy/30"}`}
            >
              <Icon className="w-4 h-4" strokeWidth={2} />
              {lang === "en" ? t.en : t.fr}
              <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-bold ${typeTab === t.key ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"}`}>
                {assignments.filter(a => a.type === t.key).length}
              </span>
            </button>
          );
        })}
      </div>

      {/* Status filters */}
      <div className="flex gap-1.5 mb-6 bg-gray-100 p-1 rounded-xl w-fit flex-wrap animate-fade-in-up" style={{ animationDelay: "0.08s" }}>
        {STATUS_FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setStatusFilter(f.key)}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all duration-150
              ${statusFilter === f.key ? "bg-white text-navy shadow-sm" : "text-slate hover:text-ink"}`}
          >
            {lang === "en" ? f.en : f.fr}
            <span className="ml-1 text-xs opacity-60">
              {f.key === "all" ? byType.length : byType.filter(a => getStatus(a) === f.key).length}
            </span>
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="card divide-y divide-gray-50">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={activeTypeMeta.icon}
          title={lang === "en" ? "Nothing here" : "Rien ici"}
          description={statusFilter === "pending"
            ? (lang === "en" ? "No pending items — well done!" : "Aucun élément en attente, bravo !")
            : (lang === "en" ? "No items found for this filter." : "Aucun élément pour ce filtre.")}
        />
      ) : (
        <div className="card divide-y divide-gray-50 overflow-hidden stagger-children">
          {filtered.map((a) => {
            const status = getStatus(a);
            const sub = subMap.get(a.id);
            const due = a.due_date ? new Date(a.due_date) : null;
            const days = due ? daysUntil(a.due_date!) : null;
            const aTitle = (lang === "fr" && a.title_fr) ? a.title_fr : a.title_en;
            const cTitle = a.courses ? ((lang === "fr" && a.courses.title_fr) ? a.courses.title_fr : a.courses.title) : "";
            const Icon = TYPE_TABS.find(t => t.key === a.type)?.icon ?? PencilLine;

            return (
              <Link key={a.id} to={`/student/assessments/${a.id}`} className="flex items-start gap-4 px-5 py-4 hover:bg-gray-50/60 transition-colors group">
                {/* Date / icon block */}
                {due ? (
                  <div className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center flex-shrink-0 border
                    ${status === "graded"    ? "bg-green-50 border-green-200 text-green-700"
                     : status === "submitted" ? "bg-yellow-50 border-yellow-200 text-yellow-700"
                     : status === "overdue"   ? "bg-red-50 border-red-200 text-red-700"
                     : "bg-blue-50 border-blue-200 text-blue-700"}`}>
                    <span className="text-sm font-black leading-none">{due.getDate()}</span>
                    <span className="text-[9px] font-bold uppercase">
                      {due.toLocaleString(lang === "fr" ? "fr-FR" : "en-GB", { month: "short" })}
                    </span>
                  </div>
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-5 h-5 text-gray-500" strokeWidth={2} />
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h3 className="font-bold text-ink text-sm leading-snug">{aTitle}</h3>
                    <Badge color={STATUS_COLOR[status]}>{lang === "en" ? STATUS_LABEL[status].en : STATUS_LABEL[status].fr}</Badge>
                  </div>
                  <p className="text-xs text-slate mb-2">{cTitle}{a.courses?.code ? ` (${a.courses.code})` : ""}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    {a.max_score && <Badge color="gray">{a.max_score} pts</Badge>}
                    {status === "graded" && sub?.score !== null && sub?.score !== undefined && (
                      <Badge color="green">{lang === "en" ? "Score" : "Note"}: {sub.score}/{a.max_score ?? 100}</Badge>
                    )}
                    {days !== null && (status === "pending" || status === "overdue") && (
                      <span className="text-[11px] text-gray-400">
                        {status === "overdue"
                          ? (lang === "en" ? "Was due " : "Échéance ") + Math.abs(days) + (lang === "en" ? "d ago" : "j")
                          : days === 0 ? (lang === "en" ? "Due today" : "Dû aujourd'hui")
                          : days === 1 ? (lang === "en" ? "Due tomorrow" : "Dû demain")
                          : `${lang === "en" ? "Due in" : "Dans"} ${days}${lang === "en" ? "d" : "j"}`}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex-shrink-0 self-center">
                  {status === "pending" || status === "overdue" ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-brand group-hover:bg-brand-light px-3 py-1.5 rounded-lg transition-colors">
                      <Send className="w-3.5 h-3.5" strokeWidth={2} />
                      {lang === "en" ? "Submit" : "Soumettre"}
                    </span>
                  ) : (
                    <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-brand transition-colors" strokeWidth={2} />
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </StudentLayout>
  );
}
