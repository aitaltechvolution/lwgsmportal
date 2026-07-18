import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { EmptyState, SkeletonCard, Badge } from "@/components/ui/primitives";
import ReportToolbar from "@/components/ReportToolbar";
import { exportToCsv } from "@/lib/exportCsv";
import { BarChart3 } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";

interface Props { lang: "en" | "fr" }

interface Course { id: string; title: string; title_fr: string | null }
interface Submission { student_id: string; course_id: string; score: number | null; max_score: number | null; profiles?: { full_name: string } | null }

const GRADE_COLORS: Record<string, string> = { A: "#16a34a", B: "#0ea5e9", C: "#ca8a04", D: "#C9A227", F: "#dc2626" };

function letterGrade(pct: number): "A" | "B" | "C" | "D" | "F" {
  if (pct >= 80) return "A";
  if (pct >= 70) return "B";
  if (pct >= 60) return "C";
  if (pct >= 50) return "D";
  return "F";
}

export default function StudentPerformanceReport({ lang }: Props) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [submissions, setSubmissions] = useState<(Submission & { course_id: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [courseFilter, setCourseFilter] = useState<string>("all");

  useEffect(() => {
    async function load() {
      const { data: courseData } = await supabase.from("courses").select("id, title, title_fr").order("title");
      setCourses((courseData ?? []) as Course[]);

      const { data: subData } = await supabase
        .from("submissions")
        .select("student_id, score, assignments(course_id, max_score), profiles:student_id(full_name)")
        .not("score", "is", null);

      const rows = ((subData ?? []) as unknown as { student_id: string; score: number; assignments?: { course_id: string; max_score: number | null } | null; profiles?: { full_name: string } | null }[])
        .filter(r => r.assignments?.course_id)
        .map(r => ({
          student_id: r.student_id,
          course_id: r.assignments!.course_id,
          score: r.score,
          max_score: r.assignments!.max_score ?? 100,
          profiles: r.profiles,
        }));
      setSubmissions(rows);
      setLoading(false);
    }
    load();
  }, []);

  const courseLabel = (c: Course) => (lang === "fr" && c.title_fr ? c.title_fr : c.title);

  const avgByCourse = useMemo(() => {
    return courses.map(c => {
      const rows = submissions.filter(s => s.course_id === c.id);
      if (rows.length === 0) return null;
      const avgPct = rows.reduce((sum, r) => sum + ((r.score ?? 0) / (r.max_score || 100)) * 100, 0) / rows.length;
      return { id: c.id, name: courseLabel(c), avg: Math.round(avgPct * 10) / 10, count: rows.length };
    }).filter(Boolean) as { id: string; name: string; avg: number; count: number }[];
  }, [courses, submissions, lang]);

  const filteredSubmissions = useMemo(() => {
    if (courseFilter === "all") return submissions;
    return submissions.filter(s => s.course_id === courseFilter);
  }, [submissions, courseFilter]);

  const gradeDistribution = useMemo(() => {
    const counts: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, F: 0 };
    filteredSubmissions.forEach(s => {
      const pct = ((s.score ?? 0) / (s.max_score || 100)) * 100;
      counts[letterGrade(pct)] += 1;
    });
    return Object.entries(counts).map(([grade, value]) => ({ name: grade, value })).filter(g => g.value > 0);
  }, [filteredSubmissions]);

  const studentRows = useMemo(() => {
    // Group by student within the filtered course scope.
    const map = new Map<string, { name: string; course: string; scores: number[] }>();
    filteredSubmissions.forEach(s => {
      const course = courses.find(c => c.id === s.course_id);
      const key = `${s.student_id}-${s.course_id}`;
      const pct = ((s.score ?? 0) / (s.max_score || 100)) * 100;
      if (!map.has(key)) map.set(key, { name: s.profiles?.full_name ?? "—", course: course ? courseLabel(course) : "—", scores: [] });
      map.get(key)!.scores.push(pct);
    });
    return Array.from(map.values()).map(r => ({
      ...r,
      avg: Math.round((r.scores.reduce((a, b) => a + b, 0) / r.scores.length) * 10) / 10,
    })).sort((a, b) => b.avg - a.avg);
  }, [filteredSubmissions, courses, lang]);

  const onExport = () => {
    exportToCsv(
      `student-performance-${new Date().toISOString().slice(0, 10)}.csv`,
      [lang === "en" ? "Student" : "Étudiant", lang === "en" ? "Course" : "Cours", lang === "en" ? "Average Score (%)" : "Note Moyenne (%)", lang === "en" ? "Grade" : "Note"],
      studentRows.map(r => [r.name, r.course, r.avg, letterGrade(r.avg)])
    );
  };

  if (loading) return <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{Array.from({ length: 2 }).map((_, i) => <SkeletonCard key={i} />)}</div>;

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-4 flex-wrap print:hidden">
        <div>
          <label className="label">{lang === "en" ? "Course" : "Cours"}</label>
          <select value={courseFilter} onChange={e => setCourseFilter(e.target.value)} className="input w-56">
            <option value="all">{lang === "en" ? "All Courses" : "Tous les Cours"}</option>
            {courses.map(c => <option key={c.id} value={c.id}>{courseLabel(c)}</option>)}
          </select>
        </div>
        <ReportToolbar lang={lang} onExport={onExport} exportDisabled={studentRows.length === 0} />
      </div>

      {avgByCourse.length === 0 ? (
        <EmptyState icon={BarChart3} title={lang === "en" ? "No graded submissions yet" : "Aucune soumission notée"} />
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="card p-5">
              <h3 className="font-bold text-ink text-sm mb-4">{lang === "en" ? "Average Grade by Course" : "Note Moyenne par Cours"}</h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={avgByCourse} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f1f1" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} interval={0} angle={-20} textAnchor="end" height={50} />
                  <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} domain={[0, 100]} />
                  <Tooltip formatter={(v) => `${v}%`} />
                  <Bar dataKey="avg" fill="#0D2B55" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="card p-5">
              <h3 className="font-bold text-ink text-sm mb-4">
                {lang === "en" ? "Grade Distribution" : "Répartition des Notes"}
                {courseFilter !== "all" && <span className="text-slate font-normal"> — {courses.find(c => c.id === courseFilter) ? courseLabel(courses.find(c => c.id === courseFilter)!) : ""}</span>}
              </h3>
              {gradeDistribution.length === 0 ? (
                <div className="h-[260px] flex items-center justify-center text-sm text-gray-400">{lang === "en" ? "No data for this course" : "Aucune donnée pour ce cours"}</div>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={gradeDistribution} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={85} label={(d) => `${d.name}: ${d.value}`}>
                      {gradeDistribution.map((g, i) => <Cell key={i} fill={GRADE_COLORS[g.name] ?? "#64748B"} />)}
                    </Pie>
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50/60 border-b border-gray-100">
                    {[lang === "en" ? "Student" : "Étudiant", lang === "en" ? "Course" : "Cours", lang === "en" ? "Average Score" : "Note Moyenne", lang === "en" ? "Grade" : "Note"].map(h => (
                      <th key={h} className="text-left px-5 py-3 text-xs font-bold text-slate uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {studentRows.map((r, i) => {
                    const grade = letterGrade(r.avg);
                    return (
                      <tr key={i} className="hover:bg-gray-50/60 transition-colors">
                        <td className="px-5 py-3.5 font-semibold text-ink">{r.name}</td>
                        <td className="px-5 py-3.5 text-slate">{r.course}</td>
                        <td className="px-5 py-3.5 font-bold text-ink">{r.avg}%</td>
                        <td className="px-5 py-3.5"><Badge color={grade === "A" || grade === "B" ? "green" : grade === "C" ? "yellow" : "red"}>{grade}</Badge></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
