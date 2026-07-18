import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { EmptyState, SkeletonCard, Badge } from "@/components/ui/primitives";
import ReportToolbar from "@/components/ReportToolbar";
import { exportToCsv } from "@/lib/exportCsv";
import { CalendarCheck, Info } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface Props { lang: "en" | "fr" }

interface Course { id: string; title: string; title_fr: string | null }
interface AttendanceRow { course_id: string; student_id: string; date: string; status: "present" | "absent" | "late"; profiles?: { full_name: string } | null }
interface SubmissionProxyRow { student_id: string; submitted_at: string; assignments?: { course_id: string } | null; profiles?: { full_name: string } | null }

export default function AttendanceReport({ lang }: Props) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRow[]>([]);
  const [proxyRows, setProxyRows] = useState<SubmissionProxyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [courseFilter, setCourseFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    async function load() {
      const [cRes, aRes, sRes] = await Promise.all([
        supabase.from("courses").select("id, title, title_fr").order("title"),
        supabase.from("attendance").select("course_id, student_id, date, status, profiles:student_id(full_name)"),
        supabase.from("submissions").select("student_id, submitted_at, assignments(course_id), profiles:student_id(full_name)").not("submitted_at", "is", null),
      ]);
      setCourses((cRes.data ?? []) as Course[]);
      setAttendance((aRes.data ?? []) as unknown as AttendanceRow[]);
      setProxyRows((sRes.data ?? []) as unknown as SubmissionProxyRow[]);
      setLoading(false);
    }
    load();
  }, []);

  const courseLabel = (c: Course) => (lang === "fr" && c.title_fr ? c.title_fr : c.title);
  const coursesWithRealAttendance = useMemo(() => new Set(attendance.map(a => a.course_id)), [attendance]);

  const dateInRange = (iso: string) => {
    const d = new Date(iso);
    if (dateFrom && d < new Date(dateFrom)) return false;
    if (dateTo && d > new Date(dateTo + "T23:59:59")) return false;
    return true;
  };

  const byCourse = useMemo(() => {
    return courses.map(c => {
      const hasReal = coursesWithRealAttendance.has(c.id);
      if (hasReal) {
        const rows = attendance.filter(a => a.course_id === c.id && dateInRange(a.date));
        if (rows.length === 0) return null;
        const present = rows.filter(r => r.status === "present" || r.status === "late").length;
        return { id: c.id, name: courseLabel(c), rate: Math.round((present / rows.length) * 100), source: "real" as const, count: rows.length };
      } else {
        // Proxy: treat each submission as a "present" signal for that
        // course on that date, since no attendance record exists yet.
        const rows = proxyRows.filter(r => r.assignments?.course_id === c.id && dateInRange(r.submitted_at));
        if (rows.length === 0) return null;
        return { id: c.id, name: courseLabel(c), rate: null, source: "proxy" as const, count: rows.length };
      }
    }).filter(Boolean) as { id: string; name: string; rate: number | null; source: "real" | "proxy"; count: number }[];
  }, [courses, attendance, proxyRows, coursesWithRealAttendance, dateFrom, dateTo, lang]);

  const chartData = byCourse.filter(c => c.rate !== null).map(c => ({ name: c.name, rate: c.rate }));

  const studentSummary = useMemo(() => {
    const scope = courseFilter === "all" ? courses : courses.filter(c => c.id === courseFilter);
    const map = new Map<string, { name: string; course: string; present: number; absent: number; late: number; total: number; proxyCount: number; source: "real" | "proxy" }>();

    scope.forEach(c => {
      const hasReal = coursesWithRealAttendance.has(c.id);
      if (hasReal) {
        attendance.filter(a => a.course_id === c.id && dateInRange(a.date)).forEach(a => {
          const key = `${a.student_id}-${c.id}`;
          if (!map.has(key)) map.set(key, { name: a.profiles?.full_name ?? "—", course: courseLabel(c), present: 0, absent: 0, late: 0, total: 0, proxyCount: 0, source: "real" });
          const row = map.get(key)!;
          row[a.status] += 1;
          row.total += 1;
        });
      } else {
        proxyRows.filter(r => r.assignments?.course_id === c.id && dateInRange(r.submitted_at)).forEach(r => {
          const key = `${r.student_id}-${c.id}`;
          if (!map.has(key)) map.set(key, { name: r.profiles?.full_name ?? "—", course: courseLabel(c), present: 0, absent: 0, late: 0, total: 0, proxyCount: 0, source: "proxy" });
          map.get(key)!.proxyCount += 1;
        });
      }
    });

    return Array.from(map.values());
  }, [courseFilter, courses, attendance, proxyRows, coursesWithRealAttendance, dateFrom, dateTo, lang]);

  const onExport = () => {
    exportToCsv(
      `attendance-report-${new Date().toISOString().slice(0, 10)}.csv`,
      [lang === "en" ? "Student" : "Étudiant", lang === "en" ? "Course" : "Cours", lang === "en" ? "Present" : "Présent", lang === "en" ? "Absent" : "Absent", lang === "en" ? "Late" : "Retard", lang === "en" ? "Submissions (proxy)" : "Soumissions (proxy)"],
      studentSummary.map(r => [r.name, r.course, r.present, r.absent, r.late, r.proxyCount])
    );
  };

  if (loading) return <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{Array.from({ length: 2 }).map((_, i) => <SkeletonCard key={i} />)}</div>;

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-4 flex-wrap print:hidden">
        <div className="flex gap-3 items-end flex-wrap">
          <div>
            <label className="label">{lang === "en" ? "Course" : "Cours"}</label>
            <select value={courseFilter} onChange={e => setCourseFilter(e.target.value)} className="input w-56">
              <option value="all">{lang === "en" ? "All Courses" : "Tous les Cours"}</option>
              {courses.map(c => <option key={c.id} value={c.id}>{courseLabel(c)}</option>)}
            </select>
          </div>
          <div>
            <label className="label">{lang === "en" ? "From" : "Du"}</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="input w-40" />
          </div>
          <div>
            <label className="label">{lang === "en" ? "To" : "Au"}</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="input w-40" />
          </div>
        </div>
        <ReportToolbar lang={lang} onExport={onExport} exportDisabled={studentSummary.length === 0} />
      </div>

      {byCourse.some(c => c.source === "proxy") && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-sm text-blue-700 flex items-start gap-2 print:hidden">
          <Info className="w-4 h-4 flex-shrink-0 mt-0.5" strokeWidth={2} />
          {lang === "en"
            ? "Some courses have no attendance records yet, so submission activity is shown instead as an approximate signal — it is not a true attendance rate."
            : "Certains cours n'ont pas encore de registre de présence ; l'activité de soumission est utilisée comme signal approximatif — ce n'est pas un vrai taux de présence."}
        </div>
      )}

      {byCourse.length === 0 ? (
        <EmptyState icon={CalendarCheck} title={lang === "en" ? "No attendance or activity data" : "Aucune donnée de présence ou d'activité"} />
      ) : (
        <>
          {chartData.length > 0 && (
            <div className="card p-5">
              <h3 className="font-bold text-ink text-sm mb-4">{lang === "en" ? "Attendance Rate by Course (% Present)" : "Taux de Présence par Cours (% Présent)"}</h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f1f1" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} interval={0} angle={-20} textAnchor="end" height={50} />
                  <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} domain={[0, 100]} />
                  <Tooltip formatter={(v) => `${v}%`} />
                  <Bar dataKey="rate" fill="#0D2B55" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50/60 border-b border-gray-100">
                    {[lang === "en" ? "Student" : "Étudiant", lang === "en" ? "Course" : "Cours", lang === "en" ? "Present" : "Présent", lang === "en" ? "Absent" : "Absent", lang === "en" ? "Late" : "Retard", lang === "en" ? "Source" : "Source"].map(h => (
                      <th key={h} className="text-left px-5 py-3 text-xs font-bold text-slate uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {studentSummary.map((r, i) => (
                    <tr key={i} className="hover:bg-gray-50/60 transition-colors">
                      <td className="px-5 py-3.5 font-semibold text-ink">{r.name}</td>
                      <td className="px-5 py-3.5 text-slate">{r.course}</td>
                      {r.source === "real" ? (
                        <>
                          <td className="px-5 py-3.5 text-green-600 font-semibold">{r.present}</td>
                          <td className="px-5 py-3.5 text-red-500 font-semibold">{r.absent}</td>
                          <td className="px-5 py-3.5 text-yellow-600 font-semibold">{r.late}</td>
                          <td className="px-5 py-3.5"><Badge color="navy">{lang === "en" ? "Recorded" : "Enregistré"}</Badge></td>
                        </>
                      ) : (
                        <>
                          <td className="px-5 py-3.5 text-gray-400" colSpan={3}>
                            {r.proxyCount} {lang === "en" ? "submission(s) — no attendance taken" : "soumission(s) — aucune présence relevée"}
                          </td>
                          <td className="px-5 py-3.5"><Badge color="gray">{lang === "en" ? "Proxy" : "Proxy"}</Badge></td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
