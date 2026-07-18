import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import LecturerLayout from "@/components/LecturerLayout";
import { supabase } from "@/lib/supabase";
import { useTranslation } from "react-i18next";
import {
  Search, Paperclip, Eye, CheckCircle2, Clock, Save, Loader2, Users,
} from "lucide-react";
import { Badge, EmptyState, SkeletonRow } from "@/components/ui/primitives";
import SecureFileViewer from "@/components/SecureFileViewer";
import { useToast } from "@/contexts/ToastContext";

interface Assignment {
  id: string;
  course_id: string;
  title_en: string;
  title_fr: string | null;
  max_score: number | null;
  courses?: { title: string; title_fr?: string; code?: string } | null;
}

interface Submission {
  id: string;
  student_id: string;
  file_url: string | null;
  text_content: string | null;
  submitted_at: string;
  score: number | null;
  feedback: string | null;
  profiles?: { full_name: string; email: string } | null;
}

function fileNameFromUrl(url: string) {
  try { return decodeURIComponent(url.split("/").pop() ?? url); } catch { return url; }
}

export default function AssessmentSubmissions() {
  const { id } = useParams<{ id: string }>();
  const { i18n } = useTranslation();
  const lang = (i18n.language.startsWith("fr") ? "fr" : "en") as "en" | "fr";
  const { showToast } = useToast();

  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);

  // Per-row edit state
  const [scores, setScores] = useState<Record<string, string>>({});
  const [feedbacks, setFeedbacks] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [viewingSub, setViewingSub] = useState<Submission | null>(null);
  const [expandedSub, setExpandedSub] = useState<string | null>(null);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    const [aRes, sRes] = await Promise.all([
      supabase.from("assignments").select("*, courses(title, title_fr, code)").eq("id", id).maybeSingle(),
      supabase.from("submissions").select("*, profiles(full_name, email)").eq("assignment_id", id).order("submitted_at", { ascending: false }),
    ]);
    setAssignment(aRes.data as unknown as Assignment | null);
    const subs = (sRes.data ?? []) as unknown as Submission[];
    setSubmissions(subs);

    const initScores: Record<string, string> = {};
    const initFeedback: Record<string, string> = {};
    subs.forEach(s => {
      initScores[s.id] = s.score !== null ? String(s.score) : "";
      initFeedback[s.id] = s.feedback ?? "";
    });
    setScores(initScores);
    setFeedbacks(initFeedback);
    setLoading(false);
  };

  useEffect(() => { load(); }, [id]);

  const saveGrade = async (submissionId: string) => {
    const scoreVal = scores[submissionId];
    const feedbackVal = feedbacks[submissionId];

    if (scoreVal !== "" && assignment?.max_score && Number(scoreVal) > assignment.max_score) {
      showToast("error", lang === "en" ? `Score cannot exceed ${assignment.max_score}.` : `La note ne peut pas dépasser ${assignment.max_score}.`);
      return;
    }

    setSavingId(submissionId);
    const { error } = await supabase
      .from("submissions")
      .update({ score: scoreVal === "" ? null : Number(scoreVal), feedback: feedbackVal || null })
      .eq("id", submissionId);
    setSavingId(null);

    if (!error) {
      setSubmissions(prev => prev.map(s => s.id === submissionId ? { ...s, score: scoreVal === "" ? null : Number(scoreVal), feedback: feedbackVal || null } : s));
      setSavedId(submissionId);
      setTimeout(() => setSavedId(null), 2000);
    }
  };

  const title = assignment ? ((lang === "fr" && assignment.title_fr) ? assignment.title_fr : assignment.title_en) : "…";
  const cTitle = assignment?.courses ? ((lang === "fr" && assignment.courses.title_fr) ? assignment.courses.title_fr : assignment.courses.title) : "";
  const maxScore = assignment?.max_score ?? 100;
  const gradedCount = submissions.filter(s => s.score !== null).length;

  return (
    <LecturerLayout breadcrumbs={[
      { label: lang === "en" ? "My Courses" : "Mes Cours", to: "/lecturer/courses" },
      ...(assignment ? [{ label: cTitle, to: `/lecturer/courses/${assignment.course_id}/assessments` }] : []),
      { label: title },
    ]}>
      <div className="mb-6 animate-fade-in-up">
        <h2 className="text-2xl font-black text-ink">{title}</h2>
        <p className="text-sm text-slate mt-0.5">
          {cTitle}{assignment?.courses?.code ? ` · ${assignment.courses.code}` : ""}
        </p>
      </div>

      {/* Summary */}
      {!loading && (
        <div className="grid grid-cols-3 gap-4 mb-6 stagger-children">
          <div className="card p-5 text-center">
            <Users className="w-5 h-5 text-navy mx-auto mb-1" strokeWidth={2} />
            <div className="text-2xl font-black text-navy">{submissions.length}</div>
            <div className="text-xs text-slate font-semibold mt-1 uppercase tracking-wider">{lang === "en" ? "Submissions" : "Soumissions"}</div>
          </div>
          <div className="card p-5 text-center">
            <CheckCircle2 className="w-5 h-5 text-green-600 mx-auto mb-1" strokeWidth={2} />
            <div className="text-2xl font-black text-green-600">{gradedCount}</div>
            <div className="text-xs text-slate font-semibold mt-1 uppercase tracking-wider">{lang === "en" ? "Graded" : "Notés"}</div>
          </div>
          <div className="card p-5 text-center">
            <Clock className="w-5 h-5 text-yellow-500 mx-auto mb-1" strokeWidth={2} />
            <div className="text-2xl font-black text-yellow-500">{submissions.length - gradedCount}</div>
            <div className="text-xs text-slate font-semibold mt-1 uppercase tracking-wider">{lang === "en" ? "Pending" : "En attente"}</div>
          </div>
        </div>
      )}

      {/* Submissions list */}
      {loading ? (
        <div className="card divide-y divide-gray-50">{Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)}</div>
      ) : submissions.length === 0 ? (
        <EmptyState icon={Search} title={lang === "en" ? "No submissions yet" : "Aucune soumission"} description={lang === "en" ? "Submissions will appear here as students submit their work." : "Les soumissions apparaîtront ici."} />
      ) : (
        <div className="space-y-4 stagger-children">
          {submissions.map((s) => {
            const isGraded = s.score !== null;
            return (
              <div key={s.id} className="card p-5">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-navy to-navy-light flex items-center justify-center text-white font-black text-sm flex-shrink-0">
                      {s.profiles?.full_name?.charAt(0).toUpperCase() ?? "?"}
                    </div>
                    <div>
                      <p className="font-bold text-ink text-sm">{s.profiles?.full_name ?? "—"}</p>
                      <p className="text-xs text-gray-400">{s.profiles?.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge color={isGraded ? "green" : "yellow"} icon={isGraded ? CheckCircle2 : Clock}>
                      {isGraded ? (lang === "en" ? "Graded" : "Noté") : (lang === "en" ? "Pending" : "En attente")}
                    </Badge>
                    <span className="text-xs text-gray-400">
                      {new Date(s.submitted_at).toLocaleDateString(lang === "fr" ? "fr-FR" : "en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                </div>

                {/* Submission content */}
                {s.text_content && (
                  <div className="bg-gray-50 rounded-xl border border-gray-100 mb-3 overflow-hidden">
                    <div className={`px-4 pt-4 text-sm text-ink whitespace-pre-wrap leading-relaxed ${expandedSub === s.id ? "" : "line-clamp-4"}`}>
                      {s.text_content}
                    </div>
                    <div className="px-4 py-2.5 border-t border-gray-100 flex items-center justify-between">
                      <span className="text-xs text-gray-400">
                        {s.text_content.split(" ").length} {lang === "en" ? "words" : "mots"}
                      </span>
                      <button
                        onClick={() => setExpandedSub(expandedSub === s.id ? null : s.id)}
                        className="text-xs font-bold text-navy hover:text-brand transition-colors"
                      >
                        {expandedSub === s.id
                          ? (lang === "en" ? "▲ Show Less" : "▲ Réduire")
                          : (lang === "en" ? "▼ Read Full Submission" : "▼ Lire la Soumission Complète")}
                      </button>
                    </div>
                  </div>
                )}
                {s.file_url && (
                  <button onClick={() => setViewingSub(s)}
                    className="flex items-center gap-3 bg-gray-50 hover:bg-gray-100 rounded-xl p-3 border border-gray-100 transition-colors group mb-3 max-w-md w-full text-left">
                    <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 flex-shrink-0">
                      <Paperclip className="w-4 h-4" strokeWidth={2} />
                    </div>
                    <span className="text-sm font-medium text-ink truncate flex-1 group-hover:text-navy">{fileNameFromUrl(s.file_url)}</span>
                    <Eye className="w-4 h-4 text-gray-400 group-hover:text-brand transition-colors flex-shrink-0" strokeWidth={2} />
                  </button>
                )}

                {/* Grading form */}
                <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr_auto] gap-3 items-start pt-3 border-t border-gray-50">
                  <div>
                    <label className="label">{lang === "en" ? "Score" : "Note"}</label>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="0"
                        max={maxScore}
                        step="0.5"
                        value={scores[s.id] ?? ""}
                        onChange={e => setScores(prev => ({ ...prev, [s.id]: e.target.value }))}
                        className="input"
                        placeholder="—"
                      />
                      <span className="text-sm text-gray-400 flex-shrink-0">/ {maxScore}</span>
                    </div>
                  </div>
                  <div>
                    <label className="label">{lang === "en" ? "Feedback" : "Commentaires"}</label>
                    <textarea
                      rows={1}
                      value={feedbacks[s.id] ?? ""}
                      onChange={e => setFeedbacks(prev => ({ ...prev, [s.id]: e.target.value }))}
                      className="input resize-none"
                      placeholder={lang === "en" ? "Optional feedback for the student…" : "Commentaire facultatif…"}
                    />
                  </div>
                  <div className="sm:pt-[26px]">
                    <button
                      onClick={() => saveGrade(s.id)}
                      disabled={savingId === s.id}
                      className="btn-primary w-full sm:w-auto disabled:opacity-60 disabled:translate-y-0"
                    >
                      {savingId === s.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2.5} />
                      ) : savedId === s.id ? (
                        <CheckCircle2 className="w-4 h-4" strokeWidth={2.5} />
                      ) : (
                        <Save className="w-4 h-4" strokeWidth={2} />
                      )}
                      {savedId === s.id ? (lang === "en" ? "Saved" : "Enregistré") : (lang === "en" ? "Save Grade" : "Enregistrer")}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {viewingSub && viewingSub.file_url && (
        <SecureFileViewer
          open={!!viewingSub}
          onClose={() => setViewingSub(null)}
          title={fileNameFromUrl(viewingSub.file_url)}
          storedUrl={viewingSub.file_url}
          kind="file"
          bucket="submissions"
        />
      )}
    </LecturerLayout>
  );
}
