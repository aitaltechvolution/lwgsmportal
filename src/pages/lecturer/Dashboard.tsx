import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import LecturerLayout from "@/components/LecturerLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { useTranslation } from "react-i18next";
import {
  BookOpen, Users, ClipboardCheck, Award, UploadCloud, PencilLine, Megaphone, ArrowRight, CalendarCheck,
} from "lucide-react";
import { Badge, StatCard, EmptyState, SkeletonRow } from "@/components/ui/primitives";
import GradientBlobs from "@/components/ui/GradientBlobs";

interface Stats {
  activeCourses: number;
  totalStudents: number;
  pendingSubmissions: number;
  publishedResults: number;
}

interface CourseRow {
  id: string;
  title: string;
  title_fr?: string;
  code?: string;
  is_published: boolean;
}

export default function LecturerDashboard() {
  const { profile } = useAuth();
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const lang = (i18n.language.startsWith("fr") ? "fr" : "en") as "en" | "fr";

  const [stats, setStats] = useState<Stats>({ activeCourses: 0, totalStudents: 0, pendingSubmissions: 0, publishedResults: 0 });
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [liveSessionCount, setLiveSessionCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.id) return;

    async function load() {
      const { data: courseRows } = await supabase
        .from("courses")
        .select("id, title, title_fr, code, is_published")
        .eq("lecturer_id", profile!.id);

      const courseList = (courseRows ?? []) as CourseRow[];
      const courseIds = courseList.map((c) => c.id);
      setCourses(courseList);

      let totalStudents = 0;
      let pendingSubmissions = 0;
      let publishedResults = 0;

      if (courseIds.length > 0) {
        const [enrRes, asgRes, gradeRes] = await Promise.all([
          supabase.from("enrollments").select("id", { count: "exact" }).in("course_id", courseIds).eq("status", "active"),
          supabase.from("assignments").select("id").in("course_id", courseIds),
          supabase.from("grades").select("id", { count: "exact" }).in("course_id", courseIds).eq("is_published", true),
        ]);

        totalStudents = enrRes.count ?? 0;
        publishedResults = gradeRes.count ?? 0;

        const assignmentIds = (asgRes.data ?? []).map((a: { id: string }) => a.id);
        if (assignmentIds.length > 0) {
          const { count } = await supabase
            .from("submissions")
            .select("id", { count: "exact" })
            .in("assignment_id", assignmentIds)
            .is("score", null);
          pendingSubmissions = count ?? 0;
        }

        const { data: openSessions } = await supabase
          .from("attendance_sessions")
          .select("id, closes_at")
          .in("course_id", courseIds)
          .eq("is_open", true);
        const now = Date.now();
        setLiveSessionCount((openSessions ?? []).filter(
          (s: { closes_at: string | null }) => !s.closes_at || new Date(s.closes_at).getTime() > now
        ).length);
      }

      setStats({
        activeCourses: courseList.filter((c) => c.is_published).length,
        totalStudents,
        pendingSubmissions,
        publishedResults,
      });
      setLoading(false);
    }

    load();
  }, [profile?.id]);

  const QUICK_ACTIONS = [
    {
      icon: UploadCloud,
      label: lang === "en" ? "Upload Material" : "Téléverser une Ressource",
      desc: lang === "en" ? "Add notes, videos, or files to a course" : "Ajouter des notes, vidéos ou fichiers à un cours",
      to: courses[0] ? `/lecturer/courses/${courses[0].id}/materials` : "/lecturer/courses",
      accent: "bg-blue-50 text-blue-600",
    },
    {
      icon: PencilLine,
      label: lang === "en" ? "Create Assignment" : "Créer un Devoir",
      desc: lang === "en" ? "Set up a new assessment for students" : "Configurer une nouvelle évaluation",
      to: courses[0] ? `/lecturer/courses/${courses[0].id}/assessments` : "/lecturer/courses",
      accent: "bg-purple-50 text-purple-600",
    },
    {
      icon: Megaphone,
      label: lang === "en" ? "Post Announcement" : "Publier une Annonce",
      desc: lang === "en" ? "Notify your students of updates" : "Informer vos étudiants des mises à jour",
      to: "/lecturer/announcements",
      accent: "bg-orange-50 text-brand",
    },
  ];

  return (
    <LecturerLayout>
      {/* Welcome */}
      <div className="relative overflow-hidden rounded-2xl bg-navy p-6 md:p-8 mb-6 animate-fade-in-up">
        <GradientBlobs variant="dark" />
        <div className="relative z-10">
          <p className="text-amber-400 text-xs font-bold uppercase tracking-[0.15em] mb-1.5">
            {lang === "en" ? "Lecturer Dashboard" : "Tableau de bord"}
          </p>
          <h2 className="text-white text-2xl md:text-3xl font-black mb-1 leading-tight">
            {profile?.full_name?.split(" ")[0] ?? ""}
          </h2>
          <p className="text-white/50 text-sm">
            {lang === "en" ? "Here's what's happening with your courses today." : "Voici ce qui se passe avec vos cours aujourd'hui."}
          </p>
        </div>
      </div>

      {liveSessionCount > 0 && (
        <Link
          to="/lecturer/attendance"
          className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-2xl px-5 py-3.5 mb-6 hover:bg-green-100 transition-colors animate-fade-in-up group"
        >
          <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
          </span>
          <CalendarCheck className="w-4 h-4 text-green-700 flex-shrink-0" strokeWidth={2} />
          <p className="text-sm font-semibold text-green-800 flex-1">
            {lang === "en"
              ? `You have ${liveSessionCount} live attendance session${liveSessionCount > 1 ? "s" : ""} running — confirm students now.`
              : `Vous avez ${liveSessionCount} session${liveSessionCount > 1 ? "s" : ""} de présence en direct — confirmez les étudiants maintenant.`}
          </p>
          <ArrowRight className="w-4 h-4 text-green-700 flex-shrink-0 group-hover:translate-x-0.5 transition-transform" strokeWidth={2.5} />
        </Link>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6 stagger-children">
        <StatCard icon={BookOpen} label={lang === "en" ? "Active Courses" : "Cours Actifs"} value={stats.activeCourses} accent="navy" loading={loading} />
        <StatCard icon={Users} label={lang === "en" ? "Total Students" : "Total Étudiants"} value={stats.totalStudents} accent="blue" loading={loading} />
        <StatCard icon={ClipboardCheck} label={lang === "en" ? "Pending Submissions" : "Soumissions en Attente"} value={stats.pendingSubmissions} accent="purple" loading={loading} />
        <StatCard icon={Award} label={lang === "en" ? "Published Results" : "Résultats Publiés"} value={stats.publishedResults} accent="green" loading={loading} />
      </div>

      {/* Quick actions */}
      <div className="mb-6 animate-fade-in-up" style={{ animationDelay: "0.05s" }}>
        <h3 className="text-xs font-bold text-slate uppercase tracking-wider mb-3">
          {lang === "en" ? "Quick Actions" : "Actions Rapides"}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 stagger-children">
          {QUICK_ACTIONS.map((a) => {
            const Icon = a.icon;
            return (
              <Link key={a.label} to={a.to} className="card card-hover p-5 group">
                <div className={`w-11 h-11 rounded-xl ${a.accent} flex items-center justify-center mb-3 group-hover:scale-105 transition-transform duration-200`}>
                  <Icon className="w-5 h-5" strokeWidth={2} />
                </div>
                <h4 className="font-bold text-ink text-sm mb-1">{a.label}</h4>
                <p className="text-xs text-slate leading-relaxed">{a.desc}</p>
                <div className="mt-3 flex items-center gap-1 text-xs font-bold text-brand group-hover:gap-2 transition-all">
                  {lang === "en" ? "Go" : "Aller"}
                  <ArrowRight className="w-3.5 h-3.5" strokeWidth={2.5} />
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* My Courses overview */}
      <div className="card overflow-hidden animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
          <h3 className="font-bold text-ink text-sm flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-navy" strokeWidth={2} />
            {lang === "en" ? "My Courses" : "Mes Cours"}
          </h3>
          <Link to="/lecturer/courses" className="text-xs font-semibold text-brand hover:text-brand-light transition-colors flex items-center gap-1">
            {lang === "en" ? "View all" : "Voir tout"}
            <ArrowRight className="w-3 h-3" strokeWidth={2.5} />
          </Link>
        </div>
        <div className="divide-y divide-gray-50">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} />)
          ) : courses.length === 0 ? (
            <div className="px-5 py-10">
              <EmptyState
                icon={BookOpen}
                title={lang === "en" ? "No courses yet" : "Aucun cours pour l'instant"}
                description={lang === "en" ? "Create your first course to get started." : "Créez votre premier cours pour commencer."}
                action={<Link to="/lecturer/courses" className="btn-primary">{lang === "en" ? "Create Course" : "Créer un Cours"}</Link>}
              />
            </div>
          ) : (
            courses.slice(0, 5).map((c) => (
              <Link key={c.id} to={`/lecturer/courses/${c.id}/materials`} className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50/60 transition-colors">
                <div>
                  <p className="font-semibold text-ink text-sm">{(lang === "fr" && c.title_fr) ? c.title_fr : c.title}</p>
                  {c.code && <p className="text-xs text-gray-400 mt-0.5">{c.code}</p>}
                </div>
                <Badge color={c.is_published ? "green" : "yellow"}>
                  {c.is_published ? (lang === "en" ? "Published" : "Publié") : (lang === "en" ? "Draft" : "Brouillon")}
                </Badge>
              </Link>
            ))
          )}
        </div>
      </div>
    </LecturerLayout>
  );
}
