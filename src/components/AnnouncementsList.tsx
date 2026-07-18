import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Megaphone } from "lucide-react";
import { EmptyState, SkeletonRow } from "@/components/ui/primitives";

interface Announcement {
  id: string;
  title_en: string;
  title_fr: string | null;
  body_en: string | null;
  body_fr: string | null;
  target_role: string | null;
  created_at: string;
  author?: { full_name: string };
}

interface Props {
  role: "student" | "lecturer" | "admin";
  lang: "en" | "fr";
  limit?: number;
  showTitle?: boolean;
}

export default function AnnouncementsList({ role, lang, limit, showTitle = true }: Props) {
  const { profile } = useAuth();
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      let q = supabase
        .from("announcements")
        .select("id, title_en, title_fr, body_en, body_fr, target_role, created_at, author:author_id(full_name)")
        .or(`target_role.is.null,target_role.eq.${role}`)
        .eq("is_published", true)
        .order("created_at", { ascending: false });
      if (limit) q = q.limit(limit);
      const { data } = await q;
      setItems((data ?? []) as unknown as Announcement[]);

      // Load read status
      if (profile?.id && data && data.length > 0) {
        const ids = (data as any[]).map(a => a.id);
        const { data: reads } = await supabase
          .from("notification_reads")
          .select("announcement_id")
          .eq("user_id", profile.id)
          .in("announcement_id", ids);
        setReadIds(new Set((reads ?? []).map((r: any) => r.announcement_id)));
      }
      setLoading(false);
    };
    load();
  }, [role, profile?.id, limit]);

  const markRead = async (id: string) => {
    if (!profile?.id || readIds.has(id)) return;
    await supabase.from("notification_reads").insert({
      user_id: profile.id,
      announcement_id: id,
    }).select();
    setReadIds(prev => new Set([...prev, id]));
  };

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString(lang === "fr" ? "fr-FR" : "en-GB", {
      day: "numeric", month: "long", year: "numeric",
    });

  const audienceLabel = (role: string | null) => {
    if (!role) return lang === "fr" ? "Tous" : "All";
    const map: Record<string, Record<"en"|"fr", string>> = {
      student: { en: "Students", fr: "Étudiants" },
      lecturer: { en: "Lecturers", fr: "Enseignants" },
      admin: { en: "Admins", fr: "Admins" },
    };
    return map[role]?.[lang] ?? role;
  };

  return (
    <div>
      {showTitle && (
        <div className="flex items-center gap-2 mb-4">
          <Megaphone className="w-5 h-5 text-navy" strokeWidth={2} />
          <h2 className="font-bold text-ink text-lg">
            {lang === "fr" ? "Annonces" : "Announcements"}
          </h2>
          {items.length > 0 && (
            <span className="ml-auto text-xs text-gray-400">{items.length} {lang === "fr" ? "annonces" : "posts"}</span>
          )}
        </div>
      )}

      {loading ? (
        <div className="card overflow-hidden">
          {Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} />)}
        </div>
      ) : items.length === 0 ? (
        <div className="card p-8">
          <EmptyState
            icon={Megaphone}
            title={lang === "fr" ? "Aucune annonce" : "No announcements"}
            subtitle={lang === "fr" ? "Rien de nouveau pour l'instant." : "Nothing to show right now."}
          />
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(ann => {
            const isRead = readIds.has(ann.id);
            const title = lang === "fr" ? (ann.title_fr || ann.title_en) : ann.title_en;
            const body = lang === "fr" ? (ann.body_fr || ann.body_en) : ann.body_en;
            return (
              <div
                key={ann.id}
                onClick={() => markRead(ann.id)}
                className={`card p-5 cursor-pointer transition-all hover:shadow-md ${!isRead ? "border-l-4 border-l-brand bg-brand/[0.01]" : ""}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      <h3 className={`text-sm font-bold text-ink ${!isRead ? "text-brand" : ""}`}>{title}</h3>
                      {!isRead && (
                        <span className="w-2 h-2 rounded-full bg-brand flex-shrink-0" />
                      )}
                    </div>
                    <p className="text-sm text-slate leading-relaxed">{body}</p>
                    <div className="flex items-center gap-3 mt-3 flex-wrap">
                      <span className="text-[11px] text-gray-400">{fmtDate(ann.created_at)}</span>
                      {(ann as any).author?.full_name && (
                        <span className="text-[11px] text-gray-400">
                          {lang === "fr" ? "par" : "by"} {(ann as any).author.full_name}
                        </span>
                      )}
                      <span className="text-[10px] font-bold bg-navy/5 text-navy px-2 py-0.5 rounded-full ml-auto">
                        {audienceLabel(ann.target_role)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
