import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { EmptyState, SkeletonCard, StatCard } from "@/components/ui/primitives";
import ReportToolbar from "@/components/ReportToolbar";
import { exportToCsv } from "@/lib/exportCsv";
import { Activity, Users, GraduationCap, ShieldCheck, BookOpen } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface Props { lang: "en" | "fr" }

interface ProfileRow { role: string }
interface EventRow { id: string; user_id: string | null; event_type: string; course_id: string | null; created_at: string; profiles?: { full_name: string; role: string } | null }
interface CourseRow { id: string; title: string; title_fr: string | null }

export default function SystemUsageReport({ lang }: Props) {
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [submissionCounts, setSubmissionCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [pRes, eRes, cRes, sRes] = await Promise.all([
        supabase.from("profiles").select("role"),
        supabase.from("usage_events").select("id, user_id, event_type, course_id, created_at, profiles:user_id(full_name, role)").order("created_at", { ascending: false }).limit(200),
        supabase.from("courses").select("id, title, title_fr"),
        supabase.from("submissions").select("assignments(course_id)"),
      ]);
      setProfiles((pRes.data ?? []) as ProfileRow[]);
      setEvents((eRes.data ?? []) as unknown as EventRow[]);
      setCourses((cRes.data ?? []) as CourseRow[]);

      const counts: Record<string, number> = {};
      ((sRes.data ?? []) as unknown as { assignments?: { course_id: string } | null }[]).forEach(r => {
        const cid = r.assignments?.course_id;
        if (cid) counts[cid] = (counts[cid] ?? 0) + 1;
      });
      setSubmissionCounts(counts);
      setLoading(false);
    }
    load();
  }, []);

  const courseLabel = (c: CourseRow) => (lang === "fr" && c.title_fr ? c.title_fr : c.title);

  const usersByRole = useMemo(() => {
    const counts: Record<string, number> = { student: 0, lecturer: 0, admin: 0 };
    profiles.forEach(p => { counts[p.role] = (counts[p.role] ?? 0) + 1; });
    return counts;
  }, [profiles]);

  const materialViewsByCourse = useMemo(() => {
    const counts: Record<string, number> = {};
    events.filter(e => e.event_type === "material_view" && e.course_id).forEach(e => {
      counts[e.course_id!] = (counts[e.course_id!] ?? 0) + 1;
    });
    return counts;
  }, [events]);

  const mostActiveCourses = useMemo(() => {
    return courses.map(c => ({
      id: c.id,
      name: courseLabel(c),
      views: materialViewsByCourse[c.id] ?? 0,
      submissions: submissionCounts[c.id] ?? 0,
      activity: (materialViewsByCourse[c.id] ?? 0) + (submissionCounts[c.id] ?? 0),
    })).filter(c => c.activity > 0).sort((a, b) => b.activity - a.activity).slice(0, 10);
  }, [courses, materialViewsByCourse, submissionCounts, lang]);

  const recentLogins = events.filter(e => e.event_type === "login").slice(0, 25);

  const fmtDateTime = (iso: string) => new Date(iso).toLocaleString(lang === "fr" ? "fr-FR" : "en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

  const onExport = () => {
    exportToCsv(
      `system-usage-${new Date().toISOString().slice(0, 10)}.csv`,
      [lang === "en" ? "Course" : "Cours", lang === "en" ? "Material Views" : "Vues de Matériel", lang === "en" ? "Submissions" : "Soumissions"],
      mostActiveCourses.map(c => [c.name, c.views, c.submissions])
    );
  };

  if (loading) return <div className="grid grid-cols-1 md:grid-cols-3 gap-4">{Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}</div>;

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-4 flex-wrap print:hidden">
        <p className="text-xs text-gray-400 max-w-md">
          {lang === "en"
            ? "Material views and logins are tracked going forward from when this feature was enabled — historical activity before that point isn't included."
            : "Les vues de matériel et connexions sont suivies à partir de l'activation de cette fonctionnalité — l'activité antérieure n'est pas incluse."}
        </p>
        <ReportToolbar lang={lang} onExport={onExport} exportDisabled={mostActiveCourses.length === 0} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard icon={GraduationCap} label={lang === "en" ? "Students" : "Étudiants"} value={usersByRole.student ?? 0} accent="blue" />
        <StatCard icon={Users} label={lang === "en" ? "Lecturers" : "Enseignants"} value={usersByRole.lecturer ?? 0} accent="purple" />
        <StatCard icon={ShieldCheck} label={lang === "en" ? "Admins" : "Admins"} value={usersByRole.admin ?? 0} accent="navy" />
      </div>

      <div className="card p-5">
        <h3 className="font-bold text-ink text-sm mb-1">{lang === "en" ? "Most Active Courses" : "Cours les Plus Actifs"}</h3>
        <p className="text-xs text-gray-400 mb-4">{lang === "en" ? "By material views + submissions" : "Par vues de matériel + soumissions"}</p>
        {mostActiveCourses.length === 0 ? (
          <EmptyState icon={BookOpen} title={lang === "en" ? "No activity recorded yet" : "Aucune activité enregistrée"} />
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(220, mostActiveCourses.length * 36)}>
            <BarChart data={mostActiveCourses} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f1f1" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} allowDecimals={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "#1A1D29" }} axisLine={false} tickLine={false} width={160} />
              <Tooltip />
              <Bar dataKey="views" name={lang === "en" ? "Views" : "Vues"} stackId="a" fill="#0D2B55" radius={[0, 0, 0, 0]} />
              <Bar dataKey="submissions" name={lang === "en" ? "Submissions" : "Soumissions"} stackId="a" fill="#C9A227" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-50 flex items-center gap-2">
          <Activity className="w-4 h-4 text-navy" strokeWidth={2} />
          <h3 className="font-bold text-ink text-sm">{lang === "en" ? "Recent Logins" : "Connexions Récentes"}</h3>
        </div>
        {recentLogins.length === 0 ? (
          <div className="p-6"><EmptyState icon={Activity} title={lang === "en" ? "No logins recorded yet" : "Aucune connexion enregistrée"} /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50/60 border-b border-gray-100">
                  {[lang === "en" ? "User" : "Utilisateur", lang === "en" ? "Role" : "Rôle", lang === "en" ? "Time" : "Heure"].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-bold text-slate uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {recentLogins.map(e => (
                  <tr key={e.id} className="hover:bg-gray-50/60 transition-colors">
                    <td className="px-5 py-3.5 font-semibold text-ink">{e.profiles?.full_name ?? "—"}</td>
                    <td className="px-5 py-3.5 text-slate capitalize">{e.profiles?.role ?? "—"}</td>
                    <td className="px-5 py-3.5 text-gray-400 text-xs">{fmtDateTime(e.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
