import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import LecturerLayout from "@/components/LecturerLayout";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "react-i18next";
import {
  Users, Plus, CheckCircle2, XCircle, Clock, Lock, Unlock,
  Calendar, Loader2, RefreshCw, CheckCheck, UserPlus, MapPin,
} from "lucide-react";
import { Badge, EmptyState, SkeletonRow } from "@/components/ui/primitives";
import { useToast } from "@/contexts/ToastContext";
import { useConfirm } from "@/contexts/ConfirmContext";

interface Course {
  id: string;
  title: string;
  title_fr: string | null;
  code: string | null;
}

interface RosterStudent {
  id: string;
  full_name: string;
  email: string;
}

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
  method: "self" | "lecturer";
  profiles?: { full_name: string; email: string };
}

export default function LecturerAttendance() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { profile } = useAuth();
  const { i18n } = useTranslation();
  const lang = i18n.language.startsWith("fr") ? "fr" : "en";
  const { showToast } = useToast();
  const confirm = useConfirm();

  const [courses, setCourses] = useState<Course[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(true);
  const [courseId, setCourseId] = useState<string>(searchParams.get("course") ?? "");
  const [roster, setRoster] = useState<RosterStudent[]>([]);

  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [durationMins, setDurationMins] = useState("30");
  const [customCloseAt, setCustomCloseAt] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [confirmingAll, setConfirmingAll] = useState<string | null>(null);
  const [markingOnsite, setMarkingOnsite] = useState<string | null>(null);

  // Load lecturer's courses once
  useEffect(() => {
    if (!profile?.id) return;
    supabase.from("courses").select("id, title, title_fr, code").eq("lecturer_id", profile.id).order("title")
      .then(({ data }) => {
        const list = (data ?? []) as Course[];
        setCourses(list);
        setCoursesLoading(false);
        const fromUrl = searchParams.get("course");
        if (fromUrl && list.some(c => c.id === fromUrl)) setCourseId(fromUrl);
        else if (!courseId && list.length > 0) setCourseId(list[0].id);
      });
  }, [profile?.id]);

  useEffect(() => {
    if (courseId) setSearchParams(prev => { const p = new URLSearchParams(prev); p.set("course", courseId); return p; }, { replace: true });
  }, [courseId]);

  const closeExpiredSessions = async (list: Session[]) => {
    const now = Date.now();
    const expired = list.filter(s => s.is_open && s.closes_at && new Date(s.closes_at).getTime() <= now);
    if (expired.length === 0) return list;
    await supabase.from("attendance_sessions").update({ is_open: false }).in("id", expired.map(s => s.id));
    return list.map(s => expired.some(e => e.id === s.id) ? { ...s, is_open: false } : s);
  };

  const load = async () => {
    if (!courseId) { setSessions([]); setLoading(false); return; }
    setLoading(true);
    const [{ data: sessionData }, { data: enrollData }] = await Promise.all([
      supabase.from("attendance_sessions")
        .select("*, attendance_logs(*, profiles:student_id(full_name, email))")
        .eq("course_id", courseId)
        .order("created_at", { ascending: false }),
      supabase.from("enrollments")
        .select("student_id, profiles:student_id(full_name, email)")
        .eq("course_id", courseId)
        .eq("status", "active"),
    ]);

    const normalized = ((sessionData ?? []) as any[]).map(s => ({
      ...s,
      logs: (s.attendance_logs ?? []) as AttLog[],
    })) as Session[];

    const closed = await closeExpiredSessions(normalized);
    setSessions(closed);
    setRoster(((enrollData ?? []) as any[]).map(e => ({
      id: e.student_id,
      full_name: e.profiles?.full_name ?? "—",
      email: e.profiles?.email ?? "",
    })));
    setLoading(false);
  };

  useEffect(() => { load(); }, [courseId]);

  const isLive = (s: Session) => s.is_open && (!s.closes_at || new Date(s.closes_at).getTime() > Date.now());

  const createSession = async () => {
    if (!courseId || !profile?.id || !newTitle.trim()) return;
    setCreating(true);
    let closesAt: string | null = null;
    if (durationMins === "custom") {
      closesAt = customCloseAt ? new Date(customCloseAt).toISOString() : null;
    } else if (durationMins) {
      closesAt = new Date(Date.now() + Number(durationMins) * 60000).toISOString();
    }
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
      setDurationMins("30");
      setCustomCloseAt("");
      load();
    }
    setCreating(false);
  };

  const toggleSession = async (s: Session) => {
    const next = !s.is_open;
    if (!next) {
      const ok = await confirm({
        title: lang === "en" ? "Close this session?" : "Fermer cette session ?",
        message: lang === "en"
          ? "Students will no longer be able to check themselves in. You can still confirm or mark attendance manually afterward."
          : "Les étudiants ne pourront plus se connecter. Vous pourrez toujours confirmer ou marquer la présence manuellement ensuite.",
        confirmLabel: lang === "en" ? "Close Session" : "Fermer",
        cancelLabel: lang === "en" ? "Cancel" : "Annuler",
        tone: "warning",
      });
      if (!ok) return;
    }
    await supabase.from("attendance_sessions").update({ is_open: next }).eq("id", s.id);
    setSessions(prev => prev.map(x => x.id === s.id ? { ...x, is_open: next } : x));
    showToast("info", next
      ? (lang === "en" ? "Session reopened." : "Session rouverte.")
      : (lang === "en" ? "Session closed." : "Session fermée."));
  };

  const updateLog = async (logId: string, sessionId: string, status: "approved" | "rejected") => {
    await supabase.from("attendance_logs")
      .update({ status, confirmed_by: profile?.id, confirmed_at: new Date().toISOString() })
      .eq("id", logId);
    setSessions(prev => prev.map(s => s.id !== sessionId ? s : {
      ...s,
      logs: (s.logs ?? []).map(l => l.id === logId ? { ...l, status } : l),
    }));
    showToast("success", status === "approved"
      ? (lang === "en" ? "Attendance approved." : "Présence approuvée.")
      : (lang === "en" ? "Attendance rejected." : "Présence rejetée."));
  };

  const confirmAll = async (session: Session) => {
    const pending = (session.logs ?? []).filter(l => l.status === "pending");
    if (pending.length === 0) return;
    setConfirmingAll(session.id);
    const { error } = await supabase.from("attendance_logs")
      .update({ status: "approved", confirmed_by: profile?.id, confirmed_at: new Date().toISOString() })
      .eq("session_id", session.id)
      .eq("status", "pending");
    if (error) {
      showToast("error", error.message);
    } else {
      setSessions(prev => prev.map(s => s.id !== session.id ? s : {
        ...s,
        logs: (s.logs ?? []).map(l => l.status === "pending" ? { ...l, status: "approved" as const } : l),
      }));
      showToast("success", lang === "en"
        ? `${pending.length} student(s) confirmed present.`
        : `${pending.length} étudiant(s) confirmé(s) présent(s).`);
    }
    setConfirmingAll(null);
  };

  // Mark a roster student present directly — for onsite / walk-in
  // students who have no device to self check-in with.
  const markOnsite = async (session: Session, studentId: string) => {
    if (!profile?.id) return;
    setMarkingOnsite(`${session.id}-${studentId}`);
    // Uses an upsert RPC (ON CONFLICT session_id+student_id DO UPDATE)
    // instead of a plain insert — a plain insert would throw a duplicate
    // key violation whenever a log already exists for this student in
    // this session (e.g. they'd already self-checked-in as pending).
    const { error } = await supabase.rpc("mark_attendance_onsite", {
      p_session_id: session.id,
      p_student_id: studentId,
      p_course_id: session.course_id,
      p_marked_by: profile.id,
    });
    if (error) {
      showToast("error", error.message);
    } else {
      load();
      showToast("success", lang === "en" ? "Marked present." : "Marqué présent(e).");
    }
    setMarkingOnsite(null);
  };

  const fmt = (iso: string) => new Date(iso).toLocaleString(
    lang === "fr" ? "fr-FR" : "en-GB",
    { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }
  );

  const courseLabel = (c: Course) => (lang === "fr" && c.title_fr) ? c.title_fr : c.title;

  return (
    <LecturerLayout breadcrumbs={[{ label: lang === "en" ? "Attendance" : "Présence" }]}>
      {/* Course selector */}
      <div className="flex items-center gap-3 mb-6 flex-wrap animate-fade-in-up">
        <div className="w-10 h-10 rounded-xl bg-navy/5 flex items-center justify-center flex-shrink-0">
          <Calendar className="w-5 h-5 text-navy" strokeWidth={2} />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-black text-ink">{lang === "en" ? "Attendance" : "Présence"}</h2>
          <p className="text-xs text-slate">
            {lang === "en" ? "Open live sessions, confirm students, and take onsite roll call." : "Ouvrez des sessions en direct, confirmez les étudiants et faites l'appel sur place."}
          </p>
        </div>
        {!coursesLoading && courses.length > 0 && (
          <select value={courseId} onChange={e => setCourseId(e.target.value)} className="input w-64">
            {courses.map(c => <option key={c.id} value={c.id}>{courseLabel(c)}{c.code ? ` · ${c.code}` : ""}</option>)}
          </select>
        )}
      </div>

      {coursesLoading ? (
        <div className="card divide-y divide-gray-50">{Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} />)}</div>
      ) : courses.length === 0 ? (
        <EmptyState icon={Calendar} title={lang === "en" ? "You have no courses yet" : "Vous n'avez encore aucun cours"} />
      ) : (
        <>
          {/* Create session */}
          <div className="card p-5 mb-6 animate-fade-in-up">
            <h3 className="font-bold text-ink mb-4 flex items-center gap-2">
              <Plus className="w-4 h-4 text-navy" strokeWidth={2.5} />
              {lang === "en" ? "Open New Attendance Session" : "Ouvrir une Nouvelle Session de Présence"}
            </h3>
            <div className="flex gap-3 flex-wrap items-start">
              <input
                type="text"
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                placeholder={lang === "en" ? "Session title e.g. Week 3 Class" : "Ex. Cours Semaine 3"}
                className="input flex-1 min-w-48"
              />
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-gray-400" strokeWidth={2} />
                <select value={durationMins} onChange={e => setDurationMins(e.target.value)} className="input w-44">
                  <option value="">{lang === "en" ? "No time limit" : "Sans limite"}</option>
                  <option value="10">10 min</option>
                  <option value="15">15 min</option>
                  <option value="30">30 min</option>
                  <option value="60">1 hour</option>
                  <option value="120">2 hours</option>
                  <option value="custom">{lang === "en" ? "Custom time…" : "Heure personnalisée…"}</option>
                </select>
              </div>
              {durationMins === "custom" && (
                <input
                  type="datetime-local"
                  value={customCloseAt}
                  onChange={e => setCustomCloseAt(e.target.value)}
                  className="input w-56"
                />
              )}
              <button onClick={createSession} disabled={creating || !newTitle.trim()} className="btn-primary disabled:opacity-60">
                {creating ? <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2.5} /> : <Plus className="w-4 h-4" strokeWidth={2.5} />}
                {lang === "en" ? "Open Session" : "Ouvrir"}
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              {lang === "en"
                ? "Students see a button to check themselves in while the session is live. For onsite students without a device, use \"Mark Present\" in the roster below."
                : "Les étudiants voient un bouton pour se connecter tant que la session est active. Pour les étudiants sur place sans appareil, utilisez « Marquer Présent » dans la liste ci-dessous."}
            </p>
          </div>

          {/* Sessions list */}
          {loading ? (
            <div className="card divide-y divide-gray-50">{Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} />)}</div>
          ) : sessions.length === 0 ? (
            <EmptyState icon={Calendar} title={lang === "en" ? "No attendance sessions yet" : "Aucune session de présence"} />
          ) : (
            <div className="space-y-4 stagger-children">
              {sessions.map(s => {
                const logs = s.logs ?? [];
                const pending = logs.filter(l => l.status === "pending").length;
                const approved = logs.filter(l => l.status === "approved").length;
                const live = isLive(s);
                const loggedStudentIds = new Set(logs.map(l => l.student_id));
                const unmarked = roster.filter(r => !loggedStudentIds.has(r.id));
                return (
                  <div key={s.id} className={`card overflow-hidden ${live ? "border-l-4 border-l-green-400" : "border-l-4 border-l-gray-200"}`}>
                    <div className="px-5 py-4 flex items-center gap-4 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <h4 className="font-bold text-ink text-sm">{s.title}</h4>
                          <Badge color={live ? "green" : "gray"}>
                            {live ? (lang === "en" ? "Live" : "En direct") : (lang === "en" ? "Closed" : "Fermée")}
                          </Badge>
                          {pending > 0 && <Badge color="orange">{pending} {lang === "en" ? "pending" : "en attente"}</Badge>}
                        </div>
                        <p className="text-xs text-gray-400">
                          {lang === "en" ? "Opened" : "Ouverte"}: {fmt(s.opens_at)}
                          {s.closes_at && ` · ${lang === "en" ? "Closes" : "Ferme"}: ${fmt(s.closes_at)}`}
                          {` · ${approved}/${roster.length || logs.length} ${lang === "en" ? "present" : "présents"}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => load()} className="text-gray-400 hover:text-navy p-1.5 transition-colors" title="Refresh">
                          <RefreshCw className="w-4 h-4" strokeWidth={2} />
                        </button>
                        {pending > 0 && (
                          <button onClick={() => confirmAll(s)} disabled={confirmingAll === s.id}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 transition-colors disabled:opacity-60">
                            {confirmingAll === s.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={2} /> : <CheckCheck className="w-3.5 h-3.5" strokeWidth={2} />}
                            {lang === "en" ? "Confirm All" : "Tout Confirmer"}
                          </button>
                        )}
                        <button onClick={() => toggleSession(s)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${s.is_open ? "bg-red-50 text-red-600 border border-red-200 hover:bg-red-100" : "bg-green-50 text-green-600 border border-green-200 hover:bg-green-100"}`}>
                          {s.is_open ? <Lock className="w-3.5 h-3.5" strokeWidth={2} /> : <Unlock className="w-3.5 h-3.5" strokeWidth={2} />}
                          {s.is_open ? (lang === "en" ? "Close" : "Fermer") : (lang === "en" ? "Reopen" : "Rouvrir")}
                        </button>
                        <button onClick={() => setExpanded(expanded === s.id ? null : s.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-navy/5 text-navy border border-navy/10 hover:bg-navy/10 transition-colors">
                          <Users className="w-3.5 h-3.5" strokeWidth={2} />
                          {lang === "en" ? "View Roster" : "Voir la Liste"}
                        </button>
                      </div>
                    </div>

                    {expanded === s.id && (
                      <div className="border-t border-gray-100">
                        {logs.length === 0 ? (
                          <p className="text-sm text-gray-400 text-center py-6">
                            {lang === "en" ? "No students have checked in yet." : "Aucun étudiant ne s'est encore connecté."}
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
                                {l.method === "lecturer" && (
                                  <Badge color="purple"><MapPin className="w-3 h-3" strokeWidth={2.5} />{lang === "en" ? "Onsite" : "Sur place"}</Badge>
                                )}
                                <Badge color={l.status === "approved" ? "green" : l.status === "rejected" ? "red" : "orange"}>
                                  {l.status === "approved" ? (lang === "en" ? "Present" : "Présent") : l.status === "rejected" ? (lang === "en" ? "Rejected" : "Rejeté") : (lang === "en" ? "Pending" : "En attente")}
                                </Badge>
                                {l.status === "pending" && (
                                  <div className="flex gap-1.5 flex-shrink-0">
                                    <button onClick={() => updateLog(l.id, s.id, "approved")}
                                      className="w-8 h-8 flex items-center justify-center rounded-lg bg-green-50 text-green-600 hover:bg-green-100 transition-colors">
                                      <CheckCircle2 className="w-4 h-4" strokeWidth={2.5} />
                                    </button>
                                    <button onClick={() => updateLog(l.id, s.id, "rejected")}
                                      className="w-8 h-8 flex items-center justify-center rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors">
                                      <XCircle className="w-4 h-4" strokeWidth={2.5} />
                                    </button>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {unmarked.length > 0 && (
                          <div className="border-t border-gray-100 bg-gray-50/60">
                            <p className="text-xs font-bold text-slate uppercase tracking-wider px-5 pt-4 pb-2">
                              {lang === "en" ? "Not Yet Marked — Onsite Roll Call" : "Pas Encore Marqués — Appel sur Place"}
                            </p>
                            <div className="divide-y divide-gray-100">
                              {unmarked.map(r => (
                                <div key={r.id} className="flex items-center gap-4 px-5 py-2.5">
                                  <div className="w-7 h-7 rounded-full bg-gray-300 flex items-center justify-center text-white font-black text-[11px] flex-shrink-0">
                                    {r.full_name.charAt(0)}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium text-ink text-sm">{r.full_name}</p>
                                    <p className="text-xs text-gray-400">{r.email}</p>
                                  </div>
                                  <button
                                    onClick={() => markOnsite(s, r.id)}
                                    disabled={markingOnsite === `${s.id}-${r.id}`}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-navy text-white hover:bg-navy/90 transition-colors disabled:opacity-60"
                                  >
                                    {markingOnsite === `${s.id}-${r.id}`
                                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={2.5} />
                                      : <UserPlus className="w-3.5 h-3.5" strokeWidth={2.5} />}
                                    {lang === "en" ? "Mark Present" : "Marquer Présent"}
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </LecturerLayout>
  );
}
