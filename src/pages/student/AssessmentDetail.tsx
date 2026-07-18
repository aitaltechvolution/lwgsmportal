import { useEffect, useState, FormEvent } from "react";
import { useParams, Link } from "react-router-dom";
import StudentLayout from "@/components/StudentLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { useTranslation } from "react-i18next";
import {
  PencilLine, HelpCircle, FileSpreadsheet, Search, Calendar, Target,
  Paperclip, UploadCloud, CheckCircle2, Clock, Loader2, ExternalLink, AlertTriangle, Send, ListChecks,
} from "lucide-react";
import { Badge, EmptyState } from "@/components/ui/primitives";
import QuizRunner from "@/components/QuizRunner";

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
  time_limit_minutes: number | null;
  shuffle_questions: boolean;
  external_url: string | null;
  courses?: { title: string; title_fr?: string; code?: string } | null;
}

interface Submission {
  id: string;
  assignment_id: string;
  student_id: string;
  file_url: string | null;
  text_content: string | null;
  submitted_at: string;
  score: number | null;
  feedback: string | null;
}

const TYPE_META: Record<string, { icon: typeof PencilLine; en: string; fr: string }> = {
  assignment: { icon: PencilLine,     en: "Assignment", fr: "Devoir" },
  quiz:       { icon: HelpCircle,     en: "Quiz",       fr: "Quiz" },
  exam:       { icon: FileSpreadsheet,en: "Exam",       fr: "Examen" },
};

function daysUntil(iso: string) {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
}
function fileNameFromUrl(url: string) {
  try { return decodeURIComponent(url.split("/").pop() ?? url); } catch { return url; }
}

export default function AssessmentDetail() {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const { i18n } = useTranslation();
  const lang = (i18n.language.startsWith("fr") ? "fr" : "en") as "en" | "fr";

  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [questionCount, setQuestionCount] = useState(0);

  const [textAnswer, setTextAnswer] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [autoScore, setAutoScore] = useState<{ score: number; max_score: number } | null>(null);

  useEffect(() => {
    if (!id || !profile?.id) return;
    setLoading(true);

    Promise.all([
      supabase.from("assignments").select("*, courses(title, title_fr, code)").eq("id", id).maybeSingle(),
      supabase.from("submissions").select("*").eq("assignment_id", id).eq("student_id", profile.id).maybeSingle(),
      supabase.from("questions").select("id", { count: "exact", head: true }).eq("assignment_id", id),
    ]).then(([aRes, sRes, qRes]) => {
      if (aRes.error || !aRes.data) { setNotFound(true); setLoading(false); return; }
      setAssignment(aRes.data as unknown as Assignment);
      setSubmission((sRes.data ?? null) as Submission | null);
      setQuestionCount(qRes.count ?? 0);
      setLoading(false);
    });
  }, [id, profile?.id]);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) { setFile(null); return; }
    const validTypes = ["application/pdf", "image/png", "image/jpeg", "image/jpg", "image/webp"];
    if (!validTypes.includes(f.type)) {
      setError(lang === "en" ? "Only PDF or image files are allowed." : "Seuls les fichiers PDF ou image sont autorisés.");
      setFile(null);
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      setError(lang === "en" ? "File must be under 10MB." : "Le fichier doit faire moins de 10 Mo.");
      setFile(null);
      return;
    }
    setError(null);
    setFile(f);
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!profile?.id || !assignment) return;
    if (!textAnswer.trim() && !file) {
      setError(lang === "en" ? "Please write an answer or attach a file." : "Veuillez écrire une réponse ou joindre un fichier.");
      return;
    }
    setSubmitting(true);
    setError(null);

    let fileUrl: string | null = null;

    try {
      if (file) {
        const ext = file.name.split(".").pop();
        const path = `${profile.id}/${assignment.id}-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("submissions").upload(path, file, { cacheControl: "3600", upsert: false });
        if (upErr) throw upErr;
        // Submissions bucket is private — store the storage path, not a
        // public URL. The lecturer's grading view resolves a fresh signed
        // URL on demand (see SecureFileViewer), so the file is never
        // directly linkable.
        fileUrl = path;
      }

      const { data, error: insErr } = await supabase
        .from("submissions")
        .insert({
          assignment_id: assignment.id,
          student_id: profile.id,
          text_content: textAnswer.trim() || null,
          file_url: fileUrl,
          submitted_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (insErr) throw insErr;
      setSubmission(data as Submission);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : (lang === "en" ? "Submission failed. Please try again." : "Échec de la soumission."));
    } finally {
      setSubmitting(false);
    }
  };

  /* ── Loading ── */
  if (loading) {
    return (
      <StudentLayout breadcrumbs={[{ label: lang === "en" ? "Assessments" : "Évaluations", to: "/student/assessments" }, { label: "…" }]}>
        <div className="max-w-2xl space-y-4 animate-fade-in">
          <div className="skeleton h-36 rounded-2xl" />
          <div className="skeleton h-24 rounded-2xl" />
          <div className="skeleton h-64 rounded-2xl" />
        </div>
      </StudentLayout>
    );
  }

  /* ── Not found ── */
  if (notFound || !assignment) {
    return (
      <StudentLayout breadcrumbs={[{ label: lang === "en" ? "Assessments" : "Évaluations", to: "/student/assessments" }, { label: lang === "en" ? "Not found" : "Introuvable" }]}>
        <EmptyState
          icon={Search}
          title={lang === "en" ? "Assessment not found" : "Évaluation introuvable"}
          action={
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button onClick={() => window.history.back()} className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
                  ← {lang === "en" ? "Back to Course" : "Retour au Cours"}
                </button>
                <Link to="/student/assessments" className="btn-outline flex items-center justify-center">
                  {lang === "en" ? "All Assessments" : "Toutes les Évaluations"}
                </Link>
              </div>
            }
        />
      </StudentLayout>
    );
  }

  const title = (lang === "fr" && assignment.title_fr) ? assignment.title_fr : assignment.title_en;
  const description = (lang === "fr" && assignment.description_fr) ? assignment.description_fr : assignment.description_en;
  const due = assignment.due_date ? new Date(assignment.due_date) : null;
  const days = due ? daysUntil(assignment.due_date!) : null;
  const overdue = days !== null && days < 0 && !submission;
  const cTitle = assignment.courses ? ((lang === "fr" && assignment.courses.title_fr) ? assignment.courses.title_fr : assignment.courses.title) : "";
  const meta = TYPE_META[assignment.type] ?? TYPE_META.assignment;
  const TypeIcon = meta.icon;

  return (
    <StudentLayout breadcrumbs={[{ label: lang === "en" ? "Assessments" : "Évaluations", to: "/student/assessments" }, { label: title }]}>
      <div className="max-w-2xl">
        {/* ── Header card ─────────────────────────────────── */}
        <div className="relative overflow-hidden rounded-2xl bg-navy p-6 mb-6 animate-fade-in-up">
          <div className="relative">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-9 h-9 rounded-xl bg-white/[0.08] flex items-center justify-center">
                <TypeIcon className="w-[18px] h-[18px] text-amber-400" strokeWidth={2} />
              </div>
              <Badge color="orange">{lang === "en" ? meta.en : meta.fr}</Badge>
            </div>
            <h1 className="text-white text-xl md:text-2xl font-black leading-snug mb-2">{title}</h1>
            {cTitle && (
              <p className="text-white/50 text-sm mb-4">{cTitle}{assignment.courses?.code ? ` · ${assignment.courses.code}` : ""}</p>
            )}

            <div className="flex flex-wrap gap-2">
              {assignment.max_score && (
                <span className="flex items-center gap-1.5 text-xs text-white/70 bg-white/[0.06] px-3 py-1.5 rounded-full font-semibold">
                  <Target className="w-3.5 h-3.5" strokeWidth={2} />
                  {assignment.max_score} {lang === "en" ? "points" : "points"}
                </span>
              )}
              {due && (
                <span className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-semibold ${overdue ? "bg-red-400/15 text-red-300" : "bg-white/[0.06] text-white/70"}`}>
                  <Calendar className="w-3.5 h-3.5" strokeWidth={2} />
                  {lang === "en" ? "Due" : "Échéance"}: {due.toLocaleDateString(lang === "fr" ? "fr-FR" : "en-GB", { day: "numeric", month: "long", year: "numeric" })}
                  {days !== null && !submission && (
                    <> · {overdue
                      ? (lang === "en" ? `${Math.abs(days)}d overdue` : `${Math.abs(days)}j de retard`)
                      : days === 0 ? (lang === "en" ? "today" : "aujourd'hui")
                      : `${days}${lang === "en" ? "d left" : "j restants"}`}
                    </>
                  )}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ── Description ─────────────────────────────────── */}
        {description && (
          <div className="card p-6 mb-6 animate-fade-in-up" style={{ animationDelay: "0.05s" }}>
            <h3 className="text-xs font-bold text-slate uppercase tracking-wider mb-3">
              {lang === "en" ? "Instructions" : "Instructions"}
            </h3>
            <p className="text-ink text-sm leading-relaxed whitespace-pre-wrap">{description}</p>
          </div>
        )}

        {/* ── Submission area ─────────────────────────────── */}
        {submission ? (
          <div className="card overflow-hidden animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-bold text-ink">{lang === "en" ? "Your Submission" : "Votre Soumission"}</h3>
              <Badge color={submission.score !== null ? "green" : "yellow"} icon={submission.score !== null ? CheckCircle2 : Clock}>
                {submission.score !== null ? (lang === "en" ? "Graded" : "Noté") : (lang === "en" ? "Submitted" : "Soumis")}
              </Badge>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-xs text-gray-400">
                {lang === "en" ? "Submitted on" : "Soumis le"}{" "}
                {new Date(submission.submitted_at).toLocaleDateString(lang === "fr" ? "fr-FR" : "en-GB", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
              </p>

              {submission.text_content && (
                <div>
                  <h4 className="text-xs font-bold text-slate uppercase tracking-wider mb-2">{lang === "en" ? "Written Answer" : "Réponse écrite"}</h4>
                  <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                    <p className="text-sm text-ink whitespace-pre-wrap leading-relaxed">{submission.text_content}</p>
                  </div>
                </div>
              )}

              {submission.file_url && (
                <div>
                  <h4 className="text-xs font-bold text-slate uppercase tracking-wider mb-2">{lang === "en" ? "Attached File" : "Fichier Joint"}</h4>
                  <a href={submission.file_url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-3 bg-gray-50 hover:bg-gray-100 rounded-xl p-3 border border-gray-100 transition-colors group">
                    <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 flex-shrink-0">
                      <Paperclip className="w-[18px] h-[18px]" strokeWidth={2} />
                    </div>
                    <span className="text-sm font-medium text-ink truncate flex-1 group-hover:text-navy">{fileNameFromUrl(submission.file_url)}</span>
                    <ExternalLink className="w-4 h-4 text-gray-400 group-hover:text-brand transition-colors flex-shrink-0" strokeWidth={2} />
                  </a>
                </div>
              )}

              {submission.score !== null ? (
                <div className="bg-green-50 border border-green-100 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-bold text-green-800">{lang === "en" ? "Score" : "Note"}</h4>
                    <span className="text-xl font-black text-green-700">{submission.score}<span className="text-sm text-green-500">/{assignment.max_score ?? 100}</span></span>
                  </div>
                  {submission.feedback && (
                    <div>
                      <h5 className="text-xs font-bold text-green-700 uppercase tracking-wider mb-1">{lang === "en" ? "Feedback" : "Commentaires"}</h5>
                      <p className="text-sm text-green-800 leading-relaxed">{submission.feedback}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-4 flex items-center gap-3">
                  <Clock className="w-5 h-5 text-yellow-600 flex-shrink-0" strokeWidth={2} />
                  <p className="text-sm font-medium text-yellow-700">
                    {lang === "en" ? "Awaiting grading from your lecturer." : "En attente de correction par votre enseignant."}
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="card p-6 animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
            {success ? (
              <div className="text-center py-10 animate-scale-in">
                <div className="w-14 h-14 rounded-2xl bg-green-50 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-7 h-7 text-green-600" strokeWidth={2} />
                </div>
                <p className="font-bold text-green-700 text-lg mb-1">{lang === "en" ? "Submitted successfully!" : "Soumis avec succès !"}</p>
                {autoScore ? (
                  <>
                    <p className="text-slate text-sm mb-3">{lang === "en" ? "Your test was graded automatically." : "Votre test a été corrigé automatiquement."}</p>
                    <div className="inline-flex items-center gap-2 bg-green-50 border border-green-100 rounded-xl px-4 py-2">
                      <span className="text-xl font-black text-green-700">{autoScore.score}</span>
                      <span className="text-sm text-green-500">/{autoScore.max_score}</span>
                    </div>
                  </>
                ) : (
                  <p className="text-slate text-sm">{lang === "en" ? "You will be notified once it is graded." : "Vous serez notifié(e) une fois noté."}</p>
                )}
              </div>
            ) : questionCount > 0 ? (
              <>
                <h3 className="font-bold text-ink mb-1 flex items-center gap-2">
                  <ListChecks className="w-4 h-4 text-navy" strokeWidth={2} />
                  {lang === "en" ? "Answer the Questions" : "Répondez aux Questions"}
                </h3>
                <p className="text-xs text-slate mb-4">
                  {lang === "en" ? "Multiple choice and true/false are graded instantly. Short answers are matched automatically too." : "Les choix multiples et vrai/faux sont notés instantanément. Les réponses courtes aussi."}
                </p>
                {overdue && (
                  <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 flex items-start gap-3 text-sm text-red-700 font-medium mb-4">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" strokeWidth={2} />
                    {lang === "en" ? "This assessment is past its due date. Late submissions may be penalized." : "Cette évaluation est en retard. Les soumissions tardives peuvent être pénalisées."}
                  </div>
                )}
                <QuizRunner
                  assignmentId={assignment.id}
                  studentId={profile!.id}
                  maxScore={assignment.max_score ?? 100}
                  timeLimitMinutes={assignment.time_limit_minutes}
                  shuffleQuestions={assignment.shuffle_questions}
                  lang={lang}
                  onSubmitted={(sub) => {
                    setSubmission({ id: sub.id, assignment_id: assignment.id, student_id: profile!.id, file_url: null, text_content: null, submitted_at: new Date().toISOString(), score: sub.score, feedback: null });
                    setAutoScore({ score: sub.score, max_score: sub.max_score });
                    setSuccess(true);
                  }}
                />
              </>
            ) : assignment.external_url ? (
              <>
                <h3 className="font-bold text-ink mb-2">{lang === "en" ? "Hosted Externally" : "Hébergé en Externe"}</h3>
                <p className="text-sm text-slate mb-4">
                  {lang === "en"
                    ? "This test is hosted on an external site. Complete it there, then your lecturer will enter your score manually once available."
                    : "Ce test est hébergé sur un site externe. Complétez-le là-bas ; votre enseignant saisira votre note manuellement."}
                </p>
                <a href={assignment.external_url} target="_blank" rel="noopener noreferrer" className="btn-primary w-full justify-center">
                  <ExternalLink className="w-4 h-4" strokeWidth={2} />
                  {lang === "en" ? "Open Test" : "Ouvrir le Test"}
                </a>
              </>
            ) : (
              <>
                <h3 className="font-bold text-ink mb-4">{lang === "en" ? "Submit Your Work" : "Soumettre Votre Travail"}</h3>
                <form onSubmit={onSubmit} className="space-y-5">
                {overdue && (
                  <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 flex items-start gap-3 text-sm text-red-700 font-medium">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" strokeWidth={2} />
                    {lang === "en" ? "This assessment is past its due date. Late submissions may be penalized." : "Cette évaluation est en retard. Les soumissions tardives peuvent être pénalisées."}
                  </div>
                )}

                <div>
                  <label className="label">{lang === "en" ? "Written Answer" : "Réponse Écrite"}</label>
                  <textarea
                    rows={8}
                    value={textAnswer}
                    onChange={e => setTextAnswer(e.target.value)}
                    placeholder={lang === "en" ? "Type your answer here…" : "Saisissez votre réponse ici…"}
                    className="input resize-none"
                  />
                </div>

                <div>
                  <label className="label">{lang === "en" ? "Attach File (PDF or Image, max 10MB)" : "Joindre un Fichier (PDF ou Image, max 10 Mo)"}</label>
                  <label className="flex items-center justify-center gap-2 border-2 border-dashed border-gray-200 hover:border-navy/30 rounded-xl px-4 py-8 cursor-pointer transition-colors group">
                    <input type="file" accept=".pdf,image/png,image/jpeg,image/webp" onChange={onFileChange} className="hidden" />
                    {file ? (
                      <div className="flex items-center gap-2 text-sm text-ink">
                        <Paperclip className="w-5 h-5 text-navy" strokeWidth={2} />
                        <span className="font-medium">{file.name}</span>
                        <span className="text-xs text-gray-400">({(file.size / 1024 / 1024).toFixed(1)} MB)</span>
                      </div>
                    ) : (
                      <div className="text-center">
                        <UploadCloud className="w-7 h-7 text-gray-400 group-hover:text-navy mx-auto mb-1.5 transition-colors" strokeWidth={1.75} />
                        <span className="text-sm text-slate group-hover:text-navy transition-colors font-medium">
                          {lang === "en" ? "Click to choose a file" : "Cliquez pour choisir un fichier"}
                        </span>
                      </div>
                    )}
                  </label>
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-600 font-medium">{error}</div>
                )}

                <button type="submit" disabled={submitting} className="btn-primary w-full py-3 disabled:opacity-60 disabled:translate-y-0">
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2.5} />
                      {lang === "en" ? "Submitting…" : "Envoi en cours…"}
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" strokeWidth={2} />
                      {lang === "en" ? "Submit" : "Soumettre"}
                    </>
                  )}
                </button>
              </form>
              </>
            )}
          </div>
        )}
      </div>
    </StudentLayout>
  );
}
