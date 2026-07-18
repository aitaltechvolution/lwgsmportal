import LecturerLayout from "@/components/LecturerLayout";
import MessagesPage from "@/pages/shared/MessagesPage";
import { useTranslation } from "react-i18next";
export default function LecturerMessages() {
  const { i18n } = useTranslation();
  const lang = i18n.language.startsWith("fr") ? "fr" : "en";
  return (
    <LecturerLayout breadcrumbs={[{ label: lang === "fr" ? "Tableau de bord" : "Dashboard", to: "/lecturer" }, { label: "Messages" }]}>
      <MessagesPage allowedContactRoles={["student", "admin"]} />
    </LecturerLayout>
  );
}
