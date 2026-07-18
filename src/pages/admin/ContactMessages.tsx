import { useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { supabase } from "@/lib/supabase";
import { useTranslation } from "react-i18next";
import { MessageSquare, Mail, Clock, CheckCircle2, Archive, Trash2 } from "lucide-react";
import { Badge, EmptyState, SkeletonRow } from "@/components/ui/primitives";
import { useConfirm } from "@/contexts/ConfirmContext";
import { useToast } from "@/contexts/ToastContext";

interface ContactMsg {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: "new" | "read" | "replied" | "archived";
  created_at: string;
}

const STATUS_COLOR: Record<string, "orange" | "blue" | "green" | "gray"> = {
  new: "orange", read: "blue", replied: "green", archived: "gray",
};

export default function AdminContactMessages() {
  const { i18n } = useTranslation();
  const lang = i18n.language.startsWith("fr") ? "fr" : "en";
  const confirm = useConfirm();
  const { showToast } = useToast();

  const [messages, setMessages] = useState<ContactMsg[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "new" | "read" | "replied">("all");

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("contact_messages")
      .select("id,name,email,subject,message,status,created_at")
      .order("created_at", { ascending: false });
    setMessages((data ?? []) as ContactMsg[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const updateStatus = async (id: string, status: ContactMsg["status"]) => {
    setMessages(prev => prev.map(m => m.id === id ? { ...m, status } : m));
    await supabase.from("contact_messages").update({ status }).eq("id", id);
    showToast("success", lang === "en" ? `Marked as ${status}` : `Marqué comme ${status}`);
  };

  const onDelete = async (m: ContactMsg) => {
    const ok = await confirm({
      title: lang === "en" ? "Delete message?" : "Supprimer le message ?",
      message: lang === "en" ? `From ${m.name} — this cannot be undone.` : `De ${m.name} — irréversible.`,
      confirmLabel: lang === "en" ? "Delete" : "Supprimer",
      tone: "danger",
    });
    if (!ok) return;
    setMessages(prev => prev.filter(x => x.id !== m.id));
    await supabase.from("contact_messages").delete().eq("id", m.id);
    showToast("info", lang === "en" ? "Message deleted." : "Message supprimé.");
  };

  const filtered = filter === "all" ? messages : messages.filter(m => m.status === filter);
  const newCount = messages.filter(m => m.status === "new").length;

  const fmt = (iso: string) => new Date(iso).toLocaleDateString(
    lang === "fr" ? "fr-FR" : "en-GB",
    { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }
  );

  return (
    <AdminLayout title={lang === "en" ? "Contact Messages" : "Messages de Contact"}>
      <div className="flex items-center justify-between gap-4 mb-6 animate-fade-in-up flex-wrap">
        <div>
          <h2 className="text-2xl font-black text-ink flex items-center gap-2">
            {lang === "en" ? "Contact Messages" : "Messages de Contact"}
            {newCount > 0 && (
              <span className="bg-brand text-white text-xs font-black px-2 py-0.5 rounded-full">{newCount}</span>
            )}
          </h2>
          <p className="text-sm text-slate mt-0.5">{messages.length} {lang === "en" ? "message(s) from the public contact form" : "message(s) du formulaire de contact public"}</p>
        </div>
        {/* Filter tabs */}
        <div className="flex gap-1.5">
          {(["all","new","read","replied"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-colors ${filter === f ? "bg-navy text-white" : "bg-gray-100 text-slate hover:bg-gray-200"}`}>
              {f}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="card divide-y divide-gray-50">{Array.from({length:4}).map((_,i)=><SkeletonRow key={i}/>)}</div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={MessageSquare} title={lang === "en" ? "No messages yet" : "Aucun message"} />
      ) : (
        <div className="space-y-3 stagger-children">
          {filtered.map(m => (
            <div key={m.id} className={`card overflow-hidden transition-all duration-200 ${m.status === "new" ? "border-l-4 border-l-amber-400" : ""}`}>
              <div className="px-5 py-4 flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-navy/5 flex items-center justify-center flex-shrink-0">
                  <Mail className="w-5 h-5 text-navy" strokeWidth={1.75} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-bold text-ink text-sm">{m.name}</span>
                    <Badge color={STATUS_COLOR[m.status] ?? "gray"}>{m.status}</Badge>
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" strokeWidth={2}/>{fmt(m.created_at)}
                    </span>
                  </div>
                  <p className="text-xs text-slate mb-0.5">{m.email}</p>
                  <p className="text-sm font-semibold text-ink">{m.subject}</p>
                  {expanded === m.id ? (
                    <div className="mt-3">
                      <p className="text-sm text-ink leading-relaxed whitespace-pre-wrap bg-gray-50 rounded-xl p-4 border border-gray-100">{m.message}</p>
                      <div className="flex gap-2 mt-3 flex-wrap">
                        <a href={`mailto:${m.email}?subject=Re: ${m.subject}`}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-navy text-white text-xs font-bold hover:bg-navy/90 transition-colors">
                          <Mail className="w-3.5 h-3.5" strokeWidth={2}/>
                          {lang === "en" ? "Reply via Email" : "Répondre par E-mail"}
                        </a>
                        {m.status !== "replied" && (
                          <button onClick={() => updateStatus(m.id, "replied")}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-50 text-green-700 border border-green-200 text-xs font-bold hover:bg-green-100 transition-colors">
                            <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={2}/>
                            {lang === "en" ? "Mark Replied" : "Marquer Répondu"}
                          </button>
                        )}
                        {m.status !== "archived" && (
                          <button onClick={() => updateStatus(m.id, "archived")}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-50 text-gray-600 border border-gray-200 text-xs font-bold hover:bg-gray-100 transition-colors">
                            <Archive className="w-3.5 h-3.5" strokeWidth={2}/>
                            {lang === "en" ? "Archive" : "Archiver"}
                          </button>
                        )}
                        <button onClick={() => onDelete(m)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 text-red-600 border border-red-200 text-xs font-bold hover:bg-red-100 transition-colors ml-auto">
                          <Trash2 className="w-3.5 h-3.5" strokeWidth={2}/>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-slate mt-1 line-clamp-2">{m.message}</p>
                  )}
                </div>
                <button
                  onClick={() => {
                    setExpanded(expanded === m.id ? null : m.id);
                    if (m.status === "new") updateStatus(m.id, "read");
                  }}
                  className="flex-shrink-0 text-xs font-bold text-navy hover:text-brand transition-colors"
                >
                  {expanded === m.id ? (lang === "en" ? "Close" : "Fermer") : (lang === "en" ? "Read" : "Lire")}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </AdminLayout>
  );
}
