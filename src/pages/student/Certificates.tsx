import { useEffect, useState } from "react";
import StudentLayout from "@/components/StudentLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { useTranslation } from "react-i18next";
import { Award, Download, ShieldCheck, ShieldQuestion, BadgeCheck, Loader2, CheckCircle2 } from "lucide-react";
import { Badge, EmptyState, SkeletonCard, ProgressBar } from "@/components/ui/primitives";
import { useToast } from "@/contexts/ToastContext";
import { useCurrency } from "@/contexts/CurrencyContext";
import CertificatePreviewModal from "@/components/CertificatePreviewModal";
import { CertificateData } from "@/components/CertificateCard";

interface Certificate {
  id: string;
  certificate_number: string;
  student_name: string;
  is_verified: boolean;
  issue_date: string | null;
  completion_date: string | null;
  certificate_url: string | null;
  qr_code_url: string | null;
  program_id: string | null;
  programs?: { title: string; title_fr?: string } | null;
}

interface EligibilityRow {
  program_id: string;
  total_courses: number;
  published_courses: number;
  pct_published: number;
  is_eligible: boolean;
  already_issued: boolean;
  programs?: { title: string; title_fr?: string | null } | null;
}

export default function StudentCertificates() {
  const { profile } = useAuth();
  const { i18n } = useTranslation();
  const lang = (i18n.language.startsWith("fr") ? "fr" : "en") as "en" | "fr";
  const { showToast } = useToast();
  const { format } = useCurrency();

  const [certs, setCerts] = useState<Certificate[]>([]);
  const [eligibility, setEligibility] = useState<EligibilityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewCert, setPreviewCert] = useState<Certificate | null>(null);
  const [requestingId, setRequestingId] = useState<string | null>(null);
  const [requestedIds, setRequestedIds] = useState<Set<string>>(new Set());
  const [certFee, setCertFee] = useState(0);

  const load = async () => {
    if (!profile?.id) return;
    setLoading(true);
    const [certRes, eligRes, feeRes, payRes] = await Promise.all([
      supabase.from("certificates").select("*, programs(title, title_fr)").eq("student_id", profile.id).order("issue_date", { ascending: false }),
      supabase.from("certificate_eligibility").select("*, programs:program_id(title, title_fr)").eq("student_id", profile.id),
      supabase.from("site_settings").select("value").eq("key", "fee_certificate").maybeSingle(),
      supabase.from("payments").select("description, reference").eq("student_id", profile.id).eq("type", "certificate").eq("status", "pending"),
    ]);
    setCerts((certRes.data ?? []) as unknown as Certificate[]);
    setEligibility((eligRes.data ?? []) as unknown as EligibilityRow[]);
    setCertFee(Number(feeRes.data?.value ?? 0));
    setRequestedIds(new Set((payRes.data ?? []).map((p: { reference: string | null }) => p.reference).filter(Boolean) as string[]));
    setLoading(false);
  };

  useEffect(() => { load(); }, [profile?.id]);

  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(lang === "fr" ? "fr-FR" : "en-GB", { day: "numeric", month: "long", year: "numeric" });

  const certToPreviewData = (c: Certificate): CertificateData => ({
    certificate_number: c.certificate_number,
    student_name: c.student_name,
    program_title_en: c.programs?.title ?? "—",
    program_title_fr: c.programs?.title_fr ?? null,
    completion_date: c.completion_date,
    verify_url: `${window.location.origin}/verify?cert=${c.certificate_number}`,
  });

  const onRequestCollection = async (cert: Certificate) => {
    if (!profile?.id) return;
    setRequestingId(cert.id);
    try {
      const reference = `cert-collect-${cert.id}`;
      const { error } = await supabase.from("payments").insert({
        student_id: profile.id,
        type: "certificate",
        amount: certFee,
        currency: "USD",
        amount_usd: certFee,
        method: "bank_transfer",
        status: "pending",
        reference,
        description: lang === "en" ? `Certificate collection — ${cert.certificate_number}` : `Retrait de certificat — ${cert.certificate_number}`,
      });
      if (error) throw error;
      setRequestedIds(prev => new Set(prev).add(reference));
      showToast("success", lang === "en" ? "Collection request submitted! Visit Payments to complete payment." : "Demande soumise ! Consultez Paiements pour régler.");
    } catch {
      showToast("error", lang === "en" ? "Could not submit your request." : "Échec de la demande.");
    } finally {
      setRequestingId(null);
    }
  };

  // Eligibility rows that haven't yet resulted in an issued certificate —
  // shown as an in-progress tracker so a student can see how close they are.
  const inProgress = eligibility.filter(e => !e.already_issued);

  return (
    <StudentLayout title={lang === "en" ? "Certificates" : "Certificats"}>
      <div className="mb-6 animate-fade-in-up">
        <h2 className="text-2xl font-black text-ink">{lang === "en" ? "My Certificates" : "Mes Certificats"}</h2>
        <p className="text-sm text-slate mt-0.5">{certs.length} {lang === "en" ? "certificate(s) issued" : "certificat(s) émis"}</p>
      </div>

      {/* Eligibility tracker */}
      {!loading && inProgress.length > 0 && (
        <div className="mb-6 space-y-3 animate-fade-in-up" style={{ animationDelay: "0.03s" }}>
          {inProgress.map(row => {
            const progTitle = row.programs ? ((lang === "fr" && row.programs.title_fr) ? row.programs.title_fr : row.programs.title) : "—";
            return (
              <div key={row.program_id} className="card p-5">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="font-bold text-ink text-sm">{progTitle}</p>
                    <p className="text-xs text-slate mt-0.5">
                      {row.is_eligible
                        ? (lang === "en" ? "All grades published — eligible for certificate" : "Toutes les notes publiées — éligible au certificat")
                        : (lang === "en" ? "Certificate eligibility progress" : "Progression vers l'éligibilité")}
                    </p>
                  </div>
                  {row.is_eligible ? (
                    <Badge color="green" icon={CheckCircle2}>{lang === "en" ? "Eligible" : "Éligible"}</Badge>
                  ) : (
                    <span className="text-sm font-black text-navy">{row.pct_published}%</span>
                  )}
                </div>
                <ProgressBar value={row.pct_published} />
                <p className="text-xs text-gray-400 mt-2">
                  {row.published_courses}/{row.total_courses} {lang === "en" ? "courses with published grades" : "cours avec notes publiées"}
                </p>
                {row.is_eligible && (
                  <p className="text-xs text-green-600 font-medium mt-2">
                    {lang === "en" ? "Your administration will issue this certificate soon." : "L'administration émettra bientôt ce certificat."}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{Array.from({ length: 2 }).map((_, i) => <SkeletonCard key={i} />)}</div>
      ) : certs.length === 0 ? (
        <EmptyState
          icon={Award}
          title={lang === "en" ? "No certificates yet" : "Aucun certificat"}
          description={lang === "en" ? "Complete your programme to earn your first certificate." : "Terminez votre programme pour obtenir votre premier certificat."}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 stagger-children">
          {certs.map(cert => {
            const progTitle = cert.programs ? ((lang === "fr" && cert.programs.title_fr) ? cert.programs.title_fr : cert.programs.title) : null;
            const collectionRef = `cert-collect-${cert.id}`;
            const alreadyRequested = requestedIds.has(collectionRef);
            return (
              <div key={cert.id} className="card card-hover overflow-hidden">
                <div className="h-1.5 bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-400" />
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <Badge color={cert.is_verified ? "green" : "gray"} icon={cert.is_verified ? ShieldCheck : ShieldQuestion}>
                      {lang === "en" ? (cert.is_verified ? "Verified" : "Pending Verification") : (cert.is_verified ? "Vérifié" : "En cours de vérification")}
                    </Badge>
                    <span className="text-xs font-mono text-gray-400">{cert.certificate_number}</span>
                  </div>

                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-50 to-yellow-50 flex items-center justify-center mb-4">
                    <Award className="w-7 h-7 text-amber-500" strokeWidth={1.75} />
                  </div>

                  {progTitle && <p className="text-xs font-bold text-brand uppercase tracking-wider mb-1">{progTitle}</p>}
                  <h3 className="font-black text-ink text-lg leading-snug mb-1">{cert.student_name}</h3>

                  <div className="space-y-1 mb-5">
                    {cert.completion_date && (
                      <p className="text-xs text-slate">{lang === "en" ? "Completed:" : "Achevé le:"} <span className="font-semibold text-ink">{fmtDate(cert.completion_date)}</span></p>
                    )}
                    {cert.issue_date && (
                      <p className="text-xs text-slate">{lang === "en" ? "Issued:" : "Émis le:"} <span className="font-semibold text-ink">{fmtDate(cert.issue_date)}</span></p>
                    )}
                  </div>

                  <div className="flex gap-2 mb-2.5">
                    <button onClick={() => setPreviewCert(cert)}
                      className="flex-1 flex items-center justify-center gap-2 text-sm font-bold bg-navy hover:bg-navy-light text-white py-2.5 rounded-xl transition-colors">
                      <Download className="w-4 h-4" strokeWidth={2} />
                      {lang === "en" ? "Download Certificate" : "Télécharger le Certificat"}
                    </button>
                    <a href={`/verify?cert=${cert.certificate_number}`}
                      className="flex-shrink-0 text-sm font-bold border border-gray-200 text-slate hover:border-navy hover:text-navy px-4 py-2.5 rounded-xl transition-all">
                      {lang === "en" ? "Verify" : "Vérifier"}
                    </a>
                  </div>

                  <button
                    onClick={() => onRequestCollection(cert)}
                    disabled={requestingId === cert.id || alreadyRequested}
                    className="w-full flex items-center justify-center gap-2 text-sm font-bold border border-amber-200 text-brand hover:bg-orange-50 py-2.5 rounded-xl transition-all disabled:opacity-60"
                  >
                    {requestingId === cert.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2} />
                    ) : alreadyRequested ? (
                      <CheckCircle2 className="w-4 h-4" strokeWidth={2} />
                    ) : (
                      <Award className="w-4 h-4" strokeWidth={2} />
                    )}
                    {alreadyRequested
                      ? (lang === "en" ? "Collection Requested" : "Retrait Demandé")
                      : (lang === "en" ? `Request Physical Collection${certFee ? ` (${format(certFee)})` : ""}` : `Demander le Retrait Physique${certFee ? ` (${format(certFee)})` : ""}`)}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-6 bg-blue-50 border border-blue-100 rounded-2xl p-5 flex items-start gap-4 animate-fade-in-up">
        <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center flex-shrink-0">
          <BadgeCheck className="w-5 h-5 text-blue-600" strokeWidth={2} />
        </div>
        <div>
          <p className="font-semibold text-blue-800 text-sm mb-1">{lang === "en" ? "Third-party verification" : "Vérification par tiers"}</p>
          <p className="text-blue-600 text-xs mb-3">
            {lang === "en" ? "Share the certificate number with employers or institutions for independent verification." : "Partagez le numéro de certificat avec les employeurs ou institutions pour une vérification indépendante."}
          </p>
          <a href="/verify" className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-700 hover:text-blue-900 transition-colors">
            {lang === "en" ? "Open Verification Portal →" : "Portail de Vérification →"}
          </a>
        </div>
      </div>

      {previewCert && (
        <CertificatePreviewModal
          open={!!previewCert}
          onClose={() => setPreviewCert(null)}
          data={certToPreviewData(previewCert)}
          lang={lang}
        />
      )}
    </StudentLayout>
  );
}
