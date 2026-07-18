import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import StudentLayout from "@/components/StudentLayout";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "react-i18next";
import { useCurrency } from "@/contexts/CurrencyContext";
import { CreditCard, Clock, CheckCircle2, AlertCircle, Upload, Info, Plus, ReceiptIcon, Mail } from "lucide-react";
import { Badge, EmptyState, SkeletonRow } from "@/components/ui/primitives";
import { useToast } from "@/contexts/ToastContext";
import CurrencyToggle from "@/components/CurrencyToggle";
import PaymentModal from "@/components/PaymentModal";
import ReceiptModal from "@/components/ReceiptModal";
import { usePaystackPayment } from "@/lib/usePaystackPayment";
import { PAYMENT_TYPES } from "@/lib/constants";

interface Payment {
  id: string;
  amount: number;
  amount_usd: number | null;
  currency: string;
  type: string;
  status: "pending" | "success" | "failed";
  method: string | null;
  reference: string | null;
  receipt_number: string | null;
  description: string | null;
  paid_at: string | null;
  created_at: string;
}

const STATUS_COLOR: Record<string, "green" | "yellow" | "red"> = { success: "green", pending: "yellow", failed: "red" };
const STATUS_LABEL: Record<string, { en: string; fr: string }> = {
  success: { en: "Paid",    fr: "Payé" },
  pending: { en: "Pending", fr: "En attente" },
  failed:  { en: "Failed",  fr: "Échoué" },
};

function typeLabel(type: string, lang: "en" | "fr") {
  const t = PAYMENT_TYPES.find((p) => p.value === type);
  return t ? (lang === "en" ? t.en : t.fr) : type;
}

export default function StudentPayments() {
  const { profile } = useAuth();
  const { i18n } = useTranslation();
  const lang = (i18n.language.startsWith("fr") ? "fr" : "en") as "en" | "fr";
  const { format } = useCurrency();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState<"all" | "pending" | "success" | "failed">("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [receiptFor, setReceiptFor] = useState<Payment | null>(null);

  const load = useCallback(() => {
    if (!profile?.id) return;
    supabase.from("payments").select("*").eq("student_id", profile.id).order("created_at", { ascending: false })
      .then(({ data }) => { setPayments((data ?? []) as Payment[]); setLoading(false); });
  }, [profile?.id]);

  useEffect(() => { load(); }, [load]);

  const usdOf = (p: Payment) => p.amount_usd ?? p.amount;
  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(lang === "fr" ? "fr-FR" : "en-GB", { day: "numeric", month: "short", year: "numeric" });

  const filtered = filter === "all" ? payments : payments.filter(p => p.status === filter);
  const totalDue  = payments.filter(p => p.status === "pending").reduce((s, p) => s + usdOf(p), 0);
  const totalPaid = payments.filter(p => p.status === "success").reduce((s, p) => s + usdOf(p), 0);

  const FILTERS: { key: typeof filter; en: string; fr: string }[] = [
    { key: "all", en: "All", fr: "Tous" },
    { key: "pending", en: "Pending", fr: "En attente" },
    { key: "success", en: "Paid", fr: "Payés" },
    { key: "failed", en: "Failed", fr: "Échoués" },
  ];

  const [searchParams] = useSearchParams();
  const unlockMaterialId = searchParams.get('unlock');
  const unlockTitle = searchParams.get('title');
  const unlockPrice = searchParams.get('price');
  const registerCourseId = searchParams.get('registerCourse');
  const registerAmount = searchParams.get('amount');
  const registerCourseTitle = searchParams.get('courseTitle');

  const isRegisterFlow = !!registerCourseId;
  const bannerItemId = unlockMaterialId ?? registerCourseId;
  const bannerTitle = isRegisterFlow ? registerCourseTitle : unlockTitle;
  const bannerAmountUsd = Number((isRegisterFlow ? registerAmount : unlockPrice) ?? 0);

  const { exchangeRate } = useCurrency();
  const { initiate } = usePaystackPayment();
  const [publicKey, setPublicKey] = useState("");
  const [payMethod, setPayMethod] = useState<"paystack" | "bank_transfer">("paystack");
  const [payingNow, setPayingNow] = useState(false);

  useEffect(() => {
    supabase.from("site_settings").select("value").eq("key", "paystack_public_key").maybeSingle()
      .then(({ data }) => setPublicKey(data?.value ?? ""));
  }, []);

  const payWithPaystack = async () => {
    if (!profile?.id || !bannerItemId) return;
    setPayingNow(true);
    try {
      const result = await initiate({
        email: profile.email,
        amountUsd: bannerAmountUsd,
        exchangeRate,
        studentId: profile.id,
        paymentType: isRegisterFlow ? "registration" : "material",
        publicKey,
        courseId: isRegisterFlow ? registerCourseId! : undefined,
      });
      if (result.status === "success") {
        showToast("success", lang === "en" ? "Payment successful! Access unlocked." : "Paiement réussi ! Accès débloqué.");
        load();
      } else if (result.status === "failed") {
        showToast("error", lang === "en" ? "Payment failed. Please try again." : "Paiement échoué. Veuillez réessayer.");
      }
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Payment error.");
    } finally {
      setPayingNow(false);
    }
  };

  // Handle manual transfer submission
  const [transferRef, setTransferRef] = useState('');
  const [submittingTransfer, setSubmittingTransfer] = useState(false);
  const { showToast } = useToast();

  const submitTransfer = async () => {
    if (!profile?.id || !bannerItemId || !transferRef.trim()) return;
    setSubmittingTransfer(true);
    const { error } = await supabase.from('payments').insert({
      student_id: profile.id,
      amount_usd: bannerAmountUsd || 0,
      type: isRegisterFlow ? 'registration' : 'material',
      status: 'pending',
      transfer_reference: transferRef.trim(),
      material_id: isRegisterFlow ? null : unlockMaterialId,
      course_id: isRegisterFlow ? registerCourseId : null,
      description: bannerTitle
        ? `${isRegisterFlow ? 'Registration' : 'Unlock'}: ${decodeURIComponent(bannerTitle)}`
        : (isRegisterFlow ? 'Course registration' : 'Premium material'),
    });
    if (error) {
      showToast('error', error.message);
    } else {
      showToast('success',
        lang === 'en'
          ? 'Transfer submitted! Admin will confirm within 24 hours and this will unlock automatically.'
          : "Virement soumis ! L'admin confirmera sous 24 heures et cela se déverrouillera automatiquement."
      );
      setTransferRef('');
      load();
    }
    setSubmittingTransfer(false);
  };

  return (
    <StudentLayout title={lang === "en" ? "Payments" : "Paiements"}>
      <div className="flex items-start justify-between gap-4 mb-6 animate-fade-in-up flex-wrap">
        <div>
          <h2 className="text-2xl font-black text-ink">{lang === "en" ? "Payments" : "Paiements"}</h2>
          <p className="text-sm text-slate mt-0.5">{payments.length} {lang === "en" ? "transaction(s)" : "transaction(s)"}</p>
        </div>
        <div className="flex items-center gap-3">
          <CurrencyToggle />
          <button onClick={() => setModalOpen(true)} className="btn-primary">
            <Plus className="w-4 h-4" strokeWidth={2.5} />
            {lang === "en" ? "Make Payment" : "Effectuer un Paiement"}
          </button>
        </div>
      </div>

      {bannerItemId && (
        <div className="mb-6 rounded-2xl border border-brand/30 bg-amber-50 p-5 animate-fade-in-up">
          <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
            <div>
              <p className="text-xs font-bold text-brand uppercase tracking-wider mb-1">
                {isRegisterFlow ? (lang === "en" ? "Course Registration Required" : "Inscription au Cours Requise") : (lang === "en" ? "Unlock Premium Material" : "Débloquer le Contenu Premium")}
              </p>
              <p className="font-bold text-ink">{bannerTitle ? decodeURIComponent(bannerTitle) : ""}</p>
              <p className="text-2xl font-black text-navy mt-1">{format(bannerAmountUsd)}</p>
            </div>
          </div>

          <div className="flex gap-2 mb-4">
            <button onClick={() => setPayMethod("paystack")} className={`flex-1 text-sm font-bold py-2 rounded-lg border transition-colors ${payMethod === "paystack" ? "bg-navy text-white border-navy" : "bg-white text-slate border-gray-200"}`}>
              {lang === "en" ? "Pay with Card" : "Payer par Carte"}
            </button>
            <button onClick={() => setPayMethod("bank_transfer")} className={`flex-1 text-sm font-bold py-2 rounded-lg border transition-colors ${payMethod === "bank_transfer" ? "bg-navy text-white border-navy" : "bg-white text-slate border-gray-200"}`}>
              {lang === "en" ? "Bank Transfer" : "Virement Bancaire"}
            </button>
          </div>

          {payMethod === "paystack" ? (
            <button onClick={payWithPaystack} disabled={payingNow || !publicKey} className="btn-primary w-full disabled:opacity-60">
              {payingNow ? "…" : (lang === "en" ? `Pay ${format(bannerAmountUsd)} Now` : `Payer ${format(bannerAmountUsd)} Maintenant`)}
            </button>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-slate">
                {lang === "en" ? "Transfer to the school's bank account, then submit your transaction reference below." : "Effectuez le virement vers le compte de l'école, puis soumettez votre référence de transaction ci-dessous."}
              </p>
              <input type="text" value={transferRef} onChange={e => setTransferRef(e.target.value)}
                placeholder={lang === "en" ? "Transaction reference" : "Référence de transaction"}
                className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-navy/50" />
              <button onClick={submitTransfer} disabled={submittingTransfer || !transferRef.trim()} className="btn-primary w-full disabled:opacity-60">
                {submittingTransfer ? "…" : (lang === "en" ? "Submit for Confirmation" : "Soumettre pour Confirmation")}
              </button>
            </div>
          )}
        </div>
      )}

      {!loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6 stagger-children">
          <div className={`rounded-2xl p-5 ${totalDue > 0 ? "bg-red-50" : "bg-green-50"}`}>
            <div className="text-xs font-bold uppercase tracking-wider mb-1 opacity-60">{lang === "en" ? "Outstanding Balance" : "Solde Dû"}</div>
            <div className={`text-2xl font-black ${totalDue > 0 ? "text-red-700" : "text-green-700"}`}>
              {totalDue > 0 ? format(totalDue) : (lang === "en" ? "All Clear" : "Tout réglé")}
            </div>
            {totalDue > 0 && (
              <p className="text-xs mt-1 text-red-500 font-medium">
                {payments.filter(p => p.status === "pending").length} {lang === "en" ? "payment(s) pending" : "paiement(s) en attente"}
              </p>
            )}
          </div>
          <div className="card p-5">
            <div className="text-xs font-bold uppercase tracking-wider mb-1 text-slate">{lang === "en" ? "Total Paid" : "Total Payé"}</div>
            <div className="text-2xl font-black text-navy">{format(totalPaid)}</div>
            <p className="text-xs mt-1 text-gray-400">{payments.filter(p => p.status === "success").length} {lang === "en" ? "successful payment(s)" : "paiement(s) réussi(s)"}</p>
          </div>
        </div>
      )}

      <div className="flex gap-1.5 mb-4 bg-gray-100 p-1 rounded-xl w-fit animate-fade-in-up" style={{ animationDelay: "0.05s" }}>
        {FILTERS.map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all duration-150 ${filter === f.key ? "bg-white text-navy shadow-sm" : "text-slate hover:text-ink"}`}>
            {lang === "en" ? f.en : f.fr}
            <span className="ml-1 text-xs opacity-60">{f.key === "all" ? payments.length : payments.filter(p => p.status === f.key).length}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="card divide-y divide-gray-50">{Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} />)}</div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title={lang === "en" ? "No payment records" : "Aucun paiement"}
          action={<button onClick={() => setModalOpen(true)} className="btn-outline">{lang === "en" ? "Make Your First Payment" : "Effectuer un Paiement"}</button>}
        />
      ) : (
        <div className="card overflow-hidden stagger-children">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50/60 border-b border-gray-100">
                  {[lang === "en" ? "Date" : "Date", lang === "en" ? "Type" : "Type", lang === "en" ? "Amount" : "Montant", lang === "en" ? "Status" : "Statut", lang === "en" ? "Reference" : "Référence", lang === "en" ? "Receipt" : "Reçu"].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-bold text-slate uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(pay => (
                  <tr key={pay.id} className="hover:bg-gray-50/60 transition-colors">
                    <td className="px-5 py-3.5 text-gray-500 text-xs whitespace-nowrap">{fmtDate(pay.paid_at ?? pay.created_at)}</td>
                    <td className="px-5 py-3.5 font-medium text-ink">{typeLabel(pay.type, lang)}</td>
                    <td className="px-5 py-3.5 font-bold text-ink whitespace-nowrap">{format(usdOf(pay))}</td>
                    <td className="px-5 py-3.5"><Badge color={STATUS_COLOR[pay.status]}>{lang === "en" ? STATUS_LABEL[pay.status].en : STATUS_LABEL[pay.status].fr}</Badge></td>
                    <td className="px-5 py-3.5 text-xs text-gray-400 font-mono">{pay.reference ?? "—"}</td>
                    <td className="px-5 py-3.5">
                      {pay.status === "success" ? (
                        <button onClick={() => setReceiptFor(pay)} className="flex items-center gap-1.5 text-xs font-bold text-navy hover:text-brand transition-colors">
                          <ReceiptIcon className="w-3.5 h-3.5" strokeWidth={2} />
                          {lang === "en" ? "View" : "Voir"}
                        </button>
                      ) : (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && totalDue > 0 && (
        <div className="mt-6 bg-orange-50 border border-amber-100 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-fade-in-up">
          <div>
            <p className="font-bold text-amber-800 text-sm">{lang === "en" ? "You have outstanding payments" : "Vous avez des paiements en attente"}</p>
            <p className="text-amber-600 text-xs mt-0.5">{lang === "en" ? "Settle below, or contact administration." : "Réglez ci-dessous, ou contactez l'administration."}</p>
          </div>
          <a href="mailto:finance@lwgsm.edu" className="btn-outline flex-shrink-0">
            <Mail className="w-4 h-4" strokeWidth={2} />
            {lang === "en" ? "Contact Finance" : "Contacter la Finance"}
          </a>
        </div>
      )}

      <PaymentModal open={modalOpen} onClose={() => setModalOpen(false)} lang={lang} onCompleted={load} />

      {receiptFor && profile && (
        <ReceiptModal
          open={!!receiptFor}
          onClose={() => setReceiptFor(null)}
          payment={receiptFor}
          studentName={profile.full_name}
          lang={lang}
        />
      )}
    </StudentLayout>
  );
}
