import { useEffect, useState, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import AdminLayout from "@/components/AdminLayout";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "react-i18next";
import {
  Search, Users, Plus, Trash2, Loader2, CheckCircle2,
  BookOpen, LogIn, UserCheck,
} from "lucide-react";
import { Badge, EmptyState, SkeletonRow, Modal, ToggleSwitch } from "@/components/ui/primitives";
import { useConfirm } from "@/contexts/ConfirmContext";
import { useToast } from "@/contexts/ToastContext";
import PasswordInput from "@/components/PasswordInput";

interface LecturerRow {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  country: string | null;
  status: "active" | "suspended";
  created_at: string;
  courseCount?: number;
}

interface Course {
  id: string;
  title: string;
  title_fr: string | null;
  code: string | null;
  lecturer_id: string | null;
}

interface CreatedLecturer {
  id: string;
  full_name: string;
  email: string;
  password: string;
}

export default function AdminFaculty() {
  const { i18n } = useTranslation();
  const lang = (i18n.language.startsWith("fr") ? "fr" : "en") as "en" | "fr";
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { showToast } = useToast();

  const [lecturers, setLecturers] = useState<LecturerRow[]>([]);
  const [allCourses, setAllCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [courseSearch, setCourseSearch] = useState("");

  // Create modal
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ full_name: "", title: "", email: "", password: "", phone: "", country: "" });
  const [selectedCourses, setSelectedCourses] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // Manage Courses modal (existing lecturers)
  const [manageLecturer, setManageLecturer] = useState<LecturerRow | null>(null);
  const [assignedCourseIds, setAssignedCourseIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  // ✅ FIX #12: After creation, show prompt asking admin if they want to switch to lecturer account
  const [createdLecturer, setCreatedLecturer] = useState<CreatedLecturer | null>(null);
  const [switchingIn, setSwitchingIn] = useState(false);

  const load = async () => {
    setLoading(true);
    const [lecRes, courseRes] = await Promise.all([
      supabase.from("profiles").select("id, full_name, email, phone, country, status, created_at")
        .eq("role", "lecturer").order("created_at", { ascending: false }),
      supabase.from("courses").select("id, title, title_fr, code, lecturer_id").order("title"),
    ]);
    const lecList = (lecRes.data ?? []) as LecturerRow[];
    const courseList = (courseRes.data ?? []) as Course[];
    lecList.forEach(l => { l.courseCount = courseList.filter(c => c.lecturer_id === l.id).length; });
    setLecturers(lecList);
    setAllCourses(courseList);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = lecturers.filter(l => {
    if (!search) return true;
    const q = search.toLowerCase();
    return l.full_name.toLowerCase().includes(q) || l.email.toLowerCase().includes(q);
  });

  const filteredCourses = allCourses.filter(c => {
    if (!courseSearch) return true;
    const q = courseSearch.toLowerCase();
    return c.title.toLowerCase().includes(q) || c.code?.toLowerCase().includes(q);
  });

  const toggleCourse = (id: string) =>
    setSelectedCourses(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const openManageCourses = (l: LecturerRow) => {
    setManageLecturer(l);
    setAssignedCourseIds(new Set(allCourses.filter(c => c.lecturer_id === l.id).map(c => c.id)));
  };

  const toggleAssignedCourse = async (courseId: string) => {
    if (!manageLecturer) return;
    const isAssigned = assignedCourseIds.has(courseId);
    setAssignedCourseIds(prev => {
      const next = new Set(prev);
      isAssigned ? next.delete(courseId) : next.add(courseId);
      return next;
    });
    const { error } = await supabase.from("courses")
      .update({ lecturer_id: isAssigned ? null : manageLecturer.id })
      .eq("id", courseId);
    if (error) {
      showToast("error", error.message);
      setAssignedCourseIds(prev => {
        const next = new Set(prev);
        isAssigned ? next.add(courseId) : next.delete(courseId);
        return next;
      });
    } else {
      setAllCourses(prev => prev.map(c => c.id === courseId ? { ...c, lecturer_id: isAssigned ? null : manageLecturer.id } : c));
      setLecturers(prev => prev.map(l => {
        if (l.id !== manageLecturer.id) return l;
        return { ...l, courseCount: (l.courseCount ?? 0) + (isAssigned ? -1 : 1) };
      }));
    }
  };

  const onAddLecturer = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.full_name.trim() || !form.email.trim() || !form.password.trim()) {
      setError(lang === "en" ? "Name, email and password are required." : "Nom, e-mail et mot de passe requis.");
      return;
    }
    setSaving(true); setError(null);

    try {
      // Step 1: create auth user
      const { data, error: signErr } = await supabase.auth.signUp({
        email: form.email.trim(),
        password: form.password,
        options: { data: { full_name: form.full_name.trim(), role: "lecturer" } },
      });
      if (signErr || !data.user) throw signErr ?? new Error("No user returned");

      const uid = data.user.id;

      // Step 2: upsert profile as lecturer (handle_new_user creates it as student first)
      // Wait briefly to ensure trigger has run
      await new Promise(r => setTimeout(r, 800));
      const { error: profErr } = await supabase.from("profiles").upsert({
        id: uid,
        full_name: form.full_name.trim(),
        title: form.title.trim() || null,
        email: form.email.trim(),
        role: "lecturer",
        phone: form.phone.trim() || null,
        country: form.country.trim() || null,
      });
      if (profErr) throw profErr;

      // ✅ FIX #13: Assign courses AFTER profile upsert with verified uid
      if (selectedCourses.length > 0) {
        const { error: courseErr } = await supabase
          .from("courses")
          .update({ lecturer_id: uid })
          .in("id", selectedCourses);
        if (courseErr) throw courseErr;
      }

      // Store created lecturer info for the post-creation prompt
      setCreatedLecturer({ id: uid, full_name: form.full_name.trim(), email: form.email.trim(), password: form.password });
      showToast("success",
        lang === "en"
          ? `Lecturer account for ${form.full_name} created successfully.`
          : `Compte enseignant pour ${form.full_name} créé avec succès.`
      );
      // Reset form but keep modal open to show the prompt
      setForm({ full_name: "", title: "", email: "", password: "", phone: "", country: "" });
      setSelectedCourses([]);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : (lang === "en" ? "Failed to create account." : "Échec de la création."));
    } finally {
      setSaving(false);
    }
  };

  // ✅ FIX #12: Admin switches into lecturer account
  const handleSwitchToLecturer = async () => {
    if (!createdLecturer) return;
    setSwitchingIn(true);
    try {
      await signIn(createdLecturer.email, createdLecturer.password);
      navigate("/lecturer");
    } catch {
      showToast("error", lang === "en" ? "Could not sign in as lecturer. Try logging in manually." : "Connexion impossible. Essayez manuellement.");
      setSwitchingIn(false);
    }
  };

  const handleStayAsAdmin = () => {
    setCreatedLecturer(null);
    setShowModal(false);
  };

  const toggleStatus = async (l: LecturerRow) => {
    const next: "active" | "suspended" = l.status === "active" ? "suspended" : "active";
    setLecturers(prev => prev.map(x => x.id === l.id ? { ...x, status: next } : x));
    await supabase.from("profiles").update({ status: next }).eq("id", l.id);
    showToast("info", `${l.full_name} ${next === "active" ? (lang === "en" ? "activated" : "activé") : (lang === "en" ? "suspended" : "suspendu")}.`);
  };

  const onDelete = async (l: LecturerRow) => {
    const ok = await confirm({
      title: lang === "en" ? `Remove ${l.full_name}?` : `Supprimer ${l.full_name} ?`,
      message: lang === "en"
        ? "Their profile will be deleted and their courses unassigned. This cannot be undone."
        : "Leur profil sera supprimé et leurs cours désaffectés.",
      confirmLabel: lang === "en" ? "Remove" : "Supprimer",
      tone: "danger",
    });
    if (!ok) return;
    const prevList = lecturers;
    setLecturers(prev => prev.filter(x => x.id !== l.id));
    // Unassign their courses first
    await supabase.from("courses").update({ lecturer_id: null }).eq("lecturer_id", l.id);
    const { error: delErr } = await supabase.from("profiles").delete().eq("id", l.id);
    if (delErr) {
      setLecturers(prevList);
      showToast("error", lang === "en" ? `Could not remove lecturer: ${delErr.message}` : `Impossible de supprimer : ${delErr.message}`);
      return;
    }
    showToast("info", lang === "en" ? "Lecturer removed." : "Enseignant supprimé.");
  };

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString(lang === "fr" ? "fr-FR" : "en-GB", { day: "numeric", month: "short", year: "numeric" });

  return (
    <AdminLayout title={lang === "en" ? "Lecturers" : "Enseignants"}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 animate-fade-in-up">
        <div>
          <h2 className="text-2xl font-black text-ink">{lang === "en" ? "Lecturers" : "Enseignants"}</h2>
          <p className="text-sm text-slate mt-0.5">
            {loading ? "…" : `${lecturers.length} ${lang === "en" ? "lecturer(s)" : "enseignant(s)"}`}
          </p>
        </div>
        <div className="flex gap-3">
          <div className="relative sm:w-60">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" strokeWidth={2} />
            <input type="text" placeholder={lang === "en" ? "Search…" : "Rechercher…"} value={search}
              onChange={e => setSearch(e.target.value)} className="input pl-9" />
          </div>
          <button onClick={() => { setShowModal(true); setError(null); setCreatedLecturer(null); setSelectedCourses([]); setForm({ full_name: "", title: "", email: "", password: "", phone: "", country: "" }); }}
            className="btn-primary flex-shrink-0">
            <Plus className="w-4 h-4" strokeWidth={2.5} />
            {lang === "en" ? "Add Lecturer" : "Ajouter"}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="card divide-y divide-gray-50">{Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)}</div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={Users} title={lang === "en" ? "No lecturers yet" : "Aucun enseignant"} />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50/60 border-b border-gray-100">
                  <th className="text-left px-5 py-3 text-xs font-bold text-slate uppercase tracking-wider">{lang === "en" ? "Name" : "Nom"}</th>
                  <th className="text-left px-5 py-3 text-xs font-bold text-slate uppercase tracking-wider hidden md:table-cell">{lang === "en" ? "Email" : "E-mail"}</th>
                  <th className="text-center px-5 py-3 text-xs font-bold text-slate uppercase tracking-wider">{lang === "en" ? "Courses" : "Cours"}</th>
                  <th className="text-center px-5 py-3 text-xs font-bold text-slate uppercase tracking-wider">{lang === "en" ? "Status" : "Statut"}</th>
                  <th className="text-center px-5 py-3 text-xs font-bold text-slate uppercase tracking-wider">{lang === "en" ? "Active" : "Actif"}</th>
                  <th className="text-left px-5 py-3 text-xs font-bold text-slate uppercase tracking-wider hidden lg:table-cell">{lang === "en" ? "Joined" : "Inscrit"}</th>
                  <th className="text-right px-5 py-3 text-xs font-bold text-slate uppercase tracking-wider">{lang === "en" ? "Actions" : "Actions"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(l => (
                  <tr key={l.id} className="hover:bg-gray-50/60 transition-colors group">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-white border border-gray-200 flex items-center justify-center text-navy font-black text-xs flex-shrink-0 overflow-hidden">
                          {(l as any).avatar_url ? <img src={(l as any).avatar_url} alt="" className="w-full h-full object-cover" /> : l.full_name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-ink">{l.full_name}</p>
                          <p className="text-xs text-gray-400 md:hidden">{l.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-gray-400 hidden md:table-cell">{l.email}</td>
                    <td className="px-5 py-3.5 text-center">
                      <span className="flex items-center justify-center gap-1 text-navy font-bold">
                        <BookOpen className="w-3.5 h-3.5" strokeWidth={2} />{l.courseCount ?? 0}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <Badge color={l.status === "active" ? "green" : "red"}>
                        {l.status === "active" ? (lang === "en" ? "Active" : "Actif") : (lang === "en" ? "Suspended" : "Suspendu")}
                      </Badge>
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <ToggleSwitch checked={l.status === "active"} onChange={() => toggleStatus(l)} />
                    </td>
                    <td className="px-5 py-3.5 text-gray-400 text-xs hidden lg:table-cell">{fmtDate(l.created_at)}</td>
                    <td className="px-5 py-3.5 text-right">
                      <button onClick={() => openManageCourses(l)} className="text-gray-400 hover:text-navy transition-colors p-1.5 rounded-lg hover:bg-navy/5 mr-1" title={lang === "en" ? "Manage Courses" : "Gérer les Cours"}>
                        <BookOpen className="w-4 h-4" strokeWidth={2} />
                      </button>
                      <button onClick={() => onDelete(l)} className="text-gray-400 hover:text-red-500 transition-colors p-1.5 rounded-lg hover:bg-red-50">
                        <Trash2 className="w-4 h-4" strokeWidth={2} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Create Lecturer Modal ── */}
      <Modal open={showModal} onClose={() => { setShowModal(false); setCreatedLecturer(null); }}
        title={lang === "en" ? "Add Lecturer" : "Ajouter un Enseignant"} maxWidth="max-w-2xl">

        {/* ✅ FIX #12: Post-creation prompt */}
        {createdLecturer ? (
          <div className="text-center py-6 space-y-5 animate-scale-in">
            <div className="w-16 h-16 rounded-2xl bg-green-50 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8 text-green-600" strokeWidth={2} />
            </div>
            <div>
              <h3 className="text-lg font-black text-ink mb-1">
                {lang === "en" ? "Lecturer account created!" : "Compte enseignant créé !"}
              </h3>
              <p className="text-sm text-slate">
                {lang === "en"
                  ? `${createdLecturer.full_name}'s account is ready. Would you like to switch to their account to verify setup?`
                  : `Le compte de ${createdLecturer.full_name} est prêt. Voulez-vous basculer vers ce compte pour vérifier la configuration ?`}
              </p>
            </div>
            <div className="flex gap-3">
              <button onClick={handleSwitchToLecturer} disabled={switchingIn}
                className="btn-primary flex-1 disabled:opacity-60">
                {switchingIn
                  ? <><Loader2 className="w-4 h-4 animate-spin" strokeWidth={2.5} />{lang === "en" ? "Switching…" : "Changement…"}</>
                  : <><LogIn className="w-4 h-4" strokeWidth={2} />{lang === "en" ? "Switch to Lecturer Account" : "Basculer vers ce Compte"}</>}
              </button>
              <button onClick={handleStayAsAdmin}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
                <UserCheck className="w-4 h-4" strokeWidth={2} />
                {lang === "en" ? "Stay as Admin" : "Rester Admin"}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={onAddLecturer} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">{lang === "en" ? "Full Name" : "Nom Complet"} *</label>
                <input type="text" required value={form.full_name}
                  onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} className="input" />
              </div>
              <div>
                <label className="label">{lang === "en" ? "Professional Title" : "Titre Professionnel"}</label>
                <input type="text" value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder={lang === "en" ? "e.g. Senior Lecturer, PhD" : "ex. Maître de Conférences"}
                  className="input" />
              </div>
              <div>
                <label className="label">{lang === "en" ? "Email" : "E-mail"} *</label>
                <input type="email" required value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="input" />
              </div>
              <div>
                <label className="label">{lang === "en" ? "Temporary Password" : "Mot de Passe Temporaire"} *</label>
                <PasswordInput required minLength={8} value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: (e.target as HTMLInputElement).value }))}
                  className="input" placeholder="Min 8 characters" />
              </div>
              <div>
                <label className="label">{lang === "en" ? "Phone" : "Téléphone"}</label>
                <input type="tel" value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="input" />
              </div>
              <div>
                <label className="label">{lang === "en" ? "Country" : "Pays"}</label>
                <input type="text" value={form.country}
                  onChange={e => setForm(f => ({ ...f, country: e.target.value }))} className="input" />
              </div>
            </div>

            {/* Course assignment with search */}
            <div>
              <label className="label">
                {lang === "en" ? "Assign Courses" : "Assigner des Cours"}
                {selectedCourses.length > 0 && (
                  <span className="ml-2 text-xs text-brand font-bold">({selectedCourses.length} selected)</span>
                )}
              </label>
              <div className="relative mb-1.5">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" strokeWidth={2} />
                <input type="text" placeholder={lang === "en" ? "Filter courses…" : "Filtrer les cours…"} value={courseSearch}
                  onChange={e => setCourseSearch(e.target.value)} className="input pl-9 py-2 text-sm" />
              </div>
              <div className="max-h-52 overflow-y-auto rounded-xl border border-gray-200 divide-y divide-gray-50">
                {filteredCourses.length === 0 ? (
                  <p className="text-sm text-gray-400 p-4">{lang === "en" ? "No courses found." : "Aucun cours trouvé."}</p>
                ) : filteredCourses.map(c => (
                  <label key={c.id} className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors
                    ${selectedCourses.includes(c.id) ? "bg-navy/5" : ""}`}>
                    <input type="checkbox" checked={selectedCourses.includes(c.id)} onChange={() => toggleCourse(c.id)}
                      className="rounded border-gray-300 text-brand focus:ring-brand/30" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-ink truncate">
                        {(lang === "fr" && c.title_fr) ? c.title_fr : c.title}
                      </p>
                      {c.code && <p className="text-xs text-gray-400">{c.code}</p>}
                    </div>
                    {c.lecturer_id && c.lecturer_id !== "" && (
                      <span className="text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded font-semibold flex-shrink-0">
                        {lang === "en" ? "Assigned" : "Assigné"}
                      </span>
                    )}
                  </label>
                ))}
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-600 font-medium">{error}</div>
            )}

            <div className="flex gap-3">
              <button type="submit" disabled={saving} className="btn-primary flex-1 disabled:opacity-60 disabled:translate-y-0">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2.5} /> : <Plus className="w-4 h-4" strokeWidth={2.5} />}
                {saving ? (lang === "en" ? "Creating…" : "Création…") : (lang === "en" ? "Create Lecturer" : "Créer le Compte")}
              </button>
              <button type="button" onClick={() => setShowModal(false)} className="btn-ghost border border-gray-200">
                {lang === "en" ? "Cancel" : "Annuler"}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Manage Courses modal — add/remove courses assigned to an existing lecturer */}
      <Modal open={!!manageLecturer} onClose={() => setManageLecturer(null)}
        title={manageLecturer ? `${lang === "en" ? "Courses for" : "Cours de"} ${manageLecturer.full_name}` : ""} maxWidth="max-w-lg">
        {manageLecturer && (
          <div className="space-y-3">
            <p className="text-xs text-slate">
              {lang === "en" ? "Check or uncheck to assign or unassign a course to this lecturer." : "Cochez ou décochez pour assigner ou retirer un cours à cet enseignant."}
            </p>
            <div className="border border-gray-200 rounded-xl max-h-80 overflow-y-auto divide-y divide-gray-50">
              {allCourses.map(c => {
                const isAssigned = assignedCourseIds.has(c.id);
                const takenByOther = c.lecturer_id && c.lecturer_id !== manageLecturer.id && !isAssigned;
                return (
                  <label key={c.id} className={`flex items-center gap-2.5 px-3 py-2.5 text-sm ${takenByOther ? "opacity-50 cursor-not-allowed" : "hover:bg-gray-50 cursor-pointer"}`}>
                    <input type="checkbox" checked={isAssigned} disabled={!!takenByOther}
                      onChange={() => toggleAssignedCourse(c.id)}
                      className="w-4 h-4 rounded border-gray-300 text-navy focus:ring-navy/30" />
                    <span className="text-ink font-medium">{c.title}</span>
                    {c.code && <span className="text-xs text-gray-400">{c.code}</span>}
                    {takenByOther && <span className="ml-auto text-xs text-red-400">{lang === "en" ? "Assigned elsewhere" : "Assigné ailleurs"}</span>}
                  </label>
                );
              })}
              {allCourses.length === 0 && <p className="text-xs text-gray-400 px-3 py-3">{lang === "en" ? "No courses exist yet." : "Aucun cours pour le moment."}</p>}
            </div>
            <button type="button" onClick={() => setManageLecturer(null)} className="btn-primary w-full">
              {lang === "en" ? "Done" : "Terminé"}
            </button>
          </div>
        )}
      </Modal>
    </AdminLayout>
  );
}