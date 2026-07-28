import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import AdminLayout from "@/components/AdminLayout";
import { supabase } from "@/lib/supabase";
import { useTranslation } from "react-i18next";
import {
  GraduationCap, Users, BookOpen, CreditCard, Award, Clock,
  UserPlus, Wallet, ArrowRight,
} from "lucide-react";
import { Badge, EmptyState, SkeletonRow } from "@/components/ui/primitives";
import GradientBlobs from "@/components/ui/GradientBlobs";
import { useCurrency } from "@/contexts/CurrencyContext";
import CurrencyToggle from "@/components/CurrencyToggle";
import { PAYMENT_TYPES, CURRENCIES } from "@/lib/constants";

interface KPIs {
  totalStudents: number;
  activeLecturers: number;
  coursesRunning: number;
  revenueThisMonth: number;
  revenueThisMonthNgn: number;
  certificatesIssued: number;
  pendingApplications: number;
}

interface RecentUser {
  id: string;
  full_name: string;
  email: string;
  country: string | null;
  created_at: string;
}

interface RecentPayment {
  id: string;
  amount: number;
  amount_usd: number | null;
  amount_ngn: number | null;
  currency: string;
  type: string;
  status: "pending" | "success" | "failed";
  created_at: string;
  profiles?: { full_name: string } | null;
}

const PAYMENT_STATUS_COLOR: Record<string, "green" | "yellow" | "red"> = {
  success: "green", pending: "yellow", failed: "red",
};
const PAYMENT_STATUS_LABEL: Record<string, { en: string; fr: string }> = {
  success: { en: "Paid", fr: "Payé" },
  pending: { en: "Pending", fr: "En attente" },
  failed: { en: "Failed", fr: "Échoué" },
};

export default function AdminDashboard() {
  const { i18n } = useTranslation();
  const lang = (i18n.language.startsWith("fr") ? "fr" : "en") as "en" | "fr";
  const { format, exchangeRate, currency } = useCurrency();

  const [kpis, setKpis] = useState<KPIs>({
    totalStudents: 0, activeLecturers: 0, coursesRunning: 0,
    revenueThisMonth: 0, revenueThisMonthNgn: 0, certificatesIssued: 0, pendingApplications: 0,
  });
  const [recentUsers, setRecentUsers] = useState<RecentUser[]>([]);
  const [recentPayments, setRecentPayments] = useState<RecentPayment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const [
        studentsRes, lecturersRes, coursesRes, revenueRes, certsRes, appsRes,
        recentUsersRes, recentPaymentsRes,
      ] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact" }).eq("role", "student"),
        supabase.from("profiles").select("id", { count: "exact" }).eq("role", "lecturer").eq("status", "active"),
        supabase.from("courses").select("id", { count: "exact" }).eq("is_published", true),
        supabase.from("payments").select("amount, amount_usd, amount_ngn").eq("status", "success").gte("paid_at", startOfMonth.toISOString()),
        supabase.from("certificates").select("id", { count: "exact" }),
        supabase.from("applications").select("id", { count: "exact" }).eq("status", "pending"),
        supabase.from("profiles").select("id, full_name, email, country, created_at").eq("role", "student").order("created_at", { ascending: false }).limit(10),
        supabase.from("payments").select("*, profiles!payments_student_id_fkey(full_name)").order("created_at", { ascending: false }).limit(10),
      ]);

      // amount_usd is a *derived* figure for NGN-native fees (it's back-
      // computed from the exact Naira amount using the exchange rate at
      // the time), so summing many rows of it accumulates rounding drift
      // — e.g. five $1000 fees could add up to $5008 instead of $5000.
      // Summing the canonical amount_ngn first and converting once keeps
      // that drift to a single rounding step instead of one per row.
      const revenueNgn = (revenueRes.data ?? []).reduce(
        (sum: number, p: { amount: number; amount_usd: number | null; amount_ngn: number | null }) =>
          sum + (p.amount_ngn ?? (p.amount_usd ?? p.amount) * exchangeRate),
        0
      );
      const revenue = exchangeRate ? revenueNgn / exchangeRate : revenueNgn;

      setKpis({
        totalStudents: studentsRes.count ?? 0,
        activeLecturers: lecturersRes.count ?? 0,
        coursesRunning: coursesRes.count ?? 0,
        revenueThisMonth: revenue,
        revenueThisMonthNgn: revenueNgn,
        certificatesIssued: certsRes.count ?? 0,
        pendingApplications: appsRes.count ?? 0,
      });
      setRecentUsers((recentUsersRes.data ?? []) as RecentUser[]);
      setRecentPayments((recentPaymentsRes.data ?? []) as unknown as RecentPayment[]);
      setLoading(false);
    }
    load();
  }, [exchangeRate]);

  const KPI_CARDS = [
    { label: lang === "en" ? "Total Students" : "Total Étudiants", value: kpis.totalStudents, icon: GraduationCap, accent: "bg-navy/5 text-navy" },
    { label: lang === "en" ? "Active Lecturers" : "Enseignants Actifs", value: kpis.activeLecturers, icon: Users, accent: "bg-purple-50 text-purple-600" },
    { label: lang === "en" ? "Courses Running" : "Cours en Cours", value: kpis.coursesRunning, icon: BookOpen, accent: "bg-blue-50 text-blue-600" },
    { label: lang === "en" ? "Revenue This Month" : "Revenu ce Mois",
      value: currency === "NGN" ? `${CURRENCIES.find(c => c.code === "NGN")!.symbol}${kpis.revenueThisMonthNgn.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : format(kpis.revenueThisMonth),
      icon: Wallet, accent: "bg-green-50 text-green-600" },
    { label: lang === "en" ? "Certificates Issued" : "Certificats Émis", value: kpis.certificatesIssued, icon: Award, accent: "bg-orange-50 text-brand" },
    { label: lang === "en" ? "Pending Applications" : "Candidatures en Attente", value: kpis.pendingApplications, icon: Clock, accent: "bg-yellow-50 text-yellow-600" },
  ];

  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(lang === "fr" ? "fr-FR" : "en-GB", { day: "numeric", month: "short", year: "numeric" });

  return (
    <AdminLayout>
      {/* Welcome */}
      <div className="relative overflow-hidden rounded-2xl bg-navy p-6 md:p-8 mb-6 animate-fade-in-up">
        <GradientBlobs variant="dark" />
        <div className="relative z-10 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-amber-400 text-xs font-bold uppercase tracking-[0.15em] mb-1.5">
              {lang === "en" ? "Administration" : "Administration"}
            </p>
            <h2 className="text-white text-2xl md:text-3xl font-black mb-1 leading-tight">
              {lang === "en" ? "School Overview" : "Aperçu de l'École"}
            </h2>
            <p className="text-white/50 text-sm">
              {lang === "en" ? "Key metrics across students, faculty, and finances." : "Indicateurs clés concernant les étudiants, le corps enseignant et les finances."}
            </p>
          </div>
          <CurrencyToggle className="bg-white/10" />
        </div>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6 stagger-children">
        {KPI_CARDS.map((k) => {
          const Icon = k.icon;
          return (
            <div key={k.label} className="card card-hover p-5">
              <div className={`w-11 h-11 rounded-xl ${k.accent} flex items-center justify-center mb-3`}>
                <Icon className="w-5 h-5" strokeWidth={2} />
              </div>
              {loading ? (
                <>
                  <div className="skeleton h-7 w-20 mb-2" />
                  <div className="skeleton h-3 w-28" />
                </>
              ) : (
                <>
                  <div className="text-2xl font-black text-ink leading-none">{k.value}</div>
                  <div className="text-xs font-semibold text-slate mt-1.5">{k.label}</div>
                </>
              )}
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent registrations */}
        <div className="card overflow-hidden animate-fade-in-up" style={{ animationDelay: "0.08s" }}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
            <h3 className="font-bold text-ink text-sm flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-navy" strokeWidth={2} />
              {lang === "en" ? "Recent Registrations" : "Inscriptions Récentes"}
            </h3>
            <Link to="/admin/students" className="text-xs font-semibold text-brand hover:text-brand-light transition-colors flex items-center gap-1">
              {lang === "en" ? "View all" : "Voir tout"}
              <ArrowRight className="w-3 h-3" strokeWidth={2.5} />
            </Link>
          </div>
          {loading ? (
            <div className="divide-y divide-gray-50">{Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}</div>
          ) : recentUsers.length === 0 ? (
            <div className="p-6"><EmptyState icon={GraduationCap} title={lang === "en" ? "No registrations yet" : "Aucune inscription"} /></div>
          ) : (
            <div className="divide-y divide-gray-50">
              {recentUsers.map((u) => (
                <div key={u.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-navy to-navy-light flex items-center justify-center text-white font-black text-xs flex-shrink-0">
                    {u.full_name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-ink text-sm truncate">{u.full_name}</p>
                    <p className="text-xs text-gray-400 truncate">{u.email}{u.country ? ` · ${u.country}` : ""}</p>
                  </div>
                  <span className="text-xs text-gray-400 flex-shrink-0">{fmtDate(u.created_at)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent payments */}
        <div className="card overflow-hidden animate-fade-in-up" style={{ animationDelay: "0.12s" }}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
            <h3 className="font-bold text-ink text-sm flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-navy" strokeWidth={2} />
              {lang === "en" ? "Recent Payments" : "Paiements Récents"}
            </h3>
            <Link to="/admin/finance" className="text-xs font-semibold text-brand hover:text-brand-light transition-colors flex items-center gap-1">
              {lang === "en" ? "View all" : "Voir tout"}
              <ArrowRight className="w-3 h-3" strokeWidth={2.5} />
            </Link>
          </div>
          {loading ? (
            <div className="divide-y divide-gray-50">{Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}</div>
          ) : recentPayments.length === 0 ? (
            <div className="p-6"><EmptyState icon={CreditCard} title={lang === "en" ? "No payments yet" : "Aucun paiement"} /></div>
          ) : (
            <div className="divide-y divide-gray-50">
              {recentPayments.map((p) => (
                <div key={p.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-ink text-sm truncate">{p.profiles?.full_name ?? "—"}</p>
                    <p className="text-xs text-gray-400">{(PAYMENT_TYPES.find(t => t.value === p.type) ? (lang === "en" ? PAYMENT_TYPES.find(t => t.value === p.type)!.en : PAYMENT_TYPES.find(t => t.value === p.type)!.fr) : p.type)} · {fmtDate(p.created_at)}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-bold text-ink text-sm">
                      {currency === "NGN" && p.amount_ngn != null
                        ? `${CURRENCIES.find(c => c.code === "NGN")!.symbol}${p.amount_ngn.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                        : format(p.amount_usd ?? p.amount)}
                    </p>
                    <Badge color={PAYMENT_STATUS_COLOR[p.status]}>{lang === "en" ? PAYMENT_STATUS_LABEL[p.status].en : PAYMENT_STATUS_LABEL[p.status].fr}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}