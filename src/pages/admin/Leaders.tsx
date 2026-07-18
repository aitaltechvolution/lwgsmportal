import { useEffect, useState, FormEvent } from "react";
import AdminLayout from "@/components/AdminLayout";
import { supabase } from "@/lib/supabase";
import { useTranslation } from "react-i18next";
import { Plus, Pencil, Trash2, Loader2, Users, UploadCloud, ArrowUp, ArrowDown } from "lucide-react";
import { EmptyState, SkeletonCard, Modal } from "@/components/ui/primitives";
import { useConfirm } from "@/contexts/ConfirmContext";
import { useToast } from "@/contexts/ToastContext";

interface LeaderRow {
  id: string;
  name: string;
  title: string | null;
  title_fr: string | null;
  bio: string | null;
  bio_fr: string | null;
  image_url: string | null;
  sort_order: number;
}

const EMPTY_FORM = { name: "", title: "", title_fr: "", bio: "", bio_fr: "" };

export default function AdminLeaders() {
  const { i18n } = useTranslation();
  const lang = (i18n.language.startsWith("fr") ? "fr" : "en") as "en" | "fr";
  const confirm = useConfirm();
  const { showToast } = useToast();

  const [leaders, setLeaders] = useState<LeaderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("leaders").select("*").order("sort_order");
    setLeaders((data ?? []) as LeaderRow[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const setF = (k: keyof typeof form, v: string) => setForm(f => ({ ...f, [k]: v }));

  const openCreate = () => {
    setEditingId(null); setForm(EMPTY_FORM); setError(null);
    setImageFile(null); setImagePreview(null); setCurrentImageUrl(null);
    setShowModal(true);
  };

  const openEdit = (l: LeaderRow) => {
    setEditingId(l.id);
    setForm({ name: l.name, title: l.title ?? "", title_fr: l.title_fr ?? "", bio: l.bio ?? "", bio_fr: l.bio_fr ?? "" });
    setCurrentImageUrl(l.image_url);
    setImageFile(null); setImagePreview(null); setError(null);
    setShowModal(true);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setError(lang === "en" ? "Name is required." : "Le nom est requis."); return; }
    setSaving(true); setError(null);

    try {
      let image_url = currentImageUrl;
      if (imageFile) {
        const ext = imageFile.name.split(".").pop();
        const path = `leaders/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("course-materials").upload(path, imageFile, { upsert: true });
        if (upErr) throw upErr;
        const { data: urlData } = supabase.storage.from("course-materials").getPublicUrl(path);
        image_url = urlData.publicUrl;
      }

      const payload = {
        name: form.name.trim(), title: form.title.trim() || null, title_fr: form.title_fr.trim() || null,
        bio: form.bio.trim() || null, bio_fr: form.bio_fr.trim() || null, image_url,
      };

      const { error: err, data: rows } = editingId
        ? await supabase.from("leaders").update(payload).eq("id", editingId).select()
        : await supabase.from("leaders").insert({ ...payload, sort_order: leaders.length + 1 }).select();

      if (err) throw err;
      if (!rows || rows.length === 0) throw new Error(lang === "en" ? "Save didn't take effect — please refresh and try again." : "L'enregistrement a échoué — veuillez actualiser.");

      setShowModal(false);
      showToast("success", editingId ? (lang === "en" ? "Leader updated." : "Responsable mis à jour.") : (lang === "en" ? "Leader added." : "Responsable ajouté."));
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (l: LeaderRow) => {
    const ok = await confirm({
      title: lang === "en" ? `Remove ${l.name}?` : `Retirer ${l.name} ?`,
      message: lang === "en" ? "This will remove them from the public leadership page." : "Cela le retirera de la page publique de direction.",
      confirmLabel: lang === "en" ? "Remove" : "Retirer",
      tone: "danger",
    });
    if (!ok) return;
    setLeaders(prev => prev.filter(x => x.id !== l.id));
    await supabase.from("leaders").delete().eq("id", l.id);
  };

  const move = async (l: LeaderRow, dir: -1 | 1) => {
    const idx = leaders.findIndex(x => x.id === l.id);
    const swapWith = leaders[idx + dir];
    if (!swapWith) return;
    const newList = [...leaders];
    [newList[idx].sort_order, newList[idx + dir].sort_order] = [swapWith.sort_order, l.sort_order];
    [newList[idx], newList[idx + dir]] = [newList[idx + dir], newList[idx]];
    setLeaders(newList);
    await Promise.all([
      supabase.from("leaders").update({ sort_order: newList[idx].sort_order }).eq("id", newList[idx].id),
      supabase.from("leaders").update({ sort_order: newList[idx + dir].sort_order }).eq("id", newList[idx + dir].id),
    ]);
  };

  return (
    <AdminLayout title={lang === "en" ? "Leadership Team" : "Équipe de Direction"}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 animate-fade-in-up">
        <div>
          <h2 className="text-2xl font-black text-ink">{lang === "en" ? "Leadership Team" : "Équipe de Direction"}</h2>
          <p className="text-sm text-slate mt-0.5">{loading ? "…" : `${leaders.length} ${lang === "en" ? "leader(s)" : "responsable(s)"}`}</p>
        </div>
        <button onClick={openCreate} className="btn-primary">
          <Plus className="w-4 h-4" strokeWidth={2.5} />
          {lang === "en" ? "Add Leader" : "Ajouter"}
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}</div>
      ) : leaders.length === 0 ? (
        <EmptyState icon={Users} title={lang === "en" ? "No leaders yet" : "Aucun responsable"}
          action={<button onClick={openCreate} className="btn-primary"><Plus className="w-4 h-4" strokeWidth={2.5} />{lang === "en" ? "Add Leader" : "Ajouter"}</button>} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 stagger-children">
          {leaders.map((l, i) => (
            <div key={l.id} className="card flex gap-4 p-5">
              <div className="w-16 h-16 rounded-2xl flex-shrink-0 bg-navy flex items-center justify-center text-white font-black text-xl overflow-hidden">
                {l.image_url ? <img src={l.image_url} alt="" className="w-full h-full object-cover" /> : l.name.split(" ").filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-ink">{l.name}</div>
                <div className="text-brand text-xs font-semibold mb-1">{lang === "en" ? l.title : (l.title_fr ?? l.title)}</div>
                <p className="text-xs text-slate line-clamp-2">{l.bio}</p>
                <div className="flex items-center gap-2 mt-3">
                  <button onClick={() => move(l, -1)} disabled={i === 0} className="p-1.5 rounded-lg border border-gray-200 text-slate hover:bg-gray-50 disabled:opacity-30"><ArrowUp className="w-3.5 h-3.5" /></button>
                  <button onClick={() => move(l, 1)} disabled={i === leaders.length - 1} className="p-1.5 rounded-lg border border-gray-200 text-slate hover:bg-gray-50 disabled:opacity-30"><ArrowDown className="w-3.5 h-3.5" /></button>
                  <button onClick={() => openEdit(l)} className="flex items-center gap-1 text-xs font-semibold text-navy border border-navy/15 hover:bg-navy hover:text-white rounded-lg px-2.5 py-1.5 transition-all"><Pencil className="w-3.5 h-3.5" />{lang === "en" ? "Edit" : "Modifier"}</button>
                  <button onClick={() => onDelete(l)} className="flex items-center gap-1 text-xs font-semibold text-red-500 border border-red-200 hover:bg-red-50 rounded-lg px-2.5 py-1.5 transition-all"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editingId ? (lang === "en" ? "Edit Leader" : "Modifier") : (lang === "en" ? "Add Leader" : "Ajouter un Responsable")} maxWidth="max-w-lg">
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="label">{lang === "en" ? "Photo" : "Photo"}</label>
            <label className="block relative cursor-pointer group">
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleImageChange} className="hidden" />
              <div className="w-20 h-20 rounded-2xl border-2 border-dashed border-gray-200 group-hover:border-navy/30 overflow-hidden transition-colors bg-gray-50 flex items-center justify-center">
                {imagePreview || currentImageUrl ? (
                  <img src={imagePreview ?? currentImageUrl!} alt="" className="w-full h-full object-cover" />
                ) : (
                  <UploadCloud className="w-6 h-6 text-gray-300" strokeWidth={1.5} />
                )}
              </div>
            </label>
          </div>
          <div>
            <label className="label">{lang === "en" ? "Full Name" : "Nom Complet"} *</label>
            <input type="text" required value={form.name} onChange={e => setF("name", e.target.value)} className="input" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">{lang === "en" ? "Title (English)" : "Titre (Anglais)"}</label>
              <input type="text" value={form.title} onChange={e => setF("title", e.target.value)} className="input" />
            </div>
            <div>
              <label className="label">{lang === "en" ? "Title (French)" : "Titre (Français)"}</label>
              <input type="text" value={form.title_fr} onChange={e => setF("title_fr", e.target.value)} className="input" />
            </div>
          </div>
          <div>
            <label className="label">{lang === "en" ? "Bio (English)" : "Bio (Anglais)"}</label>
            <textarea rows={3} value={form.bio} onChange={e => setF("bio", e.target.value)} className="input resize-none" />
          </div>
          <div>
            <label className="label">{lang === "en" ? "Bio (French)" : "Bio (Français)"}</label>
            <textarea rows={3} value={form.bio_fr} onChange={e => setF("bio_fr", e.target.value)} className="input resize-none" />
          </div>
          {error && <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-600 font-medium">{error}</div>}
          <div className="flex gap-3">
            <button type="submit" disabled={saving} className="btn-primary flex-1 disabled:opacity-60 disabled:translate-y-0">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2.5} /> : <Plus className="w-4 h-4" strokeWidth={2.5} />}
              {saving ? "…" : editingId ? (lang === "en" ? "Save Changes" : "Enregistrer") : (lang === "en" ? "Add Leader" : "Ajouter")}
            </button>
            <button type="button" onClick={() => setShowModal(false)} className="btn-ghost border border-gray-200">{lang === "en" ? "Cancel" : "Annuler"}</button>
          </div>
        </form>
      </Modal>
    </AdminLayout>
  );
}
