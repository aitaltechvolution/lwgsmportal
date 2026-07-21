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
import { PAYMENT_TYPES, CURRENCIES } from "@/lib/constants";

interface Payment {
  id: string;
  amount: number;
  amount_usd: number | null;
  amount_ngn: number | null;
  currency: string;
  type: string;
  status: "pending" | "success" | "failed";
  method: string | null;
  reference: string | null;
  transfer_reference: string | null;
  receipt_number: string | null;
  description: string | null;
  paid_at: string | null;
  created_at: string;
  course_id: string | null;
  material_id: string | null;
}

interface BankAccount {
  id: string;
  bank_name: string;
  account_name: string;
  account_number: string;
  currency: string;
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
  // course_id -> program title, fetched separately below rather than via
  // a PostgREST embedded join — payments.course_id has no declared FK, so
  // `courses(...)` embedding errors out and was silently emptying this
  // whole payments list.
  const [programTitles, setProgramTitles] = useState<Record<string, string>>({});

  const load = useCallback(() => {
    if (!profile?.id) return;
    supabase.from("payments").select("*").eq("student_id", profile.id).order("created_at", { ascending: false })
      .then(({ data }) => {
        const rows = (data ?? []) as Payment[];
        setPayments(rows);
        setLoading(false);
        loadProgramTitles(rows);
      });
  }, [profile?.id]);

  const loadProgramTitles = async (rows: Payment[]) => {
    const courseIds = Array.from(new Set(rows.map(p => p.course_id).filter((id): id is string => !!id)));
    if (courseIds.length === 0) return;
    const { data: courses } = await supabase.from("courses").select("id, title, title_fr, program_id").in("id", courseIds);
    if (!courses) return;
    const programIds = Array.from(new Set(courses.map((c: { program_id: string | null }) => c.program_id).filter((id): id is string => !!id)));
    const { data: programs } = programIds.length
      ? await supabase.from("programs").select("id, title, title_fr").in("id", programIds)
      : { data: [] as { id: string; title: string; title_fr: string | null }[] };
    const programMap = new Map((programs ?? []).map((pr: { id: string; title: string; title_fr: string | null }) => [pr.id, pr]));
    const map: Record<string, string> = {};
    (courses as { id: string; title: string; title_fr: string | null; program_id: string | null }[]).forEach(c => {
      const program = c.program_id ? programMap.get(c.program_id) : null;
      const title = program ? ((lang === "fr" && program.title_fr) || program.title) : ((lang === "fr" && c.title_fr) || c.title);
      map[c.id] = title;
    });
    setProgramTitles(map);
  };

  useEffect(() => { load(); }, [load]);

  const usdOf = (p: Payment) => p.amount_usd ?? p.amount;
  // See the equivalent note on admin/Finance.tsx: amount_usd is a derived
  // approximation of the exact Naira fee, so re-converting it back to NGN
  // via format() can drift by a few naira. Use amount_ngn verbatim instead
  // whenever the student's display currency is NGN.
  const fmtAmount = (p: Payment) =>
    currency === "NGN" && p.amount_ngn != null
      ? `${CURRENCIES.find(c => c.code === "NGN")!.symbol}${p.amount_ngn.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
      : format(usdOf(p));
  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(lang === "fr" ? "fr-FR" : "en-GB", { day: "numeric", month: "short", year: "numeric" });

  const filtered = filter === "all" ? payments : payments.filter(p => p.status === filter);
  const totalDue  = payments.filter(p => p.status === "pending").reduce((s, p) => s + usdOf(p), 0);
  const totalPaid = payments.filter(p => p.status === "success").reduce((s, p) => s + usdOf(p), 0);
  // Same drift as fmtAmount: sum the exact amount_ngn figures instead of
  // re-converting the summed USD approximations when display is NGN.
  const totalDueNgn  = payments.filter(p => p.status === "pending").reduce((s, p) => s + (p.amount_ngn ?? 0), 0);
  const totalPaidNgn = payments.filter(p => p.status === "success").reduce((s, p) => s + (p.amount_ngn ?? 0), 0);
  const fmtTotal = (usd: number, ngn: number) =>
    currency === "NGN"
      ? `${CURRENCIES.find(c => c.code === "NGN")!.symbol}${ngn.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
      : format(usd);

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
  const registerAmountNgn = searchParams.get('amountNgn');
  const registerCourseTitle = searchParams.get('courseTitle');
  // Certificate collection fee — student lands here from the "Request
  // Certificate" button on the Certificates page instead of that page
  // silently inserting its own pending bank-transfer row (which had no
  // way to prevent a second, duplicate submission). Reusing this page's
  // existing pending/success guard (`existingBannerPayment` below) is
  // what actually prevents the double-payment problem.
  const certificateId = searchParams.get('certificateId');
  const certNumber = searchParams.get('certNumber');
  const certAmount = searchParams.get('certAmount');

  const isRegisterFlow = !!registerCourseId;
  const isCertificateFlow = !isRegisterFlow && !!certificateId;
  const bannerItemId = unlockMaterialId ?? registerCourseId ?? (isCertificateFlow ? certificateId : null);
  const bannerTitle = isRegisterFlow ? registerCourseTitle : isCertificateFlow ? certNumber : unlockTitle;
  const bannerAmountUsd = Number((isRegisterFlow ? registerAmount : isCertificateFlow ? certAmount : unlockPrice) ?? 0);
  // The exact string stored on the payments row's `description` for a
  // certificate fee — there's no dedicated certificate_id column on
  // `payments`, so this is how we recognise "a payment for *this*
  // certificate already exists" further down. Deliberately NOT
  // language-dependent: if it were, a student who switches UI language
  // between requesting and revisiting this page would fail to match
  // their own existing payment and could pay twice.
  const certDescription = certNumber ? `Certificate collection — ${decodeURIComponent(certNumber)}` : null;
  // Registration fees are configured by the admin in exact Naira — use
  // that figure directly for the charge/record. Never recompute it via
  // amountUsd * exchangeRate, which introduces rounding drift (e.g. an
  // admin-set ₦5,000 fee turning into ₦5,008 on the payment record).
  const bannerAmountNgn = isRegisterFlow && registerAmountNgn
    ? Number(registerAmountNgn)
    : null;

  const { exchangeRate, currency } = useCurrency();
  // Same exact-NGN preference as fmtAmount, applied to the pre-payment
  // banner (uses bannerAmountNgn since that payment row doesn't exist yet).
  const fmtBannerAmount = () =>
    currency === "NGN" && bannerAmountNgn != null
      ? `${CURRENCIES.find(c => c.code === "NGN")!.symbol}${bannerAmountNgn.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
      : format(bannerAmountUsd);
  const { initiate } = usePaystackPayment();
  const [publicKey, setPublicKey] = useState("");
  const [payMethod, setPayMethod] = useState<"paystack" | "bank_transfer">("paystack");
  const [payingNow, setPayingNow] = useState(false);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Is there already a payment row (pending confirmation, or already
  // succeeded) for the exact item this banner is for? If so, we must not
  // show the "pay now" form again — that's what let students resubmit
  // bank-transfer claims over and over, stacking up duplicate pending rows
  // for the same course and inflating their apparent balance.
  const existingBannerPayment = bannerItemId
    ? payments.find(p =>
        (p.status === "pending" || p.status === "success") &&
        (isRegisterFlow ? p.course_id === registerCourseId && p.type === "registration"
         : isCertificateFlow ? p.description === certDescription && p.type === "certificate"
         : p.material_id === unlockMaterialId)
      ) ?? null
    : null;

  useEffect(() => {
    supabase.from("bank_accounts").select("id, bank_name, account_name, account_number, currency")
      .eq("is_active", true).order("sort_order")
      .then(({ data }) => setBankAccounts((data ?? []) as BankAccount[]));
  }, []);

  // Show accounts matching the student's currently selected display
  // currency; if the school has none in that currency, fall back to NGN
  // (transfers within Nigeria are always the safe default) rather than
  // showing nothing or accounts in a currency the student didn't pick.
  const matchingAccounts = bankAccounts.filter(a => a.currency === currency);
  const displayAccounts = matchingAccounts.length > 0 ? matchingAccounts : bankAccounts.filter(a => a.currency === "NGN");

  const onCopyAccount = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      /* clipboard unavailable — number is still visible to copy manually */
    }
  };

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
        amountNgn: bannerAmountNgn ?? undefined,
        exchangeRate,
        studentId: profile.id,
        paymentType: isRegisterFlow ? "registration" : isCertificateFlow ? "certificate" : "material",
        publicKey,
        courseId: isRegisterFlow ? registerCourseId! : undefined,
        description: isCertificateFlow ? certDescription ?? undefined : undefined,
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
    if (!profile?.id || !bannerItemId || !transferRef.trim() || existingBannerPayment) return;
    setSubmittingTransfer(true);
    const amountNgn = bannerAmountNgn ?? Math.round(bannerAmountUsd * exchangeRate * 100) / 100;
    const { error } = await supabase.from('payments').insert({
      student_id: profile.id,
      amount: amountNgn,
      currency: 'NGN',
      amount_usd: bannerAmountUsd || 0,
      amount_ngn: amountNgn,
      type: isRegisterFlow ? 'registration' : isCertificateFlow ? 'certificate' : 'material',
      status: 'pending',
      method: 'bank_transfer',
      transfer_reference: transferRef.trim(),
      material_id: (isRegisterFlow || isCertificateFlow) ? null : unlockMaterialId,
      course_id: isRegisterFlow ? registerCourseId : null,
      description: isCertificateFlow
        ? (certDescription ?? 'Certificate collection')
        : (bannerTitle
            ? `${isRegisterFlow ? 'Registration' : 'Unlock'}: ${decodeURIComponent(bannerTitle)}`
            : (isRegisterFlow ? 'Course registration' : 'Premium material')),
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
        <div className="mb-6 rounded-2xl border border-brand/30 bg-amber-50 p-5 lg:max-w-md animate-fade-in-up">
          <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
            <div>
              <p className="text-xs font-bold text-brand uppercase tracking-wider mb-1">
                {isRegisterFlow
                  ? (lang === "en" ? "Course Registration Required" : "Inscription au Cours Requise")
                  : isCertificateFlow
                    ? (lang === "en" ? "Certificate Collection Fee" : "Frais de Retrait de Certificat")
                    : (lang === "en" ? "Unlock Premium Material" : "Débloquer le Contenu Premium")}
              </p>
              <p className="font-bold text-ink">{bannerTitle ? decodeURIComponent(bannerTitle) : ""}</p>
              <p className="text-2xl font-black text-navy mt-1">{fmtBannerAmount()}</p>
            </div>
          </div>

          {existingBannerPayment?.status === "success" ? (
            <div className="flex items-center gap-3 bg-green-50 border border-green-100 rounded-xl px-4 py-3">
              <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" strokeWidth={2} />
              <p className="text-sm text-green-700 font-medium">
                {isCertificateFlow
                  ? (lang === "en" ? "Payment confirmed — your certificate is fully paid." : "Paiement confirmé — votre certificat est entièrement payé.")
                  : (lang === "en" ? "Payment confirmed — this should already be unlocked." : "Paiement confirmé — cela devrait déjà être débloqué.")}
              </p>
            </div>
          ) : existingBannerPayment?.status === "pending" ? (
            <div className="flex items-start gap-3 bg-amber-100/70 border border-amber-200 rounded-xl px-4 py-3">
              <Clock className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" strokeWidth={2} />
              <div>
                <p className="text-sm text-amber-800 font-bold">
                  {lang === "en" ? "Pending confirmation" : "En attente de confirmation"}
                </p>
                <p className="text-xs text-amber-700 mt-0.5">
                  {lang === "en"
                    ? `We've received your ${existingBannerPayment.method === "bank_transfer" ? "transfer reference" : "payment"} and it's awaiting admin confirmation — usually within 24 hours. This will unlock automatically once confirmed.`
                    : `Nous avons bien reçu votre ${existingBannerPayment.method === "bank_transfer" ? "référence de virement" : "paiement"}, en attente de confirmation par l'administration — généralement sous 24 heures.`}
                </p>
                {existingBannerPayment.transfer_reference && (
                  <p className="text-xs text-amber-600 font-mono mt-1.5">{existingBannerPayment.transfer_reference}</p>
                )}
              </div>
            </div>
          ) : (
            <>
              <div className="flex gap-2 mb-4">
                <button onClick={() => setPayMethod("paystack")} className={`flex-1 text-sm font-bold py-2 rounded-lg border transition-colors ${payMethod === "paystack" ? "bg-navy text-white border-navy" : "bg-white text-slate border-gray-200"}`}>
                  {lang === "en" ? "Online (Paystack)" : "En Ligne (Paystack)"}
                </button>
                <button onClick={() => setPayMethod("bank_transfer")} className={`flex-1 text-sm font-bold py-2 rounded-lg border transition-colors ${payMethod === "bank_transfer" ? "bg-navy text-white border-navy" : "bg-white text-slate border-gray-200"}`}>
                  {lang === "en" ? "Bank Transfer" : "Virement Bancaire"}
                </button>
              </div>

              {payMethod === "paystack" ? (
                <button onClick={payWithPaystack} disabled={payingNow || !publicKey} className="btn-primary w-full disabled:opacity-60">
                  {payingNow ? "…" : (lang === "en" ? `Pay ${fmtBannerAmount()} Now` : `Payer ${fmtBannerAmount()} Maintenant`)}
                </button>
              ) : (
                <div className="space-y-3">
                  {displayAccounts.length === 0 ? (
                    <div className="bg-yellow-50 border border-yellow-100 rounded-xl px-4 py-3 text-sm text-yellow-700 flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" strokeWidth={2} />
                      {lang === "en" ? "No bank accounts are configured yet. Please contact finance." : "Aucun compte bancaire configuré. Contactez la finance."}
                    </div>
                  ) : (
                    displayAccounts.map(acc => (
                      <div key={acc.id} className="bg-white rounded-xl p-4 border border-gray-100">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-bold text-ink text-sm">{acc.bank_name}</span>
                          <span className="text-[11px] text-gray-400 font-semibold">{acc.currency}</span>
                        </div>
                        <p className="text-xs text-gray-500 mb-2">{acc.account_name}</p>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-bold text-navy">{acc.account_number}</span>
                          <button onClick={() => onCopyAccount(acc.account_number, acc.id)} className="text-gray-400 hover:text-navy transition-colors">
                            {copiedId === acc.id ? <CheckCircle2 className="w-3.5 h-3.5 text-green-600" strokeWidth={2.5} /> : <Upload className="w-3.5 h-3.5 rotate-180" strokeWidth={2} />}
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                  <p className="text-xs text-slate">
                    {lang === "en" ? "Transfer to the account above, then submit your transaction reference below." : "Effectuez le virement vers le compte ci-dessus, puis soumettez votre référence de transaction ci-dessous."}
                  </p>
                  <input type="text" value={transferRef} onChange={e => setTransferRef(e.target.value)}
                    placeholder={lang === "en" ? "Transaction reference" : "Référence de transaction"}
                    className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-navy/50" />
                  <button onClick={submitTransfer} disabled={submittingTransfer || !transferRef.trim()} className="btn-primary w-full disabled:opacity-60">
                    {submittingTransfer ? "…" : (lang === "en" ? "Submit for Confirmation" : "Soumettre pour Confirmation")}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {!loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6 stagger-children">
          <div className={`rounded-2xl p-5 ${totalDue > 0 ? "bg-amber-50" : "bg-green-50"}`}>
            <div className="text-xs font-bold uppercase tracking-wider mb-1 opacity-60">{lang === "en" ? "Pending Confirmation" : "En Attente de Confirmation"}</div>
            <div className={`text-2xl font-black ${totalDue > 0 ? "text-amber-700" : "text-green-700"}`}>
              {totalDue > 0 ? fmtTotal(totalDue, totalDueNgn) : (lang === "en" ? "All Clear" : "Tout réglé")}
            </div>
            {totalDue > 0 && (
              <p className="text-xs mt-1 text-amber-600 font-medium">
                {payments.filter(p => p.status === "pending").length} {lang === "en" ? "payment(s) awaiting admin confirmation" : "paiement(s) en attente de confirmation"}
              </p>
            )}
          </div>
          <div className="card p-5">
            <div className="text-xs font-bold uppercase tracking-wider mb-1 text-slate">{lang === "en" ? "Total Paid" : "Total Payé"}</div>
            <div className="text-2xl font-black text-navy">{fmtTotal(totalPaid, totalPaidNgn)}</div>
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
                    <td className="px-5 py-3.5 font-bold text-ink whitespace-nowrap">{fmtAmount(pay)}</td>
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
            <p className="font-bold text-amber-800 text-sm">{lang === "en" ? "You have payment(s) awaiting confirmation" : "Vous avez des paiements en attente de confirmation"}</p>
            <p className="text-amber-600 text-xs mt-0.5">{lang === "en" ? "An admin will confirm these shortly, or contact administration with questions." : "Un administrateur confirmera ces paiements sous peu, ou contactez l'administration."}</p>
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
          programTitle={receiptFor.course_id ? (programTitles[receiptFor.course_id] ?? null) : null}
          lang={lang}
        />
      )}
    </StudentLayout>
  );
}