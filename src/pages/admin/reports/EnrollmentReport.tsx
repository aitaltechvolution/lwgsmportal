import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { EmptyState, SkeletonCard } from "@/components/ui/primitives";
import ReportToolbar from "@/components/ReportToolbar";
import { exportToCsv } from "@/lib/exportCsv";
import { Users } from "lucide-react";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
  LineChart, Line, XAxis, YAxis, CartesianGrid,
} from "recharts";

interface Props { lang: "en" | "fr" }

interface Program { id: string; title: string; title_fr: string | null }
interface Enrollment { student_id: string; program_id: string | null; status: string; enrolled_at: string }

const COLORS = ["#0D2B55", "#C9A227", "#16a34a", "#9333ea", "#0ea5e9", "#dc2626", "#ca8a04", "#64748B"];

export default function EnrollmentReport({ lang }: Props) {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    Promise.all([
      supabase.from("programs").select("id, title, title_fr"),
      supabase.from("enrollments").select("student_id, program_id, status, enrolled_at"),
    ]).then(([pRes, eRes]) => {
      setPrograms((pRes.data ?? []) as Program[]);
      setEnrollments((eRes.data ?? []) as Enrollment[]);
      setLoading(false);
    });
  }, []);

  const filtered = useMemo(() => {
    return enrollments.filter(e => {
      const d = new Date(e.enrolled_at);
      if (dateFrom && d < new Date(dateFrom)) return false;
      if (dateTo && d > new Date(dateTo + "T23:59:59")) return false;
      return true;
    });
  }, [enrollments, dateFrom, dateTo]);

  const byProgram = useMemo(() => {
    return programs.map(p => {
      const rows = filtered.filter(e => e.program_id === p.id);
      const active = rows.filter(e => e.status === "active").length;
      const completed = rows.filter(e => e.status === "completed").length;
      return {
        id: p.id,
        name: lang === "fr" && p.title_fr ? p.title_fr : p.title,
        total: rows.length,
        active,
        completed,
      };
    }).filter(p => p.total > 0);
  }, [programs, filtered, lang]);

  const monthlyTrend = useMemo(() => {
    const now = new Date();
    const months: { key: string; label: string; total: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleDateString(lang === "fr" ? "fr-FR" : "en-US", { month: "short" }), total: 0 });
    }
    const byKey = new Map(months.map(m => [m.key, m]));
    filtered.forEach(e => {
      const d = new Date(e.enrolled_at);
      const m = byKey.get(`${d.getFullYear()}-${d.getMonth()}`);
      if (m) m.total += 1;
    });
    return months;
  }, [filtered, lang]);

  const onExport = () => {
    exportToCsv(
      `enrollment-report-${new Date().toISOString().slice(0, 10)}.csv`,
      [lang === "en" ? "Program" : "Programme", lang === "en" ? "Total" : "Total", lang === "en" ? "Active" : "Actifs", lang === "en" ? "Completed" : "Terminés"],
      byProgram.map(p => [p.name, p.total, p.active, p.completed])
    );
  };

  if (loading) return <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{Array.from({ length: 2 }).map((_, i) => <SkeletonCard key={i} />)}</div>;

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-4 flex-wrap print:hidden">
        <div className="flex gap-3 items-end flex-wrap">
          <div>
            <label className="label">{lang === "en" ? "From" : "Du"}</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="input w-40" />
          </div>
          <div>
            <label className="label">{lang === "en" ? "To" : "Au"}</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="input w-40" />
          </div>
        </div>
        <ReportToolbar lang={lang} onExport={onExport} exportDisabled={byProgram.length === 0} />
      </div>

      {byProgram.length === 0 ? (
        <EmptyState icon={Users} title={lang === "en" ? "No enrollments in this range" : "Aucune inscription sur cette période"} />
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="card p-5">
              <h3 className="font-bold text-ink text-sm mb-4">{lang === "en" ? "Students by Program" : "Étudiants par Programme"}</h3>
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={byProgram} dataKey="total" nameKey="name" cx="50%" cy="50%" outerRadius={85} label={(d) => String(d.value)}>
                    {byProgram.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="card p-5">
              <h3 className="font-bold text-ink text-sm mb-4">{lang === "en" ? "Monthly Enrollment Trend" : "Tendance Mensuelle des Inscriptions"}</h3>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={monthlyTrend} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f1f1" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip />
                  <Line type="monotone" dataKey="total" stroke="#C9A227" strokeWidth={2.5} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50/60 border-b border-gray-100">
                    {[lang === "en" ? "Program" : "Programme", lang === "en" ? "Total Students" : "Total Étudiants", lang === "en" ? "Active" : "Actifs", lang === "en" ? "Completed" : "Terminés"].map(h => (
                      <th key={h} className="text-left px-5 py-3 text-xs font-bold text-slate uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {byProgram.map(p => (
                    <tr key={p.id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="px-5 py-3.5 font-semibold text-ink">{p.name}</td>
                      <td className="px-5 py-3.5 font-bold text-navy">{p.total}</td>
                      <td className="px-5 py-3.5 text-green-600 font-semibold">{p.active}</td>
                      <td className="px-5 py-3.5 text-slate">{p.completed}</td>
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
