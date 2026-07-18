import AdminLayout from "@/components/AdminLayout";
import MessagesPage from "@/pages/shared/MessagesPage";
import { useTranslation } from "react-i18next";
export default function AdminMessages() {
  const { i18n } = useTranslation();
  const lang = i18n.language.startsWith("fr") ? "fr" : "en";
  return (
    <AdminLayout breadcrumbs={[{ label: lang === "fr" ? "Tableau de bord" : "Dashboard", to: "/admin" }, { label: "Messages" }]}>
      <MessagesPage allowedContactRoles={["student", "lecturer", "admin"]} />
    </AdminLayout>
  );
}
