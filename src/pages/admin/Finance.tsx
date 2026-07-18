import { useEffect, useMemo, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { supabase } from "@/lib/supabase";
import { useTranslation } from "react-i18next";
import {
  CreditCard, TrendingUp, DollarSign, Search, Download, CheckCircle2,
  Receipt as ReceiptIcon, Loader2, X,
} from "lucide-react";
import { Badge, EmptyState, SkeletonRow } from "@/components/ui/primitives";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useToast } from "@/contexts/ToastContext";
import CurrencyToggle from "@/components/CurrencyToggle";
import ReceiptModal from "@/components/ReceiptModal";
import { PAYMENT_TYPES } from "@/lib/constants";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend,
} from "recharts";

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
  confirmed_at: string | null;
  profiles?: { full_name: string; email: string } | null;
}

const STATUS_COLOR: Record<string, "green" | "yellow" | "red"> = { success: "green", pending: "yellow", failed: "red" };
const STATUS_LABEL: Record<string, { en: string; fr: string }> = {
  success: { en: "Paid", fr: "Payé" }, pending: { en: "Pending", fr: "En attente" }, failed: { en: "Failed", fr: "Échoué" },
};

function typeLabel(type: string, lang: "en" | "fr") {
  const t = PAYMENT_TYPES.find((p) => p.value === type);
  return t ? (lang === "en" ? t.en : t.fr) : type;
}

const CHART_COLORS = ["#1A2456", "#C9A227", "#16a34a", "#9333ea", "#dc2626"];

export default function AdminFinance() {
  const { i18n } = useTranslation();
  const lang = (i18n.language.startsWith("fr") ? "fr" : "en") as "en" | "fr";
  const { format } = useCurrency();
  const { showToast } = useToast();

  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"all" | "success" | "pending" | "failed">("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [search, setSearch] = useState("");
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [receiptFor, setReceiptFor] = useState<Payment | null>(null);

  const load = () => {
    supabase.from("payments").select("*, profiles!payments_student_id_fkey(full_name, email)").order("created_at", { ascending: false })
      .then(({ data }) => { setPayments((data ?? []) as unknown as Payment[]); setLoading(false); });
  };

  useEffect(() => { load(); }, []);

  // amount_usd is the canonical figure; amount/currency are kept for legacy
  // rows recorded before the USD ledger migration (treated as already USD).
  const usdOf = (p: Payment) => p.amount_usd ?? p.amount;
  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(lang === "fr" ? "fr-FR" : "en-GB", { day: "numeric", month: "short", year: "numeric" });

  const filtered = useMemo(() => {
    return payments.filter((p) => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (typeFilter !== "all" && p.type !== typeFilter) return false;
      const d = new Date(p.paid_at ?? p.created_at);
      if (dateFrom && d < new Date(dateFrom)) return false;
      if (dateTo && d > new Date(dateTo + "T23:59:59")) return false;
      if (search) {
        const q = search.toLowerCase();
        const student = p.profiles as { full_name?: string; email?: string } | null;
        const haystack = [student?.full_name, student?.email, p.reference, p.receipt_number, p.type].filter(Boolean).join(" ").toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [payments, statusFilter, typeFilter, dateFrom, dateTo, search]);

  const totalRevenue = payments.filter(p => p.status === "success").reduce((s, p) => s + usdOf(p), 0);
  const totalPending = payments.filter(p => p.status === "pending").reduce((s, p) => s + usdOf(p), 0);

  // Breakdown by payment type (successful payments only)
  const byType = useMemo(() => {
    const map = new Map<string, number>();
    payments.filter(p => p.status === "success").forEach(p => {
      map.set(p.type, (map.get(p.type) ?? 0) + usdOf(p));
    });
    return PAYMENT_TYPES.map(t => ({ name: lang === "en" ? t.en : t.fr, value: Math.round((map.get(t.value) ?? 0) * 100) / 100 }))
      .filter(d => d.value > 0);
  }, [payments, lang]);

  // Monthly trend (last 6 months, successful payments)
  const monthlyTrend = useMemo(() => {
    const now = new Date();
    const months: { key: string; label: string; total: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const label = d.toLocaleDateString(lang === "fr" ? "fr-FR" : "en-US", { month: "short" });
      months.push({ key, label, total: 0 });
    }
    const byKey = new Map(months.map(m => [m.key, m]));
    payments.filter(p => p.status === "success").forEach(p => {
      const d = new Date(p.paid_at ?? p.created_at);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const m = byKey.get(key);
      if (m) m.total += usdOf(p);
    });
    return months.map(m => ({ name: m.label, total: Math.round(m.total * 100) / 100 }));
  }, [payments]);

  const onConfirmTransfer = async (p: Payment) => {
    setConfirmingId(p.id);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("payments")
        .update({ status: "success", paid_at: new Date().toISOString(), confirmed_by: userData.user?.id ?? null, confirmed_at: new Date().toISOString() })
        .eq("id", p.id);
      if (error) throw error;
      showToast("success", lang === "en" ? "Transfer confirmed." : "Virement confirmé.");
      load();
    } catch {
      showToast("error", lang === "en" ? "Could not confirm this transfer." : "Échec de la confirmation.");
    } finally {
      setConfirmingId(null);
    }
  };

  const onExportCsv = () => {
    const headers = ["Date", "Student", "Email", "Type", "Method", "Amount (USD)", "Status", "Reference", "Receipt No."];
    const rows = filtered.map(p => {
      const student = p.profiles as { full_name?: string; email?: string } | null;
      return [
        fmtDate(p.paid_at ?? p.created_at),
        student?.full_name ?? "",
        student?.email ?? "",
        typeLabel(p.type, "en"),
        p.method ?? "",
        usdOf(p).toFixed(2),
        p.status,
        p.reference ?? "",
        p.receipt_number ?? "",
      ];
    });
    const csv = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lwgsm-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const clearFilters = () => { setStatusFilter("all"); setTypeFilter("all"); setDateFrom(""); setDateTo(""); setSearch(""); };
  const hasFilters = statusFilter !== "all" || typeFilter !== "all" || dateFrom || dateTo || search;

  return (
    <AdminLayout title={lang === "en" ? "Finance" : "Finance"}>
      <div className="flex items-start justify-between gap-4 mb-6 animate-fade-in-up flex-wrap">
        <div>
          <h2 className="text-2xl font-black text-ink">{lang === "en" ? "Finance" : "Finance"}</h2>
          <p className="text-sm text-slate mt-0.5">{payments.length} {lang === "en" ? "transaction(s)" : "transaction(s)"}</p>
        </div>
        <div className="flex items-center gap-3">
          <CurrencyToggle />
          <button onClick={onExportCsv} className="btn-outline">
            <Download className="w-4 h-4" strokeWidth={2} />
            {lang === "en" ? "Export CSV" : "Exporter CSV"}
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6 stagger-children">
        <div className="card p-5"><DollarSign className="w-5 h-5 text-green-600 mb-2" strokeWidth={2} /><div className="text-xl font-black text-green-700">{format(totalRevenue)}</div><div className="text-xs text-slate mt-1">{lang === "en" ? "Total Revenue" : "Revenu Total"}</div></div>
        <div className="card p-5"><TrendingUp className="w-5 h-5 text-yellow-600 mb-2" strokeWidth={2} /><div className="text-xl font-black text-yellow-700">{format(totalPending)}</div><div className="text-xs text-slate mt-1">{lang === "en" ? "Pending" : "En attente"}</div></div>
        <div className="card p-5"><CreditCard className="w-5 h-5 text-navy mb-2" strokeWidth={2} /><div className="text-xl font-black text-navy">{payments.length}</div><div className="text-xs text-slate mt-1">{lang === "en" ? "Transactions" : "Transactions"}</div></div>
      </div>

      {/* Charts */}
      {!loading && payments.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6 stagger-children">
          <div className="card p-5">
            <h3 className="font-bold text-ink text-sm mb-4">{lang === "en" ? "Revenue by Type" : "Revenu par Type"}</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={byType} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f1f1" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v) => format(Number(v))} contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #f1f1f1" }} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {byType.map((_, i) => <Bar key={i} dataKey="value" fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="card p-5">
            <h3 className="font-bold text-ink text-sm mb-4">{lang === "en" ? "Monthly Trend" : "Tendance Mensuelle"}</h3>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={monthlyTrend} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f1f1" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v) => format(Number(v))} contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #f1f1f1" }} />
                <Line type="monotone" dataKey="total" stroke="#C9A227" strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="card p-4 mb-4 animate-fade-in-up" style={{ animationDelay: "0.04s" }}>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="label">{lang === "en" ? "Search" : "Rechercher"}</label>
            <div className="relative">
              <Search className="w-4 h-4 text-gray-300 absolute left-3 top-1/2 -translate-y-1/2" strokeWidth={2} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder={lang === "en" ? "Name, email, reference…" : "Nom, e-mail, référence…"} className="input pl-9" />
            </div>
          </div>
          <div>
            <label className="label">{lang === "en" ? "Type" : "Type"}</label>
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="input w-44">
              <option value="all">{lang === "en" ? "All Types" : "Tous Types"}</option>
              {PAYMENT_TYPES.map(t => <option key={t.value} value={t.value}>{lang === "en" ? t.en : t.fr}</option>)}
            </select>
          </div>
          <div>
            <label className="label">{lang === "en" ? "From" : "Du"}</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="input w-40" />
          </div>
          <div>
            <label className="label">{lang === "en" ? "To" : "Au"}</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="input w-40" />
          </div>
          {hasFilters && (
            <button onClick={clearFilters} className="flex items-center gap-1 text-xs font-bold text-gray-400 hover:text-red-500 transition-colors pb-2.5">
              <X className="w-3.5 h-3.5" strokeWidth={2.5} />
              {lang === "en" ? "Clear" : "Effacer"}
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-1.5 mb-4 bg-gray-100 p-1 rounded-xl w-fit animate-fade-in-up" style={{ animationDelay: "0.06s" }}>
        {(["all", "success", "pending", "failed"] as const).map(f => (
          <button key={f} onClick={() => setStatusFilter(f)} className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all duration-150 ${statusFilter === f ? "bg-white text-navy shadow-sm" : "text-slate hover:text-ink"}`}>
            {f === "all" ? (lang === "en" ? "All" : "Tous") : (lang === "en" ? STATUS_LABEL[f].en : STATUS_LABEL[f].fr)}
            <span className="ml-1 text-xs opacity-60">{f === "all" ? payments.length : payments.filter(p => p.status === f).length}</span>
          </button>
        ))}
      </div>

      {loading ? <div className="card divide-y divide-gray-50">{Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}</div>
      : filtered.length === 0 ? <EmptyState icon={CreditCard} title={lang === "en" ? "No transactions match" : "Aucune transaction"} />
      : (
        <div className="card overflow-hidden stagger-children">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50/60 border-b border-gray-100">
                  {[lang === "en" ? "Student" : "Étudiant", lang === "en" ? "Type" : "Type", lang === "en" ? "Method" : "Méthode", lang === "en" ? "Amount" : "Montant", "Ref", lang === "en" ? "Status" : "Statut", lang === "en" ? "Date" : "Date", ""].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-bold text-slate uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(p => {
                  const student = p.profiles as { full_name?: string; email?: string } | null;
                  return (
                    <tr key={p.id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="px-5 py-3.5"><p className="font-semibold text-ink">{student?.full_name ?? "—"}</p><p className="text-xs text-gray-400">{student?.email}</p></td>
                      <td className="px-5 py-3.5 text-ink">{typeLabel(p.type, lang)}</td>
                      <td className="px-5 py-3.5 text-xs text-slate capitalize">{p.method === "bank_transfer" ? (lang === "en" ? "Bank Transfer" : "Virement") : "Paystack"}</td>
                      <td className="px-5 py-3.5 font-bold text-ink whitespace-nowrap">{format(usdOf(p))}</td>
                      <td className="px-5 py-3.5 text-xs text-gray-400 font-mono">{p.reference ?? "—"}</td>
                      <td className="px-5 py-3.5"><Badge color={STATUS_COLOR[p.status]}>{lang === "en" ? STATUS_LABEL[p.status].en : STATUS_LABEL[p.status].fr}</Badge></td>
                      <td className="px-5 py-3.5 text-gray-400 text-xs whitespace-nowrap">{fmtDate(p.paid_at ?? p.created_at)}</td>
                      <td className="px-5 py-3.5">
                        {p.status === "pending" && p.method === "bank_transfer" ? (
                          <button
                            onClick={() => onConfirmTransfer(p)}
                            disabled={confirmingId === p.id}
                            className="flex items-center gap-1.5 text-xs font-bold text-white bg-green-600 hover:bg-green-700 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60 whitespace-nowrap"
                          >
                            {confirmingId === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={2.5} /> : <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={2.5} />}
                            {lang === "en" ? "Confirm Transfer" : "Confirmer"}
                          </button>
                        ) : p.status === "success" ? (
                          <button onClick={() => setReceiptFor(p)} className="flex items-center gap-1.5 text-xs font-bold text-navy hover:text-brand transition-colors whitespace-nowrap">
                            <ReceiptIcon className="w-3.5 h-3.5" strokeWidth={2} />
                            {lang === "en" ? "Receipt" : "Reçu"}
                          </button>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {receiptFor && (
        <ReceiptModal
          open={!!receiptFor}
          onClose={() => setReceiptFor(null)}
          payment={receiptFor}
          studentName={(receiptFor.profiles as { full_name?: string } | null)?.full_name ?? "—"}
          lang={lang}
        />
      )}
    </AdminLayout>
  );
}
