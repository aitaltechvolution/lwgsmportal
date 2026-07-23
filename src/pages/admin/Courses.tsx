import { useEffect, useState, FormEvent } from "react";
import { Link } from "react-router-dom";
import AdminLayout from "@/components/AdminLayout";
import { supabase } from "@/lib/supabase";
import { useTranslation } from "react-i18next";
import { BookOpen, Plus, Pencil, Trash2, Loader2, Search, Users, FileText } from "lucide-react";
import { Badge, EmptyState, SkeletonCard, Modal, ToggleSwitch } from "@/components/ui/primitives";
import { useConfirm } from "@/contexts/ConfirmContext";
import { useToast } from "@/contexts/ToastContext";

interface CourseRow {
  id: string;
  title: string;
  title_fr: string | null;
  code: string | null;
  is_published: boolean;
  program_id: string | null;
  lecturer_id: string | null;
  description: string | null;
  description_fr: string | null;
  objectives: string | null;
  duration: string | null;
  lecturer_locked: boolean;
  requires_attendance_for_certificate: boolean;
  allow_videos: boolean;
  programs?: { title: string; title_fr?: string } | null;
  profiles?: { full_name: string } | null;
  studentCount?: number;
  linkedProgramNames?: string;
}

interface Program { id: string; title: string; title_fr: string | null; }
interface Lecturer { id: string; full_name: string; }

const EMPTY_FORM = { title: "", title_fr: "", code: "", program_id: "", lecturer_id: "", description: "", description_fr: "", objectives: "", duration: "", is_published: false, lecturer_locked: false, requires_attendance_for_certificate: false, allow_videos: true };

export default function AdminCourses() {
  const { i18n } = useTranslation();
  const lang = (i18n.language.startsWith("fr") ? "fr" : "en") as "en" | "fr";
  const confirm = useConfirm();
  const { showToast } = useToast();

  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [lecturers, setLecturers] = useState<Lecturer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enrolledView, setEnrolledView] = useState<string | null>(null); // course id
  const [enrolledStudents, setEnrolledStudents] = useState<{id:string;full_name:string;email:string;progress_pct:number|null}[]>([]);
  const [loadingEnrolled, setLoadingEnrolled] = useState(false);

  // Many-to-many programs linked to the course being edited
  const [linkedProgramIds, setLinkedProgramIds] = useState<Set<string>>(new Set());

  const load = async () => {
    setLoading(true);
    const [cRes, pRes, lRes, linkRes] = await Promise.all([
      supabase.from("courses").select("id, title, title_fr, code, is_published, program_id, lecturer_id, description, description_fr, objectives, duration, lecturer_locked, requires_attendance_for_certificate, allow_videos, programs!courses_program_id_fkey(title, title_fr), profiles:lecturer_id(full_name)").order("created_at", { ascending: false }),
      supabase.from("programs").select("id, title, title_fr").order("title"),
      supabase.from("profiles").select("id, full_name").eq("role", "lecturer").order("full_name"),
      supabase.from("course_programs").select("course_id, program_id"),
    ]);

    if (cRes.error) {
      showToast("error", lang === "en"
        ? `Could not load courses: ${cRes.error.message}`
        : `Impossible de charger les cours : ${cRes.error.message}`);
      setCourses([]);
      setLoading(false);
      return;
    }

    const list = (cRes.data ?? []) as unknown as CourseRow[];
    list.sort((a, b) =>
      (lang === "fr" && a.title_fr ? a.title_fr : a.title).localeCompare(lang === "fr" && b.title_fr ? b.title_fr : b.title)
    );
    const courseIds = list.map(c => c.id);
    const progList = (pRes.data ?? []) as Program[];
    const progNameMap = new Map(progList.map(p => [p.id, (lang === "fr" && p.title_fr) ? p.title_fr : p.title]));
    const linksByCourse = new Map<string, string[]>();
    (linkRes.data ?? []).forEach((l: { course_id: string; program_id: string }) => {
      const names = linksByCourse.get(l.course_id) ?? [];
      names.push(progNameMap.get(l.program_id) ?? "");
      linksByCourse.set(l.course_id, names);
    });
    list.forEach(c => { c.linkedProgramNames = (linksByCourse.get(c.id) ?? []).filter(Boolean).join(", "); });

    if (courseIds.length > 0) {
      const { data: enrData } = await supabase.from("enrollments").select("course_id").in("course_id", courseIds).eq("status", "active");
      const countMap = new Map<string, number>();
      (enrData ?? []).forEach((e: { course_id: string }) => countMap.set(e.course_id, (countMap.get(e.course_id) ?? 0) + 1));
      list.forEach(c => { c.studentCount = countMap.get(c.id) ?? 0; });
    }

    setCourses(list);
    setPrograms((pRes.data ?? []) as Program[]);
    setLecturers((lRes.data ?? []) as Lecturer[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = courses.filter(c => {
    if (!search) return true;
    const q = search.toLowerCase();
    return c.title.toLowerCase().includes(q) || c.title_fr?.toLowerCase().includes(q) || c.code?.toLowerCase().includes(q);
  });

  const openCreate = () => { setEditingId(null); setForm({ ...EMPTY_FORM }); setError(null); setLinkedProgramIds(new Set()); setShowModal(true); };
  const openEdit = async (c: CourseRow) => {
    setEditingId(c.id);
    setForm({ title: c.title, title_fr: c.title_fr ?? "", code: c.code ?? "", program_id: c.program_id ?? "", lecturer_id: c.lecturer_id ?? "", description: c.description ?? "", description_fr: c.description_fr ?? "", objectives: c.objectives ?? "", duration: c.duration ?? "", is_published: c.is_published, lecturer_locked: c.lecturer_locked, requires_attendance_for_certificate: c.requires_attendance_for_certificate, allow_videos: c.allow_videos });
    setError(null);
    const { data } = await supabase.from("course_programs").select("program_id").eq("course_id", c.id);
    setLinkedProgramIds(new Set((data ?? []).map((r: { program_id: string }) => r.program_id)));
    setShowModal(true);
  };

  const toggleProgramLink = async (programId: string) => {
    if (!editingId) return;
    const isLinked = linkedProgramIds.has(programId);
    setLinkedProgramIds(prev => {
      const next = new Set(prev);
      isLinked ? next.delete(programId) : next.add(programId);
      return next;
    });
    if (isLinked) {
      const { error: delErr } = await supabase.from("course_programs").delete().eq("course_id", editingId).eq("program_id", programId);
      if (delErr) { showToast("error", delErr.message); setLinkedProgramIds(prev => new Set(prev).add(programId)); }
    } else {
      const { error: insErr } = await supabase.from("course_programs").insert({ course_id: editingId, program_id: programId });
      if (insErr) { showToast("error", insErr.message); setLinkedProgramIds(prev => { const n = new Set(prev); n.delete(programId); return n; }); }
    }
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) { setError(lang === "en" ? "English title is required." : "Le titre en anglais est requis."); return; }
    setSaving(true); setError(null);

    const payload = {
      title: form.title.trim(), title_fr: form.title_fr.trim() || null,
      code: form.code.trim() || null,
      program_id: form.program_id || null,
      lecturer_id: form.lecturer_id || null,
      description: form.description.trim() || null,
      description_fr: form.description_fr.trim() || null,
      objectives: form.objectives.trim() || null,
      duration: form.duration.trim() || null,
      is_published: form.is_published,
      lecturer_locked: form.lecturer_locked,
      requires_attendance_for_certificate: form.requires_attendance_for_certificate,
      allow_videos: form.allow_videos,
    };

    const { error: err, data } = editingId
      ? await supabase.from("courses").update(payload).eq("id", editingId).select()
      : await supabase.from("courses").insert(payload).select();

    setSaving(false);
    if (err) { setError(err.message); return; }
    if (!data || data.length === 0) {
      setError(lang === "en"
        ? "Save didn't take effect (permission issue) — please refresh and try again."
        : "L'enregistrement n'a pas fonctionné (problème de permission) — veuillez actualiser et réessayer.");
      return;
    }
    setShowModal(false); load();
  };

  const togglePublish = async (c: CourseRow) => {
    const next = !c.is_published;
    setCourses(prev => prev.map(x => x.id === c.id ? { ...x, is_published: next } : x));
    const { error: err } = await supabase.from("courses").update({ is_published: next }).eq("id", c.id);
    if (err) setCourses(prev => prev.map(x => x.id === c.id ? { ...x, is_published: !next } : x));
  };

  const onDelete = async (c: CourseRow) => {
    const ok = await confirm({
      title: lang === "en" ? "Delete course?" : "Supprimer le cours ?",
      message: lang === "en" ? `"${c.title}" and all its materials, assessments and enrollments will be permanently deleted.` : `« ${c.title} » ainsi que tous ses contenus, évaluations et inscriptions seront définitivement supprimés.`,
      confirmLabel: lang === "en" ? "Delete" : "Supprimer",
      cancelLabel: lang === "en" ? "Cancel" : "Annuler",
      tone: "danger",
    });
    if (!ok) return;
    setCourses(prev => prev.filter(x => x.id !== c.id));
    const { error: err } = await supabase.from("courses").delete().eq("id", c.id);
    if (err) {
      load();
      showToast("error", lang === "en" ? `Could not delete: ${err.message}` : `Suppression impossible : ${err.message}`);
    } else {
      showToast("info", lang === "en" ? "Course deleted." : "Cours supprimé.");
    }
  };

  const setF = (k: keyof typeof form, v: string | boolean) => setForm(f => ({ ...f, [k]: v }));

  const viewEnrolled = async (courseId: string) => {
    if (enrolledView === courseId) { setEnrolledView(null); return; }
    setEnrolledView(courseId);
    setLoadingEnrolled(true);
    const { data } = await supabase
      .from("enrollments")
      .select("student_id, progress_pct, profiles:student_id(id,full_name,email)")
      .eq("course_id", courseId)
      .eq("status", "active");
    setEnrolledStudents((data ?? []).map((e: any) => ({
      id: e.profiles?.id ?? e.student_id,
      full_name: e.profiles?.full_name ?? "—",
      email: e.profiles?.email ?? "—",
      progress_pct: e.progress_pct,
    })));
    setLoadingEnrolled(false);
  };

  return (
    <AdminLayout title={lang === "en" ? "Courses" : "Cours"}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 animate-fade-in-up">
        <div>
          <h2 className="text-2xl font-black text-ink">{lang === "en" ? "Courses" : "Cours"}</h2>
          <p className="text-sm text-slate mt-0.5">{loading ? "…" : `${courses.length} ${lang === "en" ? "course(s)" : "cours"}`}</p>
        </div>
        <div className="flex gap-3">
          <div className="relative sm:w-60">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" strokeWidth={2} />
            <input type="text" placeholder={lang === "en" ? "Search…" : "Rechercher…"} value={search} onChange={e => setSearch(e.target.value)} className="input pl-9" />
          </div>
          <button onClick={openCreate} className="btn-primary flex-shrink-0">
            <Plus className="w-4 h-4" strokeWidth={2.5} />
            {lang === "en" ? "Create Course" : "Créer un Cours"}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">{Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}</div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={BookOpen} title={lang === "en" ? "No courses found" : "Aucun cours trouvé"} action={<button onClick={openCreate} className="btn-primary"><Plus className="w-4 h-4" strokeWidth={2.5} />{lang === "en" ? "Create Course" : "Créer"}</button>} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 stagger-children">
          {filtered.map(c => {
            const title = (lang === "fr" && c.title_fr) ? c.title_fr : c.title;
            const pTitle = c.programs ? ((lang === "fr" && c.programs.title_fr) ? c.programs.title_fr : c.programs.title) : null;
            const lecName = (c.profiles as { full_name?: string } | null)?.full_name ?? null;
            return (
              <div key={c.id} className="card card-hover flex flex-col">
                <div className="p-5 flex-1">
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-10 h-10 rounded-xl bg-navy/5 flex items-center justify-center">
                      <BookOpen className="w-5 h-5 text-navy" strokeWidth={2} />
                    </div>
                    <Badge color={c.is_published ? "green" : "yellow"}>
                      {c.is_published ? (lang === "en" ? "Published" : "Publié") : (lang === "en" ? "Draft" : "Brouillon")}
                    </Badge>
                  </div>
                  {c.code && <span className="text-xs font-bold text-brand uppercase tracking-wider">{c.code}</span>}
                  <h3 className="font-bold text-ink text-[15px] leading-snug mt-1 mb-2">{title}</h3>
                  {c.linkedProgramNames ? (
                    <p className="text-xs text-slate mb-1">{c.linkedProgramNames}</p>
                  ) : pTitle ? (
                    <p className="text-xs text-slate mb-1">{pTitle}</p>
                  ) : null}
                  {lecName && <p className="text-xs text-gray-400">{lang === "en" ? "Lecturer:" : "Enseignant:"} {lecName}</p>}
                  <div className="flex items-center gap-1 mt-3 text-xs text-gray-400">
                    <Users className="w-3.5 h-3.5" strokeWidth={2} />{c.studentCount ?? 0} {lang === "en" ? "student(s)" : "étudiant(s)"}
                  </div>
                </div>
                <div className="px-5 pb-5 border-t border-gray-50 pt-4 mt-1">
                  <div className="flex items-center justify-between mb-3">
                    <ToggleSwitch checked={c.is_published} onChange={() => togglePublish(c)} label={lang === "en" ? "Published" : "Publié"} />
                  </div>
                  <div className="flex gap-2">
                    <Link to={`/admin/courses/${c.id}/materials`} className="flex-1 flex items-center justify-center gap-1.5 text-sm font-semibold text-navy border border-navy/15 hover:bg-navy hover:text-white rounded-xl py-2 transition-all duration-150">
                      <FileText className="w-3.5 h-3.5" strokeWidth={2} />{lang === "en" ? "Materials" : "Ressources"}
                    </Link>
                    <button onClick={() => openEdit(c)} className="flex-1 flex items-center justify-center gap-1.5 text-sm font-semibold text-navy border border-navy/15 hover:bg-navy hover:text-white rounded-xl py-2 transition-all duration-150">
                      <Pencil className="w-3.5 h-3.5" strokeWidth={2} />{lang === "en" ? "Edit" : "Modifier"}
                    </button>
                    <button onClick={() => onDelete(c)} className="flex items-center justify-center gap-1.5 text-sm font-semibold text-red-500 border border-red-200 hover:bg-red-50 rounded-xl px-4 py-2 transition-all duration-150">
                      <Trash2 className="w-4 h-4" strokeWidth={2} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editingId ? (lang === "en" ? "Edit Course" : "Modifier le Cours") : (lang === "en" ? "Create Course" : "Créer un Cours")} maxWidth="max-w-2xl">
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">{lang === "en" ? "Title (English)" : "Titre (Anglais)"} *</label>
              <input type="text" required value={form.title} onChange={e => setF("title", e.target.value)} className="input" />
            </div>
            <div>
              <label className="label">{lang === "en" ? "Title (French)" : "Titre (Français)"}</label>
              <input type="text" value={form.title_fr} onChange={e => setF("title_fr", e.target.value)} className="input" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="label">{lang === "en" ? "Course Code" : "Code"}</label>
              <input type="text" value={form.code} onChange={e => setF("code", e.target.value)} placeholder="BUS101" className="input" />
            </div>
            <div>
              <label className="label">{lang === "en" ? "Program" : "Programme"}</label>
              <select value={form.program_id} onChange={e => setF("program_id", e.target.value)} className="input">
                <option value="">{lang === "en" ? "None" : "Aucun"}</option>
                {programs.map(p => <option key={p.id} value={p.id}>{(lang === "fr" && p.title_fr) ? p.title_fr : p.title}</option>)}
              </select>
            </div>
            <div>
              <label className="label">{lang === "en" ? "Lecturer" : "Enseignant"}</label>
              <select value={form.lecturer_id} onChange={e => setF("lecturer_id", e.target.value)} className="input">
                <option value="">{lang === "en" ? "Unassigned" : "Non assigné"}</option>
                {lecturers.map(l => <option key={l.id} value={l.id}>{l.full_name}</option>)}
              </select>
            </div>
          </div>

          {editingId ? (
            <div>
              <label className="label">{lang === "en" ? "Programs This Course Belongs To" : "Programmes Auxquels Ce Cours Appartient"}</label>
              <div className="border border-gray-200 rounded-xl max-h-44 overflow-y-auto divide-y divide-gray-50">
                {programs.map(p => (
                  <label key={p.id} className="flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-gray-50 cursor-pointer">
                    <input type="checkbox" checked={linkedProgramIds.has(p.id)} onChange={() => toggleProgramLink(p.id)}
                      className="w-4 h-4 rounded border-gray-300 text-navy focus:ring-navy/30" />
                    <span className="text-ink">{(lang === "fr" && p.title_fr) ? p.title_fr : p.title}</span>
                  </label>
                ))}
                {programs.length === 0 && <p className="text-xs text-gray-400 px-3 py-3">{lang === "en" ? "No programs exist yet." : "Aucun programme pour le moment."}</p>}
              </div>
              <p className="text-xs text-slate mt-2">
                <span className="font-semibold text-ink">{lang === "en" ? "Selected: " : "Sélectionnés : "}</span>
                {linkedProgramIds.size === 0
                  ? (lang === "en" ? "None yet" : "Aucun pour le moment")
                  : programs.filter(p => linkedProgramIds.has(p.id)).map(p => (lang === "fr" && p.title_fr) ? p.title_fr : p.title).join(", ")}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {lang === "en" ? "A course can belong to more than one program — check or uncheck to add or remove it here." : "Un cours peut appartenir à plusieurs programmes — cochez ou décochez pour l'ajouter ou le retirer."}
              </p>
            </div>
          ) : (
            <div className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-xs text-slate">
              {lang === "en" ? "Save this course first, then reopen it to link it to multiple programs." : "Enregistrez d'abord ce cours, puis rouvrez-le pour le lier à plusieurs programmes."}
            </div>
          )}

          <div>
            <label className="label">{lang === "en" ? "Duration" : "Durée"}</label>
            <input type="text" value={form.duration} onChange={e => setF("duration", e.target.value)} placeholder={lang === "en" ? "e.g. 3 Weeks" : "ex. 3 semaines"} className="input" />
          </div>
          <div>
            <label className="label">{lang === "en" ? "Description (English)" : "Description (Anglais)"}</label>
            <textarea rows={3} value={form.description} onChange={e => setF("description", e.target.value)} className="input resize-none" />
          </div>
          <div>
            <label className="label">{lang === "en" ? "Description (French)" : "Description (Français)"}</label>
            <textarea rows={3} value={form.description_fr} onChange={e => setF("description_fr", e.target.value)} className="input resize-none" />
          </div>
          <div>
            <label className="label">{lang === "en" ? "Learning Objectives (one per line)" : "Objectifs d'apprentissage (un par ligne)"}</label>
            <textarea rows={4} value={form.objectives} onChange={e => setF("objectives", e.target.value)} placeholder={lang === "en" ? "Explain the formation and authority of the biblical canon\nIdentify the major themes..." : ""} className="input resize-none" />
          </div>
          <div className="flex items-center justify-between bg-gray-50 rounded-xl p-4">
            <p className="text-sm font-semibold text-ink">{lang === "en" ? "Publish immediately" : "Publier immédiatement"}</p>
            <ToggleSwitch checked={form.is_published} onChange={v => setF("is_published", v)} />
          </div>
          <div className="flex items-center justify-between bg-gray-50 rounded-xl p-4">
            <div>
              <p className="text-sm font-semibold text-ink">{lang === "en" ? "Lock from lecturer editing" : "Verrouiller pour l'enseignant"}</p>
              <p className="text-xs text-slate mt-0.5">{lang === "en" ? "When on, only admin can edit this course's details and materials." : "Si activé, seul l'admin peut modifier ce cours et ses contenus."}</p>
            </div>
            <ToggleSwitch checked={form.lecturer_locked} onChange={v => setF("lecturer_locked", v)} />
          </div>
          <div className="flex items-center justify-between bg-gray-50 rounded-xl p-4">
            <div>
              <p className="text-sm font-semibold text-ink">{lang === "en" ? "Allow video materials" : "Autoriser les vidéos"}</p>
              <p className="text-xs text-slate mt-0.5">
                {lang === "en"
                  ? "When off, the lecturer can only add File and Link materials for this course — no video uploads or video links. This is set per course, not globally."
                  : "Si désactivé, l'enseignant ne peut ajouter que des fichiers et des liens pour ce cours — aucune vidéo. Ce réglage s'applique à ce cours uniquement, pas globalement."}
              </p>
            </div>
            <ToggleSwitch checked={form.allow_videos} onChange={v => setF("allow_videos", v)} />
          </div>
          <div className="flex items-center justify-between bg-gray-50 rounded-xl p-4">
            <div>
              <p className="text-sm font-semibold text-ink">{lang === "en" ? "Require attendance for certificate" : "Exiger la présence pour le certificat"}</p>
              <p className="text-xs text-slate mt-0.5">
                {lang === "en"
                  ? "When on, students must also meet the minimum attendance rate in this course to be certificate-eligible (in addition to materials and assessments/exams)."
                  : "Si activé, les étudiants doivent aussi atteindre le taux de présence minimum dans ce cours pour être éligibles au certificat (en plus des ressources et évaluations/examens)."}
              </p>
            </div>
            <ToggleSwitch checked={form.requires_attendance_for_certificate} onChange={v => setF("requires_attendance_for_certificate", v)} />
          </div>
          {error && <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-600 font-medium">{error}</div>}
          <div className="flex gap-3">
            <button type="submit" disabled={saving} className="btn-primary flex-1 disabled:opacity-60 disabled:translate-y-0">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2.5} /> : <Plus className="w-4 h-4" strokeWidth={2.5} />}
              {saving ? "…" : editingId ? (lang === "en" ? "Save Changes" : "Enregistrer") : (lang === "en" ? "Create Course" : "Créer")}
            </button>
            <button type="button" onClick={() => setShowModal(false)} className="btn-ghost border border-gray-200">{lang === "en" ? "Cancel" : "Annuler"}</button>
          </div>
        </form>
      </Modal>
    </AdminLayout>
  );
}