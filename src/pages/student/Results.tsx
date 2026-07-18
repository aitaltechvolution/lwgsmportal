import { useEffect, useState } from "react";
import StudentLayout from "@/components/StudentLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { useTranslation } from "react-i18next";
import { BarChart3, Award, GraduationCap, CheckCircle2 } from "lucide-react";
import { Badge, ProgressBar, EmptyState, SkeletonRow } from "@/components/ui/primitives";

interface Grade {
  id: string;
  score: number | null;
  grade: string | null;
  remarks: string | null;
  graded_at: string | null;
  courses?: { id: string; title: string; title_fr?: string; code?: string } | null;
  assignments?: { title_en: string; title_fr?: string; max_score?: number } | null;
}

function pct(score: number, max: number) { return Math.round((score / max) * 100); }

function gradeColors(p: number): { text: string; color: "green" | "yellow" | "red" } {
  if (p >= 75) return { text: "text-green-600", color: "green" };
  if (p >= 50) return { text: "text-yellow-600", color: "yellow" };
  return { text: "text-red-600", color: "red" };
}

function pctToGpaPoint(p: number): number {
  if (p >= 90) return 4.0;
  if (p >= 80) return 3.7;
  if (p >= 75) return 3.3;
  if (p >= 70) return 3.0;
  if (p >= 65) return 2.7;
  if (p >= 60) return 2.3;
  if (p >= 55) return 2.0;
  if (p >= 50) return 1.7;
  if (p >= 45) return 1.0;
  return 0.0;
}
function letterFromPct(p: number): string {
  if (p >= 90) return "A+";
  if (p >= 80) return "A";
  if (p >= 75) return "A-";
  if (p >= 70) return "B+";
  if (p >= 65) return "B";
  if (p >= 60) return "B-";
  if (p >= 55) return "C+";
  if (p >= 50) return "C";
  if (p >= 45) return "D";
  return "F";
}

export default function StudentResults() {
  const { profile } = useAuth();
  const { i18n } = useTranslation();
  const lang = (i18n.language.startsWith("fr") ? "fr" : "en") as "en" | "fr";
  const [grades, setGrades] = useState<Grade[]>([]);
  const [loading, setLoading] = useState(true);
  const [courseFilter, setCourseFilter] = useState("all");

  useEffect(() => {
    if (!profile?.id) return;
    supabase
      .from("grades")
      .select("*, courses(id, title, title_fr, code), assignments(title_en, title_fr, max_score)")
      .eq("student_id", profile.id)
      .order("graded_at", { ascending: false })
      .then(({ data }) => {
        setGrades((data ?? []) as unknown as Grade[]);
        setLoading(false);
      });
  }, [profile?.id]);

  const courseOptions = Array.from(
    new Map(grades.filter(g => g.courses).map(g => [g.courses!.id, g.courses!])).values()
  );

  const filtered = courseFilter === "all" ? grades : grades.filter(g => g.courses?.id === courseFilter);

  const graded = filtered.filter(g => g.score !== null && g.assignments?.max_score);
  const percentages = graded.map(g => pct(g.score!, g.assignments!.max_score!));
  const avgPct = percentages.length ? Math.round(percentages.reduce((a, b) => a + b, 0) / percentages.length) : null;
  const gpa = percentages.length ? (percentages.reduce((sum, p) => sum + pctToGpaPoint(p), 0) / percentages.length).toFixed(2) : null;
  const passCount = percentages.filter(p => p >= 50).length;

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString(lang === "fr" ? "fr-FR" : "en-GB", { day: "numeric", month: "short", year: "numeric" });

  return (
    <StudentLayout title={lang === "en" ? "My Results" : "Mes Résultats"}>
      <div className="mb-6 animate-fade-in-up">
        <h2 className="text-2xl font-black text-ink">{lang === "en" ? "My Results" : "Mes Résultats"}</h2>
        <p className="text-sm text-slate mt-0.5">{grades.length} {lang === "en" ? "result(s) recorded" : "résultat(s) enregistré(s)"}</p>
      </div>

      {/* Summary cards */}
      {!loading && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6 stagger-children">
          <div className="rounded-2xl bg-navy p-5 text-center col-span-2 sm:col-span-1">
            <Award className="w-5 h-5 text-amber-400 mx-auto mb-1" strokeWidth={2} />
            <div className="text-3xl font-black text-white">{gpa ?? "—"}</div>
            <div className="text-xs text-white/50 font-semibold mt-1 uppercase tracking-wider">{lang === "en" ? "GPA (4.0)" : "GPA (4.0)"}</div>
          </div>
          <div className="card p-5 text-center">
            <BarChart3 className={`w-5 h-5 mx-auto mb-1 ${avgPct !== null ? gradeColors(avgPct).text : "text-gray-400"}`} strokeWidth={2} />
            <div className={`text-3xl font-black ${avgPct !== null ? gradeColors(avgPct).text : "text-gray-400"}`}>{avgPct !== null ? `${avgPct}%` : "—"}</div>
            <div className="text-xs text-slate font-semibold mt-1 uppercase tracking-wider">{lang === "en" ? "Average" : "Moyenne"}</div>
          </div>
          <div className="card p-5 text-center">
            <GraduationCap className="w-5 h-5 text-navy mx-auto mb-1" strokeWidth={2} />
            <div className="text-3xl font-black text-navy">{graded.length}</div>
            <div className="text-xs text-slate font-semibold mt-1 uppercase tracking-wider">{lang === "en" ? "Graded" : "Notés"}</div>
          </div>
          <div className="card p-5 text-center">
            <CheckCircle2 className="w-5 h-5 text-green-600 mx-auto mb-1" strokeWidth={2} />
            <div className="text-3xl font-black text-green-600">{passCount}</div>
            <div className="text-xs text-slate font-semibold mt-1 uppercase tracking-wider">{lang === "en" ? "Passed" : "Réussis"}</div>
          </div>
        </div>
      )}

      {/* Course filter */}
      {!loading && courseOptions.length > 0 && (
        <div className="mb-5 animate-fade-in-up" style={{ animationDelay: "0.05s" }}>
          <label className="label">{lang === "en" ? "Filter by Course" : "Filtrer par Cours"}</label>
          <select value={courseFilter} onChange={e => setCourseFilter(e.target.value)} className="input w-full sm:w-72">
            <option value="all">{lang === "en" ? "All Courses" : "Tous les Cours"}</option>
            {courseOptions.map(c => (
              <option key={c.id} value={c.id}>{c.code ? `${c.code} — ` : ""}{(lang === "fr" && c.title_fr) ? c.title_fr : c.title}</option>
            ))}
          </select>
        </div>
      )}

      {/* Table / cards */}
      {loading ? (
        <div className="card divide-y divide-gray-50">{Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}</div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={BarChart3}
          title={lang === "en" ? "No results yet" : "Aucun résultat"}
          description={lang === "en" ? "Grades will appear here once your assignments are marked." : "Les notes apparaîtront ici une fois vos devoirs corrigés."}
        />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50/60 border-b border-gray-100">
                  <th className="text-left px-5 py-3 text-xs font-bold text-slate uppercase tracking-wider">{lang === "en" ? "Course" : "Cours"}</th>
                  <th className="text-left px-5 py-3 text-xs font-bold text-slate uppercase tracking-wider">{lang === "en" ? "Assessment" : "Évaluation"}</th>
                  <th className="text-center px-5 py-3 text-xs font-bold text-slate uppercase tracking-wider">{lang === "en" ? "Score" : "Note"}</th>
                  <th className="text-center px-5 py-3 text-xs font-bold text-slate uppercase tracking-wider">{lang === "en" ? "Grade" : "Lettre"}</th>
                  <th className="text-right px-5 py-3 text-xs font-bold text-slate uppercase tracking-wider">{lang === "en" ? "Date" : "Date"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(g => {
                  const max = g.assignments?.max_score ?? 100;
                  const p = g.score !== null ? pct(g.score, max) : null;
                  const colors = p !== null ? gradeColors(p) : null;
                  const cTitle = g.courses ? ((lang === "fr" && g.courses.title_fr) ? g.courses.title_fr : g.courses.title) : "—";
                  const aTitle = g.assignments ? ((lang === "fr" && g.assignments.title_fr) ? g.assignments.title_fr : g.assignments.title_en) : "—";
                  return (
                    <tr key={g.id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="font-semibold text-ink">{cTitle}</div>
                        {g.courses?.code && <div className="text-xs text-gray-400">{g.courses.code}</div>}
                      </td>
                      <td className="px-5 py-3.5 text-ink">{aTitle}</td>
                      <td className="px-5 py-3.5 text-center">
                        {g.score !== null ? (
                          <span className="font-bold text-ink">{g.score}<span className="text-gray-400 text-xs">/{max}</span></span>
                        ) : (
                          <span className="text-gray-400 text-xs italic">{lang === "en" ? "Pending" : "En attente"}</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        {p !== null ? <Badge color={colors!.color}>{g.grade ?? letterFromPct(p)} · {p}%</Badge> : "—"}
                      </td>
                      <td className="px-5 py-3.5 text-right text-gray-400 text-xs">{g.graded_at ? fmtDate(g.graded_at) : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3 stagger-children">
            {filtered.map(g => {
              const max = g.assignments?.max_score ?? 100;
              const p = g.score !== null ? pct(g.score, max) : null;
              const colors = p !== null ? gradeColors(p) : null;
              const cTitle = g.courses ? ((lang === "fr" && g.courses.title_fr) ? g.courses.title_fr : g.courses.title) : "—";
              const aTitle = g.assignments ? ((lang === "fr" && g.assignments.title_fr) ? g.assignments.title_fr : g.assignments.title_en) : "—";
              return (
                <div key={g.id} className="card p-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <p className="font-bold text-ink text-sm">{aTitle}</p>
                      <p className="text-xs text-gray-400">{cTitle}{g.courses?.code ? ` · ${g.courses.code}` : ""}</p>
                    </div>
                    {p !== null && <Badge color={colors!.color}>{g.grade ?? letterFromPct(p)} · {p}%</Badge>}
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-400">
                    <span>{g.score !== null ? `${g.score}/${max}` : (lang === "en" ? "Pending" : "En attente")}</span>
                    <span>{g.graded_at ? fmtDate(g.graded_at) : "—"}</span>
                  </div>
                  {p !== null && <div className="mt-2"><ProgressBar value={p} size="sm" /></div>}
                </div>
              );
            })}
          </div>
        </>
      )}
    </StudentLayout>
  );
}
