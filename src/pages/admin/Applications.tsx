import { useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { supabase } from "@/lib/supabase";
import { useTranslation } from "react-i18next";
import { ClipboardList, CheckCircle2, XCircle, Clock, Eye, Mail, Copy } from "lucide-react";
import { Badge, EmptyState, SkeletonRow, Modal } from "@/components/ui/primitives";
import { useToast } from "@/contexts/ToastContext";
import { useConfirm } from "@/contexts/ConfirmContext";

interface Application {
  id: string;
  applicant_name: string;
  applicant_email: string;
  phone: string | null;
  dob: string | null;
  nationality: string | null;
  address: string | null;
  prev_qualification: string | null;
  status: "pending" | "approved" | "rejected";
  submitted_at: string;
  work_experience: string | null;
  course_id?: string | null;
  program_id?: string | null;
  student_id?: string | null;
  payment_status?: string | null;
  payment_reference?: string | null;
  external_registration_confirmed: boolean;
  programs?: { title: string; type: string } | null;
  courses?: { title: string } | null;
}

const STATUS_COLOR: Record<string, "orange"|"green"|"red"> = {
  pending: "orange", approved: "green", rejected: "red",
};

export default function AdminApplications() {
  const { i18n } = useTranslation();
  const lang = i18n.language.startsWith("fr") ? "fr" : "en";
  const { showToast } = useToast();
  const confirm = useConfirm();

  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all"|"pending"|"approved"|"rejected">("all");
  const [emailFallback, setEmailFallback] = useState<{ to: string; subject: string; body: string } | null>(null);
  // Which programme types actually require the external registration
  // check (admin-configured in Settings) — the checkbox below only
  // matters for applications to those types; shown either way but noted.
  const [requiredTypes, setRequiredTypes] = useState<Set<string>>(new Set());
  // #4: admission letter — tracks which application is currently sending,
  // so the button can show a loading state and can't be double-clicked.
  const [sendingLetterId, setSendingLetterId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [{ data }, { data: settingsData }] = await Promise.all([
      supabase
        .from("applications")
        .select("*, programs(title, type), courses(title)")
        .order("submitted_at", { ascending: false }),
      supabase.from("site_settings").select("key, value").in("key", [
        "external_reg_required_certificate", "external_reg_required_diploma", "external_reg_required_pastoral",
      ]),
    ]);
    setApps((data ?? []) as Application[]);
    const settingsMap = new Map((settingsData ?? []).map((r: { key: string; value: string }) => [r.key, r.value]));
    const required = new Set<string>();
    if (settingsMap.get("external_reg_required_certificate") === "true") required.add("certificate");
    if (settingsMap.get("external_reg_required_diploma") === "true") required.add("diploma");
    if (settingsMap.get("external_reg_required_pastoral") === "true") required.add("pastoral");
    setRequiredTypes(required);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const toggleExternalRegConfirmed = async (a: Application) => {
    const next = !a.external_registration_confirmed;
    setApps(prev => prev.map(x => x.id === a.id ? { ...x, external_registration_confirmed: next } : x));
    const { error } = await supabase.from("applications").update({ external_registration_confirmed: next }).eq("id", a.id);
    if (error) {
      setApps(prev => prev.map(x => x.id === a.id ? { ...x, external_registration_confirmed: !next } : x));
      showToast("error", lang === "en" ? "Could not update — please try again." : "Échec de la mise à jour — réessayez.");
    }
  };

  const onSendAdmissionLetter = async (a: Application) => {
    if (!a.student_id) return;
    setSendingLetterId(a.id);
    try {
      const { data, error } = await supabase.functions.invoke("send-admission-letter", {
        body: { studentId: a.student_id, programId: a.program_id ?? null },
      });
      if (error || data?.error) throw new Error(data?.error ?? error?.message ?? "Failed to send.");
      showToast("success", lang === "en" ? "Admission letter sent!" : "Lettre d'admission envoyée !");
    } catch (err) {
      showToast("error", (err instanceof Error ? err.message : null) ?? (lang === "en" ? "Could not send the admission letter." : "Échec de l'envoi de la lettre."));
    } finally {
      setSendingLetterId(null);
    }
  };

  const updateStatus = async (id: string, status: "approved"|"rejected") => {
    const app = apps.find(a => a.id === id);
    const ok = await confirm({
      title: lang === "en" ? `${status === "approved" ? "Approve" : "Reject"} this application?` : `${status === "approved" ? "Approuver" : "Rejeter"} cette candidature ?`,
      message: status === "approved"
        ? (lang === "en"
            ? (app?.student_id
                ? "This will add the course to their existing account and email them to log in."
                : "This will create their student account, enrol them in the course, and email them to set a password.")
            : "Cela ajoutera le cours à leur compte ou créera leur compte, puis leur enverra un e-mail.")
        : (lang === "en" ? "This will reject the application and email the applicant. No account will be created." : "Cela rejettera la candidature et enverra un e-mail au candidat. Aucun compte ne sera créé."),
      confirmLabel: status === "approved" ? (lang === "en" ? "Approve" : "Approuver") : (lang === "en" ? "Reject" : "Rejeter"),
      tone: status === "approved" ? "default" : "danger",
    });
    if (!ok) return;

    const { data, error: fnErr } = await supabase.functions.invoke("process-application-decision", {
      body: { applicationId: id, decision: status === "approved" ? "approve" : "reject" },
    });

    if (fnErr || data?.error) {
      showToast("error", data?.error ?? fnErr?.message ?? "Something went wrong.");
      // process-application-decision updates the application's status
      // *before* attempting the enrollment step, so a reported enrollment
      // failure can still mean the status already changed server-side.
      // Refresh so the list doesn't keep showing a stale "pending" row.
      load();
      return;
    }

    setApps(prev => prev.map(a => a.id === id ? { ...a, status } : a));

    if (!data.emailSent) {
      // Resend isn't configured or the call failed — the account/enrolment/
      // status change already went through regardless. Give admin a
      // copyable message and a mailto: link so they can send it manually.
      const joinLine = data.actionLink
        ? `Set your password here:\n${data.actionLink}`
        : data.kind === "existing_student"
          ? `Log in here:\n${window.location.origin}/login`
          : "";
      setEmailFallback({
        to: app?.applicant_email ?? "",
        subject: status === "approved" ? "Your LWGSM Application Has Been Approved" : "Update on Your LWGSM Application",
        body: status === "approved"
          ? `Dear ${app?.applicant_name ?? "Applicant"},\n\nCongratulations — your application to LWGSM has been approved.\n\n${joinLine}\n\nQuestions? Reach us at admissions@lwgsm.livingwatersglobalministry.org`
          : `Dear ${app?.applicant_name ?? "Applicant"},\n\nThank you for your interest in LWGSM. After prayerful review, we're unable to offer admission at this time.\n\nQuestions? Reach us at admissions@lwgsm.livingwatersglobalministry.org`,
      });
    } else {
      showToast("success", status === "approved"
        ? (lang === "en" ? "Applicant approved and emailed." : "Candidat approuvé et e-mail envoyé.")
        : (lang === "en" ? "Application rejected and applicant emailed." : "Candidature rejetée et e-mail envoyé."));
    }
  };

  const filtered = filter === "all" ? apps : apps.filter(a => a.status === filter);
  const pendingCount = apps.filter(a => a.status === "pending").length;
  const fmt = (iso: string) => new Date(iso).toLocaleDateString(lang === "fr" ? "fr-FR" : "en-GB", { day: "numeric", month: "short", year: "numeric" });

  return (
    <AdminLayout title={lang === "en" ? "Applications" : "Candidatures"}>
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap animate-fade-in-up">
        <div>
          <h2 className="text-2xl font-black text-ink flex items-center gap-2">
            {lang === "en" ? "Admissions Applications" : "Candidatures d'Admission"}
            {pendingCount > 0 && <span className="bg-brand text-white text-xs font-black px-2 py-0.5 rounded-full">{pendingCount}</span>}
          </h2>
          <p className="text-sm text-slate mt-0.5">{apps.length} {lang === "en" ? "total application(s)" : "candidature(s) au total"}</p>
        </div>
        <div className="flex gap-1.5">
          {(["all","pending","approved","rejected"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-colors ${filter === f ? "bg-navy text-white" : "bg-gray-100 text-slate hover:bg-gray-200"}`}>
              {f} {f !== "all" && `(${apps.filter(a => a.status === f).length})`}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="card divide-y divide-gray-50">{Array.from({length:5}).map((_,i)=><SkeletonRow key={i}/>)}</div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={ClipboardList} title={lang === "en" ? "No applications yet" : "Aucune candidature"} />
      ) : (
        <div className="space-y-3 stagger-children">
          {filtered.map(a => (
            <div key={a.id} className={`card overflow-hidden ${a.status === "pending" ? "border-l-4 border-l-amber-400" : a.status === "approved" ? "border-l-4 border-l-green-400" : "border-l-4 border-l-red-300"}`}>
              <div className="px-5 py-4 flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-navy/5 flex items-center justify-center flex-shrink-0 font-black text-navy">
                  {a.applicant_name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-bold text-ink text-sm">{a.applicant_name}</span>
                    <Badge color={STATUS_COLOR[a.status]}>{a.status}</Badge>
                    {a.programs && <Badge color="blue">{a.programs.title}</Badge>}
                  </div>
                  <p className="text-xs text-slate">{a.applicant_email} {a.phone ? `· ${a.phone}` : ""} {a.nationality ? `· ${a.nationality}` : ""}</p>
                  <p className="text-xs text-gray-400 mt-0.5"><Clock className="w-3 h-3 inline mr-1" strokeWidth={2}/>{fmt(a.submitted_at)}</p>
                  {expanded === a.id && (
                    <div className="mt-3 bg-gray-50 rounded-xl p-4 border border-gray-100 space-y-2">
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                        {a.dob && <div><span className="font-bold text-slate">{lang === "en" ? "Date of Birth:" : "Date de naissance :"}</span> <span className="text-ink">{fmt(a.dob)}</span></div>}
                        {a.address && <div className="col-span-2"><span className="font-bold text-slate">{lang === "en" ? "Address:" : "Adresse :"}</span> <span className="text-ink">{a.address}</span></div>}
                        {a.prev_qualification && <div className="col-span-2"><span className="font-bold text-slate">{lang === "en" ? "Previous Qualification:" : "Qualification Précédente :"}</span> <span className="text-ink">{a.prev_qualification}</span></div>}
                        {a.courses?.title && <div className="col-span-2"><span className="font-bold text-slate">{lang === "en" ? "Course Applied For:" : "Cours Demandé :"}</span> <span className="text-ink">{a.courses.title}</span></div>}
                      </div>
                      {a.work_experience && (
                        <div>
                          <p className="text-xs font-bold text-slate mb-1">{lang === "en" ? "Message / Background:" : "Message / Contexte :"}</p>
                          <p className="text-sm text-ink leading-relaxed">{a.work_experience}</p>
                        </div>
                      )}
                      {(a.payment_status || a.payment_reference) && (
                        <div className="pt-2 border-t border-gray-200">
                          <p className="text-xs font-bold text-slate mb-1">{lang === "en" ? "Payment:" : "Paiement :"}</p>
                          <p className="text-sm text-ink">
                            <Badge color={a.payment_status === "success" ? "green" : a.payment_status === "manual_pending" ? "orange" : "red"}>
                              {a.payment_status ?? "—"}
                            </Badge>
                            {a.payment_reference && <span className="ml-2 text-xs text-gray-400 font-mono">{a.payment_reference}</span>}
                          </p>
                        </div>
                      )}
                      <div className="pt-2 border-t border-gray-200">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" checked={a.external_registration_confirmed}
                            onChange={() => toggleExternalRegConfirmed(a)}
                            className="w-4 h-4 rounded border-gray-300 text-navy focus:ring-navy" />
                          <span className="text-xs font-bold text-ink">
                            {lang === "en" ? "Confirmed: completed external registration (e.g. Google Form)" : "Confirmé : inscription externe complétée (ex. Google Form)"}
                          </span>
                        </label>
                        {a.programs?.type && requiredTypes.has(a.programs.type) ? (
                          <p className="text-xs text-amber-600 mt-1 ml-6">
                            {lang === "en"
                              ? "Required for this programme type — the student can't access course content until this is checked."
                              : "Requis pour ce type de programme — l'étudiant ne pourra pas accéder au contenu tant que ceci n'est pas coché."}
                          </p>
                        ) : (
                          <p className="text-xs text-gray-400 mt-1 ml-6">
                            {lang === "en" ? "Not required for this programme type — informational only." : "Non requis pour ce type de programme — à titre informatif."}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-2 flex-shrink-0 items-end">
                  <button onClick={() => setExpanded(expanded === a.id ? null : a.id)}
                    className="flex items-center gap-1 text-xs font-bold text-navy hover:text-brand transition-colors">
                    <Eye className="w-3.5 h-3.5" strokeWidth={2}/>{expanded === a.id ? "Hide" : "View"}
                  </button>
                  {a.status === "pending" && (
                    <div className="flex gap-1.5">
                      <button onClick={() => updateStatus(a.id, "approved")}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-green-50 text-green-700 border border-green-200 text-xs font-bold hover:bg-green-100 transition-colors">
                        <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={2.5}/>
                        {lang === "en" ? "Approve" : "Approuver"}
                      </button>
                      <button onClick={() => updateStatus(a.id, "rejected")}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-50 text-red-600 border border-red-200 text-xs font-bold hover:bg-red-100 transition-colors">
                        <XCircle className="w-3.5 h-3.5" strokeWidth={2.5}/>
                        {lang === "en" ? "Reject" : "Rejeter"}
                      </button>
                    </div>
                  )}
                  {a.status === "approved" && a.student_id && (
                    <button onClick={() => onSendAdmissionLetter(a)} disabled={sendingLetterId === a.id}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-navy/5 text-navy border border-navy/15 text-xs font-bold hover:bg-navy hover:text-white transition-colors disabled:opacity-60">
                      <Mail className="w-3.5 h-3.5" strokeWidth={2.5}/>
                      {sendingLetterId === a.id
                        ? (lang === "en" ? "Sending…" : "Envoi…")
                        : (lang === "en" ? "Send Admission Letter" : "Envoyer la Lettre d'Admission")}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Fallback shown when Resend isn't configured or the send failed —
          admin can copy the message or open their own mail client instead. */}
      <Modal open={!!emailFallback} onClose={() => setEmailFallback(null)}
        title={lang === "en" ? "Couldn't Send Automatically" : "Envoi Automatique Impossible"} maxWidth="max-w-lg">
        {emailFallback && (
          <div className="space-y-4">
            <p className="text-sm text-slate">
              {lang === "en"
                ? "The applicant was approved, but the automatic email couldn't be sent (Resend may not be configured yet). Copy the message below or send it yourself."
                : "Le candidat a été approuvé, mais l'e-mail automatique n'a pas pu être envoyé. Copiez le message ci-dessous ou envoyez-le vous-même."}
            </p>
            <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 text-sm text-ink whitespace-pre-wrap font-mono">
              {emailFallback.body}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { navigator.clipboard.writeText(emailFallback.body); showToast("info", lang === "en" ? "Message copied." : "Message copié."); }}
                className="btn-ghost border border-gray-200 flex-1 flex items-center justify-center gap-2">
                <Copy className="w-4 h-4" strokeWidth={2} />
                {lang === "en" ? "Copy Message" : "Copier le Message"}
              </button>
              <a
                href={`mailto:${emailFallback.to}?subject=${encodeURIComponent(emailFallback.subject)}&body=${encodeURIComponent(emailFallback.body)}`}
                className="btn-primary flex-1 flex items-center justify-center gap-2">
                <Mail className="w-4 h-4" strokeWidth={2} />
                {lang === "en" ? "Send via Mail" : "Envoyer par Mail"}
              </a>
            </div>
            <p className="text-xs text-gray-400 text-center">
              {lang === "en" ? "Sends from your own mail client, e.g. admissions@lwgsm.livingwatersglobalministry.org" : "Envoyé depuis votre propre client de messagerie."}
            </p>
          </div>
        )}
      </Modal>
    </AdminLayout>
  );
}