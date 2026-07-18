import { ReactNode, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/lib/supabase";
import {
  LayoutGrid, GraduationCap, Users, BookOpen, ClipboardList, FileEdit,
  CreditCard, Award, Megaphone, BarChart3, Settings, ShieldCheck,
  MessageSquare} from "lucide-react";
import PortalLayout, { PortalNavItem } from "@/components/PortalLayout";
import { Badge } from "@/components/ui/primitives";

interface Props {
  children: ReactNode;
  title?: string;
  breadcrumbs?: { label: string; to?: string }[];
}

export default function AdminLayout({ children, title, breadcrumbs }: Props) {
  const { i18n } = useTranslation();
  const lang = (i18n.language.startsWith("fr") ? "fr" : "en") as "en" | "fr";
  const [pendingApps, setPendingApps] = useState(0);

  useEffect(() => {
    supabase.from("applications").select("id", { count: "exact" }).eq("status", "pending")
      .then(({ count }) => setPendingApps(count ?? 0));
  }, []);

  const NAV_ITEMS: PortalNavItem[] = [
    { to: "/admin",               label: "Dashboard",    fr: "Tableau de bord",  icon: LayoutGrid,    end: true },
    { to: "/admin/applications", label: "Applications", fr: "Candidatures", icon: ClipboardList },
    { to: "/admin/students",      label: "Students",     fr: "Étudiants",        icon: GraduationCap },
    { to: "/admin/faculty",       label: "Lecturers",      fr: "Enseignants", icon: Users },
    { to: "/admin/courses",       label: "Courses",      fr: "Cours",            icon: BookOpen },
    { to: "/admin/programs",      label: "Programs",     fr: "Programmes",       icon: ClipboardList },
    { to: "/admin/enrollments",   label: "Enrollments",  fr: "Inscriptions",     icon: FileEdit,      badgeCount: pendingApps },
    { to: "/admin/finance",       label: "Finance",      fr: "Finance",          icon: CreditCard },
    { to: "/admin/certificates",  label: "Certificates", fr: "Certificats",      icon: Award },
    { to: "/admin/announcements", label: "Announcements",fr: "Annonces",         icon: Megaphone },
    { to: "/admin/reports",       label: "Reports",      fr: "Rapports",         icon: BarChart3 },
    { to: "/admin/contact-messages", label: "Contact Messages", fr: "Messages de Contact", icon: MessageSquare },
    { to: "/admin/leaders",       label: "Leadership Team", fr: "Équipe de Direction", icon: Users },
  { to: "/admin/settings",      label: "Settings",     fr: "Paramètres",       icon: Settings },
  ];

  return (
    <PortalLayout
      title={title}
      breadcrumbs={breadcrumbs}
      navItems={NAV_ITEMS}
      profileTo="/admin/settings"
      portalLabel="Admin Portal"
      portalLabelFr="Portail Admin"
      role="admin"
      roleBadge={
        <Badge color="orange" icon={ShieldCheck}>
          {lang === "en" ? "Administrator" : "Administrateur"}
        </Badge>
      }
    >
      {children}
    </PortalLayout>
  );
}
