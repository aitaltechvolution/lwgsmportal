import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import LecturerLayout from "@/components/LecturerLayout";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "react-i18next";
import {
  Users, Plus, CheckCircle2, XCircle, Clock, Lock, Unlock,
  Calendar, Loader2, RefreshCw,
} from "lucide-react";
import { Badge, EmptyState, SkeletonRow } from "@/components/ui/primitives";
import { useToast } from "@/contexts/ToastContext";
import { useConfirm } from "@/contexts/ConfirmContext";

interface Session {
  id: string;
  course_id: string;
  title: string;
  opens_at: string;
  closes_at: string | null;
  is_open: boolean;
  created_at: string;
  logs?: AttLog[];
}

interface AttLog {
  id: string;
  student_id: string;
  logged_at: string;
  status: "pending" | "approved" | "rejected";
  profiles?: { full_name: string; email: string };
}

export default function LecturerAttendance() {
  const { id: courseId } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const { i18n } = useTranslation();
  const lang = i18n.language.startsWith("fr") ? "fr" : "en";
  const { showToast } = useToast();
  const confirm = useConfirm();

  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [durationMins, setDurationMins] = useState("30");
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = async () => {
    if (!courseId) return;
    setLoading(true);
    const { data } = await supabase
      .from("attendance_sessions")
      .select("*, attendance_logs(*, profiles:student_id(full_name, email))")
      .eq("course_id", courseId)
      .order("created_at", { ascending: false });
    setSessions((data ?? []) as Session[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [courseId]);

  const createSession = async () => {
    if (!courseId || !profile?.id || !newTitle.trim()) return;
    setCreating(true);
    const closesAt = durationMins
      ? new Date(Date.now() + Number(durationMins) * 60000).toISOString()
      : null;
    const { error } = await supabase.from("attendance_sessions").insert({
      course_id: courseId,
      lecturer_id: profile.id,
      title: newTitle.trim(),
      closes_at: closesAt,
      is_open: true,
    });
    if (error) {
      showToast("error", error.message);
    } else {
      showToast("success", lang === "en" ? "Attendance session opened!" : "Session de présence ouverte !");
      setNewTitle("");
      load();
    }
    setCreating(false);
  };

  const toggleSession = async (s: Session) => {
    const next = !s.is_open;
    await supabase.from("attendance_sessions").update({ is_open: next }).eq("id", s.id);
    setSessions(prev => prev.map(x => x.id === s.id ? { ...x, is_open: next } : x));
    showToast("info", next
      ? (lang === "en" ? "Session reopened." : "Session rouverte.")
      : (lang === "en" ? "Session closed." : "Session fermée."));
  };

  const updateLog = async (logId: string, sessionId: string, status: "approved" | "rejected") => {
    await supabase.from("attendance_logs").update({ status }).eq("id", logId);
    setSessions(prev => prev.map(s => s.id !== sessionId ? s : {
      ...s,
      logs: (s.logs ?? []).map(l => l.id === logId ? { ...l, status } : l),
    }));
    showToast("success", status === "approved"
      ? (lang === "en" ? "Attendance approved." : "Présence approuvée.")
      : (lang === "en" ? "Attendance rejected." : "Présence rejetée."));
  };

  const fmt = (iso: string) => new Date(iso).toLocaleString(
    lang === "fr" ? "fr-FR" : "en-GB",
    { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }
  );

  return (
    <LecturerLayout breadcrumbs={[
      { label: lang === "en" ? "My Courses" : "Mes Cours", to: "/lecturer/courses" },
      { label: lang === "en" ? "Attendance" : "Présence" },
    ]}>
      {/* Create session */}
      <div className="card p-5 mb-6 animate-fade-in-up">
        <h3 className="font-bold text-ink mb-4 flex items-center gap-2">
          <Plus className="w-4 h-4 text-navy" strokeWidth={2.5} />
          {lang === "en" ? "Open New Attendance Session" : "Ouvrir une Nouvelle Session de Présence"}
        </h3>
        <div className="flex gap-3 flex-wrap">
          <input
            type="text"
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            placeholder={lang === "en" ? "Session title e.g. Week 3 Class" : "Ex. Cours Semaine 3"}
            className="input flex-1 min-w-48"
          />
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-gray-400" strokeWidth={2} />
            <select value={durationMins} onChange={e => setDurationMins(e.target.value)} className="input w-40">
              <option value="">{lang === "en" ? "No time limit" : "Sans limite"}</option>
              <option value="10">10 min</option>
              <option value="15">15 min</option>
              <option value="30">30 min</option>
              <option value="60">1 hour</option>
              <option value="120">2 hours</option>
            </select>
          </div>
          <button onClick={createSession} disabled={creating || !newTitle.trim()} className="btn-primary disabled:opacity-60">
            {creating ? <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2.5} /> : <Plus className="w-4 h-4" strokeWidth={2.5} />}
            {lang === "en" ? "Open Session" : "Ouvrir"}
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          {lang === "en"
            ? "Once opened, enrolled students will see a button to mark their attendance. You can approve or reject each entry."
            : "Une fois ouverte, les étudiants inscrits verront un bouton pour marquer leur présence. Vous pouvez approuver ou rejeter chaque entrée."}
        </p>
      </div>

      {/* Sessions list */}
      {loading ? (
        <div className="card divide-y divide-gray-50">{Array.from({length:3}).map((_,i)=><SkeletonRow key={i}/>)}</div>
      ) : sessions.length === 0 ? (
        <EmptyState icon={Calendar} title={lang === "en" ? "No attendance sessions yet" : "Aucune session de présence"} />
      ) : (
        <div className="space-y-4 stagger-children">
          {sessions.map(s => {
            const logs = s.logs ?? [];
            const pending = logs.filter(l => l.status === "pending").length;
            const approved = logs.filter(l => l.status === "approved").length;
            return (
              <div key={s.id} className={`card overflow-hidden ${s.is_open ? "border-l-4 border-l-green-400" : "border-l-4 border-l-gray-200"}`}>
                <div className="px-5 py-4 flex items-center gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h4 className="font-bold text-ink text-sm">{s.title}</h4>
                      <Badge color={s.is_open ? "green" : "gray"}>
                        {s.is_open ? (lang === "en" ? "Open" : "Ouverte") : (lang === "en" ? "Closed" : "Fermée")}
                      </Badge>
                      {pending > 0 && <Badge color="orange">{pending} {lang === "en" ? "pending" : "en attente"}</Badge>}
                    </div>
                    <p className="text-xs text-gray-400">
                      {lang === "en" ? "Opened" : "Ouverte"}: {fmt(s.opens_at)}
                      {s.closes_at && ` · ${lang === "en" ? "Closes" : "Ferme"}: ${fmt(s.closes_at)}`}
                      {` · ${approved}/${logs.length} ${lang === "en" ? "approved" : "approuvés"}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => load()} className="text-gray-400 hover:text-navy p-1.5 transition-colors" title="Refresh">
                      <RefreshCw className="w-4 h-4" strokeWidth={2} />
                    </button>
                    <button onClick={() => toggleSession(s)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${s.is_open ? "bg-red-50 text-red-600 border border-red-200 hover:bg-red-100" : "bg-green-50 text-green-600 border border-green-200 hover:bg-green-100"}`}>
                      {s.is_open ? <Lock className="w-3.5 h-3.5" strokeWidth={2}/> : <Unlock className="w-3.5 h-3.5" strokeWidth={2}/>}
                      {s.is_open ? (lang === "en" ? "Close" : "Fermer") : (lang === "en" ? "Reopen" : "Rouvrir")}
                    </button>
                    <button onClick={() => setExpanded(expanded === s.id ? null : s.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-navy/5 text-navy border border-navy/10 hover:bg-navy/10 transition-colors">
                      <Users className="w-3.5 h-3.5" strokeWidth={2}/>
                      {lang === "en" ? "View Logs" : "Voir les Logs"}
                    </button>
                  </div>
                </div>

                {expanded === s.id && (
                  <div className="border-t border-gray-100">
                    {logs.length === 0 ? (
                      <p className="text-sm text-gray-400 text-center py-6">
                        {lang === "en" ? "No students have marked attendance yet." : "Aucun étudiant n'a encore marqué sa présence."}
                      </p>
                    ) : (
                      <div className="divide-y divide-gray-50">
                        {logs.map(l => (
                          <div key={l.id} className="flex items-center gap-4 px-5 py-3">
                            <div className="w-8 h-8 rounded-full bg-navy flex items-center justify-center text-white font-black text-xs flex-shrink-0">
                              {(l.profiles?.full_name ?? "?").charAt(0)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-ink text-sm">{l.profiles?.full_name ?? "Unknown"}</p>
                              <p className="text-xs text-gray-400">{l.profiles?.email} · {fmt(l.logged_at)}</p>
                            </div>
                            <Badge color={l.status === "approved" ? "green" : l.status === "rejected" ? "red" : "orange"}>
                              {l.status}
                            </Badge>
                            {l.status === "pending" && (
                              <div className="flex gap-1.5 flex-shrink-0">
                                <button onClick={() => updateLog(l.id, s.id, "approved")}
                                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-green-50 text-green-600 hover:bg-green-100 transition-colors">
                                  <CheckCircle2 className="w-4 h-4" strokeWidth={2.5}/>
                                </button>
                                <button onClick={() => updateLog(l.id, s.id, "rejected")}
                                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors">
                                  <XCircle className="w-4 h-4" strokeWidth={2.5}/>
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </LecturerLayout>
  );
}
