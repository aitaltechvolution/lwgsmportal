import { useEffect, useRef, useState, FormEvent } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "react-i18next";
import { Search, Send, Plus, X, Loader2, MessageSquare } from "lucide-react";

interface Profile { id: string; full_name: string; role: string; email: string; }
interface Message { id: string; sender_id: string; receiver_id: string; subject: string | null; body: string; is_read: boolean; created_at: string; }
interface Conversation { otherId: string; otherName: string; otherRole: string; lastMessage: string; lastTime: string; unread: number; }

interface Props { allowedContactRoles: string[]; }

export default function MessagesPage({ allowedContactRoles }: Props) {
  const { profile } = useAuth();
  const { i18n } = useTranslation();
  const lang = (i18n.language.startsWith("fr") ? "fr" : "en") as "en" | "fr";
  const t = (en: string, fr: string) => lang === "fr" ? fr : en;

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [thread, setThread] = useState<Message[]>([]);
  const [threadProfiles, setThreadProfiles] = useState<Record<string, Profile>>({});
  const [newBody, setNewBody] = useState("");
  const [newSubject, setNewSubject] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [loadingThread, setLoadingThread] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [searching, setSearching] = useState(false);
  const [newTarget, setNewTarget] = useState<Profile | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadConversations = async () => {
    if (!profile?.id) return;
    setLoadingConvs(true);
    const { data: sent } = await supabase.from("messages").select("*, profiles!messages_receiver_id_fkey(id,full_name,role)").eq("sender_id", profile.id).order("created_at", { ascending: false });
    const { data: received } = await supabase.from("messages").select("*, profiles!messages_sender_id_fkey(id,full_name,role)").eq("receiver_id", profile.id).order("created_at", { ascending: false });

    const map: Record<string, Conversation> = {};
    (sent ?? []).forEach((m: any) => {
      const other = m.profiles;
      if (!other) return;
      if (!map[other.id] || new Date(m.created_at) > new Date(map[other.id].lastTime))
        map[other.id] = { otherId: other.id, otherName: other.full_name, otherRole: other.role, lastMessage: m.body, lastTime: m.created_at, unread: map[other.id]?.unread ?? 0 };
    });
    (received ?? []).forEach((m: any) => {
      const other = m.profiles;
      if (!other) return;
      if (!map[other.id] || new Date(m.created_at) > new Date(map[other.id].lastTime))
        map[other.id] = { otherId: other.id, otherName: other.full_name, otherRole: other.role, lastMessage: m.body, lastTime: m.created_at, unread: (map[other.id]?.unread ?? 0) + (m.is_read ? 0 : 1) };
      else if (!m.is_read) map[other.id].unread = (map[other.id].unread ?? 0) + 1;
    });
    setConversations(Object.values(map).sort((a, b) => new Date(b.lastTime).getTime() - new Date(a.lastTime).getTime()));
    setLoadingConvs(false);
  };

  const loadThread = async (otherId: string) => {
    if (!profile?.id) return;
    setLoadingThread(true);
    const { data } = await supabase.from("messages").select("*")
      .or(`and(sender_id.eq.${profile.id},receiver_id.eq.${otherId}),and(sender_id.eq.${otherId},receiver_id.eq.${profile.id})`)
      .order("created_at", { ascending: true });
    setThread((data ?? []) as Message[]);
    setLoadingThread(false);
    await supabase.from("messages").update({ is_read: true }).eq("sender_id", otherId).eq("receiver_id", profile.id).eq("is_read", false);
    setConversations(prev => prev.map(c => c.otherId === otherId ? { ...c, unread: 0 } : c));
    const { data: profs } = await supabase.from("profiles").select("id,full_name,role,email").in("id", [profile.id, otherId]);
    const pMap: Record<string, Profile> = {};
    (profs ?? []).forEach((p: any) => { pMap[p.id] = p; });
    setThreadProfiles(pMap);
  };

  useEffect(() => { loadConversations(); }, [profile?.id]);
  useEffect(() => { if (selectedId) loadThread(selectedId); }, [selectedId]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [thread]);

  useEffect(() => {
    if (!profile?.id) return;
    const channel = supabase.channel("messages-rt")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
        const msg = payload.new as Message;
        if (msg.receiver_id === profile.id || msg.sender_id === profile.id) {
          loadConversations();
          const otherId = msg.sender_id === profile.id ? msg.receiver_id : msg.sender_id;
          if (selectedId === otherId) loadThread(otherId);
        }
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [profile?.id, selectedId]);

  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    const timer = setTimeout(async () => {
      setSearching(true);
      const { data, error: sErr } = await supabase
        .from("profiles")
        .select("id,full_name,role,email")
        .or(`full_name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%`)
        .in("role", allowedContactRoles)
        .neq("id", profile?.id ?? "")
        .limit(10);
      if (sErr) console.error("Profile search error:", sErr.message);
      setSearchResults((data ?? []) as Profile[]);
      setSearching(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const sendMessage = async (e: FormEvent) => {
    e.preventDefault();
    const targetId = newTarget?.id ?? selectedId;
    if (!profile?.id || !targetId || !newBody.trim()) return;
    setSending(true);
    await supabase.from("messages").insert({ sender_id: profile.id, receiver_id: targetId, subject: newSubject.trim() || null, body: newBody.trim() });
    setNewBody(""); setNewSubject(""); setSending(false);
    if (newTarget) { setSelectedId(newTarget.id); setShowNew(false); setNewTarget(null); setSearchQuery(""); }
  };

  const fmtTime = (iso: string) => {
    const diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (diff < 86400) return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    return new Date(iso).toLocaleDateString(lang === "fr" ? "fr-FR" : "en-GB", { day: "numeric", month: "short" });
  };
  const initials = (name: string) => name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
  const selectedConv = conversations.find(c => c.otherId === selectedId);

  return (
    <div className="flex h-[calc(100vh-4rem)] -m-4 md:-m-6 overflow-hidden">
      {/* Conversation List */}
      <div className={`w-full md:w-72 lg:w-80 flex-shrink-0 border-r border-gray-100 bg-white flex flex-col ${selectedId ? "hidden md:flex" : "flex"}`}>
        <div className="px-4 py-4 border-b border-gray-50">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-black text-[#0A1628] text-base">{t("Messages","Messages")}</h2>
            <button onClick={() => { setShowNew(true); setSelectedId(null); }} className="w-8 h-8 rounded-full bg-[#F97316] text-white flex items-center justify-center hover:bg-amber-600 transition-colors"><Plus className="w-4 h-4" strokeWidth={2.5} /></button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
          {loadingConvs ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3.5">
                <div className="skeleton w-10 h-10 rounded-full flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="skeleton h-3.5 w-2/3" />
                  <div className="skeleton h-3 w-1/2" />
                </div>
              </div>
            ))
          ) : conversations.length === 0 ? (
            <div className="p-8 text-center">
              <MessageSquare className="w-8 h-8 text-gray-200 mx-auto mb-2" strokeWidth={1.5} />
              <p className="text-sm text-gray-400 font-medium">{t("No conversations yet","Aucune conversation")}</p>
              <button onClick={() => setShowNew(true)} className="mt-3 text-xs text-[#F97316] font-semibold hover:underline">{t("Start a conversation","Démarrer une conversation")}</button>
            </div>
          ) : conversations.map(conv => (
            <button key={conv.otherId} onClick={() => { setSelectedId(conv.otherId); setShowNew(false); }}
              className={`w-full text-left px-4 py-3.5 hover:bg-gray-50 transition-colors ${selectedId === conv.otherId ? "bg-orange-50 border-r-2 border-[#F97316]" : ""}`}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#0A1628] to-[#1E3A5F] flex items-center justify-center text-white font-black text-xs flex-shrink-0">{initials(conv.otherName)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className={`text-sm font-semibold truncate ${conv.unread > 0 ? "text-[#0A1628]" : "text-gray-700"}`}>{conv.otherName}</span>
                    <span className="text-[10px] text-gray-400 flex-shrink-0">{fmtTime(conv.lastTime)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-1 mt-0.5">
                    <p className="text-[12px] text-gray-400 truncate">{conv.lastMessage}</p>
                    {conv.unread > 0 && <span className="w-4 h-4 bg-[#F97316] rounded-full text-[9px] text-white font-black flex items-center justify-center flex-shrink-0">{conv.unread}</span>}
                  </div>
                  <span className="text-[10px] text-[#0A1628]/40 capitalize">{conv.otherRole}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Thread / New */}
      <div className={`flex-1 flex flex-col bg-[#FAFBFC] ${!selectedId && !showNew ? "hidden md:flex" : "flex"}`}>
        {showNew ? (
          <div className="flex flex-col h-full">
            <div className="bg-white border-b border-gray-100 px-4 py-3.5 flex items-center gap-3">
              <button onClick={() => setShowNew(false)} className="text-gray-400 hover:text-[#0A1628] md:hidden"><X className="w-5 h-5" strokeWidth={2} /></button>
              <h3 className="font-bold text-[#0A1628]">{t("New Message","Nouveau Message")}</h3>
            </div>
            <div className="flex-1 p-4 md:p-6 overflow-y-auto">
              <div className="max-w-xl mx-auto space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">{t("To","À")}</label>
                  {newTarget ? (
                    <div className="flex items-center gap-2 bg-orange-50 border border-amber-200 rounded-xl px-3 py-2.5">
                      <div className="w-6 h-6 rounded-full bg-[#0A1628] text-white text-[10px] font-black flex items-center justify-center">{initials(newTarget.full_name)}</div>
                      <span className="text-sm font-semibold text-[#0A1628] flex-1">{newTarget.full_name}</span>
                      <span className="text-[10px] text-gray-400 capitalize">{newTarget.role}</span>
                      <button onClick={() => setNewTarget(null)}><X className="w-3.5 h-3.5 text-gray-400" strokeWidth={2} /></button>
                    </div>
                  ) : (
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" strokeWidth={2} />
                      <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                        placeholder={t("Search by name…","Rechercher par nom…")}
                        className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/20 focus:border-[#F97316] bg-white" />
                      {(searching || searchResults.length > 0) && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl border border-gray-100 shadow-lg z-10 overflow-hidden">
                          {searching ? <div className="px-4 py-3 text-sm text-gray-400 flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" />{t("Searching…","Recherche…")}</div>
                          : searchResults.length === 0 && !searching && searchQuery.length >= 2 ? (
                            <div className="px-4 py-3 text-sm text-gray-400 text-center">
                              {lang === "en" ? "No contacts found." : "Aucun contact trouvé."}
                            </div>
                          ) : searchResults.map(p => (
                            <button key={p.id} onClick={() => { setNewTarget(p); setSearchQuery(""); setSearchResults([]); }}
                              className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center gap-3 border-b border-gray-50 last:border-0">
                              <div className="w-7 h-7 rounded-full bg-[#0A1628] text-white text-[10px] font-black flex items-center justify-center">{initials(p.full_name)}</div>
                              <div><p className="text-sm font-semibold text-[#0A1628]">{p.full_name}</p><p className="text-[11px] text-gray-400 capitalize">{p.role} · {p.email}</p></div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">{t("Subject (optional)","Objet (optionnel)")}</label>
                  <input type="text" value={newSubject} onChange={e => setNewSubject(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/20 focus:border-[#F97316] bg-white" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">{t("Message","Message")}</label>
                  <textarea rows={6} value={newBody} onChange={e => setNewBody(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/20 focus:border-[#F97316] bg-white resize-none" />
                </div>
                <button onClick={sendMessage} disabled={sending || !newTarget || !newBody.trim()}
                  className="flex items-center gap-2 px-5 py-2.5 bg-[#F97316] text-white font-bold rounded-xl hover:bg-amber-600 transition-colors disabled:opacity-50">
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2.5} /> : <Send className="w-4 h-4" strokeWidth={2.5} />}
                  {t("Send","Envoyer")}
                </button>
              </div>
            </div>
          </div>
        ) : selectedId ? (
          <div className="flex flex-col h-full">
            <div className="bg-white border-b border-gray-100 px-4 py-3.5 flex items-center gap-3 flex-shrink-0">
              <button onClick={() => setSelectedId(null)} className="text-gray-400 hover:text-[#0A1628] md:hidden"><X className="w-5 h-5" strokeWidth={2} /></button>
              {selectedConv && (
                <>
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#0A1628] to-[#1E3A5F] flex items-center justify-center text-white font-black text-xs">{initials(selectedConv.otherName)}</div>
                  <div><p className="font-bold text-[#0A1628] text-sm">{selectedConv.otherName}</p><p className="text-[11px] text-gray-400 capitalize">{selectedConv.otherRole}</p></div>
                </>
              )}
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              {loadingThread ? (
                <div className="space-y-3">
                  {[0, 1, 2].map(i => (
                    <div key={i} className={`flex ${i % 2 === 0 ? "justify-start" : "justify-end"}`}>
                      <div className={`skeleton h-10 rounded-2xl ${i % 2 === 0 ? "w-1/2" : "w-2/5"}`} />
                    </div>
                  ))}
                </div>
              )
              : thread.map(msg => {
                const isMine = msg.sender_id === profile?.id;
                const sender = threadProfiles[msg.sender_id];
                return (
                  <div key={msg.id} className={`flex items-end gap-2 ${isMine ? "flex-row-reverse" : "flex-row"}`}>
                    {!isMine && <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#0A1628] to-[#1E3A5F] flex items-center justify-center text-white font-black text-[10px] flex-shrink-0 mb-1">{sender ? initials(sender.full_name) : "?"}</div>}
                    <div className={`max-w-[72%] flex flex-col gap-1 ${isMine ? "items-end" : "items-start"}`}>
                      {msg.subject && <p className={`text-[10px] font-bold uppercase tracking-wide ${isMine ? "text-amber-300" : "text-gray-400"}`}>{msg.subject}</p>}
                      <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${isMine ? "bg-[#F97316] text-white rounded-br-md" : "bg-[#0A1628] text-[#C8D4E8] rounded-bl-md"}`}>{msg.body}</div>
                      <p className={`text-[10px] text-gray-400 ${isMine ? "text-right" : ""}`}>{fmtTime(msg.created_at)}</p>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>
            <div className="bg-white border-t border-gray-100 px-4 py-3 flex-shrink-0">
              <form onSubmit={sendMessage} className="flex items-end gap-2">
                <textarea rows={2} value={newBody} onChange={e => setNewBody(e.target.value)}
                  placeholder={t("Type a message…","Écrire un message…")}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(e as any); } }}
                  className="flex-1 px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/20 focus:border-[#F97316] resize-none" />
                <button type="submit" disabled={sending || !newBody.trim()}
                  className="w-10 h-10 rounded-full bg-[#F97316] text-white flex items-center justify-center hover:bg-amber-600 transition-colors disabled:opacity-50 flex-shrink-0">
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2.5} /> : <Send className="w-4 h-4" strokeWidth={2.5} />}
                </button>
              </form>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4"><MessageSquare className="w-8 h-8 text-gray-300" strokeWidth={1.5} /></div>
              <p className="font-bold text-gray-500 text-base">{t("Select a conversation","Sélectionnez une conversation")}</p>
              <p className="text-sm text-gray-400 mt-1">{t("or start a new one","ou démarrez-en une nouvelle")}</p>
              <button onClick={() => setShowNew(true)} className="mt-4 px-4 py-2 bg-[#F97316] text-white text-sm font-bold rounded-xl hover:bg-amber-600 transition-colors">{t("New Message","Nouveau Message")}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
