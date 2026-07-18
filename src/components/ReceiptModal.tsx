import { Printer, X, CheckCircle2, Clock, XCircle } from "lucide-react";
import { useCurrency } from "@/contexts/CurrencyContext";
import { PAYMENT_TYPES } from "@/lib/constants";

interface ReceiptPayment {
  receipt_number: string | null;
  type: string;
  amount_usd: number | null;
  amount: number;
  status: "pending" | "success" | "failed";
  method: string | null;
  reference: string | null;
  paid_at: string | null;
  created_at: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  payment: ReceiptPayment;
  studentName: string;
  lang: "en" | "fr";
}

const STATUS_META: Record<string, { icon: typeof CheckCircle2; color: string; en: string; fr: string }> = {
  success: { icon: CheckCircle2, color: "text-green-600", en: "Paid",    fr: "Payé" },
  pending: { icon: Clock,        color: "text-yellow-600", en: "Pending", fr: "En attente" },
  failed:  { icon: XCircle,      color: "text-red-600",   en: "Failed",  fr: "Échoué" },
};

export default function ReceiptModal({ open, onClose, payment, studentName, lang }: Props) {
  const { format } = useCurrency();
  if (!open) return null;

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
            <button onClick={() => window.print()} className="flex items-center gap-1.5 text-xs font-bold text-navy bg-navy/5 hover:bg-navy hover:text-white px-3 py-1.5 rounded-lg transition-all">
              <Printer className="w-3.5 h-3.5" strokeWidth={2} />
              {lang === "en" ? "Print" : "Imprimer"}
            </button>
            <button onClick={onClose} className="text-gray-400 hover:text-ink p-1.5 rounded-lg hover:bg-gray-50 transition-colors">
              <X className="w-4 h-4" strokeWidth={2} />
            </button>
          </div>
        </div>

        <div id="receipt-printable" className="p-8">
          <div className="text-center mb-6">
            <div className="w-12 h-12 rounded-2xl bg-navy mx-auto flex items-center justify-center mb-2">
              <span className="text-white font-black text-sm">LW</span>
            </div>
            <h2 className="font-black text-ink text-base leading-tight">Living Waters Global<br />School of Ministry</h2>
            <p className="text-xs text-gray-400 mt-1">{lang === "en" ? "Official Payment Receipt" : "Reçu de Paiement Officiel"}</p>
          </div>

          <div className="flex items-center justify-center gap-2 mb-6">
            <StatusIcon className={`w-5 h-5 ${status.color}`} strokeWidth={2} />
            <span className={`font-bold text-sm ${status.color}`}>{lang === "en" ? status.en : status.fr}</span>
          </div>

          <div className="border-t border-b border-dashed border-gray-200 py-4 space-y-3">
            <Row label={lang === "en" ? "Receipt No." : "Reçu N°"} value={payment.receipt_number ?? "—"} mono />
            <Row label={lang === "en" ? "Student" : "Étudiant"} value={studentName} />
            <Row label={lang === "en" ? "Payment Type" : "Type de Paiement"} value={typeLabel} />
            <Row label={lang === "en" ? "Method" : "Méthode"} value={payment.method === "bank_transfer" ? (lang === "en" ? "Bank Transfer" : "Virement Bancaire") : "Paystack"} />
            <Row label={lang === "en" ? "Reference" : "Référence"} value={payment.reference ?? "—"} mono />
            <Row label={lang === "en" ? "Date" : "Date"} value={`${dateStr} · ${timeStr}`} />
          </div>

          <div className="flex items-center justify-between mt-5 pt-1">
            <span className="text-sm font-bold text-slate">{lang === "en" ? "Amount" : "Montant"}</span>
            <span className="text-2xl font-black text-navy">{format(payment.amount_usd ?? payment.amount)}</span>
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
