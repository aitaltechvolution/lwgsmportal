import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import {
  CheckCircle2, Circle, Clock, Loader2, Send, AlertTriangle,
  ListChecks, PlayCircle, ChevronRight,
} from "lucide-react";
import { Badge, ProgressBar } from "@/components/ui/primitives";
import { useConfirm } from "@/contexts/ConfirmContext";

type QType = "multiple_choice" | "true_false" | "short_answer";

interface OptionRow {
  id: string; label_en: string; label_fr: string | null; is_correct: boolean; sort_order: number;
}
interface QuestionRow {
  id: string; question_type: QType; prompt_en: string; prompt_fr: string | null;
  points: number; sort_order: number; correct_answers: string[] | null;
  question_options?: OptionRow[];
}
interface Props {
  assignmentId: string; studentId: string; maxScore: number;
  timeLimitMinutes: number | null; shuffleQuestions: boolean;
  lang: "en" | "fr";
  onSubmitted: (submission: { id: string; score: number; max_score: number }) => void;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function QuizRunner({ assignmentId, studentId, maxScore, timeLimitMinutes, shuffleQuestions, lang, onSubmitted }: Props) {
  const confirm = useConfirm();
  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState<Record<string, { optionId?: string; text?: string }>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [started, setStarted] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const startedRef = useRef<string | null>(null);
  const autoSubmittedRef = useRef(false);
  const stickyRef = useRef<HTMLDivElement>(null);
  const [headerStuck, setHeaderStuck] = useState(false);

  useEffect(() => {
    supabase.from("questions").select("*, question_options(*)")
      .eq("assignment_id", assignmentId).order("sort_order")
      .then(({ data }) => {
        let list = ((data ?? []) as QuestionRow[]).map(q => ({
          ...q, question_options: (q.question_options ?? []).sort((a, b) => a.sort_order - b.sort_order),
        }));
        if (shuffleQuestions) list = shuffle(list);
        setQuestions(list); setLoading(false);
      });
  }, [assignmentId, shuffleQuestions]);

  // Sticky sentinel observer for exam header
  useEffect(() => {
    const sentinel = document.getElementById("quiz-header-sentinel");
    if (!sentinel) return;
    const obs = new IntersectionObserver(([e]) => setHeaderStuck(!e.isIntersecting), { threshold: 1 });
    obs.observe(sentinel);
    return () => obs.disconnect();
  }, [started]);

  // Countdown timer — only starts after student clicks Start
  useEffect(() => {
    if (!started || secondsLeft === null) return;
    if (secondsLeft <= 0) {
      if (!autoSubmittedRef.current) { autoSubmittedRef.current = true; onSubmit(true); }
      return;
    }
    const t = setTimeout(() => setSecondsLeft(s => s !== null ? s - 1 : s), 1000);
    return () => clearTimeout(t);
  }, [secondsLeft, started]);

  const handleStart = () => {
    startedRef.current = new Date().toISOString();
    if (timeLimitMinutes) setSecondsLeft(timeLimitMinutes * 60);
    setStarted(true);
  };

  const setMcAnswer = (qid: string, optionId: string) => setAnswers(prev => ({ ...prev, [qid]: { optionId } }));
  const setTextAnswer = (qid: string, text: string) => setAnswers(prev => ({ ...prev, [qid]: { text } }));

  const answeredCount = questions.filter(q => {
    const a = answers[q.id];
    return a && (a.optionId || (a.text && a.text.trim()));
  }).length;

  async function onSubmit(isAutoSubmit = false) {
    if (submitting) return;
    if (!isAutoSubmit) {
      const unanswered = questions.length - answeredCount;
      if (unanswered > 0) {
        const ok = await confirm({
          title: lang === "en" ? "Submit with unanswered questions?" : "Soumettre avec des questions sans réponse ?",
          message: lang === "en"
            ? `You have ${unanswered} unanswered question(s). Unanswered questions will receive 0 points.`
            : `Il vous reste ${unanswered} question(s) sans réponse. Elles recevront 0 point.`,
          confirmLabel: lang === "en" ? "Submit Anyway" : "Soumettre quand même",
          tone: "warning",
        });
        if (!ok) return;
      }
    }

    setSubmitting(true); setError(null);
    try {
      const { data: sub, error: subErr } = await supabase.from("submissions").insert({
        assignment_id: assignmentId, student_id: studentId,
        started_at: startedRef.current, submitted_at: new Date().toISOString(),
      }).select().single();
      if (subErr) throw subErr;

      const rawAnswers = questions.map(q => {
        const a = answers[q.id];
        return q.question_type === "short_answer"
          ? { question_id: q.id, option_id: null, text_answer: a?.text ?? null }
          : { question_id: q.id, option_id: a?.optionId ?? null, text_answer: null };
      });

      const { data: gradeResult, error: gradeErr } = await supabase
        .rpc("grade_submission", { p_submission_id: sub.id, p_answers: rawAnswers })
        .single();
      if (gradeErr) throw gradeErr;

      const result = gradeResult as { score: number; max_score: number };
      onSubmitted({ id: sub.id, score: result.score, max_score: result.max_score ?? maxScore });
    } catch (err) {
      setError(err instanceof Error ? err.message : (lang === "en" ? "Submission failed." : "Échec de la soumission."));
      autoSubmittedRef.current = false;
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-28 rounded-2xl" />)}</div>;
  }

  // ── PRE-START SCREEN ──────────────────────────────────────────────────────────
  if (!started) {
    return (
      <div className="card p-8 text-center max-w-lg mx-auto">
        <div className="w-16 h-16 rounded-2xl bg-navy/5 flex items-center justify-center mx-auto mb-5">
          <ListChecks className="w-8 h-8 text-navy" strokeWidth={1.75} />
        </div>
        <h3 className="text-xl font-black text-ink mb-2">
          {lang === "en" ? "Ready to begin?" : "Prêt à commencer ?"}
        </h3>
        <div className="text-sm text-slate mb-6 space-y-1.5">
          <p><span className="font-semibold text-ink">{questions.length}</span> {lang === "en" ? "questions" : "questions"}</p>
          {timeLimitMinutes && (
            <p className="flex items-center justify-center gap-1.5">
              <Clock className="w-4 h-4 text-amber-500" strokeWidth={2} />
              <span className="font-semibold text-amber-600">{timeLimitMinutes} {lang === "en" ? "minutes — timer starts when you click Start" : "minutes — le chrono démarre quand vous cliquez sur Démarrer"}</span>
            </p>
          )}
          <p>{lang === "en" ? "Once you start, do not refresh the page." : "Une fois démarré, ne rafraîchissez pas la page."}</p>
        </div>
        <button onClick={handleStart} className="btn-primary w-full py-3 text-base">
          <PlayCircle className="w-5 h-5" strokeWidth={2} />
          {lang === "en" ? "Start Test" : "Démarrer le Test"}
        </button>
      </div>
    );
  }

  const mins = secondsLeft !== null ? Math.floor(secondsLeft / 60) : null;
  const secs = secondsLeft !== null ? secondsLeft % 60 : null;
  const timeCritical = secondsLeft !== null && secondsLeft <= 60;

  return (
    <div className="space-y-5">
      {/* Sticky sentinel */}
      <div id="quiz-header-sentinel" style={{ height: 1 }} />

      {/* ── STICKY EXAM HEADER — progress + timer + answered count ── */}
      <div ref={stickyRef}
        className={`transition-all duration-200 z-30 rounded-2xl ${
          headerStuck
            ? "sticky top-0 bg-white/95 backdrop-blur-sm border border-gray-100 shadow-lg -mx-4 px-4 py-3 rounded-none"
            : "bg-gray-50 border border-gray-100 px-4 py-3 rounded-2xl"
        }`}>
        <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
          <div className="flex items-center gap-2">
            <ListChecks className="w-4 h-4 text-navy" strokeWidth={2} />
            <span className="text-sm font-bold text-ink">
              {answeredCount}/{questions.length} {lang === "en" ? "answered" : "répondu(es)"}
            </span>
          </div>
          {secondsLeft !== null && (
            <Badge color={timeCritical ? "red" : "navy"} icon={Clock}>
              <span className={timeCritical ? "animate-pulse" : ""}>
                {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
              </span>
            </Badge>
          )}
        </div>
        <ProgressBar value={(answeredCount / Math.max(questions.length, 1)) * 100} size="sm" />
      </div>

      {/* ── QUESTIONS ── */}
      {questions.map((q, idx) => {
        const prompt = (lang === "fr" && q.prompt_fr) ? q.prompt_fr : q.prompt_en;
        const answered = !!(answers[q.id]?.optionId || answers[q.id]?.text?.trim());
        return (
          <div key={q.id} className={`card p-5 transition-all duration-150 ${answered ? "border-green-200" : ""}`}>
            <div className="flex items-start gap-2 mb-3">
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0 mt-0.5 ${answered ? "bg-green-500 text-white" : "bg-gray-100 text-gray-400"}`}>
                {answered ? "✓" : idx + 1}
              </span>
              <p className="font-semibold text-ink text-sm leading-relaxed flex-1">{prompt}</p>
              <span className="text-[11px] text-gray-400 font-medium flex-shrink-0">{q.points} pt{q.points !== 1 ? "s" : ""}</span>
            </div>

            {(q.question_type === "multiple_choice" || q.question_type === "true_false") && (
              <div className="space-y-2 pl-8">
                {(q.question_options ?? []).map(o => {
                  const selected = answers[q.id]?.optionId === o.id;
                  const label = (lang === "fr" && o.label_fr) ? o.label_fr : o.label_en;
                  return (
                    <button key={o.id} type="button" onClick={() => setMcAnswer(q.id, o.id)}
                      className={`w-full flex items-center gap-2.5 text-left px-3.5 py-2.5 rounded-xl border text-sm font-medium transition-all duration-150
                        ${selected ? "border-navy bg-navy/5 text-navy" : "border-gray-200 text-ink hover:border-navy/30"}`}>
                      {selected
                        ? <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-navy" strokeWidth={2} />
                        : <Circle className="w-4 h-4 text-gray-300 flex-shrink-0" strokeWidth={2} />}
                      {label}
                    </button>
                  );
                })}
              </div>
            )}

            {q.question_type === "short_answer" && (
              <div className="pl-8">
                <input type="text" value={answers[q.id]?.text ?? ""}
                  onChange={e => setTextAnswer(q.id, e.target.value)}
                  placeholder={lang === "en" ? "Type your answer…" : "Saisissez votre réponse…"}
                  className="input" />
              </div>
            )}
          </div>
        );
      })}

      {error && (
        <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-600 font-medium flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" strokeWidth={2} />{error}
        </div>
      )}

      <button onClick={() => onSubmit(false)} disabled={submitting}
        className="btn-primary w-full py-3 disabled:opacity-60 disabled:translate-y-0">
        {submitting ? (
          <><Loader2 className="w-4 h-4 animate-spin" strokeWidth={2.5} />{lang === "en" ? "Submitting…" : "Envoi en cours…"}</>
        ) : (
          <><Send className="w-4 h-4" strokeWidth={2} />{lang === "en" ? "Submit Test" : "Soumettre le Test"}<ChevronRight className="w-4 h-4" strokeWidth={2.5} /></>
        )}
      </button>
    </div>
  );
}
