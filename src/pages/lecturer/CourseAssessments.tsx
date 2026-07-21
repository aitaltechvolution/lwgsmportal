import { useEffect, useState, FormEvent } from "react";
import { useParams, Link } from "react-router-dom";
import LecturerLayout from "@/components/LecturerLayout";
import { supabase } from "@/lib/supabase";
import { useTranslation } from "react-i18next";
import {
  FileText, PencilLine, Plus, Loader2, Calendar, Target, ClipboardCheck,
  Pencil, Trash2, X, ChevronRight, ListChecks, Clock,
} from "lucide-react";
import { Badge, EmptyState, SkeletonRow } from "@/components/ui/primitives";
import { useConfirm } from "@/contexts/ConfirmContext";
import { useToast } from "@/contexts/ToastContext";

interface Course {
  id: string;
  title: string;
  title_fr: string | null;
  code: string | null;
}

interface Assignment {
  id: string;
  course_id: string;
  type: "assignment" | "exam";
  title_en: string;
  title_fr: string | null;
  description_en: string | null;
  description_fr: string | null;
  due_date: string | null;
  max_score: number | null;
  time_limit_minutes: number | null;
  submissionCount?: number;
  gradedCount?: number;
  questionCount?: number;
}

const TYPE_OPTIONS: { key: "assignment" | "exam"; en: string; fr: string }[] = [
  { key: "assignment", en: "Assignment", fr: "Devoir" },
  { key: "exam",       en: "Exam",       fr: "Examen" },
];

export default function CourseAssessments() {
  const { id } = useParams<{ id: string }>();
  const { i18n } = useTranslation();
  const lang = (i18n.language.startsWith("fr") ? "fr" : "en") as "en" | "fr";
  const confirm = useConfirm();
  const { showToast } = useToast();

  const [course, setCourse] = useState<Course | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [titleEn, setTitleEn] = useState("");
  const [titleFr, setTitleFr] = useState("");
  const [descEn, setDescEn] = useState("");
  const [descFr, setDescFr] = useState("");
  const [type, setType] = useState<"assignment" | "exam">("assignment");
  const [dueDate, setDueDate] = useState("");
  const [maxScore, setMaxScore] = useState("100");
  const [timeLimit, setTimeLimit] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    const [cRes, aRes] = await Promise.all([
      supabase.from("courses").select("id, title, title_fr, code").eq("id", id).maybeSingle(),
      supabase.from("assignments").select("*").eq("course_id", id).order("due_date", { ascending: false, nullsFirst: true }),
    ]);
    setCourse(cRes.data as Course | null);
    const list = (aRes.data ?? []) as Assignment[];

    // Submission + graded counts, and question counts for exams
    if (list.length > 0) {
      const subRes = await Promise.all(
        list.map((a) => supabase.from("submissions").select("score", { count: "exact" }).eq("assignment_id", a.id))
      );
      list.forEach((a, i) => {
        a.submissionCount = subRes[i].count ?? 0;
        a.gradedCount = (subRes[i].data ?? []).filter((s: { score: number | null }) => s.score !== null).length;
      });

      const examIds = list.filter(a => a.type === "exam").map(a => a.id);
      if (examIds.length > 0) {
        const { data: qCounts } = await supabase.from("questions").select("assignment_id").in("assignment_id", examIds);
        const counts = new Map<string, number>();
        (qCounts ?? []).forEach((q: { assignment_id: string }) => counts.set(q.assignment_id, (counts.get(q.assignment_id) ?? 0) + 1));
        list.forEach(a => { a.questionCount = counts.get(a.id) ?? 0; });
      }
    }

    setAssignments(list);
    setLoading(false);
  };

  useEffect(() => { load(); }, [id]);

  const resetForm = () => {
    setEditingId(null); setTitleEn(""); setTitleFr(""); setDescEn(""); setDescFr("");
    setType("assignment"); setDueDate(""); setMaxScore("100"); setTimeLimit(""); setError(null);
  };

  const startEdit = (a: Assignment) => {
    setEditingId(a.id);
    setTitleEn(a.title_en);
    setTitleFr(a.title_fr ?? "");
    setDescEn(a.description_en ?? "");
    setDescFr(a.description_fr ?? "");
    setType(a.type);
    setDueDate(a.due_date ? a.due_date.slice(0, 16) : "");
    setMaxScore(a.max_score ? String(a.max_score) : "100");
    setTimeLimit(a.time_limit_minutes ? String(a.time_limit_minutes) : "");
    setError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!id) return;
    if (!titleEn.trim()) { setError(lang === "en" ? "English title is required." : "Le titre en anglais est requis."); return; }

    setSaving(true);
    setError(null);

    const payload = {
      course_id: id,
      type,
      title_en: titleEn.trim(),
      title_fr: titleFr.trim() || null,
      description_en: descEn.trim() || null,
      description_fr: descFr.trim() || null,
      due_date: dueDate ? new Date(dueDate).toISOString() : null,
      max_score: maxScore ? Number(maxScore) : 100,
      time_limit_minutes: (type !== "assignment" && timeLimit) ? Number(timeLimit) : null,
    };

    const { error: err } = editingId
      ? await supabase.from("assignments").update(payload).eq("id", editingId)
      : await supabase.from("assignments").insert(payload);

    setSaving(false);

    if (err) { setError(err.message); return; }

    resetForm();
    load();
  };

  const onDelete = async (a: Assignment) => {
    const ok = await confirm({
      title: lang === "en" ? "Delete assessment?" : "Supprimer cette évaluation ?",
      message: lang === "en" ? "All student submissions for this assessment will be lost." : "Toutes les soumissions des étudiants pour cette évaluation seront perdues.",
      confirmLabel: lang === "en" ? "Delete" : "Supprimer",
      cancelLabel: lang === "en" ? "Cancel" : "Annuler",
      tone: "danger",
    });
    if (!ok) return;
    setAssignments(prev => prev.filter(x => x.id !== a.id));
    const { error: err } = await supabase.from("assignments").delete().eq("id", a.id);
    if (err) showToast("error", err.message); else showToast("info", lang === "en" ? "Assessment deleted." : "Évaluation supprimée.");
  };

  const courseTitle = course ? ((lang === "fr" && course.title_fr) ? course.title_fr : course.title) : "…";

  return (
    <LecturerLayout breadcrumbs={[
      { label: lang === "en" ? "My Courses" : "Mes Cours", to: "/lecturer/courses" },
      { label: courseTitle },
      { label: lang === "en" ? "Assessments" : "Évaluations" },
    ]}>
      {/* Course nav tabs */}
      <div className="flex gap-2 mb-6 flex-wrap animate-fade-in-up">
        <Link to={`/lecturer/courses/${id}/materials`} className="px-4 py-2 rounded-xl text-sm font-bold bg-white text-slate border border-gray-200 hover:border-navy/30 flex items-center gap-2 transition-all duration-150">
          <FileText className="w-4 h-4" strokeWidth={2} />
          {lang === "en" ? "Materials" : "Ressources"}
        </Link>
        <Link to={`/lecturer/courses/${id}/assessments`} className="px-4 py-2 rounded-xl text-sm font-bold bg-navy text-white shadow-md flex items-center gap-2">
          <PencilLine className="w-4 h-4" strokeWidth={2} />
          {lang === "en" ? "Assessments" : "Évaluations"}
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form */}
        <div className="lg:col-span-1">
          <div className="card p-6 animate-fade-in-up sticky top-6">
            <h3 className="font-bold text-ink mb-4 flex items-center gap-2">
              {editingId ? <Pencil className="w-4 h-4 text-navy" strokeWidth={2} /> : <Plus className="w-4 h-4 text-navy" strokeWidth={2} />}
              {editingId ? (lang === "en" ? "Edit Assessment" : "Modifier l'Évaluation") : (lang === "en" ? "Create Assignment" : "Créer un Devoir")}
            </h3>
            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <label className="label">{lang === "en" ? "Type" : "Type"}</label>
                <div className="flex gap-2">
                  {TYPE_OPTIONS.map(t => (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => setType(t.key)}
                      className={`flex-1 py-2 rounded-xl border text-xs font-semibold transition-all duration-150
                        ${type === t.key ? "border-navy bg-navy/5 text-navy" : "border-gray-200 text-slate hover:border-navy/30"}`}
                    >
                      {lang === "en" ? t.en : t.fr}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="label">{lang === "en" ? "Title (English)" : "Titre (Anglais)"} *</label>
                <input type="text" required value={titleEn} onChange={e => setTitleEn(e.target.value)} className="input" />
              </div>
              <div>
                <label className="label">{lang === "en" ? "Title (French)" : "Titre (Français)"}</label>
                <input type="text" value={titleFr} onChange={e => setTitleFr(e.target.value)} className="input" />
              </div>
              <div>
                <label className="label">{lang === "en" ? "Description (English)" : "Description (Anglais)"}</label>
                <textarea rows={3} value={descEn} onChange={e => setDescEn(e.target.value)} className="input resize-none" />
              </div>
              <div>
                <label className="label">{lang === "en" ? "Description (French)" : "Description (Français)"}</label>
                <textarea rows={3} value={descFr} onChange={e => setDescFr(e.target.value)} className="input resize-none" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">{lang === "en" ? "Due Date" : "Échéance"}</label>
                  <input type="datetime-local" value={dueDate} onChange={e => setDueDate(e.target.value)} className="input" />
                </div>
                <div>
                  <label className="label">{lang === "en" ? "Max Score" : "Note Max"}</label>
                  <input type="number" min="0" step="0.5" value={maxScore} onChange={e => setMaxScore(e.target.value)} className="input" />
                </div>
              </div>

              {type !== "assignment" && (
                <div>
                  <label className="label flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" strokeWidth={2} />{lang === "en" ? "Time Limit (minutes, optional)" : "Limite de Temps (minutes, optionnel)"}</label>
                  <input type="number" min="1" value={timeLimit} onChange={e => setTimeLimit(e.target.value)} placeholder={lang === "en" ? "No limit" : "Aucune limite"} className="input" />
                </div>
              )}

              {error && <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-600 font-medium">{error}</div>}

              <div className="flex gap-3">
                <button type="submit" disabled={saving} className="btn-primary flex-1 disabled:opacity-60 disabled:translate-y-0">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2.5} /> : <Plus className="w-4 h-4" strokeWidth={2.5} />}
                  {saving ? (lang === "en" ? "Saving…" : "Enregistrement…") : editingId ? (lang === "en" ? "Update" : "Mettre à jour") : (lang === "en" ? "Create" : "Créer")}
                </button>
                {editingId && (
                  <button type="button" onClick={resetForm} className="btn-ghost border border-gray-200">
                    <X className="w-4 h-4" strokeWidth={2} />
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>

        {/* List */}
        <div className="lg:col-span-2">
          <div className="card overflow-hidden animate-fade-in-up" style={{ animationDelay: "0.05s" }}>
            <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
              <h3 className="font-bold text-ink text-sm">{lang === "en" ? "Assessments" : "Évaluations"}</h3>
              <span className="text-xs text-gray-400">{assignments.length} {lang === "en" ? "item(s)" : "élément(s)"}</span>
            </div>
            {loading ? (
              <div className="divide-y divide-gray-50">{Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)}</div>
            ) : assignments.length === 0 ? (
              <div className="p-6"><EmptyState icon={PencilLine} title={lang === "en" ? "No assessments yet" : "Aucune évaluation"} description={lang === "en" ? "Create your first assignment using the form." : "Créez votre premier devoir."} /></div>
            ) : (
              <div className="divide-y divide-gray-50">
                {assignments.map((a) => {
                  const title = (lang === "fr" && a.title_fr) ? a.title_fr : a.title_en;
                  const typeLabel = TYPE_OPTIONS.find(t => t.key === a.type);
                  return (
                    <div key={a.id} className="px-5 py-4 hover:bg-gray-50/60 transition-colors">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <h4 className="font-bold text-ink text-sm">{title}</h4>
                            <Badge color="navy">{typeLabel ? (lang === "en" ? typeLabel.en : typeLabel.fr) : a.type}</Badge>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            {a.due_date && (
                              <span className="flex items-center gap-1 text-[11px] text-gray-400">
                                <Calendar className="w-3 h-3" strokeWidth={2} />
                                {new Date(a.due_date).toLocaleDateString(lang === "fr" ? "fr-FR" : "en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                              </span>
                            )}
                            {a.max_score && (
                              <span className="flex items-center gap-1 text-[11px] text-gray-400">
                                <Target className="w-3 h-3" strokeWidth={2} />
                                {a.max_score} pts
                              </span>
                            )}
                            {a.time_limit_minutes && (
                              <span className="flex items-center gap-1 text-[11px] text-gray-400">
                                <Clock className="w-3 h-3" strokeWidth={2} />
                                {a.time_limit_minutes} min
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 flex-wrap">
                            <Link
                              to={`/lecturer/assessments/${a.id}/submissions`}
                              className="inline-flex items-center gap-1.5 text-xs font-bold text-navy hover:text-brand transition-colors"
                            >
                              <ClipboardCheck className="w-3.5 h-3.5" strokeWidth={2} />
                              {a.submissionCount ?? 0} {lang === "en" ? "submission(s)" : "soumission(s)"}
                              {(a.submissionCount ?? 0) > (a.gradedCount ?? 0) && (
                                <Badge color="orange">{(a.submissionCount ?? 0) - (a.gradedCount ?? 0)} {lang === "en" ? "to grade" : "à corriger"}</Badge>
                              )}
                              <ChevronRight className="w-3.5 h-3.5" strokeWidth={2.5} />
                            </Link>
                            {(a.type === "exam") && (
                              <Link
                                to={`/lecturer/assessments/${a.id}/questions`}
                                className="inline-flex items-center gap-1.5 text-xs font-bold text-purple-600 hover:text-purple-700 transition-colors"
                              >
                                <ListChecks className="w-3.5 h-3.5" strokeWidth={2} />
                                {a.questionCount ?? 0} {lang === "en" ? "question(s)" : "question(s)"}
                                <ChevronRight className="w-3.5 h-3.5" strokeWidth={2.5} />
                              </Link>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button onClick={() => startEdit(a)} className="text-gray-400 hover:text-navy transition-colors">
                            <Pencil className="w-4 h-4" strokeWidth={2} />
                          </button>
                          <button onClick={() => onDelete(a)} className="text-gray-400 hover:text-red-500 transition-colors">
                            <Trash2 className="w-4 h-4" strokeWidth={2} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </LecturerLayout>
  );
}