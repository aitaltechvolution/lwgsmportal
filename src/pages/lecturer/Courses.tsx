import { useEffect, useState, FormEvent } from "react";
import { Link } from "react-router-dom";
import LecturerLayout from "@/components/LecturerLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { useTranslation } from "react-i18next";
import { Plus, BookOpen, Users, Settings, Loader2, Pencil } from "lucide-react";
import { Badge, EmptyState, SkeletonCard, Modal, ToggleSwitch } from "@/components/ui/primitives";
import { useConfirm } from "@/contexts/ConfirmContext";
import { useToast } from "@/contexts/ToastContext";

interface Course {
  id: string;
  title: string;
  title_fr: string | null;
  code: string | null;
  description: string | null;
  description_fr: string | null;
  objectives: string | null;
  duration: string | null;
  program_id: string | null;
  is_published: boolean;
  programs?: { title: string; title_fr?: string } | null;
  studentCount?: number;
}

interface Program {
  id: string;
  title: string;
  title_fr: string | null;
}

export default function LecturerCourses() {
  const { profile } = useAuth();
  const { i18n } = useTranslation();
  const lang = (i18n.language.startsWith("fr") ? "fr" : "en") as "en" | "fr";
  const confirm = useConfirm();
  const { showToast } = useToast();

  const [courses, setCourses] = useState<Course[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [titleEn, setTitleEn] = useState("");
  const [titleFr, setTitleFr] = useState("");
  const [code, setCode] = useState("");
  const [programId, setProgramId] = useState("");
  const [descEn, setDescEn] = useState("");
  const [descFr, setDescFr] = useState("");
  const [objectives, setObjectives] = useState("");
  const [duration, setDuration] = useState("");
  const [publish, setPublish] = useState(false);

  const loadCourses = async () => {
    if (!profile?.id) return;
    setLoading(true);
    const { data } = await supabase
      .from("courses")
      .select("*, programs(title, title_fr)")
      .eq("lecturer_id", profile.id)
      .order("created_at", { ascending: false });

    const courseList = (data ?? []) as unknown as Course[];

    // Fetch student counts per course
    if (courseList.length > 0) {
      const counts = await Promise.all(
        courseList.map((c) =>
          supabase.from("enrollments").select("id", { count: "exact" }).eq("course_id", c.id).eq("status", "active")
        )
      );
      courseList.forEach((c, i) => { c.studentCount = counts[i].count ?? 0; });
    }

    setCourses(courseList);
    setLoading(false);
  };

  useEffect(() => { loadCourses(); }, [profile?.id]);

  useEffect(() => {
    supabase.from("programs").select("id, title, title_fr").order("title").then(({ data }) => setPrograms((data ?? []) as Program[]));
  }, []);

  const resetForm = () => {
    setEditingId(null);
    setTitleEn(""); setTitleFr(""); setCode(""); setProgramId(""); setDescEn(""); setDescFr(""); setObjectives(""); setDuration(""); setPublish(false); setError(null);
  };

  const openEdit = (c: Course) => {
    setEditingId(c.id);
    setTitleEn(c.title); setTitleFr(c.title_fr ?? ""); setCode(c.code ?? ""); setProgramId(c.program_id ?? "");
    setDescEn(c.description ?? ""); setDescFr(c.description_fr ?? ""); setObjectives(c.objectives ?? ""); setDuration(c.duration ?? "");
    setPublish(c.is_published);
    setError(null);
    setShowModal(true);
  };

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!profile?.id) return;
    if (!titleEn.trim()) { setError(lang === "en" ? "English title is required." : "Le titre en anglais est requis."); return; }

    setSaving(true);
    setError(null);

    const payload = {
      title: titleEn.trim(),
      title_fr: titleFr.trim() || null,
      code: code.trim() || null,
      program_id: programId || null,
      description: descEn.trim() || null,
      description_fr: descFr.trim() || null,
      objectives: objectives.trim() || null,
      duration: duration.trim() || null,
      is_published: publish,
    };

    const { error: opErr } = editingId
      ? await supabase.from("courses").update(payload).eq("id", editingId)
      : await supabase.from("courses").insert({ ...payload, lecturer_id: profile.id });

    setSaving(false);

    if (opErr) {
      setError(opErr.message);
      return;
    }

    setShowModal(false);
    resetForm();
    loadCourses();
  };

  const togglePublish = async (course: Course) => {
    const next = !course.is_published;

    // Unpublishing while students are enrolled needs an explicit warning
    if (!next && (course.studentCount ?? 0) > 0) {
      const ok = await confirm({
        title: lang === "en" ? "Unpublish this course?" : "Dépublier ce cours ?",
        message: lang === "en"
          ? `${course.studentCount} student(s) are currently enrolled in this course. Unpublishing will immediately hide it from them, including their materials and progress access.`
          : `${course.studentCount} étudiant(s) sont actuellement inscrits à ce cours. La dépublication le masquera immédiatement, y compris leurs contenus et leur progression.`,
        confirmLabel: lang === "en" ? "Unpublish Anyway" : "Dépublier quand même",
        cancelLabel: lang === "en" ? "Cancel" : "Annuler",
        tone: "danger",
      });
      if (!ok) return;
    }

    setCourses(prev => prev.map(c => c.id === course.id ? { ...c, is_published: next } : c));
    const { error: updErr } = await supabase.from("courses").update({ is_published: next }).eq("id", course.id);
    if (updErr) {
      // revert on failure
      setCourses(prev => prev.map(c => c.id === course.id ? { ...c, is_published: !next } : c));
      showToast("error", updErr.message);
    } else {
      showToast("info", next
        ? (lang === "en" ? "Course published." : "Cours publié.")
        : (lang === "en" ? "Course unpublished." : "Cours dépublié."));
    }
  };

  const inputCls = "input";

  return (
    <LecturerLayout title={lang === "en" ? "My Courses" : "Mes Cours"}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 animate-fade-in-up">
        <div>
          <h2 className="text-2xl font-black text-ink">{lang === "en" ? "My Courses" : "Mes Cours"}</h2>
          <p className="text-sm text-slate mt-0.5">
            {loading ? "…" : `${courses.length} ${lang === "en" ? "course(s)" : "cours"}`}
          </p>
        </div>
        <button onClick={() => { resetForm(); setShowModal(true); }} className="btn-primary">
          <Plus className="w-4 h-4" strokeWidth={2.5} />
          {lang === "en" ? "Create Course" : "Créer un Cours"}
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : courses.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title={lang === "en" ? "No courses yet" : "Aucun cours pour l'instant"}
          description={lang === "en" ? "Create your first course to start adding materials and assessments." : "Créez votre premier cours pour commencer à ajouter des ressources et évaluations."}
          action={
            <button onClick={() => { resetForm(); setShowModal(true); }} className="btn-primary">
              <Plus className="w-4 h-4" strokeWidth={2.5} />
              {lang === "en" ? "Create Course" : "Créer un Cours"}
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 stagger-children">
          {courses.map((c) => {
            const title = (lang === "fr" && c.title_fr) ? c.title_fr : c.title;
            const program = c.programs ? ((lang === "fr" && c.programs.title_fr) ? c.programs.title_fr : c.programs.title) : null;
            return (
              <div key={c.id} className="card card-hover flex flex-col overflow-hidden">
                <div className="p-5 flex-1 flex flex-col">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-11 h-11 rounded-xl bg-navy/5 flex items-center justify-center">
                      <BookOpen className="w-5 h-5 text-navy" strokeWidth={2} />
                    </div>
                    <Badge color={c.is_published ? "green" : "yellow"}>
                      {c.is_published ? (lang === "en" ? "Published" : "Publié") : (lang === "en" ? "Draft" : "Brouillon")}
                    </Badge>
                  </div>

                  {c.code && <span className="text-xs font-bold text-brand uppercase tracking-wider mb-1.5">{c.code}</span>}
                  <h3 className="font-bold text-ink text-[15px] leading-snug mb-1.5">{title}</h3>
                  {program && <p className="text-xs text-slate mb-3">{program}</p>}

                  <div className="flex items-center gap-1.5 text-xs text-slate mt-auto pt-2">
                    <Users className="w-3.5 h-3.5" strokeWidth={2} />
                    {c.studentCount ?? 0} {lang === "en" ? "student(s)" : "étudiant(s)"}
                  </div>
                </div>

                {/* Footer: publish toggle + edit + manage */}
                <div className="px-5 pb-5 flex items-center justify-between gap-3 border-t border-gray-50 pt-4 mt-1">
                  <ToggleSwitch
                    checked={c.is_published}
                    onChange={() => togglePublish(c)}
                    label={lang === "en" ? "Published" : "Publié"}
                  />
                  <div className="flex items-center gap-3">
                    <button onClick={() => openEdit(c)} className="inline-flex items-center gap-1.5 text-sm font-bold text-navy hover:text-brand transition-colors">
                      <Pencil className="w-4 h-4" strokeWidth={2} />
                      {lang === "en" ? "Edit" : "Modifier"}
                    </button>
                    <Link
                      to={`/lecturer/courses/${c.id}/materials`}
                      className="inline-flex items-center gap-1.5 text-sm font-bold text-navy hover:text-brand transition-colors"
                    >
                      <Settings className="w-4 h-4" strokeWidth={2} />
                      {lang === "en" ? "Manage" : "Gérer"}
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create/Edit Course Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title={editingId ? (lang === "en" ? "Edit Course" : "Modifier le Cours") : (lang === "en" ? "Create New Course" : "Créer un Nouveau Cours")} maxWidth="max-w-2xl">
        <form onSubmit={onCreate} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">{lang === "en" ? "Title (English)" : "Titre (Anglais)"} *</label>
              <input type="text" required value={titleEn} onChange={e => setTitleEn(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="label">{lang === "en" ? "Title (French)" : "Titre (Français)"}</label>
              <input type="text" value={titleFr} onChange={e => setTitleFr(e.target.value)} className={inputCls} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">{lang === "en" ? "Course Code" : "Code du Cours"}</label>
              <input type="text" value={code} onChange={e => setCode(e.target.value)} placeholder="e.g. BUS101" className={inputCls} />
            </div>
            <div>
              <label className="label">{lang === "en" ? "Programme" : "Programme"}</label>
              <select value={programId} onChange={e => setProgramId(e.target.value)} className={inputCls}>
                <option value="">{lang === "en" ? "None" : "Aucun"}</option>
                {programs.map(p => (
                  <option key={p.id} value={p.id}>{(lang === "fr" && p.title_fr) ? p.title_fr : p.title}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="label">{lang === "en" ? "Duration" : "Durée"}</label>
            <input type="text" value={duration} onChange={e => setDuration(e.target.value)} placeholder={lang === "en" ? "e.g. 3 Weeks" : "ex. 3 semaines"} className={inputCls} />
          </div>
          <div>
            <label className="label">{lang === "en" ? "Description (English)" : "Description (Anglais)"}</label>
            <textarea rows={3} value={descEn} onChange={e => setDescEn(e.target.value)} className={`${inputCls} resize-none`} />
          </div>
          <div>
            <label className="label">{lang === "en" ? "Description (French)" : "Description (Français)"}</label>
            <textarea rows={3} value={descFr} onChange={e => setDescFr(e.target.value)} className={`${inputCls} resize-none`} />
          </div>
          <div>
            <label className="label">{lang === "en" ? "Learning Objectives (one per line)" : "Objectifs d'apprentissage (un par ligne)"}</label>
            <textarea rows={4} value={objectives} onChange={e => setObjectives(e.target.value)} className={`${inputCls} resize-none`} />
          </div>

          <div className="flex items-center justify-between bg-gray-50 rounded-xl p-4">
            <div>
              <p className="text-sm font-semibold text-ink">{lang === "en" ? "Publish immediately" : "Publier immédiatement"}</p>
              <p className="text-xs text-slate mt-0.5">{lang === "en" ? "Students will be able to see and enroll in this course." : "Les étudiants pourront voir et s'inscrire à ce cours."}</p>
            </div>
            <ToggleSwitch checked={publish} onChange={setPublish} />
          </div>

          {error && <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-600 font-medium">{error}</div>}

          <div className="flex gap-3 pt-1">
            <button type="submit" disabled={saving} className="btn-primary disabled:opacity-60 disabled:translate-y-0">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2.5} /> : <Plus className="w-4 h-4" strokeWidth={2.5} />}
              {saving ? (lang === "en" ? "Saving…" : "Enregistrement…") : editingId ? (lang === "en" ? "Save Changes" : "Enregistrer") : (lang === "en" ? "Create Course" : "Créer le Cours")}
            </button>
            <button type="button" onClick={() => setShowModal(false)} className="btn-ghost border border-gray-200">
              {lang === "en" ? "Cancel" : "Annuler"}
            </button>
          </div>
        </form>
      </Modal>
    </LecturerLayout>
  );
}
