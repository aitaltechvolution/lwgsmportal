import { useRef, useState } from "react";
import { X, CheckCircle2, Clock, XCircle, Share2, Download, Loader2 } from "lucide-react";
import { useCurrency } from "@/contexts/CurrencyContext";
import { PAYMENT_TYPES, CURRENCIES } from "@/lib/constants";

interface ReceiptPayment {
  receipt_number: string | null;
  type: string;
  amount_usd: number | null;
  amount_ngn: number | null;
  amount: number;
  status: "pending" | "success" | "failed";
  method: string | null;
  reference: string | null;
  transfer_reference?: string | null;
  paid_at: string | null;
  created_at: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  payment: ReceiptPayment;
  studentName: string;
  /** Program the payment relates to (e.g. via the course it's tied to).
   *  Pass null/undefined when the payment isn't linked to a program
   *  (e.g. a general "Other Charges" payment) — the row then shows "—". */
  programTitle?: string | null;
  lang: "en" | "fr";
}

const STATUS_META: Record<string, { icon: typeof CheckCircle2; color: string; en: string; fr: string }> = {
  success: { icon: CheckCircle2, color: "text-green-600", en: "Paid",    fr: "Payé" },
  pending: { icon: Clock,        color: "text-yellow-600", en: "Pending", fr: "En attente" },
  failed:  { icon: XCircle,      color: "text-red-600",   en: "Failed",  fr: "Échoué" },
};

export default function ReceiptModal({ open, onClose, payment, studentName, programTitle, lang }: Props) {
  const { format, currency } = useCurrency();
  const printableRef = useRef<HTMLDivElement>(null);
  const [sharing, setSharing] = useState(false);
  const [downloading, setDownloading] = useState(false);
  if (!open) return null;

  const filename = `Receipt-${payment.receipt_number ?? payment.reference ?? "LWGSM"}.pdf`;

  const buildPdf = async () => {
    const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
      import("html2canvas"),
      import("jspdf"),
    ]);
    const canvas = await html2canvas(printableRef.current!, { scale: 2, backgroundColor: "#ffffff" });
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const imgHeight = (canvas.height * pageWidth) / canvas.width;
    pdf.addImage(imgData, "PNG", 0, 0, pageWidth, imgHeight);
    return pdf;
  };

  const onDownload = async () => {
    if (!printableRef.current) return;
    setDownloading(true);
    try {
      const pdf = await buildPdf();
      pdf.save(filename);
    } catch {
      // PDF generation failed — nothing more to do here.
    } finally {
      setDownloading(false);
    }
  };

  const onShare = async () => {
    if (!printableRef.current) return;
    setSharing(true);
    try {
      const pdf = await buildPdf();
      const pdfBlob = pdf.output("blob");
      const pdfFile = new File([pdfBlob], filename, { type: "application/pdf" });

      if (navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
        await navigator.share({
          files: [pdfFile],
          title: lang === "en" ? "Payment Receipt" : "Reçu de Paiement",
        });
      } else {
        pdf.save(filename);
      }
    } catch {
      // Share sheet cancelled or unsupported mid-flow — nothing further
      // to do; the user can still use the Download button as a fallback.
    } finally {
      setSharing(false);
    }
  };

  const typeMeta = PAYMENT_TYPES.find((t) => t.value === payment.type);
  const typeLabel = typeMeta ? (lang === "en" ? typeMeta.en : typeMeta.fr) : payment.type;
  const status = STATUS_META[payment.status] ?? STATUS_META.pending;
  const StatusIcon = status.icon;
  const date = new Date(payment.paid_at ?? payment.created_at);
  const dateStr = date.toLocaleDateString(lang === "fr" ? "fr-FR" : "en-GB", { day: "numeric", month: "long", year: "numeric" });
  const timeStr = date.toLocaleTimeString(lang === "fr" ? "fr-FR" : "en-GB", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 print:p-0 animate-fade-in">
      <div className="absolute inset-0 bg-black/50 print:hidden" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden print:shadow-none print:rounded-none print:max-w-full">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 print:hidden">
          <h3 className="font-bold text-ink">{lang === "en" ? "Receipt" : "Reçu"}</h3>
          <div className="flex items-center gap-2">
            <button onClick={onShare} disabled={sharing} className="flex items-center gap-1.5 text-xs font-bold text-navy bg-navy/5 hover:bg-navy hover:text-white px-3 py-1.5 rounded-lg transition-all disabled:opacity-60">
              {sharing ? <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={2} /> : <Share2 className="w-3.5 h-3.5" strokeWidth={2} />}
              {lang === "en" ? "Share" : "Partager"}
            </button>
            <button onClick={onDownload} disabled={downloading} className="flex items-center gap-1.5 text-xs font-bold text-navy bg-navy/5 hover:bg-navy hover:text-white px-3 py-1.5 rounded-lg transition-all disabled:opacity-60">
              {downloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={2} /> : <Download className="w-3.5 h-3.5" strokeWidth={2} />}
              {lang === "en" ? "Download" : "Télécharger"}
            </button>
            <button onClick={onClose} className="text-gray-400 hover:text-ink p-1.5 rounded-lg hover:bg-gray-50 transition-colors">
              <X className="w-4 h-4" strokeWidth={2} />
            </button>
          </div>
        </div>

        <div id="receipt-printable" ref={printableRef} className="p-8">
          <div className="text-center mb-6">
            <div className="w-12 h-12 rounded-2xl mx-auto flex items-center justify-center mb-2 overflow-hidden">
              <img src="/favicon.png" alt="Living Waters Global School of Ministry" className="w-full h-full object-contain" />
            </div>
            <h2 className="font-black text-ink text-base leading-tight">Living Waters Global<br />School of Ministry</h2>
            <p className="text-xs text-gray-400 mt-1">{lang === "en" ? "Official Payment Receipt" : "Reçu de Paiement Officiel"}</p>
          </div>

          <div className="mb-6 flex justify-center">
            {/* Table layout instead of flex+gap: html2canvas doesn't reliably
                rasterize flexbox gap/alignment, which was causing the "Paid"
                label to render below the icon instead of beside it in the
                downloaded PDF. Table cells with vertical-align rasterize
                correctly. */}
            <table style={{ borderCollapse: "collapse" }}>
              <tbody>
                <tr>
                  <td style={{ verticalAlign: "middle" }}>
                    <span className={`font-bold text-lg ${status.color}`} style={{ lineHeight: 1 }}>
                      {lang === "en" ? status.en : status.fr}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="border-t border-b border-dashed border-gray-200 py-4 space-y-3">
            <Row label={lang === "en" ? "Receipt No." : "Reçu N°"} value={payment.receipt_number ?? "—"} mono />
            <Row label={lang === "en" ? "Student" : "Étudiant"} value={studentName} />
            <Row label={lang === "en" ? "Program" : "Programme"} value={programTitle ?? "—"} />
            <Row label={lang === "en" ? "Payment Type" : "Type de Paiement"} value={typeLabel} />
            <Row label={lang === "en" ? "Method" : "Méthode"} value={payment.method === "bank_transfer" ? (lang === "en" ? "Bank Transfer" : "Virement Bancaire") : "Paystack"} />
            <Row label={lang === "en" ? "Reference" : "Référence"} value={(payment.method === "bank_transfer" ? payment.transfer_reference : payment.reference) ?? "—"} mono />
            <Row label={lang === "en" ? "Date" : "Date"} value={`${dateStr} · ${timeStr}`} />
          </div>

          <div className="flex items-center justify-between mt-5 pt-1">
            <span className="text-sm font-bold text-slate">{lang === "en" ? "Amount" : "Montant"}</span>
            <span className="text-2xl font-black text-navy">
              {currency === "NGN" && payment.amount_ngn != null
                ? `${CURRENCIES.find(c => c.code === "NGN")!.symbol}${payment.amount_ngn.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                : format(payment.amount_usd ?? payment.amount)}
            </span>
          </div>

          <p className="text-center text-[11px] text-gray-400 mt-8">
            {lang === "en"
              ? "This receipt is system-generated and valid without a signature."
              : "Ce reçu est généré automatiquement et valide sans signature."}
          </p>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-xs text-gray-400 font-medium flex-shrink-0">{label}</span>
      <span className={`text-sm font-semibold text-ink text-right ${mono ? "font-mono text-xs" : ""}`}>{value}</span>
    </div>
  );
}