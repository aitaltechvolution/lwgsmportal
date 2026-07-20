import { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/ui/primitives";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useToast } from "@/contexts/ToastContext";
import { supabase } from "@/lib/supabase";
import { PAYMENT_TYPES } from "@/lib/constants";
import { usePaystackPayment } from "@/lib/usePaystackPayment";
import { CreditCard, Building2, Loader2, Copy, Check, AlertCircle } from "lucide-react";

interface BankAccount {
  id: string;
  bank_name: string;
  account_name: string;
  account_number: string;
  currency: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  lang: "en" | "fr";
  /** Called after a successful Paystack payment or a submitted bank-transfer claim. */
  onCompleted: () => void;
}

type Method = "paystack" | "bank_transfer";

export default function PaymentModal({ open, onClose, lang, onCompleted }: Props) {
  const { profile } = useAuth();
  const { exchangeRate, format, currency } = useCurrency();
  const { showToast } = useToast();
  const { initiate } = usePaystackPayment();

  const [type, setType] = useState(PAYMENT_TYPES[0].value);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<Method>("paystack");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fees, setFees] = useState<Record<string, number>>({});
  // Exact Naira amount as entered by the admin for fixed fees that are
  // NGN-native (currently just registration). Charges/records must use
  // this verbatim rather than round-tripping it through USD conversion,
  // which drifts the figure away from what the admin actually set.
  const [fixedNgn, setFixedNgn] = useState<Record<string, number>>({});
  const [publicKey, setPublicKey] = useState("");
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [transferClaimed, setTransferClaimed] = useState(false);

  const selectedType = useMemo(() => PAYMENT_TYPES.find((t) => t.value === type)!, [type]);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setTransferClaimed(false);
    setMethod("paystack");
    supabase
      .from("site_settings")
      .select("key, value")
      .in("key", ["fee_reg_certificate", "fee_certificate", "paystack_public_key"])
      .then(({ data }) => {
        const map = new Map((data ?? []).map((r: { key: string; value: string }) => [r.key, r.value]));
        // fee_reg_certificate is entered by the admin in Naira (see the
        // "(₦)" label in Settings) — convert to its USD-equivalent since
        // this modal's "Amount (USD)" field, and the Paystack charge it
        // feeds, are both USD-based. fee_certificate is already USD, so
        // it's left as-is.
        const feeRegNgn = Number(map.get("fee_reg_certificate") ?? 10000);
        setFees({
          // Registration fees are now per-programme-type and tied to a
          // specific course (see the registration gate on CourseDetail).
          // This generic modal only covers the Certificate-track default
          // for a standalone registration payment made outside that flow.
          fee_registration: exchangeRate ? feeRegNgn / exchangeRate : feeRegNgn,
          fee_certificate: Number(map.get("fee_certificate") ?? 0),
        });
        setFixedNgn({ fee_registration: feeRegNgn });
        setPublicKey(map.get("paystack_public_key") ?? "");
      });
    supabase
      .from("bank_accounts")
      .select("id, bank_name, account_name, account_number, currency")
      .eq("is_active", true)
      .order("sort_order")
      .then(({ data }) => setBankAccounts((data ?? []) as BankAccount[]));
  }, [open, exchangeRate]);

  // Pre-fill (and lock) the amount for fixed-fee types.
  useEffect(() => {
    if (selectedType.kind === "fixed" && selectedType.feeSettingKey) {
      const fee = fees[selectedType.feeSettingKey];
      if (fee) setAmount(String(fee));
    } else {
      setAmount("");
    }
  }, [type, fees, selectedType]);

  if (!profile) return null;

  const amountNum = Number(amount);
  const amountValid = amountNum > 0;
  // Show accounts in the student's selected currency; if the school has
  // none in that currency, fall back to NGN rather than showing nothing.
  const matchingAccounts = bankAccounts.filter(a => a.currency === currency);
  const displayAccounts = matchingAccounts.length > 0 ? matchingAccounts : bankAccounts.filter(a => a.currency === "NGN");

  const onCopy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      /* clipboard unavailable — silently ignore, the number is still visible to copy manually */
    }
  };

  const onPayOnline = async () => {
    if (!amountValid) { setError(lang === "en" ? "Enter a valid amount." : "Entrez un montant valide."); return; }
    if (!publicKey) { setError(lang === "en" ? "Online payments are not configured yet. Please use bank transfer or contact finance." : "Les paiements en ligne ne sont pas encore configurés. Utilisez le virement bancaire."); return; }
    setSubmitting(true);
    setError(null);
    try {
      const result = await initiate({
        email: profile.email,
        amountUsd: amountNum,
        amountNgn: selectedType.feeSettingKey ? fixedNgn[selectedType.feeSettingKey] : undefined,
        exchangeRate,
        studentId: profile.id,
        paymentType: type,
        publicKey,
      });
      if (result.status === "success") {
        showToast("success", lang === "en" ? "Payment successful! Your receipt is ready." : "Paiement réussi ! Votre reçu est prêt.");
        onCompleted();
        onClose();
      } else if (result.status === "failed") {
        showToast("error", lang === "en" ? "Payment could not be verified. Please try again." : "Le paiement n'a pas pu être vérifié. Veuillez réessayer.");
        onCompleted();
      }
      // "cancelled" — student closed the popup; row stays pending, no toast needed.
    } catch (err) {
      const msg = err instanceof Error ? err.message : (lang === "en" ? "Payment failed. Please try again." : "Le paiement a échoué.");
      setError(msg);
      showToast("error", msg);
    } finally {
      setSubmitting(false);
    }
  };

  const onClaimTransfer = async () => {
    if (!amountValid) { setError(lang === "en" ? "Enter a valid amount." : "Entrez un montant valide."); return; }
    setSubmitting(true);
    setError(null);
    try {
      const amountNgn = (selectedType.feeSettingKey && fixedNgn[selectedType.feeSettingKey])
        ? fixedNgn[selectedType.feeSettingKey]
        : Math.round(amountNum * exchangeRate * 100) / 100;
      const reference = `bank-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const { error: insErr } = await supabase.from("payments").insert({
        student_id: profile.id,
        type,
        amount: amountNgn,
        currency: "NGN",
        amount_usd: amountNum,
        amount_ngn: amountNgn,
        method: "bank_transfer",
        status: "pending",
        reference,
      });
      if (insErr) throw insErr;
      setTransferClaimed(true);
      showToast("info", lang === "en" ? "Thanks — we'll confirm your transfer shortly." : "Merci — nous confirmerons votre virement prochainement.");
      onCompleted();
    } catch (err) {
      const msg = err instanceof Error ? err.message : (lang === "en" ? "Could not record your transfer claim." : "Échec de l'enregistrement.");
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={lang === "en" ? "Make a Payment" : "Effectuer un Paiement"} maxWidth="max-w-lg">
      {transferClaimed ? (
        <div className="text-center py-6 animate-scale-in">
          <div className="w-14 h-14 rounded-2xl bg-green-50 flex items-center justify-center mx-auto mb-4">
            <Check className="w-7 h-7 text-green-600" strokeWidth={2} />
          </div>
          <p className="font-bold text-green-700 text-lg mb-1">{lang === "en" ? "Submitted!" : "Soumis !"}</p>
          <p className="text-slate text-sm mb-5">
            {lang === "en"
              ? "Your transfer claim is now pending admin confirmation. It will appear as 'Pending' in your payment history until confirmed."
              : "Votre réclamation de virement est en attente de confirmation par l'administration."}
          </p>
          <button onClick={onClose} className="btn-primary">{lang === "en" ? "Done" : "Terminé"}</button>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <label className="label">{lang === "en" ? "Payment Type" : "Type de Paiement"}</label>
            <select value={type} onChange={(e) => setType(e.target.value as typeof type)} className="input">
              {PAYMENT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{lang === "en" ? t.en : t.fr}{lang === "en" && t.fr ? ` / ${t.fr}` : ""}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">{lang === "en" ? "Amount (USD)" : "Montant (USD)"}</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={selectedType.kind === "fixed"}
              className={`input ${selectedType.kind === "fixed" ? "bg-gray-50 text-gray-500" : ""}`}
            />
            {amountValid && (
              <p className="text-xs text-gray-400 mt-1">
                ≈ {format(amountNum)} {lang === "en" ? "at today's rate" : "au taux du jour"} (₦{(amountNum * exchangeRate).toLocaleString(undefined, { maximumFractionDigits: 0 })})
              </p>
            )}
            {selectedType.kind === "fixed" && (
              <p className="text-xs text-gray-400 mt-1">{lang === "en" ? "This fee amount is fixed by the school." : "Ce montant est fixé par l'école."}</p>
            )}
          </div>

          <div>
            <label className="label">{lang === "en" ? "Payment Method" : "Méthode de Paiement"}</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setMethod("paystack")}
                className={`flex flex-col items-center gap-2 py-4 rounded-xl border text-sm font-bold transition-all duration-150
                  ${method === "paystack" ? "border-navy bg-navy/5 text-navy" : "border-gray-200 text-slate hover:border-navy/30"}`}
              >
                <CreditCard className="w-5 h-5" strokeWidth={2} />
                {lang === "en" ? "Online (Paystack)" : "En Ligne (Paystack)"}
              </button>
              <button
                type="button"
                onClick={() => setMethod("bank_transfer")}
                className={`flex flex-col items-center gap-2 py-4 rounded-xl border text-sm font-bold transition-all duration-150
                  ${method === "bank_transfer" ? "border-navy bg-navy/5 text-navy" : "border-gray-200 text-slate hover:border-navy/30"}`}
              >
                <Building2 className="w-5 h-5" strokeWidth={2} />
                {lang === "en" ? "Bank Transfer" : "Virement Bancaire"}
              </button>
            </div>
          </div>

          {method === "bank_transfer" && (
            <div className="space-y-3">
              {displayAccounts.length === 0 ? (
                <div className="bg-yellow-50 border border-yellow-100 rounded-xl px-4 py-3 text-sm text-yellow-700 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" strokeWidth={2} />
                  {lang === "en" ? "No bank accounts are configured yet. Please contact finance." : "Aucun compte bancaire configuré. Contactez la finance."}
                </div>
              ) : (
                displayAccounts.map((acc) => (
                  <div key={acc.id} className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-ink text-sm">{acc.bank_name}</span>
                      <span className="text-[11px] text-gray-400 font-semibold">{acc.currency}</span>
                    </div>
                    <p className="text-xs text-gray-500 mb-2">{acc.account_name}</p>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold text-navy">{acc.account_number}</span>
                      <button onClick={() => onCopy(acc.account_number, acc.id)} className="text-gray-400 hover:text-navy transition-colors">
                        {copiedId === acc.id ? <Check className="w-3.5 h-3.5 text-green-600" strokeWidth={2.5} /> : <Copy className="w-3.5 h-3.5" strokeWidth={2} />}
                      </button>
                    </div>
                  </div>
                ))
              )}
              <p className="text-xs text-gray-400">
                {lang === "en"
                  ? "After transferring, click below to notify us. An admin will confirm your payment once the transfer reflects."
                  : "Après le virement, cliquez ci-dessous pour nous prévenir. Un administrateur confirmera votre paiement."}
              </p>
            </div>
          )}

          {error && <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-600 font-medium">{error}</div>}

          {method === "paystack" ? (
            <button onClick={onPayOnline} disabled={submitting || !amountValid} className="btn-primary w-full py-3 disabled:opacity-60 disabled:translate-y-0">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2.5} /> : <CreditCard className="w-4 h-4" strokeWidth={2} />}
              {submitting ? (lang === "en" ? "Processing…" : "Traitement…") : (lang === "en" ? "Pay Online" : "Payer en Ligne")}
            </button>
          ) : (
            <button onClick={onClaimTransfer} disabled={submitting || !amountValid || displayAccounts.length === 0} className="btn-primary w-full py-3 disabled:opacity-60 disabled:translate-y-0">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2.5} /> : <Check className="w-4 h-4" strokeWidth={2} />}
              {lang === "en" ? "I've Made the Transfer" : "J'ai Effectué le Virement"}
            </button>
          )}
        </div>
      )}
    </Modal>
  );
}