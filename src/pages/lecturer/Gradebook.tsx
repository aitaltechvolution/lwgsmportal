import { useEffect, useState } from "react";
import LecturerLayout from "@/components/LecturerLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { useTranslation } from "react-i18next";
import { ClipboardCheck, CheckCircle2, Loader2, Lock, Unlock } from "lucide-react";
import { Badge, EmptyState } from "@/components/ui/primitives";

interface Course {
  id: string;
  title: string;
  title_fr: string | null;
  code: string | null;
  grades_published: boolean;
  grades_published_at: string | null;
}

interface Assignment {
  id: string;
  title_en: string;
  title_fr: string | null;
  max_score: number | null;
}

interface Student {
  id: string;
  full_name: string;
  email: string;
}

interface GradeEntry {
  id: string;
  student_id: string;
  course_id: string;
  score: number | null;
}

interface SubmissionScore {
  assignment_id: string;
  student_id: string;
  score: number | null;
}

function pctColor(score: number, max: number) {
  const p = (score / max) * 100;
  if (p >= 75) return "text-green-600";
  if (p >= 50) return "text-yellow-600";
  return "text-red-600";
}

export default function Gradebook() {
  const { profile } = useAuth();
  const { i18n } = useTranslation();
  const lang = (i18n.language.startsWith("fr") ? "fr" : "en") as "en" | "fr";

  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<string>("");
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [grades, setGrades] = useState<GradeEntry[]>([]);
  const [submissionScores, setSubmissionScores] = useState<SubmissionScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);

  // Load lecturer courses
  useEffect(() => {
    if (!profile?.id) return;
    supabase.from("courses").select("id, title, title_fr, code, grades_published, grades_published_at").eq("lecturer_id", profile.id).order("title")
      .then(({ data }) => {
        const list = (data ?? []) as Course[];
        setCourses(list);
        if (list.length > 0) setSelectedCourse(list[0].id);
        else setLoading(false);
      });
  }, [profile?.id]);

  // Load gradebook data for the selected course
  useEffect(() => {
    if (!selectedCourse) return;
    setLoading(true);

    async function load() {
      const [asgRes, enrRes, gradeRes] = await Promise.all([
        supabase.from("assignments").select("id, title_en, title_fr, max_score").eq("course_id", selectedCourse).order("due_date"),
        supabase.from("enrollments").select("student_id, profiles(id, full_name, email)").eq("course_id", selectedCourse).eq("status", "active"),
        supabase.from("grades").select("*").eq("course_id", selectedCourse),
      ]);

      const asgList = (asgRes.data ?? []) as Assignment[];
      setAssignments(asgList);
      const studentList = ((enrRes.data ?? []) as unknown as { profiles?: { id: string; full_name: string; email: string } }[])
        .map((e) => e.profiles)
        .filter(Boolean) as Student[];
      setStudents(studentList);
      setGrades((gradeRes.data ?? []) as GradeEntry[]);

      if (asgList.length > 0) {
        const { data: subs } = await supabase
          .from("submissions")
          .select("assignment_id, student_id, score")
          .in("assignment_id", asgList.map(a => a.id));
        setSubmissionScores((subs ?? []) as SubmissionScore[]);
      } else {
        setSubmissionScores([]);
      }
      setLoading(false);
    }

    load();
  }, [selectedCourse]);

  // Note: grades is keyed by (course_id, student_id) — one overall grade
  // record per student per course, separate from per-assignment scores
  // (which live on submissions and are graded from each assessment's
  // submissions page). Whether those grades are visible to students and
  // count toward certificate eligibility is controlled at the COURSE
  // level via courses.grades_published, toggled below — not per grade
  // row — since a partially-published gradebook isn't meaningful for
  // certificate eligibility purposes.

  const getGradeEntry = (studentId: string) => grades.find(g => g.student_id === studentId);
  const getSubmissionScore = (studentId: string, assignmentId: string) =>
    submissionScores.find(s => s.student_id === studentId && s.assignment_id === assignmentId)?.score ?? null;
  const getOverallPct = (studentId: string) => {
    const scored = assignments
      .map(a => ({ score: getSubmissionScore(studentId, a.id), max: a.max_score ?? 100 }))
      .filter((s): s is { score: number; max: number } => s.score !== null);
    if (scored.length === 0) return null;
    const pct = scored.reduce((sum, s) => sum + (s.score / s.max) * 100, 0) / scored.length;
    return Math.round(pct);
  };
  const selectedCourseObj = courses.find(c => c.id === selectedCourse);
  const courseTitle = selectedCourseObj ? ((lang === "fr" && selectedCourseObj.title_fr) ? selectedCourseObj.title_fr : selectedCourseObj.title) : "";

  const togglePublishCourse = async () => {
    if (!selectedCourseObj) return;
    const next = !selectedCourseObj.grades_published;
    setPublishing(true);
    const patch = { grades_published: next, grades_published_at: next ? new Date().toISOString() : null };
    setCourses(prev => prev.map(c => c.id === selectedCourse ? { ...c, ...patch } : c));
    const { error } = await supabase.from("courses").update(patch).eq("id", selectedCourse);
    if (error) {
      setCourses(prev => prev.map(c => c.id === selectedCourse ? { ...c, grades_published: !next, grades_published_at: selectedCourseObj.grades_published_at } : c));
    }
    setPublishing(false);
  };

  return (
    <LecturerLayout title={lang === "en" ? "Gradebook" : "Cahier de Notes"}>
      <div className="mb-6 animate-fade-in-up">
        <h2 className="text-2xl font-black text-ink">{lang === "en" ? "Gradebook" : "Cahier de Notes"}</h2>
        <p className="text-sm text-slate mt-0.5">{lang === "en" ? "View and publish student grades by course." : "Consultez et publiez les notes des étudiants par cours."}</p>
      </div>

      {/* Course selector */}
      {courses.length > 0 && (
        <div className="mb-6 animate-fade-in-up" style={{ animationDelay: "0.04s" }}>
          <label className="label">{lang === "en" ? "Select Course" : "Sélectionner un Cours"}</label>
          <select value={selectedCourse} onChange={e => setSelectedCourse(e.target.value)} className="input w-full sm:w-80">
            {courses.map(c => (
              <option key={c.id} value={c.id}>{c.code ? `${c.code} — ` : ""}{(lang === "fr" && c.title_fr) ? c.title_fr : c.title}</option>
            ))}
          </select>
        </div>
      )}

      {courses.length === 0 && !loading ? (
        <EmptyState icon={ClipboardCheck} title={lang === "en" ? "No courses found" : "Aucun cours trouvé"} description={lang === "en" ? "Create a course first to use the gradebook." : "Créez d'abord un cours pour utiliser le cahier de notes."} />
      ) : loading ? (
        <div className="card p-6 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton h-10 w-full" />)}
        </div>
      ) : (
        <>
          {selectedCourseObj && (
            <div className={`flex items-center justify-between gap-4 rounded-2xl p-5 mb-5 flex-wrap animate-fade-in-up ${selectedCourseObj.grades_published ? "bg-green-50 border border-green-100" : "bg-yellow-50 border border-yellow-100"}`}>
              <div className="flex items-start gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${selectedCourseObj.grades_published ? "bg-green-100" : "bg-yellow-100"}`}>
                  {selectedCourseObj.grades_published ? <Unlock className="w-4 h-4 text-green-600" strokeWidth={2} /> : <Lock className="w-4 h-4 text-yellow-600" strokeWidth={2} />}
                </div>
                <div>
                  <p className={`text-sm font-bold ${selectedCourseObj.grades_published ? "text-green-800" : "text-yellow-800"}`}>
                    {selectedCourseObj.grades_published
                      ? (lang === "en" ? "Grades published for this course" : "Notes publiées pour ce cours")
                      : (lang === "en" ? "Grades not yet published" : "Notes pas encore publiées")}
                  </p>
                  <p className={`text-xs mt-0.5 ${selectedCourseObj.grades_published ? "text-green-600" : "text-yellow-700"}`}>
                    {lang === "en"
                      ? "Publishing makes final grades visible to enrolled students and counts this course toward their certificate eligibility."
                      : "La publication rend les notes finales visibles aux étudiants inscrits et compte ce cours dans leur éligibilité au certificat."}
                  </p>
                </div>
              </div>
              <button
                onClick={togglePublishCourse}
                disabled={publishing}
                className={`flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-lg transition-colors disabled:opacity-60 whitespace-nowrap
                  ${selectedCourseObj.grades_published ? "bg-yellow-100 text-yellow-700 hover:bg-yellow-200" : "bg-green-600 text-white hover:bg-green-700"}`}
              >
                {publishing ? <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={2.5} /> : selectedCourseObj.grades_published ? <Lock className="w-3.5 h-3.5" strokeWidth={2} /> : <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={2} />}
                {selectedCourseObj.grades_published
                  ? (lang === "en" ? "Unpublish Grades" : "Dépublier les Notes")
                  : (lang === "en" ? "Publish Grades" : "Publier les Notes")}
              </button>
            </div>
          )}

          {students.length === 0 ? (
            <EmptyState icon={ClipboardCheck} title={lang === "en" ? "No students enrolled" : "Aucun étudiant inscrit"} description={courseTitle} />
          ) : (
            <div className="card overflow-hidden animate-fade-in-up" style={{ animationDelay: "0.08s" }}>
              <div className="px-5 py-4 border-b border-gray-50">
                <h3 className="font-bold text-ink text-sm">{courseTitle}</h3>
                <p className="text-xs text-gray-400 mt-0.5">{students.length} {lang === "en" ? "student(s)" : "étudiant(s)"} · {assignments.length} {lang === "en" ? "assessment(s)" : "évaluation(s)"}</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50/60 border-b border-gray-100">
                      <th className="text-left px-5 py-3 text-xs font-bold text-slate uppercase tracking-wider sticky left-0 bg-gray-50/60">
                        {lang === "en" ? "Student" : "Étudiant"}
                      </th>
                      {assignments.map(a => (
                        <th key={a.id} className="text-center px-4 py-3 text-xs font-bold text-slate uppercase tracking-wider whitespace-nowrap">
                          {(lang === "fr" && a.title_fr) ? a.title_fr : a.title_en}
                          <div className="text-[10px] text-gray-400 font-normal mt-0.5">/{a.max_score ?? 100}</div>
                        </th>
                      ))}
                      <th className="text-center px-5 py-3 text-xs font-bold text-slate uppercase tracking-wider">
                        {lang === "en" ? "Overall" : "Global"}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {students.map((stu) => {
                      const entry = getGradeEntry(stu.id);
                      const overallPct = getOverallPct(stu.id);
                      return (
                        <tr key={stu.id} className="hover:bg-gray-50/60 transition-colors">
                          <td className="px-5 py-3.5 sticky left-0 bg-white">
                            <div className="font-semibold text-ink">{stu.full_name}</div>
                            <div className="text-xs text-gray-400">{stu.email}</div>
                          </td>
                          {assignments.map(a => {
                            const score = getSubmissionScore(stu.id, a.id);
                            const max = a.max_score ?? 100;
                            return (
                              <td key={a.id} className="text-center px-4 py-3.5 text-xs">
                                {score !== null ? (
                                  <span className={`font-bold ${pctColor(score, max)}`}>{score}<span className="text-gray-400">/{max}</span></span>
                                ) : (
                                  <span className="text-gray-400">—</span>
                                )}
                              </td>
                            );
                          })}
                          <td className="text-center px-5 py-3.5">
                            {entry?.score !== null && entry?.score !== undefined ? (
                              <span className={`font-bold ${pctColor(entry.score, 100)}`}>{entry.score}<span className="text-gray-400 text-xs">/100</span></span>
                            ) : overallPct !== null ? (
                              <span className={`font-bold ${pctColor(overallPct, 100)}`}>{overallPct}<span className="text-gray-400 text-xs">%</span></span>
                            ) : (
                              <span className="text-gray-400 text-xs italic">{lang === "en" ? "Not graded" : "Non noté"}</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="px-5 py-3 border-t border-gray-50 bg-gray-50/40">
                <p className="text-xs text-gray-400 flex items-center gap-1.5">
                  {lang === "en"
                    ? "Per-assessment scores are graded individually in each assessment's submissions page. The Overall column reflects the course-level grade record."
                    : "Les notes par évaluation sont attribuées individuellement dans la page de soumissions de chaque évaluation. La colonne Global reflète la note globale du cours."}
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </LecturerLayout>
  );
}