import { useEffect, useState } from "react";
import LecturerLayout from "@/components/LecturerLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { useTranslation } from "react-i18next";
import { Search, Users, Mail, MessageSquare } from "lucide-react";
import { Badge, EmptyState, SkeletonRow } from "@/components/ui/primitives";
import { Link } from "react-router-dom";

interface Course {
  id: string;
  title: string;
  title_fr: string | null;
  code: string | null;
}

interface StudentRow {
  student_id: string;
  full_name: string;
  email: string;
  avatar_url?: string | null;
  course_id: string;
  course_title: string;
  course_title_fr: string | null;
  status: string;
  progress_pct: number | null;
}

export default function LecturerStudents() {
  const { profile } = useAuth();
  const { i18n } = useTranslation();
  const lang = (i18n.language.startsWith("fr") ? "fr" : "en") as "en" | "fr";

  const [courses, setCourses] = useState<Course[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [courseFilter, setCourseFilter] = useState("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!profile?.id) return;

    async function load() {
      const { data: courseData } = await supabase
        .from("courses")
        .select("id, title, title_fr, code")
        .eq("lecturer_id", profile!.id);

      const courseList = (courseData ?? []) as Course[];
      setCourses(courseList);

      const courseIds = courseList.map(c => c.id);
      if (courseIds.length === 0) { setLoading(false); return; }

      const { data: enrData } = await supabase
        .from("enrollments")
        .select("student_id, course_id, status, progress_pct, profiles(full_name, email, avatar_url)")
        .in("course_id", courseIds)
        .eq("status", "active");

      const rows: StudentRow[] = ((enrData ?? []) as unknown as {
        student_id: string; course_id: string; status: string; progress_pct: number | null;
        profiles?: { full_name: string; email: string; avatar_url?: string | null } | null;
      }[]).map((e) => {
        const course = courseList.find(c => c.id === e.course_id);
        return {
          student_id: e.student_id,
          full_name: e.profiles?.full_name ?? "—",
          email: e.profiles?.email ?? "",
          avatar_url: e.profiles?.avatar_url ?? null,
          course_id: e.course_id,
          course_title: course?.title ?? "",
          course_title_fr: course?.title_fr ?? null,
          status: e.status,
          progress_pct: e.progress_pct,
        };
      });

      setStudents(rows);
      setLoading(false);
    }

    load();
  }, [profile?.id]);

  const filtered = students
    .filter(s => courseFilter === "all" || s.course_id === courseFilter)
    .filter(s => {
      if (!search) return true;
      const q = search.toLowerCase();
      return s.full_name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q);
    });

  // Unique students count
  const uniqueStudents = new Set(students.map(s => s.student_id)).size;

  return (
    <LecturerLayout title={lang === "en" ? "Students" : "Étudiants"}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 animate-fade-in-up">
        <div>
          <h2 className="text-2xl font-black text-ink">{lang === "en" ? "Students" : "Étudiants"}</h2>
          <p className="text-sm text-slate mt-0.5">
            {loading ? "…" : `${uniqueStudents} ${lang === "en" ? "student(s) across your courses" : "étudiant(s) dans vos cours"}`}
          </p>
        </div>
        <div className="relative sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" strokeWidth={2} />
          <input type="text" placeholder={lang === "en" ? "Search students…" : "Rechercher…"} value={search} onChange={e => setSearch(e.target.value)} className="input pl-9" />
        </div>
      </div>

      {/* Course filter */}
      {courses.length > 0 && (
        <div className="flex gap-1.5 mb-6 bg-gray-100 p-1 rounded-xl w-fit flex-wrap animate-fade-in-up" style={{ animationDelay: "0.04s" }}>
          <button
            onClick={() => setCourseFilter("all")}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all duration-150 ${courseFilter === "all" ? "bg-white text-navy shadow-sm" : "text-slate hover:text-ink"}`}
          >
            {lang === "en" ? "All Courses" : "Tous les Cours"}
          </button>
          {courses.map(c => (
            <button
              key={c.id}
              onClick={() => setCourseFilter(c.id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all duration-150 ${courseFilter === c.id ? "bg-white text-navy shadow-sm" : "text-slate hover:text-ink"}`}
            >
              {c.code ?? ((lang === "fr" && c.title_fr) ? c.title_fr : c.title)}
            </button>
          ))}
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="card divide-y divide-gray-50">{Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}</div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={Users} title={lang === "en" ? "No students found" : "Aucun étudiant trouvé"} />
      ) : (
        <div className="card overflow-hidden stagger-children">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50/60 border-b border-gray-100">
                  <th className="text-left px-5 py-3 text-xs font-bold text-slate uppercase tracking-wider">{lang === "en" ? "Student" : "Étudiant"}</th>
                  <th className="text-left px-5 py-3 text-xs font-bold text-slate uppercase tracking-wider">{lang === "en" ? "Course" : "Cours"}</th>
                  <th className="text-center px-5 py-3 text-xs font-bold text-slate uppercase tracking-wider">{lang === "en" ? "Progress" : "Progression"}</th>
                  <th className="text-center px-5 py-3 text-xs font-bold text-slate uppercase tracking-wider">{lang === "en" ? "Status" : "Statut"}</th>
                  <th className="text-right px-5 py-3 text-xs font-bold text-slate uppercase tracking-wider">{lang === "en" ? "Contact" : "Contact"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((s, i) => {
                  const cTitle = (lang === "fr" && s.course_title_fr) ? s.course_title_fr : s.course_title;
                  const progress = s.progress_pct ?? 0;
                  return (
                    <tr key={`${s.student_id}-${s.course_id}-${i}`} className="hover:bg-gray-50/60 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-navy to-navy-light flex items-center justify-center text-white font-black text-xs flex-shrink-0 overflow-hidden">
                            {s.avatar_url ? <img src={s.avatar_url} alt="" className="w-full h-full object-cover" /> : s.full_name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-ink">{s.full_name}</div>
                            <div className="text-xs text-gray-400">{s.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-ink">{cTitle}</td>
                      <td className="px-5 py-3.5 text-center">
                        <span className={`font-bold ${progress >= 80 ? "text-green-600" : progress >= 40 ? "text-yellow-600" : "text-navy"}`}>{progress}%</span>
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <Badge color={s.status === "completed" ? "green" : "blue"}>
                          {lang === "en" ? s.status.charAt(0).toUpperCase() + s.status.slice(1) : s.status === "active" ? "Actif" : "Terminé"}
                        </Badge>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <a href={`mailto:${s.email}`} className="text-gray-400 hover:text-navy transition-colors" title={lang === "en" ? "Email" : "E-mail"}>
                            <Mail className="w-4 h-4" strokeWidth={2} />
                          </a>
                          <Link to="/lecturer/messages" className="text-gray-400 hover:text-brand transition-colors" title={lang === "en" ? "Message" : "Message"}>
                            <MessageSquare className="w-4 h-4" strokeWidth={2} />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </LecturerLayout>
  );
}
