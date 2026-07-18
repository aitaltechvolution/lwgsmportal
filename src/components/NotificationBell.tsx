import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Bell, Megaphone, MessageSquare, CheckCheck, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

interface NotifItem {
  id: string;
  kind: "announcement" | "message";
  title: string;
  body: string;
  from?: string;
  timestamp: string;
  is_read: boolean;
}

interface Props {
  role: "student" | "lecturer" | "admin";
  lang: "en" | "fr";
}

export default function NotificationBell({ role, lang }: Props) {
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotifItem[]>([]);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const unreadCount = items.filter((i) => !i.is_read).length;

  const load = async () => {
    if (!profile?.id) return;
    setLoading(true);

    const { data: announcements } = await supabase
      .from("announcements")
      .select("id, title_en, title_fr, body_en, body_fr, created_at")
      .or(`target_role.is.null,target_role.eq.${role},target_role.eq.all`)
      .order("created_at", { ascending: false })
      .limit(5);

    const { data: messages } = await supabase
      .from("messages")
      .select("id, subject, body, sender_id, created_at, is_read, profiles!messages_sender_id_fkey(full_name)")
      .eq("receiver_id", profile.id)
      .eq("is_read", false)
      .order("created_at", { ascending: false })
      .limit(5);

    const notifs: NotifItem[] = [];

    (announcements ?? []).forEach((a: any) => {
      notifs.push({
        id: `ann-${a.id}`,
        kind: "announcement",
        title: lang === "fr" ? (a.title_fr || a.title_en) : a.title_en,
        body: lang === "fr" ? (a.body_fr || a.body_en || "") : (a.body_en || ""),
        timestamp: a.created_at,
        is_read: false,
      });
    });

    (messages ?? []).forEach((m: any) => {
      notifs.push({
        id: `msg-${m.id}`,
        kind: "message",
        title: m.subject || (lang === "fr" ? "Nouveau message" : "New message"),
        body: m.body?.slice(0, 80) || "",
        from: (m.profiles as any)?.full_name ?? "",
        timestamp: m.created_at,
        is_read: m.is_read,
      });
    });

    notifs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    setItems(notifs.slice(0, 5));
    setLoading(false);
  };

  useEffect(() => {
    if (open) load();
  }, [open, profile?.id]);

  useEffect(() => {
    if (!profile?.id) return;
    const channel = supabase
      .channel("notif-bell")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `receiver_id=eq.${profile.id}` }, () => load())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "announcements" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [profile?.id]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const markRead = async (item: NotifItem) => {
    if (item.kind === "message") {
      const msgId = item.id.replace("msg-", "");
      await supabase.from("messages").update({ is_read: true }).eq("id", msgId);
    }
    setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, is_read: true } : i));
  };

  const markAllRead = async () => {
    const msgIds = items.filter((i) => i.kind === "message" && !i.is_read).map((i) => i.id.replace("msg-", ""));
    if (msgIds.length > 0) await supabase.from("messages").update({ is_read: true }).in("id", msgIds);
    setItems((prev) => prev.map((i) => ({ ...i, is_read: true })));
  };

  const fmtTime = (iso: string) => {
    const diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (diff < 60) return lang === "fr" ? "À l'instant" : "Just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}${lang === "fr" ? " min" : "m ago"}`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}${lang === "fr" ? " h" : "h ago"}`;
    return new Date(iso).toLocaleDateString(lang === "fr" ? "fr-FR" : "en-GB", { day: "numeric", month: "short" });
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen((p) => !p)}
        className="relative w-9 h-9 rounded-full hover:bg-gray-50 flex items-center justify-center transition-colors text-gray-400 hover:text-[#0A1628]"
        aria-label="Notifications"
      >
        <Bell className="w-[18px] h-[18px]" strokeWidth={2} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-4 bg-red-500 rounded-full text-[9px] font-black text-white flex items-center justify-center px-0.5 ring-2 ring-white leading-none">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 w-80 bg-white rounded-2xl shadow-2xl shadow-black/10 border border-gray-100 z-50 overflow-hidden" style={{animation:"fadeIn .15s ease"}}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
            <span className="font-bold text-[#0A1628] text-sm">{lang === "fr" ? "Notifications" : "Notifications"}</span>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button onClick={markAllRead} className="text-[11px] text-[#F97316] font-semibold hover:underline flex items-center gap-1">
                  <CheckCheck className="w-3 h-3" strokeWidth={2.5} />
                  {lang === "fr" ? "Tout lire" : "Mark all read"}
                </button>
              )}
              <button onClick={() => setOpen(false)} className="text-gray-300 hover:text-gray-500 transition-colors">
                <X className="w-4 h-4" strokeWidth={2} />
              </button>
            </div>
          </div>

          <div className="max-h-[340px] overflow-y-auto divide-y divide-gray-50">
            {loading ? (
              <div className="px-4 py-6 text-center text-sm text-gray-400">{lang === "fr" ? "Chargement…" : "Loading…"}</div>
            ) : items.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <Bell className="w-7 h-7 text-gray-200 mx-auto mb-2" strokeWidth={1.5} />
                <p className="text-sm text-gray-400 font-medium">{lang === "fr" ? "Aucune notification" : "No notifications"}</p>
              </div>
            ) : items.map((item) => (
              <button key={item.id} onClick={() => markRead(item)} className={`w-full text-left px-4 py-3 hover:bg-gray-50/80 transition-colors ${!item.is_read ? "bg-orange-50/30" : ""}`}>
                <div className="flex items-start gap-3">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${item.kind === "announcement" ? "bg-[#0A1628]/10" : "bg-amber-100"}`}>
                    {item.kind === "announcement"
                      ? <Megaphone className="w-3.5 h-3.5 text-[#0A1628]" strokeWidth={2} />
                      : <MessageSquare className="w-3.5 h-3.5 text-[#F97316]" strokeWidth={2} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-1">
                      <p className={`text-[12px] leading-snug font-semibold truncate ${!item.is_read ? "text-[#0A1628]" : "text-gray-600"}`}>{item.title}</p>
                      {!item.is_read && <span className="w-1.5 h-1.5 bg-[#F97316] rounded-full flex-shrink-0 mt-1" />}
                    </div>
                    {item.from && <p className="text-[10px] text-gray-400 mt-0.5">{lang === "fr" ? "De" : "From"} {item.from}</p>}
                    <p className="text-[11px] text-gray-400 mt-0.5 line-clamp-1">{item.body}</p>
                    <p className="text-[10px] text-gray-300 mt-1">{fmtTime(item.timestamp)}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>

          <div className="border-t border-gray-50 px-4 py-2.5 flex items-center justify-between">
            <Link to={`/${role}/messages`} onClick={() => setOpen(false)} className="text-[11px] font-semibold text-[#0A1628] hover:text-[#F97316] transition-colors">
              {lang === "fr" ? "Voir les messages →" : "View messages →"}
            </Link>
            <Link to={`/${role}/announcements`} onClick={() => setOpen(false)} className="text-[11px] font-semibold text-[#0A1628] hover:text-[#F97316] transition-colors">
              {lang === "fr" ? "Annonces →" : "Announcements →"}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
