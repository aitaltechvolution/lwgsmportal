import { useEffect, useState, FormEvent } from "react";
import { useParams, Link } from "react-router-dom";
import AdminLayout from "@/components/AdminLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { useTranslation } from "react-i18next";
import {
  FileText, Video, Paperclip, Lock, Trash2, Pencil, UploadCloud,
  Loader2, Plus, X, Eye, PencilLine, AlignLeft, GripVertical, Link2, AlertTriangle,
} from "lucide-react";
import { Badge, EmptyState, SkeletonRow, ToggleSwitch } from "@/components/ui/primitives";
import { useCurrency } from "@/contexts/CurrencyContext";
import SecureFileViewer from "@/components/SecureFileViewer";
import { useConfirm } from "@/contexts/ConfirmContext";
import { useToast } from "@/contexts/ToastContext";
import { uploadWithProgress } from "@/lib/uploadWithProgress";
import { isExternalUrl } from "@/lib/storage";

interface Course {
  id: string;
  title: string;
  title_fr: string | null;
  code: string | null;
  allow_videos: boolean;
}

interface Material {
  id: string;
  course_id: string;
  title_en: string;
  title_fr: string | null;
  type: "note" | "video" | "file" | "link";
  url: string | null;
  content_en: string | null;
  content_fr: string | null;
  is_premium: boolean;
  price: number | null;
  sort_order: number | null;
  created_at: string;
}

// "note" (typed text) is kept here only so any pre-existing note
// materials still render correctly in the list — it's no longer offered
// as a choice when adding/editing a material (see the Type selector below).
const TYPE_META: Record<string, { icon: typeof FileText; bg: string; text: string; en: string; fr: string }> = {
  note:  { icon: FileText,  bg: "bg-blue-50",   text: "text-blue-600",   en: "Note",  fr: "Note"  },
  video: { icon: Video,     bg: "bg-red-50",    text: "text-red-600",    en: "Video", fr: "Vidéo" },
  file:  { icon: Paperclip, bg: "bg-gray-100",  text: "text-gray-600",   en: "File",  fr: "Fichier" },
  link:  { icon: Link2,     bg: "bg-purple-50", text: "text-purple-600", en: "Link",  fr: "Lien"  },
};

// Allowed types per material type
const ALLOWED_BY_TYPE: Record<string, { mimes: string[]; label: string; accept: string }> = {
  note: {
    mimes: ["application/pdf","image/png","image/jpeg","image/jpg","image/webp"],
    label: "PDF, PNG, JPG, WebP",
    accept: ".pdf,.png,.jpg,.jpeg,.webp",
  },
  file: {
    mimes: ["application/pdf","image/png","image/jpeg","image/jpg","image/webp"],
    label: "PDF, PNG, JPG, WebP",
    accept: ".pdf,.png,.jpg,.jpeg,.webp",
  },
  video: {
    mimes: ["video/mp4","video/webm","video/ogg","video/quicktime","video/x-msvideo"],
    label: "MP4, WebM, MOV, AVI",
    accept: ".mp4,.webm,.ogg,.mov,.avi",
  },
};
// Legacy fallback
const ALLOWED_TYPES = ["application/pdf","image/png","image/jpeg","image/webp","video/mp4","video/webm","video/quicktime"];
const ALLOWED_LABEL = "PDF, Image, or Video";

// "type" (free-text typed content) has been replaced with "link" (a pasted
// external URL) — see the "links for videos" request: File and Video
// materials can now either be uploaded or point at an external link (e.g.
// a YouTube URL for a video), and "Link" is its own material type for a
// plain external resource link.
type SourceMode = "upload" | "link";

function isValidHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export default function CourseMaterials() {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const { i18n } = useTranslation();
  const lang = (i18n.language.startsWith("fr") ? "fr" : "en") as "en" | "fr";
  const { format } = useCurrency();
  const confirm = useConfirm();
  const { showToast } = useToast();

  const [course, setCourse] = useState<Course | null>(null);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewingMat, setViewingMat] = useState<Material | null>(null);
  const [reordering, setReordering] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Form state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [titleEn, setTitleEn] = useState("");
  const [titleFr, setTitleFr] = useState("");
  const [type, setType] = useState<"video" | "file" | "link">("file");
  const [sourceMode, setSourceMode] = useState<SourceMode>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [linkUrl, setLinkUrl] = useState("");
  const [isPremium, setIsPremium] = useState(false);
  const [price, setPrice] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    const [cRes, mRes] = await Promise.all([
      supabase.from("courses").select("id, title, title_fr, code, allow_videos").eq("id", id).maybeSingle(),
      supabase.from("course_materials").select("*").eq("course_id", id).order("sort_order", { ascending: true }).order("created_at", { ascending: true }),
    ]);
    const loadedCourse = cRes.data as Course | null;
    setCourse(loadedCourse);
    setMaterials((mRes.data ?? []) as Material[]);
    if (loadedCourse && !loadedCourse.allow_videos) {
      setType(prev => (prev === "video" ? "file" : prev));
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [id]);

  const resetForm = () => {
    setEditingId(null); setTitleEn(""); setTitleFr(""); setType("file"); setSourceMode("upload");
    setFile(null); setLinkUrl(""); setIsPremium(false); setPrice(""); setError(null);
  };

  const startEdit = (m: Material) => {
    setEditingId(m.id);
    setTitleEn(m.title_en); setTitleFr(m.title_fr ?? "");
    // Legacy "note" materials are no longer a selectable type — fall back
    // to "file" so the type selector still shows a valid, highlighted option.
    setType(m.type === "note" ? "file" : m.type);
    if (m.url && isExternalUrl(m.url)) {
      setSourceMode("link"); setLinkUrl(m.url);
    } else {
      setSourceMode(m.url ? "upload" : "link"); setLinkUrl("");
    }
    setFile(null);
    setIsPremium(m.is_premium); setPrice(m.price ? String(m.price) : ""); setError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const validateFile = (f: File): string | null => {
    const allowed = ALLOWED_BY_TYPE[type] ?? ALLOWED_BY_TYPE.file;
    if (!allowed.mimes.includes(f.type)) {
      const isWord = f.name.endsWith('.doc') || f.name.endsWith('.docx');
      if (isWord) {
        return lang === "en"
          ? "Word documents are not allowed. Please convert to PDF first."
          : "Les fichiers Word ne sont pas acceptés. Convertissez en PDF d'abord.";
      }
      return lang === "en"
        ? `For "${type}" materials, only ${allowed.label} files are allowed.`
        : `Pour les ressources de type "${type}", seuls les fichiers ${allowed.label} sont acceptés.`;
    }
    const maxSize = type === "video" ? 500 * 1024 * 1024 : 50 * 1024 * 1024;
    const maxLabel = type === "video" ? "500MB" : "50MB";
    if (f.size > maxSize) {
      return lang === "en" ? `File must be under ${maxLabel}.` : `Le fichier doit faire moins de ${maxLabel}.`;
    }
    return null;
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) { setFile(null); return; }
    const err = validateFile(f);
    if (err) { setError(err); setFile(null); return; }
    setError(null);
    setFile(f);
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!id || !profile?.id) return;
    if (!titleEn.trim()) { setError(lang === "en" ? "English title is required." : "Le titre en anglais est requis."); return; }
    if (isPremium && (!price || Number(price) <= 0)) { setError(lang === "en" ? "Enter a valid price for premium content." : "Entrez un prix valide."); return; }
    if (type === "video" && course && !course.allow_videos) {
      setError(lang === "en" ? "Video materials are disabled for this course." : "Les vidéos sont désactivées pour ce cours.");
      return;
    }
    if (sourceMode === "link") {
      if (!linkUrl.trim()) { setError(lang === "en" ? "Enter a link URL." : "Entrez une URL."); return; }
      if (!isValidHttpUrl(linkUrl.trim())) { setError(lang === "en" ? "Enter a valid link starting with http:// or https://." : "Entrez un lien valide commençant par http:// ou https://."); return; }
    }
    if (sourceMode === "upload" && !file && !editingId) { setError(lang === "en" ? "Choose a file to upload." : "Choisissez un fichier."); return; }

    setSaving(true); setError(null);

    try {
      let storagePath: string | null = sourceMode === "upload"
        ? (editingId ? materials.find(m => m.id === editingId)?.url ?? null : null)
        : null;

      if (sourceMode === "upload" && file) {
        const path = `${id}/${Date.now()}-${file.name.replace(/\s+/g, "_")}`;
        setUploadProgress(0);
        try {
          await uploadWithProgress("course-materials", path, file, setUploadProgress);
        } catch (upErr) {
          throw upErr instanceof Error ? upErr : new Error("Upload failed.");
        } finally {
          setUploadProgress(null);
        }
        storagePath = path;
      }

      if (sourceMode === "upload" && !storagePath) throw new Error(lang === "en" ? "Choose a file to upload." : "Choisissez un fichier.");

      const payload = {
        course_id: id,
        title_en: titleEn.trim(), title_fr: titleFr.trim() || null,
        type,
        url: sourceMode === "upload" ? storagePath : linkUrl.trim(),
        content_en: null,
        content_fr: null,
        is_premium: isPremium,
        price: isPremium ? Number(price) : 0,
        sort_order: editingId
          ? (materials.find(m => m.id === editingId)?.sort_order ?? materials.length)
          : materials.length,
      };

      if (editingId) {
        const { error: updErr } = await supabase.from("course_materials").update(payload).eq("id", editingId);
        if (updErr) throw updErr;
      } else {
        const { error: insErr } = await supabase.from("course_materials").insert(payload);
        if (insErr) throw insErr;
      }

      resetForm();
      load();
      showToast("success", editingId
        ? (lang === "en" ? "Material updated." : "Ressource mise à jour.")
        : (lang === "en" ? "Material added." : "Ressource ajoutée."));
    } catch (err) {
      setError(err instanceof Error ? err.message : (lang === "en" ? "Save failed." : "Échec."));
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (m: Material) => {
    const ok = await confirm({
      title: lang === "en" ? "Delete material?" : "Supprimer la ressource ?",
      message: lang === "en" ? `"${m.title_en}" will be permanently removed.` : `"${m.title_en}" sera supprimée définitivement.`,
      confirmLabel: lang === "en" ? "Delete" : "Supprimer",
      tone: "danger",
    });
    if (!ok) return;
    setMaterials(prev => prev.filter(x => x.id !== m.id));
    if (m.url && !isExternalUrl(m.url)) await supabase.storage.from("course-materials").remove([m.url]);
    await supabase.from("course_materials").delete().eq("id", m.id);
    showToast("info", lang === "en" ? "Material deleted." : "Ressource supprimée.");
  };

  // HTML5 Drag and drop reorder
  const onDragStart = (index: number) => setDragIndex(index);
  const onDragOver = (e: React.DragEvent, index: number) => { e.preventDefault(); setDragOverIndex(index); };
  const onDragEnd = () => { setDragIndex(null); setDragOverIndex(null); };
  const onDrop = async (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === dropIndex) { setDragIndex(null); setDragOverIndex(null); return; }
    const newList = [...materials];
    const [moved] = newList.splice(dragIndex, 1);
    newList.splice(dropIndex, 0, moved);
    setMaterials(newList);
    setDragIndex(null); setDragOverIndex(null);
    setReordering(true);
    await Promise.all(newList.map((m, i) =>
      supabase.from("course_materials").update({ sort_order: i }).eq("id", m.id)
    ));
    setReordering(false);
  };

  // Move up/down (keyboard/button alternative)
  const moveItem = async (index: number, dir: -1 | 1) => {
    const newList = [...materials];
    const target = index + dir;
    if (target < 0 || target >= newList.length) return;
    [newList[index], newList[target]] = [newList[target], newList[index]];
    setMaterials(newList);
    setReordering(true);
    await Promise.all(newList.map((m, i) =>
      supabase.from("course_materials").update({ sort_order: i }).eq("id", m.id)
    ));
    setReordering(false);
  };

  const courseTitle = course ? ((lang === "fr" && course.title_fr) ? course.title_fr : course.title) : "…";

  return (
    <AdminLayout breadcrumbs={[
      { label: lang === "en" ? "Courses" : "Cours", to: "/admin/courses" },
      { label: courseTitle },
      { label: lang === "en" ? "Materials" : "Ressources" },
    ]}>
      <div className="flex gap-2 mb-6 flex-wrap animate-fade-in-up">
        <div className="px-4 py-2 rounded-xl text-sm font-bold bg-navy text-white shadow-md flex items-center gap-2">
          <FileText className="w-4 h-4" strokeWidth={2} />
          {lang === "en" ? "Materials" : "Ressources"}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form */}
        <div className="lg:col-span-1">
          <div className="card p-6 animate-fade-in-up sticky top-6">
            <h3 className="font-bold text-ink mb-4 flex items-center gap-2">
              {editingId ? <Pencil className="w-4 h-4 text-navy" strokeWidth={2} /> : <Plus className="w-4 h-4 text-navy" strokeWidth={2} />}
              {editingId ? (lang === "en" ? "Edit Material" : "Modifier") : (lang === "en" ? "Add Material" : "Ajouter une Ressource")}
            </h3>
            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <label className="label">{lang === "en" ? "Title (English)" : "Titre (Anglais)"} *</label>
                <input type="text" required value={titleEn} onChange={e => setTitleEn(e.target.value)} className="input" />
              </div>
              <div>
                <label className="label">{lang === "en" ? "Title (French)" : "Titre (Français)"}</label>
                <input type="text" value={titleFr} onChange={e => setTitleFr(e.target.value)} className="input" />
              </div>
              <div>
                <label className="label">{lang === "en" ? "Type" : "Type"}</label>
                <div className="flex gap-2">
                  {(["file", "video", "link"] as const).map(t => {
                    const meta = TYPE_META[t];
                    const Icon = meta.icon;
                    const disabled = t === "video" && course ? !course.allow_videos : false;
                    return (
                      <button key={t} type="button" disabled={disabled}
                        onClick={() => { setType(t); if (t === "link") setSourceMode("link"); else if (sourceMode === "link") setSourceMode("upload"); }}
                        className={`flex-1 flex flex-col items-center gap-1 py-2.5 rounded-xl border text-xs font-semibold transition-all duration-150
                          ${disabled ? "border-gray-100 text-gray-300 cursor-not-allowed bg-gray-50"
                            : type === t ? "border-navy bg-navy/5 text-navy" : "border-gray-200 text-slate hover:border-navy/30"}`}>
                        <Icon className="w-4 h-4" strokeWidth={2} />
                        {lang === "en" ? meta.en : meta.fr}
                      </button>
                    );
                  })}
                </div>
                {course && !course.allow_videos && (
                  <p className="text-[11px] text-amber-600 mt-1.5 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 flex-shrink-0" strokeWidth={2} />
                    {lang === "en" ? "Video materials are disabled for this course (see the course's settings)." : "Les vidéos sont désactivées pour ce cours (voir les paramètres du cours)."}
                  </p>
                )}
              </div>

              {type !== "link" && (
                <div className="flex gap-1.5 bg-gray-100 p-1 rounded-xl">
                  <button type="button" onClick={() => setSourceMode("upload")}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all duration-150 ${sourceMode === "upload" ? "bg-white text-navy shadow-sm" : "text-slate hover:text-ink"}`}>
                    <UploadCloud className="w-3.5 h-3.5" strokeWidth={2} />{lang === "en" ? "Upload File" : "Téléverser"}
                  </button>
                  <button type="button" onClick={() => setSourceMode("link")}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all duration-150 ${sourceMode === "link" ? "bg-white text-navy shadow-sm" : "text-slate hover:text-ink"}`}>
                    <Link2 className="w-3.5 h-3.5" strokeWidth={2} />{lang === "en" ? "Add Link" : "Ajouter un Lien"}
                  </button>
                </div>
              )}

              {sourceMode === "upload" ? (
                <div>
                  <label className="flex items-center justify-center gap-2 border-2 border-dashed border-gray-200 hover:border-navy/30 rounded-xl px-4 py-6 cursor-pointer transition-colors group">
                    <input type="file" accept={(ALLOWED_BY_TYPE[type] ?? ALLOWED_BY_TYPE.file).accept} onChange={onFileChange} className="hidden" />
                    {file ? (
                      <div className="flex items-center gap-2 text-sm text-ink text-center">
                        <Paperclip className="w-4 h-4 text-navy flex-shrink-0" strokeWidth={2} />
                        <span className="font-medium truncate max-w-[160px]">{file.name}</span>
                      </div>
                    ) : editingId && materials.find(m => m.id === editingId)?.url ? (
                      <div className="text-center">
                        <Paperclip className="w-6 h-6 text-navy mx-auto mb-1" strokeWidth={1.75} />
                        <span className="text-xs text-slate font-medium">{lang === "en" ? "Keep existing file, or choose a new one" : "Garder le fichier actuel ou en choisir un nouveau"}</span>
                      </div>
                    ) : (
                      <div className="text-center">
                        <UploadCloud className="w-6 h-6 text-gray-400 group-hover:text-navy mx-auto mb-1 transition-colors" strokeWidth={1.75} />
                        <span className="text-xs text-slate group-hover:text-navy transition-colors font-medium">{lang === "en" ? "Click to choose a file" : "Choisir un fichier"}</span>
                        <p className="text-[10px] text-gray-400 mt-1">{(ALLOWED_BY_TYPE[type] ?? ALLOWED_BY_TYPE.file).label} · max {type === "video" ? "500MB" : "50MB"}</p>
                        <p className="text-[10px] text-amber-600 mt-0.5 font-semibold">
                          {lang === "en" ? "⚠ Word documents not allowed — convert to PDF first" : "⚠ Fichiers Word non acceptés — convertissez en PDF d'abord"}
                        </p>
                      </div>
                    )}
                  </label>
                </div>
              ) : (
                <div>
                  <label className="label">{lang === "en" ? "Link URL" : "URL du Lien"} *</label>
                  <input type="url" required value={linkUrl} onChange={e => setLinkUrl(e.target.value)}
                    placeholder="https://…" className="input" />
                  <p className="text-[11px] text-gray-400 mt-1">
                    {type === "video"
                      ? (lang === "en" ? "Paste a YouTube, Vimeo, or other video link." : "Collez un lien YouTube, Vimeo ou autre.")
                      : type === "link"
                      ? (lang === "en" ? "Paste any external resource link." : "Collez un lien vers une ressource externe.")
                      : (lang === "en" ? "Paste a link to an external file (e.g. Google Drive)." : "Collez un lien vers un fichier externe (ex. Google Drive).")}
                  </p>
                </div>
              )}

              <div className="flex items-center justify-between bg-gray-50 rounded-xl p-3.5">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-yellow-600" strokeWidth={2} />
                  <span className="text-sm font-semibold text-ink">{lang === "en" ? "Premium content" : "Contenu Premium"}</span>
                </div>
                <ToggleSwitch checked={isPremium} onChange={setIsPremium} />
              </div>

              {isPremium && (
                <div>
                  <label className="label">{lang === "en" ? "Price (USD)" : "Prix (USD)"}</label>
                  <input type="number" min="0" step="0.01" value={price} onChange={e => setPrice(e.target.value)} className="input" />
                </div>
              )}

              {error && <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-600 font-medium">{error}</div>}

              {uploadProgress !== null && (
                <div>
                  <div className="flex items-center justify-between text-xs font-semibold text-slate mb-1">
                    <span>{lang === "en" ? "Uploading…" : "Téléversement…"}</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-brand rounded-full transition-all duration-200 ease-out"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <button type="submit" disabled={saving} className="btn-primary flex-1 disabled:opacity-60 disabled:translate-y-0">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2.5} /> : <Plus className="w-4 h-4" strokeWidth={2.5} />}
                  {saving ? (lang === "en" ? "Saving…" : "Enregistrement…") : editingId ? (lang === "en" ? "Update" : "Mettre à jour") : (lang === "en" ? "Add Material" : "Ajouter")}
                </button>
                {editingId && (
                  <button type="button" onClick={resetForm} className="btn-ghost border border-gray-200">
                    <X className="w-4 h-4" strokeWidth={2} />
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>

        {/* List with reorder */}
        <div className="lg:col-span-2">
          <div className="card overflow-hidden animate-fade-in-up">
            <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
              <h3 className="font-bold text-ink text-sm">
                {lang === "en" ? "Course Materials" : "Ressources du Cours"}
                <span className="text-xs font-normal text-gray-400 ml-2">
                  {lang === "en" ? "— drag the ⠿ handle to reorder" : "— glissez ⠿ pour réorganiser"}
                </span>
              </h3>
              <div className="flex items-center gap-3">
                {reordering && <Loader2 className="w-3.5 h-3.5 animate-spin text-navy" />}
                <span className="text-xs text-gray-400">{materials.length} {lang === "en" ? "item(s)" : "élément(s)"}</span>
              </div>
            </div>
            {loading ? (
              <div className="divide-y divide-gray-50">{Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)}</div>
            ) : materials.length === 0 ? (
              <div className="p-6"><EmptyState icon={FileText} title={lang === "en" ? "No materials yet" : "Aucune ressource"} description={lang === "en" ? "Add your first material using the form." : "Ajoutez votre première ressource."} /></div>
            ) : (
              <div className="divide-y divide-gray-50">
                {materials.map((m, index) => {
                  const meta = TYPE_META[m.type] ?? TYPE_META.file;
                  const Icon = meta.icon;
                  const title = (lang === "fr" && m.title_fr) ? m.title_fr : m.title_en;
                  return (
                    <div
                      key={m.id}
                      draggable
                      onDragStart={() => onDragStart(index)}
                      onDragOver={e => onDragOver(e, index)}
                      onDrop={e => onDrop(e, index)}
                      onDragEnd={onDragEnd}
                      className={`flex items-center gap-3 px-5 py-4 transition-all duration-150 group
                        ${dragIndex === index ? "opacity-50 bg-blue-50/60 scale-[0.99]" : ""}
                        ${dragOverIndex === index && dragIndex !== index ? "bg-orange-50 border-l-4 border-amber-400" : "hover:bg-gray-50/60 border-l-4 border-transparent"}`}
                    >
                      {/* Drag handle */}
                      <div className="flex flex-col items-center gap-0.5 flex-shrink-0 cursor-grab active:cursor-grabbing">
                        <button onClick={() => moveItem(index, -1)} disabled={index === 0}
                          className="text-gray-300 hover:text-navy disabled:opacity-20 transition-colors text-[10px] leading-none select-none">▲</button>
                        <GripVertical className="w-4 h-4 text-gray-400" strokeWidth={2} />
                        <button onClick={() => moveItem(index, 1)} disabled={index === materials.length - 1}
                          className="text-gray-300 hover:text-navy disabled:opacity-20 transition-colors text-[10px] leading-none select-none">▼</button>
                      </div>
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${meta.bg}`}>
                        <Icon className={`w-[18px] h-[18px] ${meta.text}`} strokeWidth={2} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs text-gray-400 font-bold w-5 text-center">{index + 1}</span>
                          <p className="font-semibold text-ink text-sm truncate">{title}</p>
                          {m.is_premium && <Badge color="yellow" icon={Lock}>{format(m.price ?? 0)}</Badge>}
                          {!m.url && <Badge color="blue" icon={AlignLeft}>{lang === "en" ? "Typed" : "Saisi"}</Badge>}
                        </div>
                        <p className={`text-[11px] font-medium mt-0.5 capitalize ${meta.text} opacity-70`}>{m.type}</p>
                      </div>
                      {m.url ? (
                        <button
                          onClick={() => m.url && isExternalUrl(m.url) ? window.open(m.url, "_blank", "noopener,noreferrer") : setViewingMat(m)}
                          className="text-gray-400 hover:text-brand transition-colors flex-shrink-0">
                          <Eye className="w-4 h-4" strokeWidth={2} />
                        </button>
                      ) : null}
                      <button onClick={() => startEdit(m)} className="text-gray-400 hover:text-navy transition-colors flex-shrink-0">
                        <Pencil className="w-4 h-4" strokeWidth={2} />
                      </button>
                      <button onClick={() => onDelete(m)} className="text-gray-400 hover:text-red-500 transition-colors flex-shrink-0">
                        <Trash2 className="w-4 h-4" strokeWidth={2} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {viewingMat && viewingMat.url && !isExternalUrl(viewingMat.url) && (
        <SecureFileViewer
          open={!!viewingMat}
          onClose={() => setViewingMat(null)}
          title={(lang === "fr" && viewingMat.title_fr) ? viewingMat.title_fr : viewingMat.title_en}
          storedUrl={viewingMat.url}
          kind={viewingMat.type}
        />
      )}
    </AdminLayout>
  );
}
