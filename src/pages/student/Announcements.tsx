import { useEffect, useState } from "react";
import StudentLayout from "@/components/StudentLayout";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "react-i18next";
import { Megaphone, Calendar } from "lucide-react";
import { EmptyState, SkeletonRow } from "@/components/ui/primitives";

interface Announcement {
  id: string;
  title_en: string;
  title_fr: string | null;
  body_en: string;
  body_fr: string | null;
  target_role: string | null;
  created_at: string;
  is_published: boolean;
}

export default function StudentAnnouncements() {
  const { profile } = useAuth();
  const { i18n } = useTranslation();
  const lang = i18n.language.startsWith("fr") ? "fr" : "en";
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    const nowIso = new Date().toISOString();
    supabase
      .from("announcements")
      // The table's real columns are title_en/body_en (with optional
      // _fr translations) — selecting "title"/"body" doesn't exist and
      // was making this query fail outright, which is why nothing ever
      // showed up here.
      .select("id, title_en, title_fr, body_en, body_fr, target_role, created_at, is_published, scheduled_at")
      .eq("is_published", true)
      .or("target_role.is.null,target_role.eq.public,target_role.eq.student")
      // An announcement with no scheduled_at set (or one scheduled for
      // the past) should show. Comparing NULL with <= is never true in
      // Postgres, so a plain .lte() here would silently hide any
      // announcement that never got a scheduled_at value.
      .or(`scheduled_at.is.null,scheduled_at.lte.${nowIso}`)
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) console.error("Failed to load announcements:", error);
        setItems((data ?? []) as Announcement[]);
        setLoading(false);
      });
  }, [profile]);

  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString(lang === "fr" ? "fr-FR" : "en-GB", {
      day: "numeric", month: "long", year: "numeric",
    });

  return (
    <StudentLayout breadcrumbs={[{ label: lang === "en" ? "Announcements" : "Annonces" }]}>
      <div className="flex items-center gap-3 mb-6 animate-fade-in-up">
        <div className="w-10 h-10 rounded-xl bg-navy/5 flex items-center justify-center">
          <Megaphone className="w-5 h-5 text-navy" strokeWidth={2} />
        </div>
        <div>
          <h2 className="text-xl font-black text-ink">
            {lang === "en" ? "Announcements" : "Annonces"}
          </h2>
          <p className="text-xs text-slate">
            {loading ? "…" : `${items.length} ${lang === "en" ? "announcement(s)" : "annonce(s)"}`}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="card divide-y divide-gray-50">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title={lang === "en" ? "No announcements yet" : "Aucune annonce pour l'instant"}
          description={lang === "en" ? "Check back soon for updates from the school." : "Revenez bientôt pour des mises à jour de l'école."}
        />
      ) : (
        <div className="space-y-3 stagger-children">
          {items.map(a => {
            const title = (lang === "fr" && a.title_fr) ? a.title_fr : a.title_en;
            const body  = (lang === "fr" && a.body_fr)  ? a.body_fr  : a.body_en;
            return (
              <div key={a.id} className="card card-hover p-5 animate-fade-in-up">
                <div className="flex items-start gap-4">
                  <div className="w-9 h-9 rounded-xl bg-orange-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Megaphone className="w-4 h-4 text-brand" strokeWidth={2} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-ink text-base leading-snug mb-1">{title}</h3>
                    <p className="text-sm text-slate leading-relaxed">{body}</p>
                    <div className="flex items-center gap-1.5 mt-3 text-xs text-gray-400">
                      <Calendar className="w-3.5 h-3.5" strokeWidth={2} />
                      <span>{fmt(a.created_at)}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </StudentLayout>
  );
}