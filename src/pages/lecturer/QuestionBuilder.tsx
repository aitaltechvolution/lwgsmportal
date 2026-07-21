import { useEffect, useState, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import LecturerLayout from "@/components/LecturerLayout";
import { supabase } from "@/lib/supabase";
import { useTranslation } from "react-i18next";
import {
  ListChecks, Plus, Trash2, GripVertical, CheckCircle2, Circle,
  Loader2, ChevronLeft, ToggleLeft, AlignLeft, ListTodo, Upload,
  FileText, X, AlertTriangle,
} from "lucide-react";
import { EmptyState, Badge } from "@/components/ui/primitives";
import { useToast } from "@/contexts/ToastContext";
import { useConfirm } from "@/contexts/ConfirmContext";

type QType = "multiple_choice" | "true_false" | "short_answer";

interface OptionRow {
  id: string;
  label_en: string;
  label_fr: string | null;
  is_correct: boolean;
  sort_order: number;
}

interface QuestionRow {
  id: string;
  question_type: QType;
  prompt_en: string;
  prompt_fr: string | null;
  points: number;
  sort_order: number;
  correct_answers: string[] | null;
  question_options?: OptionRow[];
}

interface Assignment {
  id: string;
  title_en: string;
  title_fr: string | null;
  course_id: string;
  type: "assignment" | "quiz" | "exam";
}

const TYPE_META: Record<QType, { icon: typeof ListTodo; en: string; fr: string; color: string }> = {
  multiple_choice: { icon: ListTodo,   en: "Multiple Choice", fr: "Choix Multiple", color: "text-blue-600 bg-blue-50 border-blue-200" },
  true_false:      { icon: ToggleLeft, en: "True / False",    fr: "Vrai / Faux",    color: "text-green-600 bg-green-50 border-green-200" },
  short_answer:    { icon: AlignLeft,  en: "Short Answer",    fr: "Réponse Courte", color: "text-purple-600 bg-purple-50 border-purple-200" },
};

function newId() { return Math.random().toString(36).slice(2, 10); }

// Two options count as duplicates if their text matches once trimmed and
// case-folded — "Paris" and "paris" are the same answer to a student, even
// though they're different strings. Blank options are ignored here; the
// separate "every option needs text" check in onSaveAll already covers
// those.
function findDuplicateOptionIds(options: OptionRow[]): Set<string> {
  const firstSeenAt = new Map<string, string>();
  const dupIds = new Set<string>();
  for (const o of options) {
    const key = o.label_en.trim().toLowerCase();
    if (!key) continue;
    const firstId = firstSeenAt.get(key);
    if (firstId) { dupIds.add(firstId); dupIds.add(o.id); }
    else firstSeenAt.set(key, o.id);
  }
  return dupIds;
}

// ── CSV Parser ─────────────────────────────────────────────────────────────────
// Expected CSV format (header row required):
// prompt_en, type, option_a, option_b, option_c, option_d, correct, points
// type: mc | tf | sa
// correct: for mc = a/b/c/d | for tf = true/false | for sa = accepted answer text
function parseCSV(text: string): { questions: QuestionRow[]; errors: string[] } {
  const lines = text.trim().split("\n").map(l => l.trim()).filter(Boolean);
  const errors: string[] = [];
  const questions: QuestionRow[] = [];

  if (lines.length < 2) { errors.push("CSV must have a header row and at least one data row."); return { questions, errors }; }

  const header = lines[0].toLowerCase().split(",").map(h => h.trim().replace(/"/g, ""));
  const col = (name: string) => header.indexOf(name);

  if (col("prompt_en") === -1 || col("type") === -1) {
    errors.push("CSV must have columns: prompt_en, type");
    return { questions, errors };
  }

  for (let i = 1; i < lines.length; i++) {
    const raw = lines[i].match(/(".*?"|[^,]+)(?=,|$)/g) ?? lines[i].split(",");
    const get = (idx: number) => (raw[idx] ?? "").trim().replace(/^"|"$/g, "");

    const prompt = get(col("prompt_en"));
    const type = get(col("type")).toLowerCase();
    const pts = parseFloat(get(col("points"))) || 1;

    if (!prompt) { errors.push(`Row ${i + 1}: prompt_en is empty.`); continue; }

    if (type === "mc" || type === "multiple_choice") {
      const optA = get(col("option_a")); const optB = get(col("option_b"));
      const optC = get(col("option_c")); const optD = get(col("option_d"));
      const correct = get(col("correct")).toLowerCase();
      const correctMap: Record<string, string> = { a: optA, b: optB, c: optC, d: optD };
      const opts = [optA, optB, optC, optD].filter(Boolean);
      if (opts.length < 2) { errors.push(`Row ${i + 1}: Need at least 2 options for MC.`); continue; }
      const dupCheck = new Set<string>();
      const dup = opts.find(o => { const k = o.trim().toLowerCase(); if (dupCheck.has(k)) return true; dupCheck.add(k); return false; });
      if (dup) { errors.push(`Row ${i + 1}: Duplicate option "${dup}" — each option must be unique.`); continue; }
      questions.push({
        id: `new-${newId()}`, question_type: "multiple_choice",
        prompt_en: prompt, prompt_fr: null, points: pts,
        sort_order: questions.length, correct_answers: null,
        question_options: [optA, optB, optC, optD].filter(Boolean).map((label, oi) => ({
          id: `new-${newId()}`, label_en: label, label_fr: null,
          is_correct: correctMap[["a","b","c","d"][oi]] === label && ["a","b","c","d"][oi] === correct,
          sort_order: oi,
        })),
      });
    } else if (type === "tf" || type === "true_false") {
      const isTrue = get(col("correct")).toLowerCase() === "true";
      questions.push({
        id: `new-${newId()}`, question_type: "true_false",
        prompt_en: prompt, prompt_fr: null, points: pts,
        sort_order: questions.length, correct_answers: null,
        question_options: [
          { id: `new-${newId()}`, label_en: "True", label_fr: "Vrai", is_correct: isTrue, sort_order: 0 },
          { id: `new-${newId()}`, label_en: "False", label_fr: "Faux", is_correct: !isTrue, sort_order: 1 },
        ],
      });
    } else if (type === "sa" || type === "short_answer") {
      const correct = get(col("correct"));
      questions.push({
        id: `new-${newId()}`, question_type: "short_answer",
        prompt_en: prompt, prompt_fr: null, points: pts,
        sort_order: questions.length,
        correct_answers: correct ? correct.split("|").map(s => s.trim()) : [],
        question_options: [],
      });
    } else {
      errors.push(`Row ${i + 1}: Unknown type "${type}". Use: mc, tf, sa`);
    }
  }
  return { questions, errors };
}

export default function QuestionBuilder() {
  const { id: assignmentId } = useParams<{ id: string }>();
  const { i18n } = useTranslation();
  const lang = (i18n.language.startsWith("fr") ? "fr" : "en") as "en" | "fr";
  const { showToast } = useToast();
  const confirm = useConfirm();

  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // CSV import
  const [importing, setImporting] = useState(false);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const csvRef = useRef<HTMLInputElement>(null);

  // Sticky type-bar sentinel
  const typeBarRef = useRef<HTMLDivElement>(null);
  const [typeBarStuck, setTypeBarStuck] = useState(false);

  useEffect(() => {
    const sentinel = document.getElementById("type-bar-sentinel");
    if (!sentinel) return;
    const obs = new IntersectionObserver(([e]) => setTypeBarStuck(!e.isIntersecting), { threshold: 1 });
    obs.observe(sentinel);
    return () => obs.disconnect();
  }, []);

  const load = async () => {
    if (!assignmentId) return;
    setLoading(true);
    const [aRes, qRes] = await Promise.all([
      supabase.from("assignments").select("id, title_en, title_fr, course_id, type").eq("id", assignmentId).maybeSingle(),
      supabase.from("questions").select("*, question_options(*)").eq("assignment_id", assignmentId).order("sort_order"),
    ]);
    setAssignment(aRes.data as Assignment | null);
    const list = ((qRes.data ?? []) as QuestionRow[]).map(q => ({
      ...q,
      question_options: (q.question_options ?? []).sort((a, b) => a.sort_order - b.sort_order),
    }));
    setQuestions(list);
    setLoading(false);
  };

  useEffect(() => { load(); }, [assignmentId]);

  const addQuestion = (type: QType) => {
    const q: QuestionRow = {
      id: `new-${newId()}`, question_type: type,
      prompt_en: "", prompt_fr: "", points: 1,
      sort_order: questions.length, correct_answers: type === "short_answer" ? [""] : null,
      question_options: type === "multiple_choice"
        ? [
            { id: `new-${newId()}`, label_en: "", label_fr: "", is_correct: true,  sort_order: 0 },
            { id: `new-${newId()}`, label_en: "", label_fr: "", is_correct: false, sort_order: 1 },
          ]
        : type === "true_false"
        ? [
            { id: `new-${newId()}`, label_en: "True",  label_fr: "Vrai", is_correct: true,  sort_order: 0 },
            { id: `new-${newId()}`, label_en: "False", label_fr: "Faux", is_correct: false, sort_order: 1 },
          ]
        : [],
    };
    setQuestions(prev => [...prev, q]);
  };

  const updateQuestion = (qid: string, patch: Partial<QuestionRow>) =>
    setQuestions(prev => prev.map(q => q.id === qid ? { ...q, ...patch } : q));

  const removeQuestion = (qid: string) =>
    setQuestions(prev => prev.filter(q => q.id !== qid));

  const updateOption = (qid: string, oid: string, patch: Partial<OptionRow>) =>
    setQuestions(prev => prev.map(q => q.id !== qid ? q : {
      ...q, question_options: (q.question_options ?? []).map(o => o.id === oid ? { ...o, ...patch } : o),
    }));

  const setCorrectOption = (qid: string, oid: string) =>
    setQuestions(prev => prev.map(q => q.id !== qid ? q : {
      ...q, question_options: (q.question_options ?? []).map(o => ({ ...o, is_correct: o.id === oid })),
    }));

  const addOption = (qid: string) =>
    setQuestions(prev => prev.map(q => {
      if (q.id !== qid) return q;
      const opts = q.question_options ?? [];
      return { ...q, question_options: [...opts, { id: `new-${newId()}`, label_en: "", label_fr: "", is_correct: false, sort_order: opts.length }] };
    }));

  const removeOption = (qid: string, oid: string) =>
    setQuestions(prev => prev.map(q => q.id !== qid ? q : {
      ...q, question_options: (q.question_options ?? []).filter(o => o.id !== oid),
    }));

  // CSV import handler
  const handleCSVImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith(".csv")) {
      showToast("error", lang === "en" ? "Please upload a .csv file." : "Veuillez téléverser un fichier .csv.");
      return;
    }
    setImporting(true); setImportErrors([]);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const { questions: imported, errors } = parseCSV(text);
      setImportErrors(errors);
      if (imported.length > 0) {
        setQuestions(prev => [...prev, ...imported.map((q, i) => ({ ...q, sort_order: prev.length + i }))]);
        showToast("success", `${imported.length} ${lang === "en" ? "question(s) imported." : "question(s) importée(s)."}`);
      }
      if (errors.length > 0) showToast("warning", `${errors.length} ${lang === "en" ? "row(s) had errors — check the list below." : "ligne(s) avec erreurs."}`);
      setImporting(false);
      if (csvRef.current) csvRef.current.value = "";
    };
    reader.readAsText(file);
  };

  const onSaveAll = async () => {
    if (!assignmentId) return;
    setSaving(true);
    try {
      for (const [idx, q] of questions.entries()) {
        if (!q.prompt_en.trim()) throw new Error(lang === "en" ? "Every question needs an English prompt." : "Chaque question nécessite un énoncé en anglais.");
        if (q.question_type === "multiple_choice") {
          const opts = q.question_options ?? [];
          if (opts.length < 2) throw new Error(lang === "en" ? "Multiple choice needs at least 2 options." : "Choix multiple nécessite au moins 2 options.");
          if (!opts.some(o => o.is_correct)) throw new Error(lang === "en" ? "Mark one option as correct." : "Indiquez une option correcte.");
          if (opts.some(o => !o.label_en.trim())) throw new Error(lang === "en" ? "Every option needs English text." : "Chaque option nécessite un texte.");
          // No two options in the same question may have the same text —
          // that's an unusable duplicate answer for a student to choose
          // between. Matches the live inline check shown in the form.
          const dupIds = findDuplicateOptionIds(opts);
          if (dupIds.size > 0) {
            const dupText = opts.find(o => dupIds.has(o.id))?.label_en.trim() ?? "";
            throw new Error(lang === "en"
              ? `Question ${idx + 1} has duplicate options: "${dupText}". Each option must be unique.`
              : `La question ${idx + 1} contient des options en double : « ${dupText} ». Chaque option doit être unique.`);
          }
        }
        if (q.question_type === "short_answer" && !(q.correct_answers ?? []).some(a => a.trim()))
          throw new Error(lang === "en" ? "Provide at least one accepted answer." : "Indiquez au moins une réponse acceptée.");

        const qPayload = {
          assignment_id: assignmentId, question_type: q.question_type,
          prompt_en: q.prompt_en.trim(), prompt_fr: q.prompt_fr?.trim() || null,
          points: q.points || 1, sort_order: idx,
          correct_answers: q.question_type === "short_answer"
            ? (q.correct_answers ?? []).map(a => a.trim()).filter(Boolean) : null,
        };

        let qid = q.id;
        if (qid.startsWith("new-")) {
          const { data, error } = await supabase.from("questions").insert(qPayload).select("id").single();
          if (error) throw error;
          qid = data.id;
        } else {
          const { error } = await supabase.from("questions").update(qPayload).eq("id", qid);
          if (error) throw error;
        }

        if (q.question_type !== "short_answer") {
          for (const [oIdx, o] of (q.question_options ?? []).entries()) {
            const oPayload = {
              question_id: qid, label_en: o.label_en.trim(),
              label_fr: o.label_fr?.trim() || null,
              is_correct: o.is_correct, sort_order: oIdx,
            };
            if (o.id.startsWith("new-")) {
              const { error } = await supabase.from("question_options").insert(oPayload);
              if (error) throw error;
            } else {
              const { error } = await supabase.from("question_options").update(oPayload).eq("id", o.id);
              if (error) throw error;
            }
          }
        }
      }
      showToast("success", lang === "en" ? "All questions saved!" : "Toutes les questions enregistrées !");
      load();
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : (lang === "en" ? "Save failed." : "Échec."));
    } finally {
      setSaving(false);
    }
  };

  const onDeleteQuestion = async (qid: string) => {
    if (qid.startsWith("new-")) { removeQuestion(qid); return; }
    const ok = await confirm({
      title: lang === "en" ? "Delete question?" : "Supprimer la question ?",
      message: lang === "en" ? "This cannot be undone." : "Cette action est irréversible.",
      confirmLabel: lang === "en" ? "Delete" : "Supprimer",
      tone: "danger",
    });
    if (!ok) return;
    removeQuestion(qid);
    await supabase.from("questions").delete().eq("id", qid);
  };

  const title = assignment ? ((lang === "fr" && assignment.title_fr) ? assignment.title_fr : assignment.title_en) : "…";
  const totalPoints = questions.reduce((s, q) => s + (q.points || 0), 0);
  const hasDuplicateOptions = questions.some(q =>
    q.question_type === "multiple_choice" && findDuplicateOptionIds(q.question_options ?? []).size > 0
  );

  return (
    <LecturerLayout breadcrumbs={[
      { label: lang === "en" ? "My Courses" : "Mes Cours", to: "/lecturer/courses" },
      { label: lang === "en" ? "Assessments" : "Évaluations", to: assignment ? `/lecturer/courses/${assignment.course_id}/assessments` : "/lecturer/courses" },
      { label: title },
    ]}>
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap animate-fade-in-up">
        <div>
          <Link to={assignment ? `/lecturer/courses/${assignment.course_id}/assessments` : "/lecturer/courses"}
            className="inline-flex items-center gap-1 text-xs font-semibold text-slate hover:text-navy mb-2 transition-colors">
            <ChevronLeft className="w-3.5 h-3.5" strokeWidth={2.5} />
            {lang === "en" ? "Back to Assessments" : "Retour aux Évaluations"}
          </Link>
          <h2 className="text-2xl font-black text-ink flex items-center gap-2">
            <ListChecks className="w-6 h-6 text-purple-600" strokeWidth={2} />
            {title}
          </h2>
          <p className="text-sm text-slate mt-0.5">
            {questions.length} {lang === "en" ? "question(s)" : "question(s)"} · {totalPoints} {lang === "en" ? "pts total" : "pts au total"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* CSV Import */}
          <label className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 hover:border-navy/30 bg-white text-sm font-semibold text-ink hover:bg-gray-50 transition-all duration-150 cursor-pointer">
            <input ref={csvRef} type="file" accept=".csv" onChange={handleCSVImport} className="hidden" />
            {importing ? <Loader2 className="w-4 h-4 animate-spin text-navy" strokeWidth={2} /> : <Upload className="w-4 h-4 text-navy" strokeWidth={2} />}
            {lang === "en" ? "Import CSV" : "Importer CSV"}
          </label>
          <button onClick={onSaveAll} disabled={saving || questions.length === 0 || hasDuplicateOptions}
            title={hasDuplicateOptions ? (lang === "en" ? "Fix duplicate options before saving." : "Corrigez les options en double avant d'enregistrer.") : undefined}
            className="btn-primary disabled:opacity-60 disabled:translate-y-0">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2.5} /> : <CheckCircle2 className="w-4 h-4" strokeWidth={2.5} />}
            {saving ? (lang === "en" ? "Saving…" : "Enregistrement…") : (lang === "en" ? "Save All" : "Enregistrer Tout")}
          </button>
        </div>
      </div>

      {/* CSV import errors */}
      {importErrors.length > 0 && (
        <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl p-4 animate-fade-in-up">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-amber-600" strokeWidth={2} />
            <span className="text-sm font-bold text-amber-700">{lang === "en" ? "Import warnings" : "Avertissements d'importation"}</span>
            <button onClick={() => setImportErrors([])} className="ml-auto text-amber-400 hover:text-amber-600"><X className="w-4 h-4" strokeWidth={2} /></button>
          </div>
          <ul className="text-xs text-amber-700 space-y-1">
            {importErrors.map((e, i) => <li key={i}>• {e}</li>)}
          </ul>
        </div>
      )}

      {/* CSV template download hint */}
      <div className="mb-4 bg-navy/5 rounded-xl px-4 py-3 flex items-start gap-3 animate-fade-in-up">
        <FileText className="w-4 h-4 text-navy mt-0.5 flex-shrink-0" strokeWidth={2} />
        <p className="text-xs text-slate leading-relaxed">
          <strong className="text-navy">{lang === "en" ? "CSV format:" : "Format CSV :"}</strong>
          {" "}prompt_en, type (mc/tf/sa), option_a, option_b, option_c, option_d, correct (a/b/c/d or true/false or answer text), points
          <br />
          {lang === "en"
            ? "For short_answer, separate multiple accepted answers with | (pipe)"
            : "Pour short_answer, séparez plusieurs réponses acceptées avec | (pipe)"}
        </p>
      </div>

      {/* ── Sticky type-bar sentinel ── */}
      <div id="type-bar-sentinel" style={{ height: 1 }} />

      {/* Type bar — becomes sticky when scrolled past */}
      <div ref={typeBarRef}
        className={`flex gap-2 mb-6 flex-wrap transition-all duration-200 z-30 ${
          typeBarStuck
            ? "sticky top-0 bg-white/95 backdrop-blur-sm border-b border-gray-100 shadow-sm -mx-4 px-4 py-3"
            : ""
        }`}>
        <span className="text-xs font-bold text-slate self-center mr-1">
          {lang === "en" ? "Add question:" : "Ajouter :"}
        </span>
        {(Object.entries(TYPE_META) as [QType, typeof TYPE_META[QType]][]).map(([t, meta]) => {
          const Icon = meta.icon;
          return (
            <button key={t} onClick={() => addQuestion(t)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-semibold transition-all duration-150 ${meta.color} hover:shadow-sm`}>
              <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
              <Icon className="w-4 h-4" strokeWidth={2} />
              {lang === "en" ? meta.en : meta.fr}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="card p-6 h-32 animate-pulse bg-gray-50" />)}</div>
      ) : questions.length === 0 ? (
        <EmptyState icon={ListChecks}
          title={lang === "en" ? "No questions yet" : "Aucune question"}
          description={lang === "en" ? "Add questions using the buttons above, or import from a CSV file." : "Ajoutez des questions via les boutons ci-dessus, ou importez depuis un fichier CSV."} />
      ) : (
        <div className="space-y-4 stagger-children">
          {questions.map((q, idx) => {
            const meta = TYPE_META[q.question_type];
            const Icon = meta.icon;
            return (
              <div key={q.id} className="card p-5">
                <div className="flex items-start gap-3 mb-4">
                  <GripVertical className="w-4 h-4 text-gray-300 mt-2 flex-shrink-0" strokeWidth={2} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <Badge color="purple" icon={Icon}>{lang === "en" ? meta.en : meta.fr}</Badge>
                      <span className="text-xs text-gray-400 font-semibold">Q{idx + 1}</span>
                    </div>
                    <textarea rows={2} value={q.prompt_en}
                      onChange={e => updateQuestion(q.id, { prompt_en: e.target.value })}
                      placeholder={lang === "en" ? "Question prompt (English) *" : "Énoncé de la question (Anglais) *"}
                      className="input resize-none mb-2" />
                    <textarea rows={1} value={q.prompt_fr ?? ""}
                      onChange={e => updateQuestion(q.id, { prompt_fr: e.target.value })}
                      placeholder={lang === "en" ? "Question prompt (French, optional)" : "Énoncé (Français, optionnel)"}
                      className="input resize-none" />
                  </div>
                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    <div className="flex items-center gap-1.5">
                      <input type="number" min="0.5" step="0.5" value={q.points}
                        onChange={e => updateQuestion(q.id, { points: Number(e.target.value) })}
                        className="w-16 input text-center px-2" />
                      <span className="text-xs text-gray-400 font-medium">pts</span>
                    </div>
                    <button onClick={() => onDeleteQuestion(q.id)} className="text-gray-400 hover:text-red-500 transition-colors">
                      <Trash2 className="w-4 h-4" strokeWidth={2} />
                    </button>
                  </div>
                </div>

                {q.question_type === "multiple_choice" && (
                  <div className="space-y-2 pl-7">
                    {(() => {
                      const dupIds = findDuplicateOptionIds(q.question_options ?? []);
                      return (q.question_options ?? []).map(o => {
                        const isDup = dupIds.has(o.id);
                        return (
                          <div key={o.id} className="flex items-center gap-2">
                            <button type="button" onClick={() => setCorrectOption(q.id, o.id)} className="flex-shrink-0">
                              {o.is_correct
                                ? <CheckCircle2 className="w-5 h-5 text-green-500" strokeWidth={2} />
                                : <Circle className="w-5 h-5 text-gray-300 hover:text-navy/50 transition-colors" strokeWidth={2} />}
                            </button>
                            <input type="text" value={o.label_en}
                              onChange={e => updateOption(q.id, o.id, { label_en: e.target.value })}
                              placeholder={lang === "en" ? "Option text" : "Texte de l'option"}
                              className={`input flex-1 ${isDup ? "border-red-400 bg-red-50/60 focus:border-red-500" : ""}`} />
                            <button onClick={() => removeOption(q.id, o.id)} className="text-gray-300 hover:text-red-500 transition-colors flex-shrink-0">
                              <Trash2 className="w-3.5 h-3.5" strokeWidth={2} />
                            </button>
                          </div>
                        );
                      });
                    })()}
                    {findDuplicateOptionIds(q.question_options ?? []).size > 0 && (
                      <p className="text-xs text-red-500 font-medium flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={2} />
                        {lang === "en" ? "Duplicate options — each answer must be unique." : "Options en double — chaque réponse doit être unique."}
                      </p>
                    )}
                    <button onClick={() => addOption(q.id)} className="flex items-center gap-1.5 text-xs font-bold text-navy hover:text-brand transition-colors mt-1">
                      <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
                      {lang === "en" ? "Add option" : "Ajouter une option"}
                    </button>
                  </div>
                )}

                {q.question_type === "true_false" && (
                  <div className="flex gap-3 pl-7">
                    {(q.question_options ?? []).map(o => (
                      <button key={o.id} type="button" onClick={() => setCorrectOption(q.id, o.id)}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-semibold transition-all duration-150
                          ${o.is_correct ? "border-green-400 bg-green-50 text-green-700" : "border-gray-200 text-slate hover:border-navy/30"}`}>
                        {o.is_correct ? <CheckCircle2 className="w-4 h-4" strokeWidth={2} /> : <Circle className="w-4 h-4" strokeWidth={2} />}
                        {lang === "en" ? o.label_en : (o.label_fr || o.label_en)}
                      </button>
                    ))}
                  </div>
                )}

                {q.question_type === "short_answer" && (
                  <div className="pl-7">
                    <label className="text-xs font-semibold text-slate mb-1.5 block">
                      {lang === "en" ? "Accepted answers (separate with | pipe)" : "Réponses acceptées (séparées par |)"}
                    </label>
                    <input type="text"
                      value={(q.correct_answers ?? []).join(" | ")}
                      onChange={e => updateQuestion(q.id, { correct_answers: e.target.value.split("|").map(s => s.trim()) })}
                      placeholder={lang === "en" ? "e.g. Trial Balance | trial balance" : "ex. Balance de vérification"}
                      className="input" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </LecturerLayout>
  );
}
