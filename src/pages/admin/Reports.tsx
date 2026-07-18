import { useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { useTranslation } from "react-i18next";
import { Users, BarChart3, CalendarCheck, DollarSign, Activity } from "lucide-react";
import EnrollmentReport from "@/pages/admin/reports/EnrollmentReport";
import StudentPerformanceReport from "@/pages/admin/reports/StudentPerformanceReport";
import AttendanceReport from "@/pages/admin/reports/AttendanceReport";
import RevenueReport from "@/pages/admin/reports/RevenueReport";
import SystemUsageReport from "@/pages/admin/reports/SystemUsageReport";

type TabKey = "enrollment" | "performance" | "attendance" | "revenue" | "usage";

const TABS: { key: TabKey; icon: typeof Users; en: string; fr: string }[] = [
  { key: "enrollment",  icon: Users,        en: "Enrollment",          fr: "Inscriptions" },
  { key: "performance", icon: BarChart3,    en: "Student Performance", fr: "Performance Étudiants" },
  { key: "attendance",  icon: CalendarCheck, en: "Attendance",          fr: "Présence" },
  { key: "revenue",     icon: DollarSign,   en: "Revenue",             fr: "Revenu" },
  { key: "usage",       icon: Activity,     en: "System Usage",        fr: "Utilisation Système" },
];

export default function AdminReports() {
  const { i18n } = useTranslation();
  const lang = (i18n.language.startsWith("fr") ? "fr" : "en") as "en" | "fr";
  const [tab, setTab] = useState<TabKey>("enrollment");

  return (
    <AdminLayout title={lang === "en" ? "Reports & Analytics" : "Rapports et Analyses"}>
      <div className="mb-6 animate-fade-in-up print:hidden">
        <h2 className="text-2xl font-black text-ink">{lang === "en" ? "Reports & Analytics" : "Rapports et Analyses"}</h2>
        <p className="text-sm text-slate mt-0.5">{lang === "en" ? "Insights across enrollment, performance, attendance, revenue, and usage." : "Aperçus sur les inscriptions, performances, présence, revenus et utilisation."}</p>
      </div>

      <div className="flex gap-1.5 mb-6 bg-gray-100 p-1 rounded-xl w-fit overflow-x-auto max-w-full animate-fade-in-up print:hidden" style={{ animationDelay: "0.04s" }}>
        {TABS.map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-semibold whitespace-nowrap transition-all duration-150
                ${tab === t.key ? "bg-white text-navy shadow-sm" : "text-slate hover:text-ink"}`}
            >
              <Icon className="w-3.5 h-3.5" strokeWidth={2} />
              {lang === "en" ? t.en : t.fr}
            </button>
          );
        })}
      </div>

      {/* Print header — only visible when printing, shows which report this is */}
      <div className="hidden print:block mb-6">
        <h2 className="text-xl font-black text-ink">{lang === "en" ? TABS.find(t => t.key === tab)?.en : TABS.find(t => t.key === tab)?.fr}</h2>
        <p className="text-xs text-gray-400">{new Date().toLocaleDateString(lang === "fr" ? "fr-FR" : "en-GB", { day: "numeric", month: "long", year: "numeric" })}</p>
      </div>

      {tab === "enrollment" && <EnrollmentReport lang={lang} />}
      {tab === "performance" && <StudentPerformanceReport lang={lang} />}
      {tab === "attendance" && <AttendanceReport lang={lang} />}
      {tab === "revenue" && <RevenueReport lang={lang} />}
      {tab === "usage" && <SystemUsageReport lang={lang} />}
    </AdminLayout>
  );
}
