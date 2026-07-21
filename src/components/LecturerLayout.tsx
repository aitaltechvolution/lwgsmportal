import { ReactNode, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import {
  LayoutGrid, BookOpen, PencilLine, Users, ClipboardCheck, Megaphone,
  MessageSquare, FolderOpen, User, CalendarCheck,
} from "lucide-react";
import PortalLayout, { PortalNavItem } from "@/components/PortalLayout";

interface Props {
  children: ReactNode;
  title?: string;
  breadcrumbs?: { label: string; to?: string }[];
}

export default function LecturerLayout({ children, title, breadcrumbs }: Props) {
  const { profile } = useAuth();
  const [unreadMsg, setUnreadMsg] = useState(0);
  const [pendingSubs, setPendingSubs] = useState(0);

  useEffect(() => {
    if (!profile?.id) return;
    supabase.from("messages").select("id", { count: "exact" }).eq("receiver_id", profile.id).eq("is_read", false)
      .then(({ count }) => setUnreadMsg(count ?? 0));

    supabase.from("courses").select("id").eq("lecturer_id", profile.id)
      .then(async ({ data: courses }) => {
        const courseIds = (courses ?? []).map((c: any) => c.id);
        if (!courseIds.length) return;
        const { data: assignments } = await supabase.from("assignments").select("id").in("course_id", courseIds);
        const assignmentIds = (assignments ?? []).map((a: any) => a.id);
        if (!assignmentIds.length) return;
        const { count } = await supabase.from("submissions").select("id", { count: "exact" }).in("assignment_id", assignmentIds).is("score", null);
        setPendingSubs(count ?? 0);
      });
  }, [profile?.id]);

  const NAV_ITEMS: PortalNavItem[] = [
    { to: "/lecturer",               label: "Dashboard",    fr: "Tableau de bord", icon: LayoutGrid,    end: true },
    { to: "/lecturer/courses",       label: "My Courses",   fr: "Mes Cours",       icon: BookOpen },
    { to: "/lecturer/assessments",   label: "Assessments",  fr: "Évaluations",     icon: PencilLine,    badgeCount: pendingSubs },
    { to: "/lecturer/students",      label: "Students",     fr: "Étudiants",       icon: Users },
    { to: "/lecturer/attendance",    label: "Attendance",   fr: "Présence",        icon: CalendarCheck },
    { to: "/lecturer/gradebook",     label: "Gradebook",    fr: "Cahier de Notes", icon: ClipboardCheck },
    { to: "/lecturer/announcements", label: "Announcements",fr: "Annonces",        icon: Megaphone },
    { to: "/lecturer/resources",     label: "Resources",    fr: "Ressources",      icon: FolderOpen },
    { to: "/lecturer/profile",       label: "Profile",      fr: "Profil",          icon: User },
  ];

  return (
    <PortalLayout title={title} breadcrumbs={breadcrumbs} navItems={NAV_ITEMS} profileTo="/lecturer/profile"
      portalLabel="Lecturer Portal" portalLabelFr="Portail Enseignant" role="lecturer">
      {children}
    </PortalLayout>
  );
}