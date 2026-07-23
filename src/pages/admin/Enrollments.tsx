import { useEffect, useState, FormEvent } from "react";
import AdminLayout from "@/components/AdminLayout";
import { supabase } from "@/lib/supabase";
import { useTranslation } from "react-i18next";
import {
  FileEdit, Plus, Check, X, Loader2, Search, CheckCircle2, XCircle,
} from "lucide-react";
import { Badge, EmptyState, SkeletonRow, Modal } from "@/components/ui/primitives";

interface EnrollmentRow {
  id: string;
  student_id: string;
  course_id: string;
  status: "active" | "pending" | "completed" | "rejected";
  enrolled_at: string;
  student?: { full_name: string; email: string; avatar_url?: string | null } | null;
  course?: { title: string; title_fr?: string; code?: string; programs?: { title: string; title_fr?: string } | null } | null;
}

interface Student { id: string; full_name: string; email: string; }
interface Program { id: string; title: string; title_fr: string | null; }

const STATUS_COLOR: Record<string, "green" | "yellow" | "blue" | "red" | "gray"> = {
  active: "green", pending: "yellow", completed: "blue", rejected: "red",
};
const STATUS_LABEL: Record<string, { en: string; fr: string }> = {
  active: { en: "Active", fr: "Actif" },
  pending: { en: "Pending", fr: "En attente" },
  completed: { en: "Completed", fr: "Terminé" },
  rejected: { en: "Rejected", fr: "Rejeté" },
};

export default function AdminEnrollments() {
  const { i18n } = useTranslation();
  const lang = (i18n.language.startsWith("fr") ? "fr" : "en") as "en" | "fr";

  const [enrollments, setEnrollments] = useState<EnrollmentRow[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "active" | "completed" | "rejected">("all");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Manual enrollment modal — a student registers for a PROGRAMME, not an
  // individual course (see process-application-decision, which enrols
  // into every course under the applied-to programme on approval). This
  // form now mirrors that: pick a programme, and every course under it
  // gets enrolled, not just one hand-picked course.
  const [showModal, setShowModal] = useState(false);
  const [enrStudentId, setEnrStudentId] = useState("");
  const [enrProgramId, setEnrProgramId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [enrRes, stuRes, progRes] = await Promise.all([
      supabase
        .from("enrollments")
        .select("id, student_id, course_id, status, enrolled_at, student:student_id(full_name, email, avatar_url), course:course_id(title, title_fr, code, programs!courses_program_id_fkey(title, title_fr))")
        .order("enrolled_at", { ascending: false })
        .limit(200),
      supabase.from("profiles").select("id, full_name, email").eq("role", "student").order("full_name"),
      supabase.from("programs").select("id, title, title_fr").order("title"),
    ]);
    setEnrollments((enrRes.data ?? []) as unknown as EnrollmentRow[]);
    setStudents((stuRes.data ?? []) as Student[]);
    setPrograms((progRes.data ?? []) as Program[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = enrollments
    .filter(e => statusFilter === "all" || e.status === statusFilter)
    .filter(e => {
      if (!search) return true;
      const q = search.toLowerCase();
      const sName = (e.student as { full_name?: string } | null)?.full_name?.toLowerCase() ?? "";
      const cTitle = (e.course as { title?: string } | null)?.title?.toLowerCase() ?? "";
      return sName.includes(q) || cTitle.includes(q);
    });

  const pendingCount = enrollments.filter(e => e.status === "pending").length;

  const updateStatus = async (id: string, status: "active" | "rejected") => {
    setActionLoading(id);
    setEnrollments(prev => prev.map(e => e.id === id ? { ...e, status } : e));
    const { error: err } = await supabase.from("enrollments").update({ status }).eq("id", id);
    if (err) load();
    setActionLoading(null);
  };

  const onManualEnroll = async (e: FormEvent) => {
    e.preventDefault();
    if (!enrStudentId || !enrProgramId) { setError(lang === "en" ? "Select both a student and a programme." : "Sélectionnez un étudiant et un programme."); return; }

    setSaving(true); setError(null);

    // A course can be linked to a programme two ways: its primary
    // courses.program_id column, or an additional link in the
    // course_programs join table (a course can belong to more than one
    // programme) — same fix as process-application-decision and
    // Admissions.tsx, so manual enrollment picks up the exact same set of
    // courses an approved application would.
    const [{ data: primaryCourses }, { data: links }] = await Promise.all([
      supabase.from("courses").select("id").eq("program_id", enrProgramId),
      supabase.from("course_programs").select("course_id").eq("program_id", enrProgramId),
    ]);
    const courseIds = Array.from(new Set([
      ...(primaryCourses ?? []).map((c: { id: string }) => c.id),
      ...(links ?? []).map((l: { course_id: string }) => l.course_id),
    ]));

    if (courseIds.length === 0) {
      setSaving(false);
      setError(lang === "en" ? "This programme has no courses configured under it." : "Ce programme n'a aucun cours configuré.");
      return;
    }

    // Don't re-insert courses this student is already enrolled in —
    // upsert would just update them, but we want to tell the admin
    // exactly what happened rather than silently no-op on all of them.
    const { data: existing } = await supabase.from("enrollments").select("course_id").eq("student_id", enrStudentId).in("course_id", courseIds);
    const alreadyEnrolledIds = new Set((existing ?? []).map((e: { course_id: string }) => e.course_id));
    const toInsert = courseIds.filter(id => !alreadyEnrolledIds.has(id));

    if (toInsert.length === 0) {
      setSaving(false);
      setError(lang === "en" ? "This student is already enrolled in every course under that programme." : "Cet étudiant est déjà inscrit à tous les cours de ce programme.");
      return;
    }

    const { error: err } = await supabase.from("enrollments").insert(
      toInsert.map(cid => ({ student_id: enrStudentId, course_id: cid, program_id: enrProgramId, status: "active" }))
    );
    setSaving(false);
    if (err) { setError(err.message); return; }
    setShowModal(false); setEnrStudentId(""); setEnrProgramId("");
    load();
  };

  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(lang === "fr" ? "fr-FR" : "en-GB", { day: "numeric", month: "short", year: "numeric" });

  const STATUS_FILTERS = ["all", "pending", "active", "completed", "rejected"] as const;

  return (
    <AdminLayout title={lang === "en" ? "Enrollments" : "Inscriptions"}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 animate-fade-in-up">
        <div>
          <h2 className="text-2xl font-black text-ink">{lang === "en" ? "Enrollments" : "Inscriptions"}</h2>
          <p className="text-sm text-slate mt-0.5">
            {loading ? "…" : `${enrollments.length} ${lang === "en" ? "total" : "au total"}`}
            {pendingCount > 0 && <> · <span className="text-brand font-semibold">{pendingCount} {lang === "en" ? "pending" : "en attente"}</span></>}
          </p>
        </div>
        <div className="flex gap-3">
          <div className="relative sm:w-60">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" strokeWidth={2} />
            <input type="text" placeholder={lang === "en" ? "Search…" : "Rechercher…"} value={search} onChange={e => setSearch(e.target.value)} className="input pl-9" />
          </div>
          <button onClick={() => { setShowModal(true); setError(null); }} className="btn-primary flex-shrink-0">
            <Plus className="w-4 h-4" strokeWidth={2.5} />
            {lang === "en" ? "Enroll Student" : "Inscrire"}
          </button>
        </div>
      </div>

      {/* Status tabs */}
      <div className="flex gap-1.5 mb-6 bg-gray-100 p-1 rounded-xl w-fit flex-wrap animate-fade-in-up" style={{ animationDelay: "0.04s" }}>
        {STATUS_FILTERS.map(f => (
          <button key={f} onClick={() => setStatusFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all duration-150 ${statusFilter === f ? "bg-white text-navy shadow-sm" : "text-slate hover:text-ink"}`}>
            {f === "all" ? (lang === "en" ? "All" : "Tous") : (lang === "en" ? STATUS_LABEL[f].en : STATUS_LABEL[f].fr)}
            <span className="ml-1 text-xs opacity-60">{f === "all" ? enrollments.length : enrollments.filter(e => e.status === f).length}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="card divide-y divide-gray-50">{Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)}</div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={FileEdit} title={lang === "en" ? "No enrollments found" : "Aucune inscription trouvée"} />
      ) : (
        <div className="card overflow-hidden stagger-children">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50/60 border-b border-gray-100">
                  <th className="text-left px-5 py-3 text-xs font-bold text-slate uppercase tracking-wider">{lang === "en" ? "Student" : "Étudiant"}</th>
                  <th className="text-left px-5 py-3 text-xs font-bold text-slate uppercase tracking-wider hidden md:table-cell">{lang === "en" ? "Program" : "Programme"}</th>
                  <th className="text-left px-5 py-3 text-xs font-bold text-slate uppercase tracking-wider">{lang === "en" ? "Course" : "Cours"}</th>
                  <th className="text-center px-5 py-3 text-xs font-bold text-slate uppercase tracking-wider">{lang === "en" ? "Status" : "Statut"}</th>
                  <th className="text-left px-5 py-3 text-xs font-bold text-slate uppercase tracking-wider hidden sm:table-cell">{lang === "en" ? "Date" : "Date"}</th>
                  <th className="text-right px-5 py-3 text-xs font-bold text-slate uppercase tracking-wider">{lang === "en" ? "Actions" : "Actions"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((enr) => {
                  const student = enr.student as { full_name?: string; email?: string; avatar_url?: string | null } | null;
                  const course = enr.course as { title?: string; title_fr?: string; code?: string; programs?: { title: string; title_fr?: string } | null } | null;
                  const program = course?.programs;
                  const cTitle = (lang === "fr" && course?.title_fr) ? course.title_fr : course?.title ?? "—";
                  const pTitle = program ? ((lang === "fr" && program.title_fr) ? program.title_fr : program.title) : "—";
                  const isLoading = actionLoading === enr.id;

                  return (
                    <tr key={enr.id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-navy to-navy-light flex items-center justify-center text-white font-black text-xs flex-shrink-0 overflow-hidden">
                            {student?.avatar_url ? <img src={student.avatar_url} alt="" className="w-full h-full object-cover" /> : (student?.full_name?.charAt(0).toUpperCase() ?? "—")}
                          </div>
                          <div>
                            <p className="font-semibold text-ink">{student?.full_name ?? "—"}</p>
                            <p className="text-xs text-gray-400">{student?.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-slate hidden md:table-cell">{pTitle}</td>
                      <td className="px-5 py-3.5">
                        <p className="text-ink">{cTitle}</p>
                        {course?.code && <p className="text-xs text-gray-400">{course.code}</p>}
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <Badge color={STATUS_COLOR[enr.status] ?? "gray"}>{lang === "en" ? STATUS_LABEL[enr.status]?.en : STATUS_LABEL[enr.status]?.fr}</Badge>
                      </td>
                      <td className="px-5 py-3.5 text-gray-400 text-xs hidden sm:table-cell">{fmtDate(enr.enrolled_at)}</td>
                      <td className="px-5 py-3.5 text-right">
                        {enr.status === "pending" ? (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => updateStatus(enr.id, "active")}
                              disabled={isLoading}
                              className="flex items-center gap-1 text-xs font-bold text-green-700 bg-green-50 hover:bg-green-100 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                            >
                              {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={2.5} /> : <Check className="w-3.5 h-3.5" strokeWidth={2.5} />}
                              {lang === "en" ? "Approve" : "Approuver"}
                            </button>
                            <button
                              onClick={() => updateStatus(enr.id, "rejected")}
                              disabled={isLoading}
                              className="flex items-center gap-1 text-xs font-bold text-red-700 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                            >
                              <X className="w-3.5 h-3.5" strokeWidth={2.5} />
                              {lang === "en" ? "Reject" : "Rejeter"}
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Manual Enrollment Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title={lang === "en" ? "Manual Enrollment" : "Inscription Manuelle"}>
        <form onSubmit={onManualEnroll} className="space-y-4">
          <div>
            <label className="label">{lang === "en" ? "Student" : "Étudiant"} *</label>
            <select required value={enrStudentId} onChange={e => setEnrStudentId(e.target.value)} className="input">
              <option value="">{lang === "en" ? "Select student…" : "Sélectionner un étudiant…"}</option>
              {students.map(s => <option key={s.id} value={s.id}>{s.full_name} — {s.email}</option>)}
            </select>
          </div>
          <div>
            <label className="label">{lang === "en" ? "Programme" : "Programme"} *</label>
            <select required value={enrProgramId} onChange={e => setEnrProgramId(e.target.value)} className="input">
              <option value="">{lang === "en" ? "Select programme…" : "Sélectionner un programme…"}</option>
              {programs.map(p => <option key={p.id} value={p.id}>{(lang === "fr" && p.title_fr) ? p.title_fr : p.title}</option>)}
            </select>
          </div>
          {error && <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-600 font-medium">{error}</div>}
          <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-xs text-blue-700">
            {lang === "en"
              ? "Enrols this student into every course under the selected programme immediately, bypassing the standard application flow."
              : "Inscrit cet étudiant immédiatement à tous les cours du programme sélectionné, en contournant le processus de candidature standard."}
          </div>
          <div className="flex gap-3">
            <button type="submit" disabled={saving} className="btn-primary flex-1 disabled:opacity-60 disabled:translate-y-0">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2.5} /> : <CheckCircle2 className="w-4 h-4" strokeWidth={2} />}
              {saving ? (lang === "en" ? "Enrolling…" : "Inscription…") : (lang === "en" ? "Enroll Student" : "Inscrire l'Étudiant")}
            </button>
            <button type="button" onClick={() => setShowModal(false)} className="btn-ghost border border-gray-200">{lang === "en" ? "Cancel" : "Annuler"}</button>
          </div>
        </form>
      </Modal>
    </AdminLayout>
  );
}