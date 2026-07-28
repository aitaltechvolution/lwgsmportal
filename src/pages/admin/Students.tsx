import { useEffect, useState, FormEvent } from "react";
import AdminLayout from "@/components/AdminLayout";
import { supabase } from "@/lib/supabase";
import { useTranslation } from "react-i18next";
import {
  Search, GraduationCap, Plus, Eye, Ban, Trash2, Loader2,
  CheckCircle2, MoreVertical, X,
} from "lucide-react";
import { Badge, EmptyState, SkeletonRow, Modal } from "@/components/ui/primitives";
import { COUNTRIES } from "@/lib/constants";
import { useConfirm } from "@/contexts/ConfirmContext";
import { useToast } from "@/contexts/ToastContext";

interface StudentRow {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  country: string | null;
  status: "active" | "suspended";
  created_at: string;
  program?: string | null;
  // The delivery mode of the student's (first active) programme —
  // online / onsite / self_paced — surfaced so admin can sort/filter by
  // it directly (see #10).
  delivery_mode?: "online" | "onsite" | "self_paced" | null;
  avatar_url?: string | null;
  matric_number?: string | null;
}

export default function AdminStudents() {
  const { i18n } = useTranslation();
  const lang = (i18n.language.startsWith("fr") ? "fr" : "en") as "en" | "fr";
  const confirm = useConfirm();
  const { showToast } = useToast();

  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "suspended">("all");
  // #10: sort alphabetically or by application order, and filter by the
  // student's programme delivery mode.
  const [sortBy, setSortBy] = useState<"name" | "applied">("name");
  const [typeFilter, setTypeFilter] = useState<"all" | "online" | "onsite" | "self_paced">("all");
  const [actionMenu, setActionMenu] = useState<string | null>(null);

  // Add Student modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [form, setForm] = useState({ full_name: "", email: "", password: "", phone: "", country: "", nationality: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, email, phone, country, status, created_at, avatar_url, matric_number")
      .eq("role", "student")
      .order("created_at", { ascending: false });

    const list = (data ?? []) as StudentRow[];

    // Fetch enrolled programs per student (first active enrollment)
    if (list.length > 0) {
      const ids = list.map(s => s.id);
      const { data: enrData } = await supabase
        .from("enrollments")
        .select("student_id, programs(title, title_fr, delivery_mode)")
        .in("student_id", ids)
        .eq("status", "active");

      const programMap = new Map<string, string>();
      const deliveryModeMap = new Map<string, "online" | "onsite" | "self_paced">();
      (enrData as unknown as { student_id: string; programs?: { title: string; title_fr?: string; delivery_mode?: "online" | "onsite" | "self_paced" } | null }[] ?? []).forEach(e => {
        if (!programMap.has(e.student_id) && e.programs) {
          programMap.set(e.student_id, (lang === "fr" && e.programs.title_fr) ? e.programs.title_fr : e.programs.title);
          if (e.programs.delivery_mode) deliveryModeMap.set(e.student_id, e.programs.delivery_mode);
        }
      });

      list.forEach(s => { s.program = programMap.get(s.id) ?? null; s.delivery_mode = deliveryModeMap.get(s.id) ?? null; });
    }

    setStudents(list);
    setLoading(false);
  };

  useEffect(() => { load(); }, [lang]);

  const filtered = students
    .filter(s => statusFilter === "all" || s.status === statusFilter)
    .filter(s => typeFilter === "all" || s.delivery_mode === typeFilter)
    .filter(s => {
      if (!search) return true;
      const q = search.toLowerCase();
      return s.full_name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q) || s.country?.toLowerCase().includes(q);
    })
    .sort((a, b) =>
      sortBy === "name"
        ? a.full_name.localeCompare(b.full_name)
        : new Date(a.created_at).getTime() - new Date(b.created_at).getTime() // order of application — oldest (first applicant) first
    );

  const toggleSuspend = async (s: StudentRow) => {
    const next: "active" | "suspended" = s.status === "active" ? "suspended" : "active";
    setStudents(prev => prev.map(x => x.id === s.id ? { ...x, status: next } : x));
    setActionMenu(null);
    const { error: err } = await supabase.from("profiles").update({ status: next }).eq("id", s.id);
    if (err) setStudents(prev => prev.map(x => x.id === s.id ? { ...x, status: s.status } : x));
  };

  const onDelete = async (s: StudentRow) => {
    setActionMenu(null);
    const ok = await confirm({
      title: lang === "en" ? "Delete student account?" : "Supprimer le compte étudiant ?",
      message: lang === "en" ? `${s.full_name}'s account will be permanently deleted. This cannot be undone.` : `Le compte de ${s.full_name} sera définitivement supprimé. Action irréversible.`,
      confirmLabel: lang === "en" ? "Delete" : "Supprimer",
      cancelLabel: lang === "en" ? "Cancel" : "Annuler",
      tone: "danger",
    });
    if (!ok) return;
    const prevList = students;
    setStudents(prev => prev.filter(x => x.id !== s.id));
    const { error: delErr } = await supabase.from("profiles").delete().eq("id", s.id);
    if (delErr) {
      setStudents(prevList);
      showToast("error", lang === "en" ? `Could not delete: ${delErr.message}` : `Suppression impossible : ${delErr.message}`);
    } else {
      showToast("info", lang === "en" ? "Student account deleted." : "Compte étudiant supprimé.");
    }
  };

  const onAddStudent = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const { data, error: signErr } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: { data: { full_name: form.full_name, role: "student" } },
    });

    if (signErr || !data.user) {
      setSaving(false);
      setError(signErr?.message ?? (lang === "en" ? "Failed to create account." : "Échec de la création du compte."));
      return;
    }

    // Update profile row (created via trigger) with extra fields. Role is
    // set explicitly here too — the trigger always defaults new profiles to
    // 'student', so this is currently a no-op for this flow, but stating it
    // explicitly means this keeps working correctly even if that default
    // ever changes.
    await supabase.from("profiles").update({
      full_name: form.full_name,
      role: "student",
      phone: form.phone || null,
      country: form.country || null,
      nationality: form.nationality || null,
    }).eq("id", data.user.id);

    setSaving(false);
    setSuccess(true);
    setTimeout(() => {
      setShowAddModal(false);
      setSuccess(false);
      setForm({ full_name: "", email: "", password: "", phone: "", country: "", nationality: "" });
      load();
    }, 1200);
  };

  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(lang === "fr" ? "fr-FR" : "en-GB", { day: "numeric", month: "short", year: "numeric" });

  return (
    <AdminLayout title={lang === "en" ? "Students" : "Étudiants"}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 animate-fade-in-up">
        <div>
          <h2 className="text-2xl font-black text-ink">{lang === "en" ? "Students" : "Étudiants"}</h2>
          <p className="text-sm text-slate mt-0.5">{loading ? "…" : `${students.length} ${lang === "en" ? "student(s)" : "étudiant(s)"}`}</p>
        </div>
        <div className="flex gap-3">
          <div className="relative sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" strokeWidth={2} />
            <input type="text" placeholder={lang === "en" ? "Search students…" : "Rechercher…"} value={search} onChange={e => setSearch(e.target.value)} className="input pl-9" />
          </div>
          <select value={sortBy} onChange={e => setSortBy(e.target.value as "name" | "applied")} className="input w-auto flex-shrink-0">
            <option value="name">{lang === "en" ? "Sort: A–Z" : "Trier : A-Z"}</option>
            <option value="applied">{lang === "en" ? "Sort: Order of Application" : "Trier : Ordre de Candidature"}</option>
          </select>
          <button onClick={() => { setShowAddModal(true); setError(null); setSuccess(false); }} className="btn-primary flex-shrink-0">
            <Plus className="w-4 h-4" strokeWidth={2.5} />
            {lang === "en" ? "Add Student" : "Ajouter"}
          </button>
        </div>
      </div>

      {/* Status filter */}
      <div className="flex flex-wrap gap-1.5 mb-3 bg-gray-100 p-1 rounded-xl w-fit animate-fade-in-up" style={{ animationDelay: "0.04s" }}>
        {(["all", "active", "suspended"] as const).map(f => (
          <button key={f} onClick={() => setStatusFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all duration-150 ${statusFilter === f ? "bg-white text-navy shadow-sm" : "text-slate hover:text-ink"}`}>
            {f === "all" ? (lang === "en" ? "All" : "Tous") : f === "active" ? (lang === "en" ? "Active" : "Actifs") : (lang === "en" ? "Suspended" : "Suspendus")}
            <span className="ml-1 text-xs opacity-60">{f === "all" ? students.length : students.filter(s => s.status === f).length}</span>
          </button>
        ))}
      </div>

      {/* Type (delivery mode) filter — #10 */}
      <div className="flex flex-wrap gap-1.5 mb-6 bg-gray-100 p-1 rounded-xl w-fit animate-fade-in-up" style={{ animationDelay: "0.06s" }}>
        {(["all", "online", "onsite", "self_paced"] as const).map(f => (
          <button key={f} onClick={() => setTypeFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all duration-150 ${typeFilter === f ? "bg-white text-navy shadow-sm" : "text-slate hover:text-ink"}`}>
            {f === "all" ? (lang === "en" ? "All Types" : "Tous Types")
              : f === "online" ? (lang === "en" ? "Online" : "En Ligne")
              : f === "onsite" ? (lang === "en" ? "Onsite" : "Sur Site")
              : (lang === "en" ? "Self-Paced" : "Autonome")}
            <span className="ml-1 text-xs opacity-60">{f === "all" ? students.length : students.filter(s => s.delivery_mode === f).length}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="card divide-y divide-gray-50">{Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)}</div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={GraduationCap} title={lang === "en" ? "No students found" : "Aucun étudiant trouvé"} />
      ) : (
        <div className="card overflow-hidden stagger-children">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50/60 border-b border-gray-100">
                  <th className="text-left px-5 py-3 text-xs font-bold text-slate uppercase tracking-wider">{lang === "en" ? "Name" : "Nom"}</th>
                  <th className="text-left px-5 py-3 text-xs font-bold text-slate uppercase tracking-wider hidden md:table-cell">{lang === "en" ? "Matric No." : "N° Matricule"}</th>
                  <th className="text-left px-5 py-3 text-xs font-bold text-slate uppercase tracking-wider">{lang === "en" ? "Email" : "E-mail"}</th>
                  <th className="text-left px-5 py-3 text-xs font-bold text-slate uppercase tracking-wider hidden lg:table-cell">{lang === "en" ? "Phone" : "Téléphone"}</th>
                  <th className="text-left px-5 py-3 text-xs font-bold text-slate uppercase tracking-wider hidden lg:table-cell">{lang === "en" ? "Country" : "Pays"}</th>
                  <th className="text-left px-5 py-3 text-xs font-bold text-slate uppercase tracking-wider hidden md:table-cell">{lang === "en" ? "Program" : "Programme"}</th>
                  <th className="text-left px-5 py-3 text-xs font-bold text-slate uppercase tracking-wider hidden md:table-cell">{lang === "en" ? "Type" : "Type"}</th>
                  <th className="text-center px-5 py-3 text-xs font-bold text-slate uppercase tracking-wider">{lang === "en" ? "Status" : "Statut"}</th>
                  <th className="text-left px-5 py-3 text-xs font-bold text-slate uppercase tracking-wider hidden sm:table-cell">{lang === "en" ? "Joined" : "Inscrit"}</th>
                  <th className="text-right px-5 py-3 text-xs font-bold text-slate uppercase tracking-wider">{lang === "en" ? "Actions" : "Actions"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50/60 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-navy to-navy-light flex items-center justify-center text-white font-black text-xs flex-shrink-0">
                          {s.avatar_url ? <img src={s.avatar_url} alt="" className="w-full h-full object-cover" /> : s.full_name.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-semibold text-ink">{s.full_name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-gray-500 font-mono text-xs hidden md:table-cell">{s.matric_number ?? "—"}</td>
                    <td className="px-5 py-3.5 text-gray-400">{s.email}</td>
                    <td className="px-5 py-3.5 text-gray-400 hidden lg:table-cell">{s.phone ?? "—"}</td>
                    <td className="px-5 py-3.5 text-gray-400 hidden lg:table-cell">{s.country ?? "—"}</td>
                    <td className="px-5 py-3.5 text-ink hidden md:table-cell">{s.program ?? <span className="text-gray-400 italic">{lang === "en" ? "Unassigned" : "Non assigné"}</span>}</td>
                    <td className="px-5 py-3.5 hidden md:table-cell">
                      {s.delivery_mode
                        ? <Badge color={s.delivery_mode === "online" ? "blue" : s.delivery_mode === "onsite" ? "green" : "yellow"}>
                            {lang === "fr"
                              ? (s.delivery_mode === "online" ? "En Ligne" : s.delivery_mode === "onsite" ? "Sur Site" : "Autonome")
                              : (s.delivery_mode === "online" ? "Online" : s.delivery_mode === "onsite" ? "Onsite" : "Self-Paced")}
                          </Badge>
                        : <span className="text-xs text-gray-400">—</span>}
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <Badge color={s.status === "active" ? "green" : "red"}>
                        {s.status === "active" ? (lang === "en" ? "Active" : "Actif") : (lang === "en" ? "Suspended" : "Suspendu")}
                      </Badge>
                    </td>
                    <td className="px-5 py-3.5 text-gray-400 text-xs hidden sm:table-cell">{fmtDate(s.created_at)}</td>
                    <td className="px-5 py-3.5 text-right relative">
                      <button onClick={() => setActionMenu(actionMenu === s.id ? null : s.id)} className="text-gray-400 hover:text-ink transition-colors p-1">
                        <MoreVertical className="w-4 h-4" strokeWidth={2} />
                      </button>
                      {actionMenu === s.id && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setActionMenu(null)} />
                          <div className="absolute right-5 top-12 z-20 w-48 bg-white rounded-xl shadow-card-hover border border-gray-100 py-1.5 animate-scale-in">
                            <button onClick={() => toggleSuspend(s)} className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-ink hover:bg-gray-50 transition-colors">
                              <Ban className="w-4 h-4 text-yellow-500" strokeWidth={2} />
                              {s.status === "active" ? (lang === "en" ? "Suspend Account" : "Suspendre le Compte") : (lang === "en" ? "Reactivate Account" : "Réactiver le Compte")}
                            </button>
                            <button onClick={() => onDelete(s)} className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors">
                              <Trash2 className="w-4 h-4" strokeWidth={2} />
                              {lang === "en" ? "Delete" : "Supprimer"}
                            </button>
                          </div>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Student Modal */}
      <Modal open={showAddModal} onClose={() => setShowAddModal(false)} title={lang === "en" ? "Add Student" : "Ajouter un Étudiant"}>
        {success ? (
          <div className="text-center py-8 animate-scale-in">
            <div className="w-14 h-14 rounded-2xl bg-green-50 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-7 h-7 text-green-600" strokeWidth={2} />
            </div>
            <p className="font-bold text-green-700">{lang === "en" ? "Account created successfully!" : "Compte créé avec succès !"}</p>
          </div>
        ) : (
          <form onSubmit={onAddStudent} className="space-y-4">
            <div>
              <label className="label">{lang === "en" ? "Full Name" : "Nom Complet"} *</label>
              <input type="text" required value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} className="input" />
            </div>
            <div>
              <label className="label">{lang === "en" ? "Email" : "E-mail"} *</label>
              <input type="email" required value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="input" />
            </div>
            <div>
              <label className="label">{lang === "en" ? "Temporary Password" : "Mot de Passe Temporaire"} *</label>
              <input type="text" required minLength={8} value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} className="input" placeholder={lang === "en" ? "Min 8 characters" : "8 caractères min."} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">{lang === "en" ? "Phone" : "Téléphone"}</label>
                <input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="input" />
              </div>
              <div>
                <label className="label">{lang === "en" ? "Country" : "Pays"}</label>
                <select value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))} className="input">
                  <option value="">{lang === "en" ? "Select…" : "Sélectionner…"}</option>
                  {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="label">{lang === "en" ? "Nationality" : "Nationalité"}</label>
              <select value={form.nationality} onChange={e => setForm(f => ({ ...f, nationality: e.target.value }))} className="input">
                <option value="">{lang === "en" ? "Select…" : "Sélectionner…"}</option>
                {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {error && <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-600 font-medium">{error}</div>}

            <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-xs text-blue-700">
              {lang === "en"
                ? "Note: this creates a Supabase auth account directly. The student can log in immediately with the email and password provided."
                : "Remarque : ceci crée directement un compte d'authentification Supabase. L'étudiant peut se connecter immédiatement."}
            </div>

            <div className="flex gap-3">
              <button type="submit" disabled={saving} className="btn-primary flex-1 disabled:opacity-60 disabled:translate-y-0">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2.5} /> : <Plus className="w-4 h-4" strokeWidth={2.5} />}
                {saving ? (lang === "en" ? "Creating…" : "Création…") : (lang === "en" ? "Create Account" : "Créer le Compte")}
              </button>
              <button type="button" onClick={() => setShowAddModal(false)} className="btn-ghost border border-gray-200">
                {lang === "en" ? "Cancel" : "Annuler"}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </AdminLayout>
  );
}