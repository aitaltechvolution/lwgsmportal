import { useEffect, useState, FormEvent } from "react";
import AdminLayout from "@/components/AdminLayout";
import { supabase } from "@/lib/supabase";
import { useTranslation } from "react-i18next";
import { ClipboardList, Plus, Pencil, Trash2, Loader2, Clock, ImageIcon, UploadCloud, Search } from "lucide-react";
import { Badge, EmptyState, SkeletonCard, Modal } from "@/components/ui/primitives";
import { useConfirm } from "@/contexts/ConfirmContext";
import { useToast } from "@/contexts/ToastContext";

interface Program {
  id: string;
  title: string;
  title_fr: string | null;
  type: string;
  duration: string | null;
  description: string | null;
  description_fr: string | null;
  requirements: string | null;
  requirements_fr: string | null;
  image_url: string | null;
  delivery_mode: "online" | "onsite" | "self_paced";
  // Only meaningful when delivery_mode is "online" — a student otherwise
  // eligible still waits until this date to actually receive the
  // certificate. Self-paced and onsite ignore this entirely.
  certificate_deadline: string | null;
  // Lets an admin close applications for this programme without hiding
  // the programme itself from the public site.
  applications_open: boolean;
  applications_resume_date: string | null;
  courseCount?: number;
}

const DELIVERY_MODES = ["online", "onsite", "self_paced"] as const;
const DELIVERY_MODE_LABEL: Record<string, { en: string; fr: string }> = {
  online: { en: "Online", fr: "En Ligne" },
  onsite: { en: "Onsite", fr: "Sur Site" },
  self_paced: { en: "Self-Paced", fr: "Autonome" },
};

const PROGRAM_TYPES = ["certificate", "diploma", "pastoral"] as const;
const TYPE_COLOR: Record<string, "blue" | "navy" | "orange"> = {
  certificate: "blue", diploma: "navy", pastoral: "orange",
};
const TYPE_LABEL: Record<string, { en: string; fr: string }> = {
  certificate: { en: "Certificate", fr: "Certificat" },
  diploma:     { en: "Diploma",     fr: "Diplôme" },
  pastoral:    { en: "Pastoral Ordination & Licensing", fr: "Ordination et Licence Pastorale" },
};

const EMPTY_FORM = {
  title: "", title_fr: "", type: "certificate" as typeof PROGRAM_TYPES[number],
  duration: "", description: "", description_fr: "", requirements: "", requirements_fr: "",
  delivery_mode: "online" as typeof DELIVERY_MODES[number],
  certificate_deadline: "",
  applications_open: true,
  applications_resume_date: "",
};

export default function AdminPrograms() {
  const { i18n } = useTranslation();
  const lang = (i18n.language.startsWith("fr") ? "fr" : "en") as "en" | "fr";
  const confirm = useConfirm();
  const { showToast } = useToast();

  const [programs, setPrograms] = useState<Program[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Course ↔ program linking (many-to-many via course_programs)
  const [allCourses, setAllCourses] = useState<{ id: string; title: string; code: string | null }[]>([]);
  const [linkedCourseIds, setLinkedCourseIds] = useState<Set<string>>(new Set());
  const [courseSearch, setCourseSearch] = useState("");

  const load = async () => {
    setLoading(true);
    const [progRes, linkRes, coursesRes] = await Promise.all([
      supabase.from("programs").select("id,title,title_fr,type,duration,description,description_fr,requirements,requirements_fr,image_url,delivery_mode,certificate_deadline,applications_open,applications_resume_date").order("title"),
      supabase.from("course_programs").select("program_id, course_id"),
      supabase.from("courses").select("id, title, code").order("title"),
    ]);
    const list = (progRes.data ?? []) as Program[];
    const countMap = new Map<string, number>();
    (linkRes.data ?? []).forEach((l: { program_id: string; course_id: string }) => {
      countMap.set(l.program_id, (countMap.get(l.program_id) ?? 0) + 1);
    });
    list.forEach(p => { p.courseCount = countMap.get(p.id) ?? 0; });
    setPrograms(list);
    setAllCourses((coursesRes.data ?? []) as { id: string; title: string; code: string | null }[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = programs.filter(p => {
    if (!search) return true;
    const q = search.toLowerCase();
    return p.title.toLowerCase().includes(q)
      || (p.title_fr ?? "").toLowerCase().includes(q)
      || p.type.toLowerCase().includes(q)
      || (p.duration ?? "").toLowerCase().includes(q);
  });

  const openCreate = () => {
    setEditingId(null); setForm({ ...EMPTY_FORM }); setError(null);
    setImageFile(null); setImagePreview(null); setCurrentImageUrl(null);
    setLinkedCourseIds(new Set()); setCourseSearch("");
    setShowModal(true);
  };

  const openEdit = async (p: Program) => {
    setEditingId(p.id);
    setForm({
      title: p.title, title_fr: p.title_fr ?? "",
      type: (p.type as typeof PROGRAM_TYPES[number]) || "certificate",
      duration: p.duration ?? "", description: p.description ?? "",
      description_fr: p.description_fr ?? "", requirements: p.requirements ?? "",
      requirements_fr: p.requirements_fr ?? "",
      delivery_mode: p.delivery_mode ?? "online",
      certificate_deadline: p.certificate_deadline ?? "",
      applications_open: p.applications_open ?? true,
      applications_resume_date: p.applications_resume_date ?? "",
    });
    setCurrentImageUrl(p.image_url);
    setImageFile(null); setImagePreview(null); setError(null);
    setCourseSearch("");
    const { data } = await supabase.from("course_programs").select("course_id").eq("program_id", p.id);
    setLinkedCourseIds(new Set((data ?? []).map((r: { course_id: string }) => r.course_id)));
    setShowModal(true);
  };

  const toggleCourseLink = async (courseId: string) => {
    if (!editingId) return;
    const isLinked = linkedCourseIds.has(courseId);
    // optimistic update
    setLinkedCourseIds(prev => {
      const next = new Set(prev);
      isLinked ? next.delete(courseId) : next.add(courseId);
      return next;
    });
    if (isLinked) {
      const { error: delErr } = await supabase.from("course_programs").delete().eq("program_id", editingId).eq("course_id", courseId);
      if (delErr) { showToast("error", delErr.message); setLinkedCourseIds(prev => new Set(prev).add(courseId)); }
    } else {
      const { error: insErr } = await supabase.from("course_programs").insert({ program_id: editingId, course_id: courseId });
      if (insErr) { showToast("error", insErr.message); setLinkedCourseIds(prev => { const n = new Set(prev); n.delete(courseId); return n; }); }
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(f.type)) {
      setError(lang === "en" ? "Only JPG, PNG, or WebP images allowed." : "Seuls les fichiers JPG, PNG ou WebP sont acceptés.");
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      setError(lang === "en" ? "Image must be under 5MB." : "L'image doit faire moins de 5 Mo.");
      return;
    }
    setError(null);
    setImageFile(f);
    setImagePreview(URL.createObjectURL(f));
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) {
      setError(lang === "en" ? "English title is required." : "Le titre en anglais est requis.");
      return;
    }
    if (form.type === "pastoral" && form.delivery_mode === "self_paced") {
      setError(lang === "en" ? "Pastoral programmes cannot be self-paced." : "Les programmes pastoraux ne peuvent pas être autonomes.");
      return;
    }
    setSaving(true); setError(null);

    try {
      let image_url = currentImageUrl;

      // Upload new image if selected
      if (imageFile) {
        const ext = imageFile.name.split(".").pop();
        const path = `programs/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("course-materials")
          .upload(path, imageFile, { upsert: true });
        if (upErr) throw upErr;
        const { data: urlData } = supabase.storage.from("course-materials").getPublicUrl(path);
        image_url = urlData.publicUrl;
      }

      const payload = {
        title: form.title.trim(), title_fr: form.title_fr.trim() || null,
        type: form.type, duration: form.duration.trim() || null,
        description: form.description.trim() || null, description_fr: form.description_fr.trim() || null,
        requirements: form.requirements.trim() || null, requirements_fr: form.requirements_fr.trim() || null,
        image_url,
        delivery_mode: form.delivery_mode,
        // certificate_deadline only means anything for "online" — clear it
        // otherwise so a stale date doesn't linger if the mode is changed.
        certificate_deadline: form.delivery_mode === "online" && form.certificate_deadline ? form.certificate_deadline : null,
        applications_open: form.applications_open,
        // Only meaningful while closed — clear it if applications are open
        // so a stale date doesn't linger and confuse a later closure.
        applications_resume_date: !form.applications_open && form.applications_resume_date ? form.applications_resume_date : null,
      };

      const { error: err, data: savedRows } = editingId
        ? await supabase.from("programs").update(payload).eq("id", editingId).select()
        : await supabase.from("programs").insert(payload).select();

      if (err) throw err;
      if (!savedRows || savedRows.length === 0) {
        throw new Error(lang === "en"
          ? "Save didn't take effect (permission issue) — please refresh and try again."
          : "L'enregistrement n'a pas fonctionné (problème de permission) — veuillez actualiser et réessayer.");
      }
      setShowModal(false);
      showToast("success",
        editingId
          ? (lang === "en" ? "Programme updated." : "Programme mis à jour.")
          : (lang === "en" ? "Programme created." : "Programme créé."),
      );
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (p: Program) => {
    const ok = await confirm({
      title: lang === "en" ? `Delete "${p.title}"?` : `Supprimer "${p.title}" ?`,
      message: lang === "en"
        ? "All associated courses will lose their programme link. This cannot be undone."
        : "Les cours associés perdront leur lien. Cette action est irréversible.",
      confirmLabel: lang === "en" ? "Delete" : "Supprimer",
      tone: "danger",
    });
    if (!ok) return;
    setPrograms(prev => prev.filter(x => x.id !== p.id));
    await supabase.from("programs").delete().eq("id", p.id);
    showToast("info", lang === "en" ? "Programme deleted." : "Programme supprimé.");
  };

  const setF = (k: keyof typeof form, v: string) => setForm(f => ({ ...f, [k]: v }));

  return (
    <AdminLayout title={lang === "en" ? "Programs" : "Programmes"}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 animate-fade-in-up">
        <div>
          <h2 className="text-2xl font-black text-ink">{lang === "en" ? "Programs" : "Programmes"}</h2>
          <p className="text-sm text-slate mt-0.5">{loading ? "…" : `${filtered.length} programme(s)`}</p>
        </div>
        <div className="flex gap-3">
          <div className="relative sm:w-60">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" strokeWidth={2} />
            <input type="text" placeholder={lang === "en" ? "Search…" : "Rechercher…"} value={search} onChange={e => setSearch(e.target.value)} className="input pl-9" />
          </div>
          <button onClick={openCreate} className="btn-primary flex-shrink-0">
            <Plus className="w-4 h-4" strokeWidth={2.5} />
            {lang === "en" ? "Create Program" : "Créer un Programme"}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={ClipboardList} title={lang === "en" ? (search ? "No programs found" : "No programs yet") : (search ? "Aucun programme trouvé" : "Aucun programme")}
          action={<button onClick={openCreate} className="btn-primary"><Plus className="w-4 h-4" strokeWidth={2.5} />{lang === "en" ? "Create Program" : "Créer"}</button>} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 stagger-children">
          {filtered.map(p => {
            const typeLabel = TYPE_LABEL[p.type] ?? { en: p.type, fr: p.type };
            const title = (lang === "fr" && p.title_fr) ? p.title_fr : p.title;
            return (
              <div key={p.id} className="card card-hover flex flex-col overflow-hidden">
                {/* Banner image */}
                <div className="h-36 bg-navy/5 relative overflow-hidden">
                  {p.image_url ? (
                    <img src={p.image_url} alt="" aria-hidden className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ImageIcon className="w-8 h-8 text-gray-300" strokeWidth={1.5} />
                    </div>
                  )}
                  <div className="absolute top-3 left-3 flex gap-1.5">
                    <Badge color={TYPE_COLOR[p.type] ?? "gray"}>{lang === "en" ? typeLabel.en : typeLabel.fr}</Badge>
                    {p.delivery_mode && (
                      <Badge color={p.delivery_mode === "online" ? "blue" : p.delivery_mode === "onsite" ? "green" : "yellow"}>
                        {lang === "en" ? DELIVERY_MODE_LABEL[p.delivery_mode].en : DELIVERY_MODE_LABEL[p.delivery_mode].fr}
                      </Badge>
                    )}
                    {!p.applications_open && (
                      <Badge color="red">{lang === "en" ? "Admissions Closed" : "Admissions Fermées"}</Badge>
                    )}
                  </div>
                </div>
                <div className="p-5 flex-1">
                  {p.duration && (
                    <span className="flex items-center gap-1 text-xs text-gray-400 mb-2">
                      <Clock className="w-3.5 h-3.5" strokeWidth={2} />{p.duration}
                    </span>
                  )}
                  <h3 className="font-bold text-ink text-base leading-snug mb-2">{title}</h3>
                  {p.description && (
                    <p className="text-sm text-slate leading-relaxed line-clamp-2">
                      {(lang === "fr" && p.description_fr) ? p.description_fr : p.description}
                    </p>
                  )}
                  <p className="text-xs text-gray-400 mt-3">{p.courseCount ?? 0} {lang === "en" ? "course(s)" : "cours"}</p>
                </div>
                <div className="px-5 pb-5 flex gap-2 border-t border-gray-50 pt-4">
                  <button onClick={() => openEdit(p)} className="flex-1 flex items-center justify-center gap-1.5 text-sm font-semibold text-navy border border-navy/15 hover:bg-navy hover:text-white rounded-xl py-2 transition-all duration-150">
                    <Pencil className="w-4 h-4" strokeWidth={2} />{lang === "en" ? "Edit" : "Modifier"}
                  </button>
                  <button onClick={() => onDelete(p)} className="flex items-center justify-center gap-1.5 text-sm font-semibold text-red-500 border border-red-200 hover:bg-red-50 rounded-xl px-4 py-2 transition-all duration-150">
                    <Trash2 className="w-4 h-4" strokeWidth={2} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)}
        title={editingId ? (lang === "en" ? "Edit Program" : "Modifier le Programme") : (lang === "en" ? "Create Program" : "Créer un Programme")}
        maxWidth="max-w-2xl">
        <form onSubmit={onSubmit} className="space-y-4">

          {/* Banner image upload */}
          <div>
            <label className="label">{lang === "en" ? "Banner Image" : "Image de Bannière"}</label>
            <label className="block relative cursor-pointer group">
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleImageChange} className="hidden" />
              <div className="w-full h-40 rounded-xl border-2 border-dashed border-gray-200 group-hover:border-navy/30 overflow-hidden transition-colors bg-gray-50 flex items-center justify-center">
                {imagePreview || currentImageUrl ? (
                  <>
                    <img src={imagePreview ?? currentImageUrl!} alt="" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <UploadCloud className="w-6 h-6 text-white" />
                      <span className="text-white text-sm font-semibold">{lang === "en" ? "Change Image" : "Changer l'Image"}</span>
                    </div>
                  </>
                ) : (
                  <div className="text-center">
                    <ImageIcon className="w-8 h-8 text-gray-300 mx-auto mb-2" strokeWidth={1.5} />
                    <p className="text-sm text-slate">{lang === "en" ? "Click to upload a banner image" : "Cliquez pour ajouter une image"}</p>
                    <p className="text-xs text-gray-400 mt-1">JPG, PNG or WebP · max 5MB</p>
                  </div>
                )}
              </div>
            </label>
          </div>

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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">{lang === "en" ? "Type" : "Type"}</label>
              <select value={form.type} onChange={e => setF("type", e.target.value)} className="input">
                {PROGRAM_TYPES.map(t => <option key={t} value={t}>{lang === "en" ? TYPE_LABEL[t].en : TYPE_LABEL[t].fr}</option>)}
              </select>
            </div>
            <div>
              <label className="label">{lang === "en" ? "Duration" : "Durée"}</label>
              <input type="text" value={form.duration} onChange={e => setF("duration", e.target.value)} placeholder="e.g. 12 months" className="input" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">{lang === "en" ? "Delivery Mode" : "Mode de Livraison"}</label>
              <select
                value={form.delivery_mode}
                onChange={e => setForm(f => ({ ...f, delivery_mode: e.target.value as typeof DELIVERY_MODES[number] }))}
                className="input"
              >
                {DELIVERY_MODES.map(m => (
                  <option key={m} value={m} disabled={m === "self_paced" && form.type === "pastoral"}>
                    {lang === "en" ? DELIVERY_MODE_LABEL[m].en : DELIVERY_MODE_LABEL[m].fr}
                    {m === "self_paced" && form.type === "pastoral" ? (lang === "en" ? " (not available for Pastoral)" : " (indisponible pour Pastoral)") : ""}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-400 mt-1">
                {lang === "en"
                  ? "Self-paced courses under this programme never require attendance for certificate eligibility — that's disabled automatically."
                  : "Les cours autonomes de ce programme n'exigent jamais de présence pour l'éligibilité au certificat — désactivé automatiquement."}
              </p>
            </div>
            <div>
              <label className="label">{lang === "en" ? "Certificate Deadline" : "Date Limite du Certificat"}</label>
              <input
                type="date"
                value={form.certificate_deadline}
                onChange={e => setF("certificate_deadline", e.target.value)}
                disabled={form.delivery_mode !== "online"}
                className="input disabled:bg-gray-100 disabled:text-gray-400"
              />
              <p className="text-xs text-gray-400 mt-1">
                {form.delivery_mode === "online"
                  ? (lang === "en" ? "Online students wait until this date to receive their certificate, even if eligible earlier." : "Les étudiants en ligne attendent cette date pour recevoir leur certificat, même s'ils sont éligibles plus tôt.")
                  : (lang === "en" ? "Only applies to Online programmes." : "S'applique uniquement aux programmes en ligne.")}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-gray-50 border border-gray-100 rounded-xl p-4">
            <div>
              <label className="label">{lang === "en" ? "Admissions Status" : "Statut des Admissions"}</label>
              <select
                value={form.applications_open ? "open" : "closed"}
                onChange={e => setForm(f => ({ ...f, applications_open: e.target.value === "open" }))}
                className="input"
              >
                <option value="open">{lang === "en" ? "Open — accepting applications" : "Ouvert — candidatures acceptées"}</option>
                <option value="closed">{lang === "en" ? "Closed — applications paused" : "Fermé — candidatures suspendues"}</option>
              </select>
              <p className="text-xs text-gray-400 mt-1">
                {lang === "en"
                  ? "The programme still shows publicly either way — this only controls whether students can apply. Closed programmes show \"Admissions Closed\" instead of an Apply option."
                  : "Le programme reste visible publiquement dans les deux cas — ceci contrôle seulement si les étudiants peuvent postuler. Les programmes fermés affichent « Admissions Fermées » au lieu d'un bouton Postuler."}
              </p>
            </div>
            <div>
              <label className="label">{lang === "en" ? "Resumption Date" : "Date de Reprise"}</label>
              <input
                type="date"
                value={form.applications_resume_date}
                onChange={e => setF("applications_resume_date", e.target.value)}
                disabled={form.applications_open}
                className="input disabled:bg-gray-100 disabled:text-gray-400"
              />
              <p className="text-xs text-gray-400 mt-1">
                {form.applications_open
                  ? (lang === "en" ? "Only applies while admissions are closed." : "S'applique uniquement lorsque les admissions sont fermées.")
                  : (lang === "en" ? "Optional. If set, students see the date admissions reopen. If left blank, they just see \"Admissions Closed\"." : "Optionnel. Si renseignée, les étudiants voient la date de réouverture. Sinon, ils voient simplement « Admissions Fermées ».")}
              </p>
            </div>
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
            <label className="label">{lang === "en" ? "Requirements (English)" : "Conditions d'Admission (Anglais)"}</label>
            <textarea rows={2} value={form.requirements} onChange={e => setF("requirements", e.target.value)} className="input resize-none" />
          </div>
          <div>
            <label className="label">{lang === "en" ? "Requirements (French)" : "Conditions d'Admission (Français)"}</label>
            <textarea rows={2} value={form.requirements_fr} onChange={e => setF("requirements_fr", e.target.value)} className="input resize-none" />
          </div>

          {editingId ? (
            <div>
              <label className="label">{lang === "en" ? "Courses in this Program" : "Cours dans ce Programme"}</label>
              <input type="text" value={courseSearch} onChange={e => setCourseSearch(e.target.value)}
                placeholder={lang === "en" ? "Search courses…" : "Rechercher des cours…"} className="input mb-2" />
              <div className="border border-gray-200 rounded-xl max-h-48 overflow-y-auto divide-y divide-gray-50">
                {allCourses
                  .filter(c => !courseSearch || c.title.toLowerCase().includes(courseSearch.toLowerCase()) || (c.code ?? "").toLowerCase().includes(courseSearch.toLowerCase()))
                  .map(c => (
                    <label key={c.id} className="flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-gray-50 cursor-pointer">
                      <input type="checkbox" checked={linkedCourseIds.has(c.id)} onChange={() => toggleCourseLink(c.id)}
                        className="w-4 h-4 rounded border-gray-300 text-navy focus:ring-navy/30" />
                      <span className="text-ink">{c.title}</span>
                      {c.code && <span className="text-xs text-gray-400">{c.code}</span>}
                    </label>
                  ))}
                {allCourses.length === 0 && <p className="text-xs text-gray-400 px-3 py-3">{lang === "en" ? "No courses exist yet." : "Aucun cours pour le moment."}</p>}
              </div>
              <p className="text-xs text-gray-400 mt-1.5">
                {lang === "en" ? "A course can belong to more than one program — check or uncheck to add or remove it here." : "Un cours peut appartenir à plusieurs programmes — cochez ou décochez pour l'ajouter ou le retirer."}
              </p>
            </div>
          ) : (
            <div className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-xs text-slate">
              {lang === "en" ? "Save this program first, then reopen it to add courses." : "Enregistrez d'abord ce programme, puis rouvrez-le pour ajouter des cours."}
            </div>
          )}

          {error && <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-600 font-medium">{error}</div>}
          <div className="flex gap-3">
            <button type="submit" disabled={saving} className="btn-primary flex-1 disabled:opacity-60 disabled:translate-y-0">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2.5} /> : <Plus className="w-4 h-4" strokeWidth={2.5} />}
              {saving ? "…" : editingId ? (lang === "en" ? "Save Changes" : "Enregistrer") : (lang === "en" ? "Create Program" : "Créer")}
            </button>
            <button type="button" onClick={() => setShowModal(false)} className="btn-ghost border border-gray-200">{lang === "en" ? "Cancel" : "Annuler"}</button>
          </div>
        </form>
      </Modal>
    </AdminLayout>
  );
}