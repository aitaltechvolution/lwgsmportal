import { useEffect, useRef, useState, KeyboardEvent } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Search, Send, Plus, X, MessageSquare, Check, CheckCheck } from "lucide-react";

interface Profile { id: string; full_name: string; role: string; }
interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  body: string;
  is_read: boolean;
  created_at: string;
  conversation_id: string | null;
}
interface Conversation {
  partner: Profile;
  lastMsg: string;
  lastTime: string;
  unread: number;
}

interface Props {
  role: "student" | "lecturer" | "admin";
  lang: "en" | "fr";
  /** Roles this user can message */
  allowedRoles: string[];
}

export default function MessagesPane({ role, lang, allowedRoles }: Props) {
  const { profile } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<Profile | null>(null);
  const [thread, setThread] = useState<Message[]>([]);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [searching, setSearching] = useState(false);
  const [showNewMsg, setShowNewMsg] = useState(false);
  const [loadingThread, setLoadingThread] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const loadConversations = async () => {
    if (!profile?.id) return;
    const { data: msgs } = await supabase
      .from("messages")
      .select("id, sender_id, receiver_id, body, is_read, created_at, sender:sender_id(id,full_name,role), receiver:receiver_id(id,full_name,role)")
      .or(`sender_id.eq.${profile.id},receiver_id.eq.${profile.id}`)
      .order("created_at", { ascending: false });

    // Group into conversations by partner
    const convMap = new Map<string, Conversation>();
    (msgs ?? []).forEach((m: any) => {
      const isSent = m.sender_id === profile.id;
      const partner: Profile = isSent ? m.receiver : m.sender;
      if (!partner?.id) return;
      if (convMap.has(partner.id)) {
        const existing = convMap.get(partner.id)!;
        if (!isSent && !m.is_read) existing.unread++;
      } else {
        convMap.set(partner.id, {
          partner,
          lastMsg: m.body ?? "",
          lastTime: m.created_at,
          unread: (!isSent && !m.is_read) ? 1 : 0,
        });
      }
    });
    setConversations(Array.from(convMap.values()));
  };

  const loadThread = async (partner: Profile) => {
    if (!profile?.id) return;
    setLoadingThread(true);
    const { data } = await supabase
      .from("messages")
      .select("*")
      .or(
        `and(sender_id.eq.${profile.id},receiver_id.eq.${partner.id}),and(sender_id.eq.${partner.id},receiver_id.eq.${profile.id})`
      )
      .order("created_at", { ascending: true });
    setThread((data ?? []) as Message[]);
    setLoadingThread(false);
    // Mark received as read
    const unreadIds = (data ?? [])
      .filter((m: any) => m.receiver_id === profile.id && !m.is_read)
      .map((m: any) => m.id);
    if (unreadIds.length > 0) {
      await supabase.from("messages").update({ is_read: true }).in("id", unreadIds);
      loadConversations();
    }
  };

  useEffect(() => {
    loadConversations();
  }, [profile?.id]);

  useEffect(() => {
    if (selected) loadThread(selected);
  }, [selected?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thread]);

  // Realtime subscription
  useEffect(() => {
    if (!profile?.id) return;
    const channel = supabase
      .channel(`messages-pane-${profile.id}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `receiver_id=eq.${profile.id}`,
      }, (payload) => {
        const newMsg = payload.new as Message;
        // If currently viewing that thread, add to it
        if (selected && newMsg.sender_id === selected.id) {
          setThread(prev => [...prev, newMsg]);
          // Mark as read immediately
          supabase.from("messages").update({ is_read: true }).eq("id", newMsg.id);
        }
        loadConversations();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [profile?.id, selected?.id]);

  const handleSearch = async (q: string) => {
    setSearchQuery(q);
    if (!q.trim()) { setSearchResults([]); return; }
    setSearching(true);
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, role")
      .in("role", allowedRoles)
      .neq("id", profile?.id)
      .ilike("full_name", `%${q}%`)
      .limit(8);
    setSearchResults((data ?? []) as Profile[]);
    setSearching(false);
  };

  const startConversation = (partner: Profile) => {
    setSelected(partner);
    setShowNewMsg(false);
    setSearchQuery("");
    setSearchResults([]);
  };

  const sendMessage = async () => {
    if (!body.trim() || !selected || !profile?.id) return;
    setSending(true);
    const { data } = await supabase.from("messages").insert({
      sender_id: profile.id,
      receiver_id: selected.id,
      body: body.trim(),
    }).select().single();
    if (data) {
      setThread(prev => [...prev, data as Message]);
      loadConversations();
    }
    setBody("");
    setSending(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const fmtTime = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 86400000) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    return d.toLocaleDateString(lang === "fr" ? "fr-FR" : "en-GB", { day: "numeric", month: "short" });
  };

  const fmtMsgTime = (iso: string) =>
    new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const avatarInitials = (name: string) =>
    name.split(" ").map(w => w[0]).join("").substring(0, 2).toUpperCase();

  return (
    <div className="flex h-[calc(100vh-7rem)] rounded-2xl overflow-hidden border border-gray-100 shadow-sm bg-white">
      {/* ── LEFT: Conversation List ─────────────────── */}
      <div className={`w-full md:w-80 lg:w-72 flex flex-col border-r border-gray-100 flex-shrink-0 ${selected ? "hidden md:flex" : "flex"}`}>
        {/* Header */}
        <div className="px-4 py-4 border-b border-gray-50">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-ink text-base">
              {lang === "fr" ? "Messages" : "Messages"}
            </h2>
            <button
              onClick={() => setShowNewMsg(true)}
              className="w-8 h-8 bg-brand text-white rounded-full flex items-center justify-center hover:bg-amber-600 transition-colors"
              title={lang === "fr" ? "Nouveau message" : "New message"}
            >
              <Plus className="w-4 h-4" strokeWidth={2.5} />
            </button>
          </div>
        </div>

        {/* New message search */}
        {showNewMsg && (
          <div className="px-3 py-3 border-b border-gray-50 bg-gray-50/50">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-bold text-ink">
                {lang === "fr" ? "Nouveau message à..." : "New message to..."}
              </span>
              <button onClick={() => { setShowNewMsg(false); setSearchQuery(""); setSearchResults([]); }} className="ml-auto text-gray-300 hover:text-gray-500">
                <X className="w-3.5 h-3.5" strokeWidth={2} />
              </button>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-300" strokeWidth={2} />
              <input
                value={searchQuery}
                onChange={e => handleSearch(e.target.value)}
                placeholder={lang === "fr" ? "Rechercher..." : "Search by name..."}
                className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-brand transition-colors"
                autoFocus
              />
            </div>
            {searchResults.length > 0 && (
              <div className="mt-2 bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                {searchResults.map(u => (
                  <button
                    key={u.id}
                    onClick={() => startConversation(u)}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-gray-50 transition-colors text-left"
                  >
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-navy to-blue-800 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                      {avatarInitials(u.full_name)}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-ink">{u.full_name}</div>
                      <div className="text-[11px] text-gray-400 capitalize">{u.role}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {searching && <div className="mt-2 text-center text-xs text-gray-400">{lang === "fr" ? "Recherche..." : "Searching..."}</div>}
          </div>
        )}

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-6 py-12">
              <MessageSquare className="w-10 h-10 text-gray-200 mb-3" strokeWidth={1.5} />
              <p className="text-sm text-gray-400 font-medium">
                {lang === "fr" ? "Aucune conversation" : "No conversations yet"}
              </p>
              <p className="text-xs text-gray-300 mt-1">
                {lang === "fr" ? "Commencez à écrire" : "Start a new message"}
              </p>
            </div>
          ) : conversations.map(conv => (
            <button
              key={conv.partner.id}
              onClick={() => setSelected(conv.partner)}
              className={`w-full flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50/80 transition-colors text-left border-b border-gray-50/70 ${selected?.id === conv.partner.id ? "bg-brand/5 border-l-2 border-l-brand" : ""}`}
            >
              <div className="relative flex-shrink-0">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-navy to-blue-800 flex items-center justify-center text-white text-sm font-bold">
                  {avatarInitials(conv.partner.full_name)}
                </div>
                {conv.unread > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-brand text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                    {conv.unread}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <span className={`text-sm truncate ${conv.unread > 0 ? "font-bold text-ink" : "font-semibold text-ink"}`}>
                    {conv.partner.full_name}
                  </span>
                  <span className="text-[10px] text-gray-400 flex-shrink-0">{fmtTime(conv.lastTime)}</span>
                </div>
                <div className="flex items-center gap-1 mt-0.5">
                  <p className={`text-xs truncate ${conv.unread > 0 ? "text-ink font-medium" : "text-gray-400"}`}>
                    {conv.lastMsg}
                  </p>
                  {conv.unread > 0 && (
                    <span className="w-2 h-2 rounded-full bg-brand flex-shrink-0 ml-auto" />
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ── RIGHT: Thread ───────────────────────────── */}
      <div className={`flex-1 flex flex-col ${selected ? "flex" : "hidden md:flex"}`}>
        {!selected ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
            <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mb-4">
              <MessageSquare className="w-8 h-8 text-gray-200" strokeWidth={1.5} />
            </div>
            <h3 className="font-bold text-ink text-base mb-1">
              {lang === "fr" ? "Sélectionnez une conversation" : "Select a conversation"}
            </h3>
            <p className="text-sm text-gray-400">
              {lang === "fr" ? "Choisissez un contact à gauche ou commencez un nouveau message." : "Pick a contact on the left or start a new message."}
            </p>
          </div>
        ) : (
          <>
            {/* Thread header */}
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-gray-100 bg-white flex-shrink-0">
              <button onClick={() => setSelected(null)} className="md:hidden text-gray-400 hover:text-ink transition-colors mr-1">
                ← 
              </button>
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-navy to-blue-800 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                {avatarInitials(selected.full_name)}
              </div>
              <div>
                <div className="font-bold text-ink text-sm">{selected.full_name}</div>
                <div className="text-[11px] text-gray-400 capitalize">{selected.role}</div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              {loadingThread ? (
                <div className="flex items-center justify-center h-full text-sm text-gray-400">
                  {lang === "fr" ? "Chargement..." : "Loading..."}
                </div>
              ) : thread.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-sm text-gray-400">
                  <MessageSquare className="w-8 h-8 text-gray-200 mb-2" strokeWidth={1.5} />
                  {lang === "fr" ? "Aucun message. Commencez la conversation!" : "No messages yet. Start the conversation!"}
                </div>
              ) : thread.map((msg, i) => {
                const isSent = msg.sender_id === profile?.id;
                const showTime = i === 0 || new Date(thread[i].created_at).getTime() - new Date(thread[i - 1].created_at).getTime() > 300000;
                return (
                  <div key={msg.id}>
                    {showTime && (
                      <div className="text-center mb-2">
                        <span className="text-[10px] text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full">
                          {fmtTime(msg.created_at)}
                        </span>
                      </div>
                    )}
                    <div className={`flex ${isSent ? "justify-end" : "justify-start"}`}>
                      {!isSent && (
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-navy to-blue-800 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mr-2 mt-auto mb-1">
                          {avatarInitials(selected.full_name)}
                        </div>
                      )}
                      <div className={`max-w-[70%] group`}>
                        <div
                          className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                            isSent
                              ? "bg-brand text-white rounded-br-sm"
                              : "bg-navy text-[#E8E4F0] rounded-bl-sm"
                          }`}
                        >
                          {msg.body}
                        </div>
                        <div className={`flex items-center gap-1 mt-1 ${isSent ? "justify-end" : "justify-start"}`}>
                          <span className="text-[10px] text-gray-400">{fmtMsgTime(msg.created_at)}</span>
                          {isSent && (
                            msg.is_read
                              ? <CheckCheck className="w-3 h-3 text-brand" strokeWidth={2} />
                              : <Check className="w-3 h-3 text-gray-300" strokeWidth={2} />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="border-t border-gray-100 px-4 py-3 bg-white flex-shrink-0">
              <div className="flex items-end gap-2">
                <textarea
                  ref={inputRef}
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={lang === "fr" ? "Écrire un message... (Entrée pour envoyer)" : "Write a message… (Enter to send)"}
                  rows={1}
                  className="flex-1 resize-none border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-brand transition-colors max-h-32 overflow-y-auto"
                  style={{ minHeight: "42px" }}
                />
                <button
                  onClick={sendMessage}
                  disabled={!body.trim() || sending}
                  className="w-10 h-10 bg-brand text-white rounded-xl flex items-center justify-center hover:bg-amber-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
                >
                  <Send className="w-4 h-4" strokeWidth={2} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
