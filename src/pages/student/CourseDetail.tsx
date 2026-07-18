import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import StudentLayout from "@/components/StudentLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { useTranslation } from "react-i18next";
import {
  Search, BookOpen, FileText, Video, Paperclip, Lock, Eye,
  ClipboardList, GraduationCap, Clock, Award, Mail, FolderOpen, X,
  ChevronRight, CheckCircle2, Download,
} from "lucide-react";
import { Badge, ProgressBar, EmptyState, SkeletonRow } from "@/components/ui/primitives";
import { useCurrency } from "@/contexts/CurrencyContext";
import SecureFileViewer from "@/components/SecureFileViewer";
import { logUsageEvent } from "@/lib/usageEvents";

/* ── Types ── */
interface Course {
  id: string; title: string; title_fr: string | null; code: string | null;
  description: string | null; description_fr: string | null; objectives: string | null;
  duration: string | null; credits: number | null; is_published: boolean;
  programs?: { title: string; title_fr?: string; type?: string } | null;
  profiles?: { full_name: string; title: string | null; email: string } | null;
}
interface Material {
  id: string; title_en: string; title_fr: string | null; type: "note" | "video" | "file";
  url: string | null; content_en: string | null; content_fr: string | null;
  is_premium: boolean; price: number | null; sort_order: number | null;
}
interface Assignment {
  id: string; title_en: string; title_fr: string | null;
  description_en: string | null; description_fr: string | null;
  due_date: string | null; max_score: number | null;
  time_limit_minutes: number | null;
  submission?: { id: string; score: number | null; submitted_at: string } | null;
}
interface Grade {
  id: string; score: number | null; grade: string | null; remarks: string | null;
  graded_at: string | null;
  assignments?: { title_en: string; max_score: number | null } | null;
}
interface Enrollment {
  id: string; progress_pct: number | null; status: string;
}
type TabKey = "overview" | "materials" | "assignments" | "grades";

const MAT_META: Record<string, { icon: typeof FileText; bg: string; text: string }> = {
  note:  { icon: FileText,  bg: "bg-blue-50",  text: "text-blue-600" },
  video: { icon: Video,     bg: "bg-red-50",   text: "text-red-600"  },
  file:  { icon: Paperclip, bg: "bg-gray-100", text: "text-gray-600" },
};

function daysUntil(iso: string) {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
}
function gradeColor(score: number, max: number) {
  const pct = (score / max) * 100;
  if (pct >= 75) return "text-green-600";
  if (pct >= 50) return "text-yellow-600";
  return "text-red-600";
}

export default function CourseDetail() {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const lang = (i18n.language.startsWith("fr") ? "fr" : "en") as "en" | "fr";
  const { format } = useCurrency();

  const [course, setCourse]           = useState<Course | null>(null);
  const [materials, setMaterials]     = useState<Material[]>([]);
  const [unlockedMaterialIds, setUnlockedMaterialIds] = useState<Set<string>>(new Set());
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [grades, setGrades]           = useState<Grade[]>([]);
  const [enrollment, setEnrollment]   = useState<Enrollment | null>(null);
  const [tab, setTab]                 = useState<TabKey>("overview");
  const [loading, setLoading]         = useState(true);
  const [hasPaidRegistration, setHasPaidRegistration] = useState<boolean | null>(null);
  const [registrationFee, setRegistrationFee] = useState<number>(10000);
  const [viewingMat, setViewingMat]   = useState<Material | null>(null);
  const [readingMat, setReadingMat]   = useState<Material | null>(null);

  // Persistent progress from DB — materialId -> { seconds_spent, completed }
  const [matProgress, setMatProgress] = useState<Record<string, { seconds: number; completed: boolean }>>({});
  // Active timer for the currently open material
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeMatRef = useRef<Material | null>(null);
  const accSecondsRef = useRef<number>(0);

  const load = useCallback(async () => {
    if (!id || !profile?.id) return;
    setLoading(true);

    const [cRes, mRes, aRes, gRes, eRes, subRes, unlockRes, regRes, regFeeRes] = await Promise.all([
      supabase.from("courses")
        .select("*, programs(title,title_fr,type), profiles(full_name,title,email)")
        .eq("id", id).maybeSingle(),
      supabase.from("course_materials").select("*").eq("course_id", id)
        .order("sort_order", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: true }),
      supabase.from("assignments").select("id,title_en,title_fr,description_en,description_fr,due_date,max_score,time_limit_minutes")
        .eq("course_id", id).order("due_date", { ascending: true }),
      supabase.from("grades").select("*, assignments(title_en, max_score)")
        .eq("student_id", profile.id).eq("course_id", id),
      supabase.from("enrollments").select("*").eq("course_id", id).eq("student_id", profile.id).maybeSingle(),
      supabase.from("submissions").select("id,assignment_id,score,submitted_at")
        .eq("student_id", profile.id),
      supabase.from("payments").select("material_id, status, manual_confirmed")
        .eq("student_id", profile.id).not("material_id", "is", null),
      supabase.from("payments").select("id, status, manual_confirmed, course_id")
        .eq("student_id", profile.id).eq("type", "registration"),
      supabase.from("site_settings").select("key, value").in("key", ["fee_reg_certificate", "fee_reg_diploma", "fee_reg_pastoral"]),
    ]);

    const course = cRes.data as Course | null;
    const progType = course?.programs?.type ?? "certificate";
    const feeMap = new Map((regFeeRes.data ?? []).map((r: { key: string; value: string }) => [r.key, r.value]));
    const feeKey = progType === "diploma" ? "fee_reg_diploma" : progType === "pastoral" ? "fee_reg_pastoral" : "fee_reg_certificate";
    setRegistrationFee(Number(feeMap.get(feeKey) ?? (progType === "certificate" ? 10000 : 0)));

    // A registration payment counts for THIS course specifically if it's
    // tagged with this course_id — a payment made for a different course
    // does not unlock this one.
    setHasPaidRegistration(
      (regRes.data ?? []).some((p: { status: string; manual_confirmed: boolean; course_id: string | null }) =>
        p.course_id === id && (p.status === "success" || p.manual_confirmed))
    );

    const assignmentsWithSubs = ((aRes.data ?? []) as Assignment[]).map(a => ({
      ...a,
      submission: (subRes.data ?? []).find((s: { assignment_id: string }) => s.assignment_id === a.id) ?? null,
    }));

    // Load material progress from DB
    const progRes = await supabase
      .from("material_progress")
      .select("material_id, seconds_spent, completed")
      .eq("student_id", profile.id)
      .eq("course_id", id);

    const progressMap: Record<string, { seconds: number; completed: boolean }> = {};
    (progRes.data ?? []).forEach((row: { material_id: string; seconds_spent: number; completed: boolean }) => {
      progressMap[row.material_id] = { seconds: row.seconds_spent, completed: row.completed };
    });

    setCourse(cRes.data as Course | null);
    setMaterials((mRes.data ?? []) as Material[]);
    setUnlockedMaterialIds(new Set(
      (unlockRes.data ?? [])
        .filter((p: { status: string; manual_confirmed: boolean }) => p.status === "success" || p.manual_confirmed)
        .map((p: { material_id: string }) => p.material_id)
    ));
    setAssignments(assignmentsWithSubs);
    setGrades((gRes.data ?? []) as Grade[]);
    setEnrollment(eRes.data as Enrollment | null);
    setMatProgress(progressMap);
    setLoading(false);
  }, [id, profile?.id]);

  useEffect(() => { load(); }, [load]);

  // Start tracking time when material is opened
  const startTracking = useCallback((mat: Material) => {
    if (!profile?.id || !id) return;
    // Stop any existing timer
    if (timerRef.current) clearInterval(timerRef.current);
    activeMatRef.current = mat;
    accSecondsRef.current = matProgress[mat.id]?.seconds ?? 0;

    // Tick every 5 seconds — saves to DB incrementally
    timerRef.current = setInterval(async () => {
      accSecondsRef.current += 5;
      const seconds = accSecondsRef.current;
      const { data } = await supabase.rpc("upsert_material_progress", {
        p_student_id: profile.id,
        p_material_id: mat.id,
        p_course_id: id,
        p_seconds: seconds,
        p_type: mat.type,
      });
      if (data && data[0]) {
        const row = data[0] as { seconds_spent: number; completed: boolean };
        setMatProgress(prev => ({ ...prev, [mat.id]: { seconds: row.seconds_spent, completed: row.completed } }));
        if (row.completed) {
          // Refresh progress including assignments
          await refreshProgress();
        }
      }
    }, 5000);

    logUsageEvent(profile.id, "material_view", { courseId: id, materialId: mat.id });
  }, [profile?.id, id, matProgress]);

  // Stop tracking when material is closed
  const stopTracking = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    activeMatRef.current = null;
  }, []);

  // Recalculate progress: materials + assignments.
  // Calls a SECURITY DEFINER RPC so it always persists regardless
  // of client-side RLS — a raw client .update() here was silently
  // getting blocked and never actually saving.
  const refreshProgress = useCallback(async () => {
    if (!profile?.id || !id) return;
    const { data: pct, error } = await supabase.rpc("refresh_course_progress", {
      p_student_id: profile.id,
      p_course_id: id,
    });
    if (!error && typeof pct === "number") {
      setEnrollment(prev => prev ? { ...prev, progress_pct: pct } : prev);
    }
  }, [profile?.id, id]);

  // Cleanup on unmount
  useEffect(() => () => stopTracking(), [stopTracking]);

  // Alias for opening materials  
  const markViewed = startTracking;

  const openMaterial = (mat: Material) => {
    // For videos: only start tracking when they actually play (handled in SecureFileViewer)
    // For notes/files: start tracking immediately on open
    if (mat.type !== "video") markViewed(mat);
    if (mat.url) setViewingMat(mat);
    else setReadingMat(mat);
  };

  // Called by SecureFileViewer when video actually starts playing
  const onVideoPlay = (mat: Material) => {
    markViewed(mat);
  };
  const onMediaError = (_mat: Material) => {
    // Media failed to load — do NOT mark as done
    stopTracking();
  };

  const closeMaterial = () => {
    stopTracking();
    setViewingMat(null);
    setReadingMat(null);
  };

  if (loading) {
    return (
      <StudentLayout>
        <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}</div>
      </StudentLayout>
    );
  }

  if (!course) {
    return (
      <StudentLayout>
        <EmptyState icon={Search}
          title={lang === "en" ? "Course not found" : "Cours introuvable"}
          description={lang === "en" ? "This course may have been removed or is not yet published." : "Ce cours a peut-être été retiré ou n'est pas encore publié."}
          action={<Link to="/student/courses" className="btn-outline">{lang === "en" ? "Back to My Courses" : "Retour aux Cours"}</Link>}
        />
      </StudentLayout>
    );
  }

  if (hasPaidRegistration === false) {
    return (
      <StudentLayout>
        <EmptyState icon={Lock}
          title={lang === "en" ? "Complete Your Registration to Continue" : "Complétez Votre Inscription pour Continuer"}
          description={lang === "en"
            ? "Access to course content requires your registration fee to be paid and confirmed first. Once it's confirmed, this course will unlock automatically."
            : "L'accès au contenu des cours nécessite le paiement et la confirmation de vos frais d'inscription. Une fois confirmé, ce cours se déverrouillera automatiquement."}
          action={
            <Link
              to={`/student/payments?registerCourse=${id}&amount=${registrationFee}&courseTitle=${encodeURIComponent((lang === "fr" && course.title_fr) ? course.title_fr : course.title)}`}
              className="btn-primary">
              {lang === "en" ? `Pay Registration Fee (${format(registrationFee)})` : `Payer les Frais d'Inscription (${format(registrationFee)})`}
            </Link>
          }
        />
      </StudentLayout>
    );
  }

  const title = (lang === "fr" && course.title_fr) ? course.title_fr : course.title;
  const progress = enrollment?.progress_pct ?? 0;

  const TABS: { id: TabKey; en: string; fr: string; count?: number }[] = [
    { id: "overview",    en: "Overview",    fr: "Aperçu" },
    { id: "materials",   en: "Materials",   fr: "Ressources",  count: materials.length },
    { id: "assignments", en: "Assignments", fr: "Devoirs",      count: assignments.length },
    { id: "grades",      en: "Grades",      fr: "Notes",        count: grades.length },
  ];

  const submittedCount = assignments.filter(a => a.submission).length;
  const pendingCount   = assignments.filter(a => !a.submission && (!a.due_date || daysUntil(a.due_date) >= 0)).length;

  return (
    <StudentLayout breadcrumbs={[{ label: lang === "en" ? "My Courses" : "Mes Cours", to: "/student/courses" }, { label: title }]}>

      {/* ── Hero card ── */}
      <div className="relative overflow-hidden rounded-2xl bg-navy p-6 md:p-8 mb-6 animate-fade-in-up">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 relative z-10">
          <div className="flex-1 min-w-0">
            {course.code && <Badge color="orange">{course.code}</Badge>}
            <h1 className="text-white text-2xl md:text-3xl font-black leading-snug mt-3 mb-3">{title}</h1>
            {course.profiles?.full_name && (
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                  {course.profiles.full_name.charAt(0)}
                </div>
                <div>
                  <span className="text-white/90 text-sm font-semibold">{course.profiles.full_name}</span>
                  {course.profiles.title && <span className="text-white/40 text-xs"> · {course.profiles.title}</span>}
                </div>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {course.credits != null && (
                <span className="flex items-center gap-1.5 text-xs text-white/60 bg-white/[0.06] px-3 py-1.5 rounded-full font-medium">
                  <Award className="w-3.5 h-3.5" strokeWidth={2} />{course.credits} {lang === "en" ? "credits" : "crédits"}
                </span>
              )}
              {course.duration && (
                <span className="flex items-center gap-1.5 text-xs text-white/60 bg-white/[0.06] px-3 py-1.5 rounded-full font-medium">
                  <Clock className="w-3.5 h-3.5" strokeWidth={2} />{course.duration}
                </span>
              )}
              {course.programs && (
                <span className="flex items-center gap-1.5 text-xs text-white/60 bg-white/[0.06] px-3 py-1.5 rounded-full font-medium">
                  <BookOpen className="w-3.5 h-3.5" strokeWidth={2} />
                  {(lang === "fr" && course.programs.title_fr) ? course.programs.title_fr : course.programs.title}
                </span>
              )}
            </div>
          </div>
          {enrollment && (
            <div className="flex-shrink-0 bg-white/[0.06] rounded-2xl p-4 min-w-[140px] text-center border border-white/[0.08]">
              <div className={`text-3xl font-black mb-0.5 ${progress >= 80 ? "text-green-400" : progress >= 40 ? "text-yellow-300" : "text-white"}`}>
                {progress}%
              </div>
              <div className="text-white/50 text-xs font-medium mb-2">{lang === "en" ? "Progress" : "Progression"}</div>
              <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-1000 ease-out ${progress >= 80 ? "bg-green-400" : progress >= 40 ? "bg-yellow-300" : "bg-brand"}`}
                  style={{ width: `${progress}%` }} />
              </div>
              {submittedCount > 0 && (
                <p className="text-[11px] text-white/30 mt-2">{submittedCount} {lang === "en" ? "submitted" : "soumis"}</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="card overflow-hidden animate-fade-in-up" style={{ animationDelay: "0.08s" }}>
        <div className="flex gap-0 border-b border-gray-100 overflow-x-auto px-4 scrollbar-thin">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-semibold border-b-2 whitespace-nowrap transition-colors
                ${tab === t.id ? "border-brand text-brand" : "border-transparent text-slate hover:text-ink hover:border-gray-200"}`}>
              {lang === "en" ? t.en : t.fr}
              {t.count !== undefined && (
                <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-bold ${tab === t.id ? "bg-orange-50 text-brand" : "bg-gray-100 text-gray-500"}`}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── OVERVIEW ── */}
        {tab === "overview" && (
          <div className="p-6 space-y-6 animate-fade-in">
            {(course.description || course.description_fr) && (
              <div>
                <h3 className="text-xs font-bold text-slate uppercase tracking-wider mb-3">{lang === "en" ? "About This Course" : "À Propos"}</h3>
                <p className="text-ink text-sm leading-relaxed">{(lang === "fr" && course.description_fr) ? course.description_fr : course.description}</p>
              </div>
            )}
            {course.objectives && (
              <div>
                <h3 className="text-xs font-bold text-slate uppercase tracking-wider mb-3">{lang === "en" ? "Learning Objectives" : "Objectifs Pédagogiques"}</h3>
                <ul className="space-y-2.5">
                  {course.objectives.split("\n").filter(Boolean).map((obj, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-ink">
                      <span className="w-5 h-5 rounded-full bg-orange-50 text-brand flex items-center justify-center text-[11px] font-bold flex-shrink-0 mt-0.5">{i + 1}</span>
                      {obj.replace(/^[-•*]\s*/, "")}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {course.profiles?.full_name && (
              <div>
                <h3 className="text-xs font-bold text-slate uppercase tracking-wider mb-3">{lang === "en" ? "Lecturer" : "Enseignant"}</h3>
                <div className="flex items-start gap-4 bg-gray-50 rounded-xl p-4 border border-gray-100">
                  <div className="w-12 h-12 rounded-full bg-navy flex items-center justify-center text-white font-black text-lg flex-shrink-0">
                    {course.profiles.full_name.charAt(0)}
                  </div>
                  <div>
                    <div className="font-bold text-ink">{course.profiles.full_name}</div>
                    {course.profiles.title && <div className="text-sm text-brand font-medium">{course.profiles.title}</div>}
                    {course.profiles.email && (
                      <a href={`mailto:${course.profiles.email}`}
                        className="flex items-center gap-1.5 text-xs text-slate hover:text-navy transition-colors mt-1">
                        <Mail className="w-3.5 h-3.5" strokeWidth={2} />{course.profiles.email}
                      </a>
                    )}
                  </div>
                </div>
              </div>
            )}
            {!course.description && !course.objectives && !course.profiles?.full_name && (
              <EmptyState icon={BookOpen} title={lang === "en" ? "Course details coming soon" : "Détails bientôt disponibles"} />
            )}
          </div>
        )}

        {/* ── MATERIALS ── */}
        {tab === "materials" && (
          <div className="animate-fade-in">
            {materials.length === 0 ? (
              <div className="p-6"><EmptyState icon={FolderOpen} title={lang === "en" ? "No materials uploaded yet" : "Aucune ressource disponible"} /></div>
            ) : (
              <>
                <div className="px-5 py-3 bg-gray-50/60 flex items-center justify-between border-b border-gray-50">
                  <span className="text-xs font-bold text-slate uppercase tracking-wider">
                    {materials.length} {lang === "en" ? "resource(s)" : "ressource(s)"}
                  </span>
                  <span className="text-xs text-gray-400">
                    {Object.values(matProgress).filter(p => p.completed).length}/{materials.filter(m => !m.is_premium).length} {lang === "en" ? "completed" : "complétés"}
                  </span>
                </div>
                <div className="divide-y divide-gray-50">
                  {materials.map((mat, idx) => {
                    const meta = MAT_META[mat.type] ?? MAT_META.file;
                    const Icon = meta.icon;
                    const matTitle = (lang === "fr" && mat.title_fr) ? mat.title_fr : mat.title_en;
                    const progress = matProgress[mat.id];
                    const viewed = progress?.completed ?? false;
                    const partiallyRead = !viewed && (progress?.seconds ?? 0) >= 5;
                    return (
                      <div key={mat.id} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50/60 transition-colors group">
                        <div className="relative">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${meta.bg}`}>
                            <Icon className={`w-[18px] h-[18px] ${meta.text}`} strokeWidth={2} />
                          </div>
                          {viewed && (
                            <span className="absolute -top-1.5 -right-1.5 bg-green-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full leading-none shadow-sm">✓ Done</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[11px] text-gray-300 font-bold">{idx + 1}.</span>
                            <p className="font-semibold text-ink text-sm truncate">{matTitle}</p>
                            {mat.is_premium && <Badge color="yellow" icon={Lock}>Premium</Badge>}
                          </div>
                          <p className={`text-[11px] font-medium mt-0.5 capitalize ${meta.text} opacity-70`}>
                            {mat.type}{mat.is_premium && mat.price ? ` · ${format(mat.price)}` : ""}
                          </p>
                        </div>
                        {/* Reading time indicator */}
                      {!mat.is_premium && (matProgress[mat.id]?.seconds ?? 0) > 0 && !viewed && (
                        <div className="w-full mt-1.5 h-1 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-amber-400 rounded-full transition-all duration-300"
                            style={{ width: `${Math.min(100, ((matProgress[mat.id]?.seconds ?? 0) / (mat.type === "video" ? 60 : 30)) * 100)}%` }}
                          />
                        </div>
                      )}
                      {mat.is_premium && !unlockedMaterialIds.has(mat.id) ? (
                          <button
                            onClick={() => navigate(`/student/payments?unlock=${mat.id}&course=${id}&price=${mat.price ?? 0}&title=${encodeURIComponent((lang === "fr" && mat.title_fr) ? mat.title_fr : mat.title_en)}`)}
                            className="flex-shrink-0 flex items-center gap-1.5 text-xs font-bold text-yellow-700 bg-yellow-50 hover:bg-yellow-100 border border-yellow-200 px-3 py-1.5 rounded-lg transition-colors">
                            <Lock className="w-3.5 h-3.5" strokeWidth={2} />
                            {lang === "en" ? "Unlock" : "Déverrouiller"}
                            {mat.price ? <span className="ml-1 opacity-60">${mat.price}</span> : null}
                          </button>
                        ) : mat.is_premium ? (
                          <div className="flex-shrink-0 flex items-center gap-2">
                            <button
                              onClick={() => openMaterial(mat)}
                              className="flex items-center gap-1.5 text-xs font-bold text-navy bg-navy/5 hover:bg-navy hover:text-white px-3 py-1.5 rounded-lg transition-all">
                              <Eye className="w-3.5 h-3.5" strokeWidth={2.5} />
                              {lang === "en" ? "View" : "Consulter"}
                            </button>
                            {mat.url && (
                              <a
                                href={mat.url} download target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-1.5 text-xs font-bold text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 px-3 py-1.5 rounded-lg transition-colors">
                                <Download className="w-3.5 h-3.5" strokeWidth={2.5} />
                                {lang === "en" ? "Download" : "Télécharger"}
                              </a>
                            )}
                          </div>
                        ) : (
                          <button
                            onClick={() => openMaterial(mat)}
                            className="flex-shrink-0 flex items-center gap-1.5 text-xs font-bold text-navy bg-navy/5 hover:bg-navy hover:text-white px-3 py-1.5 rounded-lg transition-all">
                            <Eye className="w-3.5 h-3.5" strokeWidth={2.5} />
                            {mat.url ? (lang === "en" ? "View" : "Consulter") : (lang === "en" ? "Read" : "Lire")}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── ASSIGNMENTS ── */}
        {tab === "assignments" && (
          <div className="animate-fade-in">
            {assignments.length === 0 ? (
              <div className="p-6"><EmptyState icon={ClipboardList} title={lang === "en" ? "No assignments yet" : "Aucun devoir pour l'instant"} /></div>
            ) : (
              <>
                {(submittedCount > 0 || pendingCount > 0) && (
                  <div className="px-5 py-3 bg-gray-50/60 border-b border-gray-50 flex gap-4 text-xs font-semibold">
                    <span className="text-green-600">{submittedCount} {lang === "en" ? "submitted" : "soumis"}</span>
                    {pendingCount > 0 && <span className="text-amber-600">{pendingCount} {lang === "en" ? "pending" : "en attente"}</span>}
                  </div>
                )}
                <div className="divide-y divide-gray-50">
                  {assignments.map(a => {
                    const due = a.due_date ? new Date(a.due_date) : null;
                    const days = due ? daysUntil(a.due_date!) : null;
                    const overdue  = days !== null && days < 0;
                    const urgent   = days !== null && days >= 0 && days <= 2;
                    const soon     = days !== null && days >= 0 && days <= 7;
                    const done     = !!a.submission;

                    return (
                      /* ── Clickable assignment row → takes student to do it ── */
                      <button
                        key={a.id}
                        onClick={() => navigate(`/student/assessments/${a.id}`)}
                        className="w-full text-left px-5 py-4 hover:bg-gray-50/70 transition-colors group">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              {done && <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" strokeWidth={2.5} />}
                              <h4 className="font-bold text-ink text-sm group-hover:text-brand transition-colors">
                                {(lang === "fr" && a.title_fr) ? a.title_fr : a.title_en}
                              </h4>
                            </div>
                            {(a.description_en || a.description_fr) && (
                              <p className="text-xs text-slate leading-relaxed line-clamp-2 mb-2">
                                {(lang === "fr" && a.description_fr) ? a.description_fr : a.description_en}
                              </p>
                            )}
                            <div className="flex flex-wrap items-center gap-2">
                              {a.max_score && <Badge color="gray">{a.max_score} pts</Badge>}
                              {a.time_limit_minutes && (
                                <Badge color="navy" icon={Clock}>{a.time_limit_minutes} min</Badge>
                              )}
                              {done && a.submission?.score != null && a.max_score && (
                                <Badge color="green" icon={CheckCircle2}>
                                  {a.submission.score}/{a.max_score}
                                </Badge>
                              )}
                              {due && !done && (
                                <Badge color={overdue ? "red" : urgent ? "orange" : soon ? "yellow" : "blue"}>
                                  {overdue
                                    ? (lang === "en" ? "Overdue" : "En retard")
                                    : days === 0 ? (lang === "en" ? "Due today" : "Aujourd'hui")
                                    : days === 1 ? (lang === "en" ? "Due tomorrow" : "Demain")
                                    : `${lang === "en" ? "Due in" : "Dans"} ${days}d`}
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {due && (
                              <div className={`w-11 h-11 rounded-xl flex flex-col items-center justify-center border text-center
                                ${overdue ? "border-red-200 bg-red-50 text-red-700"
                                  : urgent ? "border-amber-200 bg-orange-50 text-amber-700"
                                  : done ? "border-green-200 bg-green-50 text-green-700"
                                  : "border-gray-200 bg-gray-50 text-gray-700"}`}>
                                <span className="text-sm font-black leading-none">{due.getDate()}</span>
                                <span className="text-[9px] font-bold uppercase">
                                  {due.toLocaleString(lang === "fr" ? "fr-FR" : "en-GB", { month: "short" })}
                                </span>
                              </div>
                            )}
                            <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-brand transition-colors" strokeWidth={2.5} />
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── GRADES ── */}
        {tab === "grades" && (
          <div className="p-5 animate-fade-in">
            {grades.length === 0 ? (
              <EmptyState icon={GraduationCap} title={lang === "en" ? "No grades recorded yet" : "Aucune note enregistrée"} />
            ) : (
              <div className="space-y-3">
                <div className="bg-gray-50 rounded-xl p-4 mb-2 border border-gray-100">
                  <div className="text-xs font-bold text-slate uppercase tracking-wider mb-2">{lang === "en" ? "Grade Summary" : "Récapitulatif"}</div>
                  <div className="flex items-center gap-6">
                    <div>
                      <span className="text-2xl font-black text-navy">{grades.filter(g => g.score !== null).length}</span>
                      <span className="text-xs text-slate ml-1.5">{lang === "en" ? "graded" : "notés"}</span>
                    </div>
                    {grades.filter(g => g.score !== null && g.assignments?.max_score).length > 0 && (
                      <div>
                        <span className="text-2xl font-black text-green-600">
                          {Math.round(
                            grades.filter(g => g.score !== null && g.assignments?.max_score)
                              .reduce((sum, g) => sum + ((g.score! / g.assignments!.max_score!) * 100), 0)
                            / grades.filter(g => g.score !== null && g.assignments?.max_score).length
                          )}%
                        </span>
                        <span className="text-xs text-slate ml-1.5">{lang === "en" ? "avg score" : "moy."}</span>
                      </div>
                    )}
                  </div>
                </div>
                {grades.map(g => {
                  const maxScore = g.assignments?.max_score ?? 100;
                  const pct = g.score !== null ? Math.round((g.score / maxScore) * 100) : null;
                  return (
                    <div key={g.id} className="bg-white rounded-xl border border-gray-100 p-4 flex items-start gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-ink text-sm">{g.assignments?.title_en ?? (lang === "en" ? "Assignment" : "Devoir")}</p>
                        {g.remarks && <p className="text-xs text-slate mt-1 leading-relaxed">{g.remarks}</p>}
                        {g.graded_at && (
                          <p className="text-[11px] text-gray-400 mt-1">
                            {lang === "en" ? "Graded" : "Noté"}{" "}
                            {new Date(g.graded_at).toLocaleDateString(lang === "fr" ? "fr-FR" : "en-GB", { day: "numeric", month: "short" })}
                          </p>
                        )}
                      </div>
                      <div className="flex-shrink-0 text-right">
                        {g.score !== null ? (
                          <>
                            <div className={`text-xl font-black ${gradeColor(g.score, maxScore)}`}>
                              {g.score}<span className="text-sm font-semibold text-gray-400">/{maxScore}</span>
                            </div>
                            {pct !== null && <div className={`text-xs font-bold mt-0.5 ${gradeColor(g.score, maxScore)}`}>{pct}%</div>}
                            {g.grade && <div className="text-xs font-black text-white bg-navy px-2 py-0.5 rounded-full mt-1 inline-block">{g.grade}</div>}
                          </>
                        ) : (
                          <span className="text-xs text-gray-400 italic">{lang === "en" ? "Pending" : "En attente"}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Material viewer */}
      {viewingMat && viewingMat.url && (
        <SecureFileViewer open={!!viewingMat} onClose={() => closeMaterial()}
          title={(lang === "fr" && viewingMat.title_fr) ? viewingMat.title_fr : viewingMat.title_en}
          storedUrl={viewingMat.url} kind={viewingMat.type}
          onVideoPlay={() => onVideoPlay(viewingMat)}
          onMediaError={() => onMediaError(viewingMat)} />
      )}

      {readingMat && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 animate-fade-in">
          <div className="absolute inset-0 bg-black/60" onClick={() => setReadingMat(null)} />
          <div
            className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl flex flex-col select-none"
            style={{ maxHeight: "85vh" }}
            onContextMenu={e => e.preventDefault()} onCopy={e => e.preventDefault()}
          >
            {/* Header with X */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
              <h3 className="font-bold text-ink text-base truncate pr-4">
                {(lang === "fr" && readingMat.title_fr) ? readingMat.title_fr : readingMat.title_en}
              </h3>
              <button
                onClick={() => setReadingMat(null)}
                className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:text-ink hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5" strokeWidth={2} />
              </button>
            </div>
            {/* Scrollable content */}
            <div className="overflow-y-auto flex-1 px-6 py-5">
              <div className="text-sm text-ink whitespace-pre-wrap leading-relaxed">
                {((lang === "fr" && readingMat.content_fr) ? readingMat.content_fr : readingMat.content_en) || "—"}
              </div>
            </div>
            {/* Close button at bottom */}
            <div className="px-6 py-4 border-t border-gray-100 flex-shrink-0">
              <button
                onClick={() => setReadingMat(null)}
                className="w-full py-2.5 rounded-xl bg-navy text-white text-sm font-bold hover:bg-navy/90 transition-colors"
              >
                {lang === "en" ? "Close Material" : "Fermer la Ressource"}
              </button>
            </div>
          </div>
        </div>
      )}
    </StudentLayout>
  );
}
