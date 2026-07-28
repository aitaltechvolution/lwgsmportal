import { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import StudentLayout from "@/components/StudentLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { useTranslation } from "react-i18next";
import { Search, BookOpen, User, ArrowRight, Lock, ChevronRight, ExternalLink } from "lucide-react";
import { Badge, ProgressBar, EmptyState, SkeletonCard } from "@/components/ui/primitives";
import { useCurrency } from "@/contexts/CurrencyContext";

interface Program {
  id: string; title: string; title_fr: string | null; type: string;
  delivery_mode: "online" | "onsite" | "self_paced" | null;
}

interface EnrollmentRow {
  id: string; course_id: string; status: string; progress_pct: number | null;
  courses: {
    id: string; title: string; title_fr: string | null; code: string | null;
    is_published: boolean; profiles: { full_name: string } | null;
  } | null;
}

export default function StudentProgramCourses() {
  const { programId } = useParams<{ programId: string }>();
  const { profile } = useAuth();
  const { i18n } = useTranslation();
  const lang = (i18n.language.startsWith("fr") ? "fr" : "en") as "en" | "fr";
  const { format, exchangeRate } = useCurrency();

  const [program, setProgram] = useState<Program | null>(null);
  const [enrollments, setEnrollments] = useState<EnrollmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [isPaid, setIsPaid] = useState<boolean | null>(null);
  const [regFee, setRegFee] = useState(0);
  const [regFeeNgn, setRegFeeNgn] = useState(0);
  // #1: external registration gate — required per programme type,
  // admin-configured. Checked before the payment gate: no point paying
  // registration if you haven't even completed the external form yet.
  const [extRegRequired, setExtRegRequired] = useState(false);
  const [extRegUrl, setExtRegUrl] = useState("");
  const [extRegConfirmed, setExtRegConfirmed] = useState(true); // default true so we never flash a false lock before profile loads

  const load = useCallback(async () => {
    if (!programId || !profile?.id) return;
    setLoading(true);

    const [progRes, enrRes, payRes, feeRes, extRegRes, profileRes] = await Promise.all([
      supabase.from("programs").select("id, title, title_fr, type, delivery_mode").eq("id", programId).maybeSingle(),
      supabase
        .from("enrollments")
        .select("id, course_id, status, progress_pct, courses(id, title, title_fr, code, is_published, profiles:lecturer_id(full_name))")
        .eq("student_id", profile.id).eq("program_id", programId),
      supabase.from("payments").select("status, manual_confirmed")
        .eq("student_id", profile.id).eq("type", "registration").eq("program_id", programId),
      supabase.from("site_settings").select("key, value").in("key", [
        "fee_reg_certificate", "fee_reg_diploma", "fee_reg_pastoral",
        "fee_reg_certificate_selfpaced", "fee_reg_diploma_selfpaced",
      ]),
      supabase.from("site_settings").select("key, value").in("key", [
        "external_reg_required_certificate", "external_reg_url_certificate",
        "external_reg_required_diploma", "external_reg_url_diploma",
        "external_reg_required_pastoral", "external_reg_url_pastoral",
      ]),
      supabase.from("profiles").select("external_registration_confirmed").eq("id", profile.id).maybeSingle(),
    ]);

    const prog = progRes.data as Program | null;
    setProgram(prog);
    setEnrollments((enrRes.data ?? []) as unknown as EnrollmentRow[]);
    setIsPaid((payRes.data ?? []).some((p: { status: string; manual_confirmed: boolean }) => p.status === "success" || p.manual_confirmed));
    setExtRegConfirmed(profileRes.data?.external_registration_confirmed ?? false);

    if (prog) {
      const extMap = new Map((extRegRes.data ?? []).map((r: { key: string; value: string }) => [r.key, r.value]));
      setExtRegRequired(extMap.get(`external_reg_required_${prog.type}`) === "true");
      setExtRegUrl(extMap.get(`external_reg_url_${prog.type}`) ?? "");

      const feeMap = new Map((feeRes.data ?? []).map((r: { key: string; value: string }) => [r.key, r.value]));
      const selfPaced = prog.delivery_mode === "self_paced";
      const baseKey = prog.type === "diploma" ? "fee_reg_diploma" : prog.type === "pastoral" ? "fee_reg_pastoral" : "fee_reg_certificate";
      // Self-paced pricing only exists for Diploma/Certificate — Pastoral
      // can never be self-paced, so baseKey is always used for it.
      const key = selfPaced && baseKey !== "fee_reg_pastoral" ? `${baseKey}_selfpaced` : baseKey;
      const feeNgn = Number(feeMap.get(key) ?? feeMap.get(baseKey) ?? (baseKey === "fee_reg_certificate" ? 10000 : 0));
      setRegFeeNgn(feeNgn);
      setRegFee(exchangeRate ? feeNgn / exchangeRate : feeNgn);
    }

    setLoading(false);
  }, [programId, profile?.id, exchangeRate]);

  useEffect(() => { load(); }, [load]);

  const getTitle = (c: EnrollmentRow["courses"]) => (!c ? "—" : (lang === "fr" && c.title_fr) ? c.title_fr : c.title);
  const programTitle = program ? ((lang === "fr" && program.title_fr) ? program.title_fr : program.title) : "";

  const filtered = enrollments
    .filter(e => !!e.courses)
    .filter(e => {
      if (!search) return true;
      const q = search.toLowerCase();
      const c = e.courses;
      return c?.title.toLowerCase().includes(q) || c?.title_fr?.toLowerCase().includes(q) || c?.code?.toLowerCase().includes(q);
    })
    .sort((a, b) => getTitle(a.courses).localeCompare(getTitle(b.courses)));

  if (loading) {
    return (
      <StudentLayout title={lang === "en" ? "Programme" : "Programme"}>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      </StudentLayout>
    );
  }

  if (!program) {
    return (
      <StudentLayout>
        <EmptyState icon={Search}
          title={lang === "en" ? "Programme not found" : "Programme introuvable"}
          action={<Link to="/student/courses" className="btn-outline">{lang === "en" ? "Back to My Programmes" : "Retour aux Programmes"}</Link>}
        />
      </StudentLayout>
    );
  }

  // Gate 1 (#1): if this programme's type requires the external
  // registration (e.g. a Google Form) and the admin hasn't confirmed the
  // student completed it yet, block everything else — including payment.
  // No point paying before that's sorted out.
  if (extRegRequired && !extRegConfirmed) {
    return (
      <StudentLayout title={programTitle}>
        <EmptyState icon={ExternalLink}
          title={lang === "en" ? "Complete Your Registration Form First" : "Complétez D'abord Votre Formulaire d'Inscription"}
          description={lang === "en"
            ? `Before continuing with ${programTitle}, you need to complete our registration form. Once our team confirms it, you'll be able to continue here.`
            : `Avant de continuer avec ${programTitle}, vous devez compléter notre formulaire d'inscription. Une fois notre équipe l'aura confirmé, vous pourrez continuer ici.`}
          action={
            extRegUrl ? (
              <a href={extRegUrl} target="_blank" rel="noopener noreferrer" className="btn-primary inline-flex items-center gap-2">
                {lang === "en" ? "Open Registration Form" : "Ouvrir le Formulaire"}
                <ExternalLink className="w-4 h-4" strokeWidth={2} />
              </a>
            ) : (
              <p className="text-sm text-slate">{lang === "en" ? "Contact the school office for the registration link." : "Contactez le secrétariat pour le lien d'inscription."}</p>
            )
          }
        />
      </StudentLayout>
    );
  }

  // Gate 2: a single registration payment for THIS programme unlocks every
  // course under it — a student cannot see individual course content
  // until it's paid and confirmed.
  if (isPaid === false) {
    return (
      <StudentLayout title={programTitle}>
        <EmptyState icon={Lock}
          title={lang === "en" ? "Complete Your Registration to Continue" : "Complétez Votre Inscription pour Continuer"}
          description={lang === "en"
            ? `Access to every course under ${programTitle} requires your registration fee to be paid and confirmed first. Once confirmed, all ${enrollments.length} course(s) unlock automatically.`
            : `L'accès à tous les cours de ${programTitle} nécessite le paiement et la confirmation de vos frais d'inscription. Une fois confirmé, les ${enrollments.length} cours se déverrouilleront automatiquement.`}
          action={
            <Link
              to={`/student/payments?registerProgram=${programId}&amount=${regFee}&amountNgn=${regFeeNgn}&programTitle=${encodeURIComponent(programTitle)}`}
              className="btn-primary">
              {lang === "en" ? `Pay Registration Fee (${format(regFee)})` : `Payer les Frais d'Inscription (${format(regFee)})`}
            </Link>
          }
        />
      </StudentLayout>
    );
  }

  return (
    <StudentLayout title={programTitle}>
      <div className="flex items-center gap-1.5 text-xs text-slate mb-3 animate-fade-in-up">
        <Link to="/student/courses" className="hover:text-navy transition-colors font-semibold">{lang === "en" ? "My Programmes" : "Mes Programmes"}</Link>
        <ChevronRight className="w-3.5 h-3.5" strokeWidth={2} />
        <span className="text-ink font-semibold">{programTitle}</span>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 animate-fade-in-up">
        <div>
          <h2 className="text-2xl font-black text-ink">{programTitle}</h2>
          <p className="text-sm text-slate mt-0.5">
            {enrollments.length} {enrollments.length === 1 ? (lang === "en" ? "course" : "cours") : (lang === "en" ? "courses" : "cours")}
          </p>
        </div>
        <div className="relative sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" strokeWidth={2} />
          <input
            type="text"
            placeholder={lang === "en" ? "Search courses…" : "Rechercher…"}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-9"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title={search ? (lang === "en" ? "No matches found" : "Aucun résultat") : (lang === "en" ? "No courses yet" : "Aucun cours")}
          description={search ? (lang === "en" ? "Try a different search term." : "Essayez un autre terme.") : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 stagger-children">
          {filtered.map((enr) => {
            const c = enr.courses;
            const progress = enr.progress_pct ?? 0;
            return (
              <div key={enr.id} className="card card-hover flex flex-col overflow-hidden group">
                <div className="p-5 flex-1 flex flex-col">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-11 h-11 rounded-xl bg-navy/5 flex items-center justify-center group-hover:bg-navy group-hover:text-white transition-colors duration-300">
                      <BookOpen className="w-5 h-5 text-navy group-hover:text-white transition-colors duration-300" strokeWidth={2} />
                    </div>
                    <Badge color={enr.status === "completed" ? "green" : enr.status === "active" ? "blue" : "gray"}>
                      {lang === "en" ? enr.status.charAt(0).toUpperCase() + enr.status.slice(1) : enr.status === "active" ? "Actif" : enr.status === "completed" ? "Terminé" : enr.status}
                    </Badge>
                  </div>
                  {c?.code && <span className="text-xs font-bold text-brand uppercase tracking-wider mb-1.5">{c.code}</span>}
                  <h3 className="font-bold text-ink text-[15px] leading-snug mb-2">{getTitle(c)}</h3>
                  {c?.profiles?.full_name && (
                    <div className="flex items-center gap-1.5 mb-4 text-xs text-slate">
                      <User className="w-3.5 h-3.5" strokeWidth={2} />
                      {c.profiles.full_name}
                    </div>
                  )}
                  <div className="mt-auto">
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-xs text-slate font-medium">{progress}%</span>
                    </div>
                    <ProgressBar value={progress} size="sm" />
                  </div>
                </div>
                <div className="px-5 pb-5">
                  <Link
                    to={`/student/courses/${c?.id ?? enr.course_id}`}
                    className="flex items-center justify-center gap-2 text-sm font-bold bg-navy hover:bg-navy-light text-white rounded-xl py-2.5 transition-all duration-200 group-hover:gap-3"
                  >
                    {lang === "en" ? (enr.status === "completed" ? "Review Course" : "Continue") : (enr.status === "completed" ? "Revoir" : "Continuer")}
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" strokeWidth={2.5} />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </StudentLayout>
  );
}
