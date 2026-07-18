import { Link } from "react-router-dom";
import { Megaphone, ArrowRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import AnnouncementsPage from "@/pages/shared/AnnouncementsPage";

interface Props { role: "student" | "lecturer" | "admin"; }

export default function AnnouncementsWidget({ role }: Props) {
  const { i18n } = useTranslation();
  const lang = i18n.language.startsWith("fr") ? "fr" : "en";

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-[#0A1628]/5 flex items-center justify-center">
            <Megaphone className="w-3.5 h-3.5 text-[#0A1628]" strokeWidth={2} />
          </div>
          <span className="font-bold text-[#0A1628] text-sm">{lang === "fr" ? "Annonces récentes" : "Recent Announcements"}</span>
        </div>
        <Link to={`/${role}/announcements`} className="flex items-center gap-1 text-[11px] font-semibold text-[#F97316] hover:underline">
          {lang === "fr" ? "Tout voir" : "View all"} <ArrowRight className="w-3 h-3" strokeWidth={2.5} />
        </Link>
      </div>
      <div className="p-4">
        <AnnouncementsPage role={role} compact />
      </div>
    </div>
  );
}
