import { useEffect, useState } from "react";
import StudentLayout from "@/components/StudentLayout";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "react-i18next";
import { CheckCircle2, Clock, Calendar, Loader2 } from "lucide-react";
import { Badge, EmptyState, SkeletonRow } from "@/components/ui/primitives";
import { useToast } from "@/contexts/ToastContext";

interface Session {
  id: string;
  course_id: string;
  title: string;
  opens_at: string;
  closes_at: string | null;
  is_open: boolean;
  courses?: { title: string; title_fr: string | null; code: string | null };
  myLog?: { status: "pending" | "approved" | "rejected" } | null;
}

export default function StudentAttendance() {
  const { profile } = useAuth();
  const { i18n } = useTranslation();
  const lang = i18n.language.startsWith("fr") ? "fr" : "en";
  const { showToast } = useToast();

  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState<string | null>(null);

  const load = async () => {
    if (!profile?.id) return;
    setLoading(true);

    // Get enrolled course IDs
    const { data: enrolled } = await supabase
      .from("enrollments")
      .select("course_id")
      .eq("student_id", profile.id)
      .eq("status", "active");

    const courseIds = (enrolled ?? []).map((e: { course_id: string }) => e.course_id);
    if (courseIds.length === 0) { setLoading(false); return; }

    // Get sessions (open and past) for those courses
    const { data: sessionData } = await supabase
      .from("attendance_sessions")
      .select("*, courses(title, title_fr, code)")
      .in("course_id", courseIds)
      .order("opens_at", { ascending: false });

    // Get my logs
    const { data: myLogs } = await supabase
      .from("attendance_logs")
      .select("session_id, status")
      .eq("student_id", profile.id);

    const logMap = new Map(
      (myLogs ?? []).map((l: { session_id: string; status: string }) => [l.session_id, l])
    );

    const list = (sessionData ?? []).map((s: Session) => ({
      ...s,
      myLog: logMap.get(s.id) ?? null,
    }));

    setSessions(list as Session[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [profile?.id]);

  const markAttendance = async (session: Session) => {
    if (!profile?.id) return;
    setMarking(session.id);
    const { error } = await supabase.from("attendance_logs").insert({
      session_id: session.id,
      student_id: profile.id,
      course_id: session.course_id,
      status: "pending",
    });
    if (error) {
      showToast("error", error.message);
    } else {
      showToast("success",
        lang === "en"
          ? "Attendance marked! Awaiting lecturer approval."
          : "Présence marquée ! En attente d'approbation de l'enseignant."
      );
      load();
    }
    setMarking(null);
  };

  const fmt = (iso: string) => new Date(iso).toLocaleString(
    lang === "fr" ? "fr-FR" : "en-GB",
    { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }
  );

  const isLive = (s: Session) => s.is_open && (!s.closes_at || new Date(s.closes_at).getTime() > Date.now());
  const openSessions = sessions.filter(isLive);
  const pastSessions = sessions.filter(s => !isLive(s));

  return (
    <StudentLayout breadcrumbs={[{ label: lang === "en" ? "Attendance" : "Présence" }]}>
      <div className="flex items-center gap-3 mb-6 animate-fade-in-up">
        <div className="w-10 h-10 rounded-xl bg-navy/5 flex items-center justify-center">
          <Calendar className="w-5 h-5 text-navy" strokeWidth={2} />
        </div>
        <div>
          <h2 className="text-xl font-black text-ink">{lang === "en" ? "Attendance" : "Présence"}</h2>
          <p className="text-xs text-slate">
            {openSessions.length > 0
              ? `${openSessions.length} ${lang === "en" ? "open session(s)" : "session(s) ouverte(s)"}`
              : lang === "en" ? "No open sessions right now" : "Aucune session ouverte"}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="card divide-y divide-gray-50">{Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} />)}</div>
      ) : sessions.length === 0 ? (
        <EmptyState icon={Calendar}
          title={lang === "en" ? "No attendance sessions yet" : "Aucune session de présence"}
          description={lang === "en" ? "Your lecturer will open sessions during class time." : "Votre enseignant ouvrira des sessions pendant les cours."} />
      ) : (
        <div className="space-y-5">
          {/* Open sessions */}
          {openSessions.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-slate uppercase tracking-wider mb-3">
                {lang === "en" ? "Open Now — Mark Your Attendance" : "Ouvertes Maintenant — Marquez votre Présence"}
              </h3>
              <div className="space-y-3 stagger-children">
                {openSessions.map(s => {
                  const alreadyMarked = !!s.myLog;
                  const courseTitle = (lang === "fr" && s.courses?.title_fr) ? s.courses.title_fr : (s.courses?.title ?? "");
                  return (
                    <div key={s.id} className="card card-hover p-5 border-l-4 border-l-green-400">
                      <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <Badge color="green">{lang === "en" ? "Open" : "Ouverte"}</Badge>
                            {s.courses?.code && <Badge color="navy">{s.courses.code}</Badge>}
                          </div>
                          <h4 className="font-bold text-ink text-base mb-0.5">{s.title}</h4>
                          <p className="text-xs text-slate">{courseTitle}</p>
                          <div className="flex items-center gap-1.5 mt-2 text-xs text-gray-400">
                            <Clock className="w-3.5 h-3.5" strokeWidth={2} />
                            <span>{lang === "en" ? "Opened" : "Ouverte"}: {fmt(s.opens_at)}</span>
                            {s.closes_at && <span>· {lang === "en" ? "Closes" : "Ferme"}: {fmt(s.closes_at)}</span>}
                          </div>
                        </div>
                        <div className="flex-shrink-0">
                          {alreadyMarked ? (
                            <div className="flex flex-col items-center gap-1">
                              <div className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold
                                ${s.myLog?.status === "approved" ? "bg-green-50 text-green-700 border border-green-200"
                                  : s.myLog?.status === "rejected" ? "bg-red-50 text-red-700 border border-red-200"
                                  : "bg-orange-50 text-amber-700 border border-amber-200"}`}>
                                <CheckCircle2 className="w-4 h-4" strokeWidth={2.5} />
                                {s.myLog?.status === "approved"
                                  ? (lang === "en" ? "Approved" : "Approuvée")
                                  : s.myLog?.status === "rejected"
                                  ? (lang === "en" ? "Rejected" : "Rejetée")
                                  : (lang === "en" ? "Pending Approval" : "En Attente")}
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() => markAttendance(s)}
                              disabled={marking === s.id}
                              className="btn-primary disabled:opacity-60"
                            >
                              {marking === s.id
                                ? <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2.5} />
                                : <CheckCircle2 className="w-4 h-4" strokeWidth={2.5} />}
                              {lang === "en" ? "Mark Present" : "Marquer Présent(e)"}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Past sessions */}
          {pastSessions.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-slate uppercase tracking-wider mb-3">
                {lang === "en" ? "Past Sessions" : "Sessions Passées"}
              </h3>
              <div className="card divide-y divide-gray-50">
                {pastSessions.map(s => {
                  const courseTitle = (lang === "fr" && s.courses?.title_fr) ? s.courses.title_fr : (s.courses?.title ?? "");
                  return (
                    <div key={s.id} className="flex items-center gap-4 px-5 py-3.5">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-ink text-sm">{s.title}</p>
                        <p className="text-xs text-gray-400">{courseTitle} · {fmt(s.opens_at)}</p>
                      </div>
                      {s.myLog ? (
                        <Badge color={
                          s.myLog.status === "approved" ? "green"
                          : s.myLog.status === "rejected" ? "red"
                          : "orange"
                        }>
                          {s.myLog.status === "approved"
                            ? (lang === "en" ? "Approved" : "Approuvée")
                            : s.myLog.status === "rejected"
                            ? (lang === "en" ? "Rejected" : "Rejetée")
                            : (lang === "en" ? "Pending" : "En Attente")}
                        </Badge>
                      ) : (
                        <Badge color="gray">{lang === "en" ? "Absent" : "Absent(e)"}</Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </StudentLayout>
  );
}
