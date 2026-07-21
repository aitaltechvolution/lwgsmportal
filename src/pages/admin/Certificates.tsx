import { useEffect, useState, useMemo } from "react";
import { createRoot } from "react-dom/client";
import { QRCodeCanvas } from "qrcode.react";
import AdminLayout from "@/components/AdminLayout";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "react-i18next";
import {
  Award, ShieldCheck, ShieldQuestion, Search, CheckCircle2, Loader2,
  Eye, UserCheck, X,
} from "lucide-react";
import { Badge, EmptyState, SkeletonRow } from "@/components/ui/primitives";
import { useToast } from "@/contexts/ToastContext";
import CertificatePreviewModal from "@/components/CertificatePreviewModal";
import { CertificateData } from "@/components/CertificateCard";

interface EligibleRow {
  student_id: string;
  program_id: string;
  total_courses: number;
  enrolled_courses: number;
  published_courses: number;
  pct_published: number;
  attendance_pct: number | null;
  materials_pct: number | null;
  assessment_pct: number | null;
  requires_attendance: boolean;
  is_eligible: boolean;
  already_issued: boolean;
  profiles?: { full_name: string; email: string } | null;
  programs?: { title: string; title_fr: string | null } | null;
}

interface Cert {
  id: string;
  certificate_number: string;
  student_id: string | null;
  student_name: string;
  is_verified: boolean;
  issue_date: string | null;
  completion_date: string | null;
  qr_code_url: string | null;
  matric_number: string | null;
  is_paid: boolean;
  issued_via_override?: boolean;
  programs?: { title: string; title_fr?: string } | null;
}

// Certificate numbers now come from a real Postgres sequence
// (public.certificate_number_seq, starting at 1201) via the
// next_certificate_number() RPC — see supabase/master_fixes_4.sql.
// Format: LWGSM-{MM}{last 3 digits of year}-{running serial}
async function generateCertNumber(): Promise<string> {
  const { data, error } = await supabase.rpc("next_certificate_number");
  if (error || !data) throw error ?? new Error("Could not generate certificate number.");
  return data as string;
}

export default function AdminCertificates() {
  const { i18n } = useTranslation();
  const lang = (i18n.language.startsWith("fr") ? "fr" : "en") as "en" | "fr";
  const { showToast } = useToast();
  const { profile } = useAuth();

  const [tab, setTab] = useState<"eligible" | "review" | "issued">("eligible");
  const [eligible, setEligible] = useState<EligibleRow[]>([]);
  const [needsReview, setNeedsReview] = useState<EligibleRow[]>([]);
  const [certs, setCerts] = useState<Cert[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [issuingKey, setIssuingKey] = useState<string | null>(null);
  const [previewCert, setPreviewCert] = useState<Cert | null>(null);

  const load = async () => {
    setLoading(true);
    const [allCandidatesRes, certRes] = await Promise.all([
      supabase
        .from("certificate_eligibility")
        .select("*, profiles:student_id(full_name, email), programs:program_id(title, title_fr)")
        .eq("already_issued", false),
      supabase
        .from("certificates")
        .select("*, programs(title, title_fr)")
        .order("issue_date", { ascending: false }),
    ]);
    const all = (allCandidatesRes.data ?? []) as unknown as EligibleRow[];
    setEligible(all.filter(r => r.is_eligible));
    setNeedsReview(all.filter(r => !r.is_eligible));
    setCerts((certRes.data ?? []) as unknown as Cert[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filteredEligible = useMemo(() => {
    if (!search) return eligible;
    const q = search.toLowerCase();
    return eligible.filter(r => {
      const name = r.profiles?.full_name?.toLowerCase() ?? "";
      const prog = (r.programs?.title ?? "").toLowerCase();
      return name.includes(q) || prog.includes(q);
    });
  }, [eligible, search]);

  const filteredReview = useMemo(() => {
    if (!search) return needsReview;
    const q = search.toLowerCase();
    return needsReview.filter(r => {
      const name = r.profiles?.full_name?.toLowerCase() ?? "";
      const prog = (r.programs?.title ?? "").toLowerCase();
      return name.includes(q) || prog.includes(q);
    });
  }, [needsReview, search]);

  const filteredCerts = useMemo(() => {
    if (!search) return certs;
    const q = search.toLowerCase();
    return certs.filter(c => c.student_name?.toLowerCase().includes(q) || c.certificate_number.toLowerCase().includes(q));
  }, [certs, search]);

  const onIssue = async (row: EligibleRow, override = false) => {
    const key = `${row.student_id}-${row.program_id}`;
    if (override) {
      const ok = window.confirm(
        lang === "en"
          ? "This student does not meet the automatic materials/assessments/attendance requirements. Issue a certificate anyway?"
          : "Cet étudiant ne remplit pas automatiquement les conditions (ressources/évaluations/présence). Émettre quand même le certificat ?"
      );
      if (!ok) return;
    }
    setIssuingKey(key);
    try {
      const certNumber = await generateCertNumber();
      const verifyUrl = `${window.location.origin}/verify?cert=${certNumber}`;

      // Render the QR to an off-screen canvas to capture it as base64 —
      // qrcode.react's QRCodeCanvas needs to actually mount to draw, so we
      // create a temporary container, let it draw, then read the canvas.
      const qrDataUrl = await renderQrToDataUrl(verifyUrl);

      const { data: cert, error } = await supabase
        .from("certificates")
        .insert({
          student_id: row.student_id,
          program_id: row.program_id,
          certificate_number: certNumber,
          student_name: row.profiles?.full_name ?? "",
          is_verified: true,
          issue_date: new Date().toISOString().slice(0, 10),
          completion_date: new Date().toISOString().slice(0, 10),
          qr_code_url: qrDataUrl,
          issued_via_override: override,
          override_reason: override
            ? (lang === "en" ? "Admin manually approved despite not meeting automatic requirements." : "Approuvé manuellement par l'admin malgré des conditions automatiques non remplies.")
            : null,
          overridden_by: override ? (profile?.id ?? null) : null,
        })
        .select("*, programs(title, title_fr)")
        .single();

      if (error) throw error;

      showToast("success", lang === "en" ? `Certificate ${certNumber} issued!` : `Certificat ${certNumber} émis !`);
      setEligible(prev => prev.filter(r => !(r.student_id === row.student_id && r.program_id === row.program_id)));
      setNeedsReview(prev => prev.filter(r => !(r.student_id === row.student_id && r.program_id === row.program_id)));
      setCerts(prev => [cert as unknown as Cert, ...prev]);
      setPreviewCert(cert as unknown as Cert);
    } catch (err) {
      // Surface the real Postgres/PostgREST error (message, code, hint) so
      // a permission/RLS failure like the certificates-table grant issue
      // is diagnosable from the console instead of a generic toast.
      // PostgrestError isn't guaranteed to be `instanceof Error`, so check
      // for a `.message` string directly rather than assuming a JS Error.
      console.error("Certificate issue failed:", err);
      const msg = (err && typeof err === "object" && "message" in err && typeof (err as { message: unknown }).message === "string")
        ? (err as { message: string }).message
        : undefined;
      showToast("error", msg
        ? (lang === "en" ? `Failed to issue certificate: ${msg}` : `Échec de l'émission du certificat : ${msg}`)
        : (lang === "en" ? "Failed to issue certificate." : "Échec de l'émission du certificat."));
    } finally {
      setIssuingKey(null);
    }
  };

  const toggleVerify = async (c: Cert) => {
    const next = !c.is_verified;
    setCerts(prev => prev.map(x => x.id === c.id ? { ...x, is_verified: next } : x));
    const { error } = await supabase.from("certificates").update({ is_verified: next }).eq("id", c.id);
    if (error) {
      setCerts(prev => prev.map(x => x.id === c.id ? { ...x, is_verified: !next } : x));
      showToast("error", lang === "en" ? "Could not update verification status." : "Échec de la mise à jour.");
    }
  };

  // Manual override for the "PREVIEW" watermark — normally is_paid flips
  // automatically via the payments trigger once a certificate-collection
  // payment is confirmed, but admins can also mark it paid/unpaid directly
  // here (e.g. cash payment collected in person, never went through Payments).
  const togglePaid = async (c: Cert) => {
    const next = !c.is_paid;
    setCerts(prev => prev.map(x => x.id === c.id ? { ...x, is_paid: next } : x));
    const { error } = await supabase.from("certificates").update({ is_paid: next }).eq("id", c.id);
    if (error) {
      setCerts(prev => prev.map(x => x.id === c.id ? { ...x, is_paid: !next } : x));
      showToast("error", lang === "en" ? "Could not update payment status." : "Échec de la mise à jour du paiement.");
    }
  };

  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(lang === "fr" ? "fr-FR" : "en-GB", { day: "numeric", month: "short", year: "numeric" });

  const certToPreviewData = (c: Cert): CertificateData => ({
    certificate_number: c.certificate_number,
    student_name: c.student_name,
    program_title_en: c.programs?.title ?? "—",
    program_title_fr: c.programs?.title_fr ?? null,
    completion_date: c.completion_date,
    verify_url: `${window.location.origin}/verify?cert=${c.certificate_number}`,
    matric_number: c.matric_number,
    is_paid: c.is_paid,
  });

  return (
    <AdminLayout title={lang === "en" ? "Certificates" : "Certificats"}>
      <div className="mb-6 animate-fade-in-up">
        <h2 className="text-2xl font-black text-ink">{lang === "en" ? "Certificates" : "Certificats"}</h2>
        <p className="text-sm text-slate mt-0.5">
          {eligible.length} {lang === "en" ? "eligible" : "éligible(s)"} · {needsReview.length} {lang === "en" ? "needs review" : "à examiner"} · {certs.length} {lang === "en" ? "issued" : "émis"}
        </p>
      </div>

      <div className="flex items-center justify-between gap-4 mb-4 flex-wrap animate-fade-in-up" style={{ animationDelay: "0.04s" }}>
        <div className="flex gap-1.5 bg-gray-100 p-1 rounded-xl w-fit">
          <button onClick={() => setTab("eligible")} className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-all duration-150 ${tab === "eligible" ? "bg-white text-navy shadow-sm" : "text-slate hover:text-ink"}`}>
            <UserCheck className="w-3.5 h-3.5" strokeWidth={2} />
            {lang === "en" ? "Eligible Students" : "Étudiants Éligibles"}
            <span className="text-xs opacity-60">{eligible.length}</span>
          </button>
          <button onClick={() => setTab("review")} className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-all duration-150 ${tab === "review" ? "bg-white text-navy shadow-sm" : "text-slate hover:text-ink"}`}>
            <ShieldQuestion className="w-3.5 h-3.5" strokeWidth={2} />
            {lang === "en" ? "Needs Review" : "À Examiner"}
            <span className="text-xs opacity-60">{needsReview.length}</span>
          </button>
          <button onClick={() => setTab("issued")} className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-all duration-150 ${tab === "issued" ? "bg-white text-navy shadow-sm" : "text-slate hover:text-ink"}`}>
            <Award className="w-3.5 h-3.5" strokeWidth={2} />
            {lang === "en" ? "Issued Certificates" : "Certificats Émis"}
            <span className="text-xs opacity-60">{certs.length}</span>
          </button>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-gray-300 absolute left-3 top-1/2 -translate-y-1/2" strokeWidth={2} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={lang === "en" ? "Search…" : "Rechercher…"} className="input pl-9" />
        </div>
      </div>

      {loading ? (
        <div className="card divide-y divide-gray-50">{Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}</div>
      ) : tab === "eligible" ? (
        filteredEligible.length === 0 ? (
          <EmptyState
            icon={UserCheck}
            title={lang === "en" ? "No students currently eligible" : "Aucun étudiant éligible"}
            description={lang === "en"
              ? "A student becomes eligible once they're enrolled in every course of a program and the lecturer has published grades for all of them."
              : "Un étudiant devient éligible une fois inscrit à tous les cours d'un programme et que les notes ont été publiées pour tous."}
          />
        ) : (
          <div className="card overflow-hidden stagger-children">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50/60 border-b border-gray-100">
                    {[lang === "en" ? "Student" : "Étudiant", lang === "en" ? "Program" : "Programme", lang === "en" ? "Courses" : "Cours", lang === "en" ? "Attendance" : "Présence", ""].map(h => (
                      <th key={h} className="text-left px-5 py-3 text-xs font-bold text-slate uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredEligible.map(row => {
                    const key = `${row.student_id}-${row.program_id}`;
                    const progTitle = row.programs ? ((lang === "fr" && row.programs.title_fr) ? row.programs.title_fr : row.programs.title) : "—";
                    return (
                      <tr key={key} className="hover:bg-gray-50/60 transition-colors">
                        <td className="px-5 py-3.5"><p className="font-semibold text-ink">{row.profiles?.full_name ?? "—"}</p><p className="text-xs text-gray-400">{row.profiles?.email}</p></td>
                        <td className="px-5 py-3.5 text-ink">{progTitle}</td>
                        <td className="px-5 py-3.5"><Badge color="green" icon={CheckCircle2}>{row.published_courses}/{row.total_courses} {lang === "en" ? "published" : "publiées"}</Badge></td>
                        <td className="px-5 py-3.5">
                          {row.attendance_pct === null
                            ? <span className="text-xs text-gray-400">{lang === "en" ? "No sessions yet" : "Aucune session"}</span>
                            : <Badge color={row.attendance_pct >= 75 ? "green" : row.attendance_pct >= 50 ? "orange" : "red"}>{row.attendance_pct}%</Badge>}
                        </td>
                        <td className="px-5 py-3.5">
                          <button
                            onClick={() => onIssue(row)}
                            disabled={issuingKey === key}
                            className="flex items-center gap-1.5 text-xs font-bold text-white bg-navy hover:bg-navy-light px-3.5 py-2 rounded-lg transition-colors disabled:opacity-60 whitespace-nowrap"
                          >
                            {issuingKey === key ? <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={2.5} /> : <Award className="w-3.5 h-3.5" strokeWidth={2} />}
                            {lang === "en" ? "Issue Certificate" : "Émettre le Certificat"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : tab === "review" ? (
        filteredReview.length === 0 ? (
          <EmptyState
            icon={ShieldQuestion}
            title={lang === "en" ? "Nothing to review" : "Rien à examiner"}
            description={lang === "en"
              ? "Students who don't yet meet all three certificate pillars — materials, assessments/exams, and (if required) attendance — show up here. You can still issue a certificate manually if you decide it's warranted."
              : "Les étudiants qui ne remplissent pas encore les trois piliers du certificat — ressources, évaluations/examens, et présence si exigée — apparaissent ici. Vous pouvez tout de même émettre un certificat manuellement si vous le jugez justifié."}
          />
        ) : (
          <div className="card overflow-hidden stagger-children">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50/60 border-b border-gray-100">
                    {[
                      lang === "en" ? "Student" : "Étudiant", lang === "en" ? "Program" : "Programme",
                      lang === "en" ? "Courses" : "Cours", lang === "en" ? "Materials" : "Ressources",
                      lang === "en" ? "Assessments" : "Évaluations", lang === "en" ? "Attendance" : "Présence", "",
                    ].map(h => (
                      <th key={h} className="text-left px-5 py-3 text-xs font-bold text-slate uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredReview.map(row => {
                    const key = `${row.student_id}-${row.program_id}`;
                    const progTitle = row.programs ? ((lang === "fr" && row.programs.title_fr) ? row.programs.title_fr : row.programs.title) : "—";
                    return (
                      <tr key={key} className="hover:bg-gray-50/60 transition-colors">
                        <td className="px-5 py-3.5"><p className="font-semibold text-ink">{row.profiles?.full_name ?? "—"}</p><p className="text-xs text-gray-400">{row.profiles?.email}</p></td>
                        <td className="px-5 py-3.5 text-ink">{progTitle}</td>
                        <td className="px-5 py-3.5"><Badge color={row.published_courses === row.total_courses ? "green" : "orange"}>{row.published_courses}/{row.total_courses} {lang === "en" ? "published" : "publiées"}</Badge></td>
                        <td className="px-5 py-3.5">
                          {row.materials_pct === null
                            ? <span className="text-xs text-gray-400">—</span>
                            : <Badge color={row.materials_pct >= 100 ? "green" : row.materials_pct >= 50 ? "orange" : "red"}>{row.materials_pct}%</Badge>}
                        </td>
                        <td className="px-5 py-3.5">
                          {row.assessment_pct === null
                            ? <span className="text-xs text-gray-400">{lang === "en" ? "No scores yet" : "Aucune note"}</span>
                            : <Badge color={row.assessment_pct >= 50 ? "green" : "red"}>{row.assessment_pct}%</Badge>}
                        </td>
                        <td className="px-5 py-3.5">
                          {!row.requires_attendance
                            ? <span className="text-xs text-gray-400">{lang === "en" ? "Not required" : "Non exigée"}</span>
                            : row.attendance_pct === null
                            ? <span className="text-xs text-gray-400">{lang === "en" ? "No sessions yet" : "Aucune session"}</span>
                            : <Badge color={row.attendance_pct >= 75 ? "green" : row.attendance_pct >= 50 ? "orange" : "red"}>{row.attendance_pct}%</Badge>}
                        </td>
                        <td className="px-5 py-3.5">
                          <button
                            onClick={() => onIssue(row, true)}
                            disabled={issuingKey === key}
                            className="flex items-center gap-1.5 text-xs font-bold text-navy bg-navy/5 hover:bg-navy hover:text-white border border-navy/15 px-3.5 py-2 rounded-lg transition-colors disabled:opacity-60 whitespace-nowrap"
                          >
                            {issuingKey === key ? <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={2.5} /> : <Award className="w-3.5 h-3.5" strokeWidth={2} />}
                            {lang === "en" ? "Override & Issue" : "Forcer & Émettre"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : filteredCerts.length === 0 ? (
        <EmptyState icon={Award} title={lang === "en" ? "No certificates issued yet" : "Aucun certificat émis"} />
      ) : (
        <div className="card overflow-hidden stagger-children">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50/60 border-b border-gray-100">
                  {[lang === "en" ? "Cert #" : "N° Cert", lang === "en" ? "Student" : "Étudiant", lang === "en" ? "Program" : "Programme", lang === "en" ? "Issued" : "Émis", lang === "en" ? "Status" : "Statut", lang === "en" ? "Payment" : "Paiement", ""].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-bold text-slate uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredCerts.map(c => {
                  const pTitle = c.programs ? ((lang === "fr" && c.programs.title_fr) ? c.programs.title_fr : c.programs.title) : "—";
                  return (
                    <tr key={c.id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="px-5 py-3.5 font-mono text-xs text-gray-600">{c.certificate_number}</td>
                      <td className="px-5 py-3.5 font-semibold text-ink">
                        {c.student_name}
                        {c.issued_via_override && (
                          <span className="block text-[10px] font-bold text-amber-600 mt-0.5">
                            {lang === "en" ? "⚠ Admin override" : "⚠ Forcé par l'admin"}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-slate">{pTitle}</td>
                      <td className="px-5 py-3.5 text-gray-400 text-xs">{c.issue_date ? fmtDate(c.issue_date) : "—"}</td>
                      <td className="px-5 py-3.5"><Badge color={c.is_verified ? "green" : "yellow"} icon={c.is_verified ? ShieldCheck : ShieldQuestion}>{c.is_verified ? (lang === "en" ? "Verified" : "Vérifié") : (lang === "en" ? "Unverified" : "Non Vérifié")}</Badge></td>
                      <td className="px-5 py-3.5">
                        <Badge color={c.is_paid ? "green" : "orange"}>{c.is_paid ? (lang === "en" ? "Paid" : "Payé") : (lang === "en" ? "Preview (Unpaid)" : "Aperçu (Impayé)")}</Badge>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <button onClick={() => setPreviewCert(c)} className="flex items-center gap-1.5 text-xs font-bold text-navy hover:text-brand transition-colors">
                            <Eye className="w-3.5 h-3.5" strokeWidth={2} />
                            {lang === "en" ? "Preview" : "Aperçu"}
                          </button>
                          <button onClick={() => toggleVerify(c)} className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${c.is_verified ? "bg-yellow-50 text-yellow-700 hover:bg-yellow-100" : "bg-green-50 text-green-700 hover:bg-green-100"}`}>
                            {c.is_verified ? (lang === "en" ? "Revoke" : "Révoquer") : (lang === "en" ? "Verify" : "Vérifier")}
                          </button>
                          <button onClick={() => togglePaid(c)} className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${c.is_paid ? "bg-yellow-50 text-yellow-700 hover:bg-yellow-100" : "bg-green-50 text-green-700 hover:bg-green-100"}`}>
                            {c.is_paid ? (lang === "en" ? "Mark Unpaid" : "Marquer Impayé") : (lang === "en" ? "Mark Paid" : "Marquer Payé")}
                          </button>
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

      {previewCert && (
        <CertificatePreviewModal
          open={!!previewCert}
          onClose={() => setPreviewCert(null)}
          data={certToPreviewData(previewCert)}
          lang={lang}
        />
      )}
    </AdminLayout>
  );
}

/** Mounts QRCodeCanvas off-screen briefly to capture its rendered PNG as a
 *  base64 data URL, then unmounts it. Used at issue-time so qr_code_url is
 *  saved directly on the certificates row per the spec, independent of
 *  whatever the live preview renders. */
async function renderQrToDataUrl(value: string): Promise<string> {
  return new Promise((resolve) => {
    const container = document.createElement("div");
    container.style.position = "fixed";
    container.style.left = "-9999px";
    document.body.appendChild(container);
    const root = createRoot(container);

    root.render(
      <QRCodeCanvas
        value={value}
        size={256}
        level="M"
        ref={(node: HTMLCanvasElement | null) => {
          if (!node) return;
          // Allow one paint cycle so the canvas has actually drawn.
          requestAnimationFrame(() => {
            const dataUrl = node.toDataURL("image/png");
            root.unmount();
            document.body.removeChild(container);
            resolve(dataUrl);
          });
        }}
      />
    );
  });
}