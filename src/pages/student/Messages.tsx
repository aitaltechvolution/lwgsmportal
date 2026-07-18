import StudentLayout from "@/components/StudentLayout";
import MessagesPage from "@/pages/shared/MessagesPage";
import { useTranslation } from "react-i18next";
export default function StudentMessages() {
  const { i18n } = useTranslation();
  const lang = i18n.language.startsWith("fr") ? "fr" : "en";
  return (
    <StudentLayout breadcrumbs={[{ label: lang === "fr" ? "Tableau de bord" : "Dashboard", to: "/student" }, { label: lang === "fr" ? "Messages" : "Messages" }]}>
      <MessagesPage allowedContactRoles={["lecturer", "admin"]} />
    </StudentLayout>
  );
}
