import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { EmptyState, SkeletonCard } from "@/components/ui/primitives";
import ReportToolbar from "@/components/ReportToolbar";
import { exportToCsv } from "@/lib/exportCsv";
import { useCurrency } from "@/contexts/CurrencyContext";
import { DollarSign, Clock, CreditCard } from "lucide-react";
import { PAYMENT_TYPES, CURRENCIES } from "@/lib/constants";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";

interface Props { lang: "en" | "fr" }

interface Payment { type: string; amount: number; amount_usd: number | null; amount_ngn: number | null; status: string; paid_at: string | null; created_at: string }

const TYPE_COLORS: Record<string, string> = {
  registration: "#0D2B55", tuition: "#C9A227", certificate: "#16a34a", material: "#9333ea", other: "#64748B",
};

export default function RevenueReport({ lang }: Props) {
  const { format, currency, exchangeRate } = useCurrency();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    supabase.from("payments").select("type, amount, amount_usd, amount_ngn, status, paid_at, created_at").then(({ data }) => {
      setPayments((data ?? []) as Payment[]);
      setLoading(false);
    });
  }, []);

  const usdOf = (p: Payment) => p.amount_usd ?? p.amount;
  // amount_usd is a *derived* figure for NGN-native fees (registration,
  // certificate) — back-computed from the exact Naira amount using
  // whatever exchange rate was in effect at charge time. Summing many
  // rows of it and converting once still accumulates drift (e.g. five
  // ₦10,000 fees could total ₦50,080 instead of ₦50,000). amount_ngn is
  // the canonical figure for NGN-native fees; fall back to a fresh
  // conversion only for genuinely USD-native types (tuition/material/other).
  const ngnOf = (p: Payment, exchangeRateFallback: number) => p.amount_ngn ?? usdOf(p) * exchangeRateFallback;
  const fmtNgn = (n: number) => `${CURRENCIES.find(c => c.code === "NGN")!.symbol}${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

  const filtered = useMemo(() => {
    return payments.filter(p => {
      const d = new Date(p.paid_at ?? p.created_at);
      if (dateFrom && d < new Date(dateFrom)) return false;
      if (dateTo && d > new Date(dateTo + "T23:59:59")) return false;
      return true;
    });
  }, [payments, dateFrom, dateTo]);

  const totalCollected = filtered.filter(p => p.status === "success").reduce((s, p) => s + usdOf(p), 0);
  const totalPending = filtered.filter(p => p.status === "pending").reduce((s, p) => s + usdOf(p), 0);
  const totalCollectedNgn = filtered.filter(p => p.status === "success").reduce((s, p) => s + ngnOf(p, exchangeRate), 0);
  const totalPendingNgn = filtered.filter(p => p.status === "pending").reduce((s, p) => s + ngnOf(p, exchangeRate), 0);

  const monthlyTrend = useMemo(() => {
    const now = new Date();
    const months: { key: string; label: string; total: number; totalNgn: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleDateString(lang === "fr" ? "fr-FR" : "en-US", { month: "short" }), total: 0, totalNgn: 0 });
    }
    const byKey = new Map(months.map(m => [m.key, m]));
    filtered.filter(p => p.status === "success").forEach(p => {
      const d = new Date(p.paid_at ?? p.created_at);
      const m = byKey.get(`${d.getFullYear()}-${d.getMonth()}`);
      if (m) { m.total += usdOf(p); m.totalNgn += ngnOf(p, exchangeRate); }
    });
    return months;
  }, [filtered, lang, exchangeRate]);

  // Stacked bar: one bar per month, one stacked segment per payment type.
  const stackedByType = useMemo(() => {
    const now = new Date();
    const months: { key: string; label: string; [type: string]: string | number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleDateString(lang === "fr" ? "fr-FR" : "en-US", { month: "short" }) });
    }
    const byKey = new Map(months.map(m => [m.key, m]));
    PAYMENT_TYPES.forEach(t => months.forEach(m => { m[t.value] = 0; m[`${t.value}_ngn`] = 0; }));
    filtered.filter(p => p.status === "success").forEach(p => {
      const d = new Date(p.paid_at ?? p.created_at);
      const m = byKey.get(`${d.getFullYear()}-${d.getMonth()}`);
      if (m) {
        m[p.type] = (Number(m[p.type]) || 0) + usdOf(p);
        m[`${p.type}_ngn`] = (Number(m[`${p.type}_ngn`]) || 0) + ngnOf(p, exchangeRate);
      }
    });
    return months;
  }, [filtered, lang, exchangeRate]);

  const onExport = () => {
    exportToCsv(
      `revenue-report-${new Date().toISOString().slice(0, 10)}.csv`,
      [lang === "en" ? "Month" : "Mois", ...PAYMENT_TYPES.map(t => lang === "en" ? t.en : t.fr)],
      stackedByType.map(m => [m.label, ...PAYMENT_TYPES.map(t => Math.round(Number(m[t.value] ?? 0) * 100) / 100)])
    );
  };

  if (loading) return <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{Array.from({ length: 2 }).map((_, i) => <SkeletonCard key={i} />)}</div>;

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-4 flex-wrap print:hidden">
        <div className="flex gap-3 items-end flex-wrap">
          <div>
            <label className="label">{lang === "en" ? "From" : "Du"}</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="input w-40" />
          </div>
          <div>
            <label className="label">{lang === "en" ? "To" : "Au"}</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="input w-40" />
          </div>
        </div>
        <ReportToolbar lang={lang} onExport={onExport} exportDisabled={filtered.length === 0} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="card p-5"><DollarSign className="w-5 h-5 text-green-600 mb-2" strokeWidth={2} /><div className="text-xl font-black text-green-700">{currency === "NGN" ? fmtNgn(totalCollectedNgn) : format(totalCollected)}</div><div className="text-xs text-slate mt-1">{lang === "en" ? "Total Collected" : "Total Collecté"}</div></div>
        <div className="card p-5"><Clock className="w-5 h-5 text-yellow-600 mb-2" strokeWidth={2} /><div className="text-xl font-black text-yellow-700">{currency === "NGN" ? fmtNgn(totalPendingNgn) : format(totalPending)}</div><div className="text-xs text-slate mt-1">{lang === "en" ? "Pending" : "En attente"}</div></div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={CreditCard} title={lang === "en" ? "No revenue in this range" : "Aucun revenu sur cette période"} />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="card p-5">
            <h3 className="font-bold text-ink text-sm mb-4">{lang === "en" ? "Monthly Revenue Trend" : "Tendance Mensuelle des Revenus"}</h3>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={monthlyTrend} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f1f1" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v) => currency === "NGN" ? fmtNgn(Number(v)) : format(Number(v))} />
                <Line type="monotone" dataKey={currency === "NGN" ? "totalNgn" : "total"} stroke="#C9A227" strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="card p-5">
            <h3 className="font-bold text-ink text-sm mb-4">{lang === "en" ? "Revenue by Payment Type" : "Revenu par Type de Paiement"}</h3>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={stackedByType} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f1f1" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v) => currency === "NGN" ? fmtNgn(Number(v)) : format(Number(v))} />
                <Legend wrapperStyle={{ fontSize: 11 }} formatter={(value) => { const key = currency === "NGN" ? value.replace(/_ngn$/, "") : value; const t = PAYMENT_TYPES.find(t => t.value === key); return t ? (lang === "en" ? t.en : t.fr) : value; }} />
                {PAYMENT_TYPES.map(t => (
                  <Bar key={t.value} dataKey={currency === "NGN" ? `${t.value}_ngn` : t.value} stackId="rev" fill={TYPE_COLORS[t.value]} radius={[0, 0, 0, 0]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
