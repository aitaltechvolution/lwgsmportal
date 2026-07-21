import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import StudentLayout from "@/components/StudentLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { useTranslation } from "react-i18next";
import {
  BookOpen, PencilLine, BarChart3, FolderOpen, CreditCard, Award,
  ArrowRight, Megaphone, CalendarClock, CheckCircle2, UserCircle2, X,
} from "lucide-react";
import { StatCard, Badge, EmptyState, SkeletonRow } from "@/components/ui/primitives";
import GradientBlobs from "@/components/ui/GradientBlobs";
import { useCurrency } from "@/contexts/CurrencyContext";

/* ── Types ── */
interface DashStats {
  coursesEnrolled: number;
  assignmentsPending: number;
  paymentDue: number;
}

interface Announcement {
  id: string;
  title_en: string;
  title_fr: string;
  body_en: string;
  body_fr: string;
  created_at: string;
  target_role: string | null;
}

interface UpcomingAssignment {
  id: string;
  title_en: string;
  title_fr: string;
  due_date: string;
  max_score: number | null;
  courses?: { title: string; title_fr?: string; code?: string };
}

interface EnrolledProgram {
  programs?: { title: string; title_fr?: string };
}

/* ── Quick links ── */
const QUICK_LINKS = [
  { to: "/student/courses",      labelEn: "My Courses",   labelFr: "Mes Cours",       icon: BookOpen },
  { to: "/student/assessments",  labelEn: "Assessments",  labelFr: "Évaluations",     icon: PencilLine },
  { to: "/student/results",      labelEn: "Results",      labelFr: "Résultats",       icon: BarChart3 },
  { to: "/student/library",      labelEn: "Library",      labelFr: "Bibliothèque",    icon: FolderOpen },
  { to: "/student/payments",     labelEn: "Payments",     labelFr: "Paiements",       icon: CreditCard },
  { to: "/student/certificates", labelEn: "Certificates", labelFr: "Certificats",     icon: Award },
];

/* ── Helpers ── */
function fmtDate(iso: string, lang: "en" | "fr") {
  return new Date(iso).toLocaleDateString(lang === "fr" ? "fr-FR" : "en-GB", { day: "numeric", month: "short" });
}
function daysUntil(iso: string) {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
}

/* ── Component ── */
export default function StudentPortal() {
  const { profile } = useAuth();
  const { i18n } = useTranslation();
  const lang = (i18n.language.startsWith("fr") ? "fr" : "en") as "en" | "fr";
  const { format } = useCurrency();

  const [stats, setStats] = useState<DashStats>({ coursesEnrolled: 0, assignmentsPending: 0, paymentDue: 0 });
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [upcoming, setUpcoming] = useState<UpcomingAssignment[]>([]);
  const [enrolledProgram, setEnrolledProgram] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  useEffect(() => {
    if (!profile?.id) return;

    async function fetchAll() {
      const id = profile!.id;

      const [enrollRes, payRes, annRes, programRes] = await Promise.all([
        supabase.from("enrollments").select("id, course_id", { count: "exact" }).eq("student_id", id).eq("status", "active"),
        supabase.from("payments").select("amount, amount_usd").eq("student_id", id).eq("status", "pending"),
        supabase.from("announcements").select("*").or("target_role.eq.student,target_role.is.null").order("created_at", { ascending: false }).limit(4),
        supabase.from("enrollments").select("programs(title, title_fr)").eq("student_id", id).not("program_id", "is", null).limit(1).maybeSingle(),
      ]);

      const courseIds = (enrollRes.data ?? []).map((e: { course_id: string }) => e.course_id).filter(Boolean);
      let pendingCount = 0;
      let upcomingList: UpcomingAssignment[] = [];

      if (courseIds.length > 0) {
        // Get all assignments for enrolled courses
        const asgRes = await supabase
          .from("assignments")
          .select("id, title_en, title_fr, due_date, max_score, courses(title, title_fr, code)")
          .in("course_id", courseIds)
          .gte("due_date", new Date().toISOString())
          .order("due_date")
          .limit(10);

        // Get submitted assignment IDs for this student
        const subRes = await supabase
          .from("submissions")
          .select("assignment_id")
          .eq("student_id", id);
        const submittedIds = new Set((subRes.data ?? []).map((s: {assignment_id: string}) => s.assignment_id));

        // Only count/show assignments NOT yet submitted
        const allUpcoming = (asgRes.data ?? []) as unknown as UpcomingAssignment[];
        upcomingList = allUpcoming.filter(a => !submittedIds.has(a.id)).slice(0, 3);
        pendingCount = upcomingList.length;
      }

      const totalDue = (payRes.data ?? []).reduce((sum: number, p: { amount: number; amount_usd: number | null }) => sum + (p.amount_usd ?? p.amount ?? 0), 0);

      const prog = programRes.data as EnrolledProgram | null;
      const progTitle = prog?.programs
        ? (lang === "fr" && (prog.programs as { title: string; title_fr?: string }).title_fr
            ? (prog.programs as { title: string; title_fr?: string }).title_fr
            : (prog.programs as { title: string; title_fr?: string }).title)
        : "";

      setStats({
        coursesEnrolled: enrollRes.count ?? 0,
        assignmentsPending: pendingCount,
        paymentDue: totalDue,
      });
      setAnnouncements((annRes.data ?? []) as Announcement[]);
      setUpcoming(upcomingList);
      setEnrolledProgram(progTitle ?? "");
      setLoading(false);
    }

    fetchAll();
  }, [profile?.id, lang]);

  const firstName = profile?.full_name?.split(" ")[0] ?? "";

  return (
    <StudentLayout>
      {/* ── Welcome banner ──────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl bg-navy p-6 md:p-8 mb-6 animate-fade-in-up">
        <GradientBlobs variant="dark" />
        <div className="relative z-10">
          <p className="text-amber-400 text-xs font-bold uppercase tracking-[0.15em] mb-1.5">
            {lang === "en" ? "Welcome back" : "Bon retour"}
          </p>
          <h2 className="text-white text-2xl md:text-3xl font-black mb-1 leading-tight">{firstName}</h2>
          {enrolledProgram && (
            <p className="text-white/50 text-sm">
              {lang === "en" ? "Enrolled in" : "Inscrit en"}{" "}
              <span className="text-white/85 font-semibold">{enrolledProgram}</span>
            </p>
          )}
          {profile?.matric_number && (
            <p className="text-white/50 text-sm mt-0.5">
              {lang === "en" ? "Matric No." : "N° Matricule"}{" "}
              <span className="text-white/85 font-semibold font-mono">{profile.matric_number}</span>
            </p>
          )}
          <Link
            to="/student/courses"
            className="mt-5 inline-flex items-center gap-2 bg-brand hover:bg-brand-light text-white text-sm font-bold px-5 py-2.5 rounded-xl transition-all duration-200 shadow-glow hover:-translate-y-0.5"
          >
            {lang === "en" ? "Continue Learning" : "Continuer à Apprendre"}
            <ArrowRight className="w-4 h-4" strokeWidth={2.5} />
          </Link>
        </div>
      </div>

      {/* ── Complete profile nudge (e.g. after Google sign-up) ── */}
      {!loading && !profile?.nationality && !bannerDismissed && (
        <div className="flex items-start sm:items-center justify-between gap-4 bg-orange-50 border border-amber-100 rounded-2xl px-5 py-4 mb-6 animate-fade-in-up">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
              <UserCircle2 className="w-5 h-5 text-brand" strokeWidth={2} />
            </div>
            <div>
              <p className="text-sm font-bold text-amber-900">
                {lang === "en" ? "Finish setting up your profile" : "Terminez la configuration de votre profil"}
              </p>
              <p className="text-xs text-amber-700/80 mt-0.5">
                {lang === "en" ? "Add your nationality and language preference so we can personalize your experience." : "Ajoutez votre nationalité et votre langue préférée pour personnaliser votre expérience."}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Link to="/student/profile" className="text-xs font-bold text-white bg-brand hover:bg-brand-light px-3.5 py-2 rounded-lg transition-colors whitespace-nowrap">
              {lang === "en" ? "Complete now" : "Compléter"}
            </Link>
            <button onClick={() => setBannerDismissed(true)} className="text-amber-400 hover:text-amber-600 p-1 transition-colors">
              <X className="w-4 h-4" strokeWidth={2} />
            </button>
          </div>
        </div>
      )}

      {/* ── Stats row ───────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6 stagger-children">
        <StatCard
          icon={BookOpen}
          label={lang === "en" ? "Courses Enrolled" : "Cours Inscrits"}
          value={stats.coursesEnrolled}
          accent="blue"
          loading={loading}
        />
        <StatCard
          icon={PencilLine}
          label={lang === "en" ? (stats.assignmentsPending === 0 ? "All Caught Up!" : "Assessments Pending") : (stats.assignmentsPending === 0 ? "Tout est à jour !" : "Évaluations en Attente")}
          value={stats.assignmentsPending}
          accent="purple"
          loading={loading}
        />
        <StatCard
          icon={Megaphone}
          label={lang === "en" ? "Unread Messages" : "Messages non lus"}
          value={0}
          accent="orange"
          loading={loading}
        />
        <StatCard
          icon={CreditCard}
          label={lang === "en" ? "Payment Due" : "Paiement Dû"}
          value={
            loading ? "—"
            : stats.paymentDue > 0 ? format(stats.paymentDue)
            : (lang === "en" ? "All clear" : "Tout réglé")
          }
          accent={stats.paymentDue > 0 ? "red" : "green"}
          loading={loading}
        />
      </div>

      {/* ── Middle row: Announcements + Upcoming ─────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Announcements */}
        <div className="card overflow-hidden animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
            <h3 className="font-bold text-ink text-sm flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-navy" strokeWidth={2} />
              {lang === "en" ? "Announcements" : "Annonces"}
            </h3>
          </div>
          <div className="divide-y divide-gray-50">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} />)
            ) : announcements.length === 0 ? (
              <div className="px-5 py-10">
                <EmptyState icon={Megaphone} title={lang === "en" ? "No announcements right now" : "Aucune annonce pour l'instant"} />
              </div>
            ) : (
              announcements.map((ann) => (
                <div key={ann.id} className="px-5 py-4 hover:bg-gray-50/60 transition-colors">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="font-semibold text-ink text-sm leading-snug">
                      {lang === "fr" ? (ann.title_fr || ann.title_en) : ann.title_en}
                    </p>
                    <span className="text-[11px] text-gray-400 flex-shrink-0 mt-0.5">{fmtDate(ann.created_at, lang)}</span>
                  </div>
                  <p className="text-xs text-slate leading-relaxed line-clamp-2">
                    {lang === "fr" ? (ann.body_fr || ann.body_en) : ann.body_en}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Upcoming Assessments */}
        <div className="card overflow-hidden animate-fade-in-up" style={{ animationDelay: "0.15s" }}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
            <h3 className="font-bold text-ink text-sm flex items-center gap-2">
              <CalendarClock className="w-4 h-4 text-navy" strokeWidth={2} />
              {lang === "en" ? "Upcoming Assessments" : "Prochaines Évaluations"}
            </h3>
            <Link to="/student/assessments" className="text-xs font-semibold text-brand hover:text-brand-light transition-colors flex items-center gap-1">
              {lang === "en" ? "View all" : "Voir tout"}
              <ArrowRight className="w-3 h-3" strokeWidth={2.5} />
            </Link>
          </div>
          <div className="divide-y divide-gray-50">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} />)
            ) : upcoming.length === 0 ? (
              <div className="px-5 py-10">
                <EmptyState icon={CheckCircle2} title={lang === "en" ? "No upcoming assessments" : "Aucune évaluation prochaine"} description={lang === "en" ? "You're all caught up!" : "Vous êtes à jour !"} />
              </div>
            ) : (
              upcoming.map((asgn) => {
                const days = daysUntil(asgn.due_date);
                const urgent = days <= 2;
                const soon = days <= 7;
                return (
                  <div key={asgn.id} className="px-5 py-4 flex items-start gap-4 hover:bg-gray-50/60 transition-colors">
                    <div className={`w-10 h-10 rounded-xl flex flex-col items-center justify-center flex-shrink-0 text-center
                      ${urgent ? "bg-red-50 text-red-700" : soon ? "bg-yellow-50 text-yellow-700" : "bg-blue-50 text-blue-700"}`}>
                      <span className="text-[11px] font-black leading-none">{new Date(asgn.due_date).getDate()}</span>
                      <span className="text-[9px] font-semibold uppercase">
                        {new Date(asgn.due_date).toLocaleString(lang === "fr" ? "fr-FR" : "en-GB", { month: "short" })}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-ink text-sm leading-snug truncate">
                        {lang === "fr" ? (asgn.title_fr || asgn.title_en) : asgn.title_en}
                      </p>
                      {asgn.courses && (
                        <p className="text-xs text-slate mt-0.5 truncate">
                          {asgn.courses.code ? `${asgn.courses.code} · ` : ""}
                          {lang === "fr" ? (asgn.courses.title_fr || asgn.courses.title) : asgn.courses.title}
                        </p>
                      )}
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <Badge color={urgent ? "red" : soon ? "yellow" : "gray"}>
                        {days === 0 ? (lang === "en" ? "Today" : "Aujourd'hui")
                          : days === 1 ? (lang === "en" ? "Tomorrow" : "Demain")
                          : `${days}d`}
                      </Badge>
                      {asgn.max_score && <div className="text-[11px] text-gray-400 mt-1">{asgn.max_score} pts</div>}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* ── Quick links ─────────────────────────────────────── */}
      <div className="animate-fade-in-up" style={{ animationDelay: "0.2s" }}>
        <h3 className="text-xs font-bold text-slate uppercase tracking-wider mb-3">
          {lang === "en" ? "Quick Access" : "Accès Rapide"}
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 stagger-children">
          {QUICK_LINKS.map((ql) => {
            const Icon = ql.icon;
            return (
              <Link
                key={ql.to}
                to={ql.to}
                className="card card-hover flex flex-col items-center gap-2.5 p-4 text-center group"
              >
                <div className="w-11 h-11 rounded-xl bg-navy/5 flex items-center justify-center group-hover:bg-navy transition-colors duration-300">
                  <Icon className="w-5 h-5 text-navy group-hover:text-white transition-colors duration-300" strokeWidth={2} />
                </div>
                <span className="text-xs font-bold text-ink leading-tight">
                  {lang === "en" ? ql.labelEn : ql.labelFr}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </StudentLayout>
  );
}