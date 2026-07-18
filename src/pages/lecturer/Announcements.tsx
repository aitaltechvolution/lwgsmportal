import LecturerLayout from "@/components/LecturerLayout";
import AnnouncementsPage from "@/pages/shared/AnnouncementsPage";
import { useTranslation } from "react-i18next";
export default function LecturerAnnouncements() {
  const { i18n } = useTranslation();
  const lang = i18n.language.startsWith("fr") ? "fr" : "en";
  return (
    <LecturerLayout breadcrumbs={[{ label: lang === "fr" ? "Tableau de bord" : "Dashboard", to: "/lecturer" }, { label: lang === "fr" ? "Annonces" : "Announcements" }]}>
      <div className="space-y-6">
        <h1 className="font-black text-[#0A1628] text-2xl">{lang === "fr" ? "Annonces" : "Announcements"}</h1>
        <AnnouncementsPage role="lecturer" />
      </div>
    </LecturerLayout>
  );
}
