import { useEffect, useState } from "react";
import StudentLayout from "@/components/StudentLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { useTranslation } from "react-i18next";
import { Search, FileText, Video, Paperclip, Lock, Eye, FolderOpen, X } from "lucide-react";
import { Badge, EmptyState, SkeletonCard } from "@/components/ui/primitives";
import { useCurrency } from "@/contexts/CurrencyContext";
import SecureFileViewer from "@/components/SecureFileViewer";
import { logUsageEvent } from "@/lib/usageEvents";

interface LibraryItem {
  id: string;
  course_id: string;
  title_en: string;
  title_fr: string | null;
  type: "note" | "video" | "file";
  url: string | null;
  content_en: string | null;
  content_fr: string | null;
  is_premium: boolean;
  price: number | null;
  courses?: { title: string; title_fr?: string; code?: string } | null;
}

const TYPE_META: Record<string, { icon: typeof FileText; bg: string; text: string; label: string; fr: string }> = {
  note:  { icon: FileText,  bg: "bg-blue-50", text: "text-blue-600", label: "Document", fr: "Document" },
  video: { icon: Video,     bg: "bg-red-50",  text: "text-red-600",  label: "Video",    fr: "Vidéo"    },
  file:  { icon: Paperclip, bg: "bg-gray-100",text: "text-gray-600", label: "File",     fr: "Fichier"  },
};

type FilterType = "all" | "note" | "video" | "file";

export default function StudentLibrary() {
  const { profile } = useAuth();
  const { i18n } = useTranslation();
  const lang = (i18n.language.startsWith("fr") ? "fr" : "en") as "en" | "fr";
  const { format } = useCurrency();
  const [items, setItems]   = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>("all");
  const [search, setSearch] = useState("");
  const [viewing, setViewing] = useState<LibraryItem | null>(null);
  const [textViewing, setTextViewing] = useState<LibraryItem | null>(null);

  useEffect(() => {
    if (!profile?.id) return;
    async function load() {
      const { data: enrData } = await supabase.from("enrollments").select("course_id").eq("student_id", profile!.id).eq("status", "active");
      const ids = (enrData ?? []).map((e: { course_id: string }) => e.course_id).filter(Boolean);
      if (ids.length === 0) { setLoading(false); return; }
      const { data } = await supabase.from("course_materials").select("*, courses(title, title_fr, code)").in("course_id", ids).order("created_at", { ascending: false });
      setItems((data ?? []) as unknown as LibraryItem[]);
      setLoading(false);
    }
    load();
  }, [profile?.id]);

  const filtered = items
    .filter(i => filter === "all" || i.type === filter)
    .filter(i => {
      if (!search) return true;
      const q = search.toLowerCase();
      return i.title_en.toLowerCase().includes(q) || i.title_fr?.toLowerCase().includes(q) || i.courses?.title.toLowerCase().includes(q);
    });

  const FILTERS: { key: FilterType; en: string; fr: string }[] = [
    { key: "all", en: "All", fr: "Tous" },
    { key: "note", en: "Documents", fr: "Documents" },
    { key: "video", en: "Videos", fr: "Vidéos" },
    { key: "file", en: "Files", fr: "Fichiers" },
  ];

  return (
    <StudentLayout title={lang === "en" ? "Library" : "Bibliothèque"}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 animate-fade-in-up">
        <div>
          <h2 className="text-2xl font-black text-ink">{lang === "en" ? "Library" : "Bibliothèque"}</h2>
          <p className="text-sm text-slate mt-0.5">{items.length} {lang === "en" ? "resource(s) available" : "ressource(s) disponible(s)"}</p>
        </div>
        <div className="relative sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" strokeWidth={2} />
          <input type="text" placeholder={lang === "en" ? "Search resources…" : "Rechercher…"} value={search} onChange={e => setSearch(e.target.value)} className="input pl-9" />
        </div>
      </div>

      <div className="flex gap-1.5 mb-6 bg-gray-100 p-1 rounded-xl w-fit animate-fade-in-up" style={{ animationDelay: "0.05s" }}>
        {FILTERS.map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all duration-150 ${filter === f.key ? "bg-white text-navy shadow-sm" : "text-slate hover:text-ink"}`}>
            {lang === "en" ? f.en : f.fr}
            <span className="ml-1 text-xs opacity-60">{f.key === "all" ? items.length : items.filter(i => i.type === f.key).length}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}</div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title={search ? (lang === "en" ? "No matches" : "Aucun résultat") : (lang === "en" ? "No resources yet" : "Aucune ressource")}
          description={lang === "en" ? "Resources from your enrolled courses appear here." : "Les ressources de vos cours inscrits apparaissent ici."}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 stagger-children">
          {filtered.map(item => {
            const meta = TYPE_META[item.type] ?? TYPE_META.file;
            const Icon = meta.icon;
            const title = (lang === "fr" && item.title_fr) ? item.title_fr : item.title_en;
            const cTitle = item.courses ? ((lang === "fr" && item.courses.title_fr) ? item.courses.title_fr : item.courses.title) : "";
            return (
              <div key={item.id} className="card card-hover flex flex-col">
                <div className="p-5 flex-1">
                  <div className={`w-11 h-11 rounded-2xl ${meta.bg} flex items-center justify-center mb-3`}>
                    <Icon className={`w-5 h-5 ${meta.text}`} strokeWidth={2} />
                  </div>
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h3 className="font-bold text-ink text-sm leading-snug flex-1">{title}</h3>
                    {item.is_premium && <Badge color="yellow" icon={Lock}>Pro</Badge>}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-[11px] font-semibold ${meta.text}`}>{lang === "en" ? meta.label : meta.fr}</span>
                    {cTitle && <span className="text-[11px] text-gray-400">· {item.courses?.code ?? cTitle}</span>}
                  </div>
                </div>
                <div className="px-5 pb-5">
                  {item.is_premium ? (
                    <button className="w-full text-sm font-bold bg-yellow-50 hover:bg-yellow-100 text-yellow-800 py-2.5 rounded-xl transition-colors flex items-center justify-center gap-1.5">
                      <Lock className="w-3.5 h-3.5" strokeWidth={2} />
                      {lang === "en" ? "Unlock" : "Déverrouiller"}{item.price ? ` · ${format(item.price)}` : ""}
                    </button>
                  ) : item.url ? (
                    <button
                      onClick={() => { setViewing(item); if (profile?.id) logUsageEvent(profile.id, "material_view", { courseId: item.course_id, materialId: item.id }); }}
                      className="w-full flex items-center justify-center gap-2 text-sm font-bold bg-navy hover:bg-navy-light text-white py-2.5 rounded-xl transition-colors"
                    >
                      {lang === "en" ? "View" : "Consulter"}
                      <Eye className="w-4 h-4" strokeWidth={2.5} />
                    </button>
                  ) : (
                    <button
                      onClick={() => { setTextViewing(item); if (profile?.id) logUsageEvent(profile.id, "material_view", { courseId: item.course_id, materialId: item.id }); }}
                      className="w-full flex items-center justify-center gap-2 text-sm font-bold bg-navy hover:bg-navy-light text-white py-2.5 rounded-xl transition-colors"
                    >
                      {lang === "en" ? "Read" : "Lire"}
                      <Eye className="w-4 h-4" strokeWidth={2.5} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {viewing && viewing.url && (
        <SecureFileViewer
          open={!!viewing}
          onClose={() => setViewing(null)}
          title={(lang === "fr" && viewing.title_fr) ? viewing.title_fr : viewing.title_en}
          storedUrl={viewing.url}
          kind={viewing.type}
        />
      )}

      {textViewing && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 animate-fade-in">
          <div className="absolute inset-0 bg-black/50" onClick={() => setTextViewing(null)} />
          <div
            className="relative w-full max-w-2xl max-h-[85vh] overflow-y-auto bg-white rounded-2xl shadow-2xl p-7 select-none"
            onContextMenu={(e) => e.preventDefault()}
            onCopy={(e) => e.preventDefault()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-ink text-lg">{(lang === "fr" && textViewing.title_fr) ? textViewing.title_fr : textViewing.title_en}</h3>
              <button onClick={() => setTextViewing(null)} className="text-gray-400 hover:text-ink p-1.5 rounded-lg hover:bg-gray-50 transition-colors">
                <X className="w-5 h-5" strokeWidth={2} />
              </button>
            </div>
            <div className="prose prose-sm max-w-none text-ink whitespace-pre-wrap leading-relaxed">
              {((lang === "fr" && textViewing.content_fr) ? textViewing.content_fr : textViewing.content_en) || "—"}
            </div>
          </div>
        </div>
      )}
    </StudentLayout>
  );
}
