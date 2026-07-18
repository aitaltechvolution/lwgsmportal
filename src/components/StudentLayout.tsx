import { ReactNode, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { useTranslation } from "react-i18next";
import {
  LayoutGrid, BookOpen, PencilLine, BarChart3, CalendarDays, FolderOpen,
  MessageSquare, CreditCard, Award, User, Megaphone,
} from "lucide-react";
import PortalLayout, { PortalNavItem } from "@/components/PortalLayout";

interface Props {
  children: ReactNode;
  title?: string;
  breadcrumbs?: { label: string; to?: string }[];
}

export default function StudentLayout({ children, title, breadcrumbs }: Props) {
  const { profile } = useAuth();
  const { i18n } = useTranslation();
  const [unreadMsg, setUnreadMsg] = useState(0);

  useEffect(() => {
    if (!profile?.id) return;
    supabase.from("messages").select("id", { count: "exact" }).eq("receiver_id", profile.id).eq("is_read", false)
      .then(({ count }) => setUnreadMsg(count ?? 0));
  }, [profile?.id]);

  const NAV_ITEMS: PortalNavItem[] = [
    { to: "/student",              label: "Dashboard",    fr: "Tableau de bord",  icon: LayoutGrid,  end: true },
    { to: "/student/courses",      label: "My Courses",   fr: "Mes Cours",        icon: BookOpen },
    { to: "/student/assessments",  label: "Assessments",  fr: "Évaluations",      icon: PencilLine },
    { to: "/student/results",      label: "Results",      fr: "Résultats",        icon: BarChart3 },
    { to: "/student/attendance",   label: "Attendance",   fr: "Présences",        icon: CalendarDays },
    { to: "/student/library",      label: "Library",      fr: "Bibliothèque",     icon: FolderOpen },
    { to: "/student/announcements",label: "Announcements",fr: "Annonces",         icon: Megaphone },
    { to: "/student/payments",     label: "Payments",     fr: "Paiements",        icon: CreditCard },
    { to: "/student/certificates", label: "Certificates", fr: "Certificats",      icon: Award },
    { to: "/student/profile",      label: "Profile",      fr: "Profil",           icon: User },
  ];

  return (
    <PortalLayout title={title} breadcrumbs={breadcrumbs} navItems={NAV_ITEMS} profileTo="/student/profile"
      portalLabel="Student Portal" portalLabelFr="Portail Étudiant" role="student">
      {children}
    </PortalLayout>
  );
}