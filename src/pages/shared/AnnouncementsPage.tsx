import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useTranslation } from "react-i18next";
import { Megaphone, ChevronDown, ChevronUp, Calendar } from "lucide-react";

interface Announcement {
  id: string;
  title_en: string;
  title_fr: string;
  body_en: string;
  body_fr: string;
  target_role: string | null;
  created_at: string;
  scheduled_at: string | null;
  author_name?: string;
}

interface Props {
  role: "student" | "lecturer" | "admin";
  compact?: boolean; // for dashboard widget showing only 3
}

export default function AnnouncementsPage({ role, compact }: Props) {
  const { i18n } = useTranslation();
  const lang = (i18n.language.startsWith("fr") ? "fr" : "en") as "en" | "fr";
  const t = (en: string, fr: string) => lang === "fr" ? fr : en;
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const nowIso = new Date().toISOString();
      let q = supabase.from("announcements")
        .select("*, profiles!announcements_author_id_fkey(full_name)")
        // The app only ever stores target_role as null ("everyone"),
        // "public" (website), or an exact role name — it never stores
        // the literal string "all", so that clause used to match
        // nothing and was silently dead.
        .or(`target_role.is.null,target_role.eq.public,target_role.eq.${role}`)
        // Comparing NULL with <= is never true in Postgres, so a plain
        // .lte("scheduled_at", ...) hid every announcement that never
        // had scheduled_at set (e.g. anything created before the
        // scheduling feature existed) — that was the main reason this
        // page could show nothing at all. Treat "no scheduled_at" as
        // "publish immediately".
        .or(`scheduled_at.is.null,scheduled_at.lte.${nowIso}`)
        .order("created_at", { ascending: false });
      if (compact) q = q.limit(3);
      const { data, error } = await q;
      if (error) console.error("Failed to load announcements:", error);
      setItems((data ?? []).map((a: any) => ({ ...a, author_name: a.profiles?.full_name })));
      setLoading(false);
    };
    load();

    // realtime
    const channel = supabase.channel("announcements-rt")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "announcements" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [role, compact]);

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString(lang === "fr" ? "fr-FR" : "en-GB", { day: "numeric", month: "long", year: "numeric" });

  const audienceBadge = (r: string | null) => {
    const map: Record<string, { en: string; fr: string; color: string }> = {
      all: { en: "Everyone", fr: "Tous", color: "bg-blue-100 text-blue-700" },
      students: { en: "Students", fr: "Étudiants", color: "bg-green-100 text-green-700" },
      lecturers: { en: "Lecturers", fr: "Enseignants", color: "bg-purple-100 text-purple-700" },
      public: { en: "Public", fr: "Public", color: "bg-gray-100 text-gray-600" },
    };
    const key = r ?? "all";
    const info = map[key] ?? map.all;
    return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${info.color}`}>{lang === "fr" ? info.fr : info.en}</span>;
  };

  if (loading) return (
    <div className="space-y-3">
      {[1,2,3].map(i => <div key={i} className="skeleton rounded-2xl h-20" />)}
    </div>
  );

  if (items.length === 0) return (
    <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
      <Megaphone className="w-8 h-8 text-gray-200 mx-auto mb-3" strokeWidth={1.5} />
      <p className="text-gray-400 font-medium text-sm">{t("No announcements yet","Aucune annonce pour l'instant")}</p>
    </div>
  );

  return (
    <div className="space-y-3">
      {items.map(ann => {
        const title = lang === "fr" ? (ann.title_fr || ann.title_en) : ann.title_en;
        const body = lang === "fr" ? (ann.body_fr || ann.body_en) : ann.body_en;
        const isOpen = expanded === ann.id;
        return (
          <div key={ann.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden hover:border-[#F97316]/20 transition-colors">
            <button className="w-full text-left px-5 py-4 flex items-start gap-4" onClick={() => setExpanded(isOpen ? null : ann.id)}>
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#0A1628] to-[#1E3A5F] flex items-center justify-center flex-shrink-0 mt-0.5">
                <Megaphone className="w-4 h-4 text-[#F97316]" strokeWidth={2} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-bold text-[#0A1628] text-sm leading-snug">{title}</p>
                  <div className="flex items-center gakwpp-2 flex-shrink-0">
                    {audienceBadge(ann.target_role)}
                    {isOpen ? <ChevronUp className="w-4 h-4 text-gray-400" strokeWidth={2} /> : <ChevronDown className="w-4 h-4 text-gray-400" strokeWidth={2} />}
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-1.5">
                  <Calendar className="w-3 h-3 text-gray-300" strokeWidth={2} />
                  <span className="text-[11px] text-gray-400">{fmtDate(ann.created_at)}</span>
                  {ann.author_name && <><span className="text-gray-200">·</span><span className="text-[11px] text-gray-400">{ann.author_name}</span></>}
                </div>
              </div>
            </button>
            {isOpen && (
              <div className="px-5 pb-5 border-t border-gray-50">
                <div className="pt-4 text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{body}</div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}