import { useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { supabase } from "@/lib/supabase";
import { useTranslation } from "react-i18next";
import { ClipboardList, CheckCircle2, XCircle, Clock, Eye } from "lucide-react";
import { Badge, EmptyState, SkeletonRow } from "@/components/ui/primitives";
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
  payment_status?: string | null;
  payment_reference?: string | null;
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

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("applications")
      .select("*, programs(title, type), courses(title)")
      .order("submitted_at", { ascending: false });
    setApps((data ?? []) as Application[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const updateStatus = async (id: string, status: "approved"|"rejected") => {
    const ok = await confirm({
      title: lang === "en" ? `${status === "approved" ? "Approve" : "Reject"} this application?` : `${status === "approved" ? "Approuver" : "Rejeter"} cette candidature ?`,
      message: lang === "en" ? "This will update the applicant's status." : "Cela mettra à jour le statut du candidat.",
      confirmLabel: status === "approved" ? (lang === "en" ? "Approve" : "Approuver") : (lang === "en" ? "Reject" : "Rejeter"),
      tone: status === "approved" ? "default" : "danger",
    });
    if (!ok) return;
    await supabase.from("applications").update({ status }).eq("id", id);
    setApps(prev => prev.map(a => a.id === id ? { ...a, status } : a));
    showToast(status === "approved" ? "success" : "info",
      lang === "en" ? `Application ${status}.` : `Candidature ${status === "approved" ? "approuvée" : "rejetée"}.`
    );
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
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </AdminLayout>
  );
}
