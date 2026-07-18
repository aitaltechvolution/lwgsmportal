import { ReactNode, useState, useEffect } from "react";
import { NavLink, Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "react-i18next";
import { LogOut, Menu, X, Globe, ChevronRight, Languages } from "lucide-react";
import { useConfirm } from "@/contexts/ConfirmContext";
import { useToast } from "@/contexts/ToastContext";
import NotificationBell from "@/components/NotificationBell";
import BackToTop from "@/components/BackToTop";

export interface PortalNavItem {
  to: string;
  label: string;
  fr: string;
  icon: any;
  end?: boolean;
  badgeCount?: number;
}

interface Props {
  children: ReactNode;
  title?: string;
  breadcrumbs?: { label: string; to?: string }[];
  navItems: PortalNavItem[];
  profileTo: string;
  hasNotifications?: boolean;
  portalLabel: string;
  portalLabelFr: string;
  roleBadge?: ReactNode;
  role: "student" | "lecturer" | "admin";
}

export default function PortalLayout({
  children, title, breadcrumbs, navItems, profileTo,
  portalLabel, portalLabelFr, roleBadge, role,
}: Props) {
  const { profile, signOut } = useAuth();
  const confirm = useConfirm();
  const { showToast } = useToast();
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const lang = (i18n.language.startsWith("fr") ? "fr" : "en") as "en" | "fr";

  useEffect(() => { setSidebarOpen(false); }, [location.pathname]);

  const handleSignOut = async () => {
    const ok = await confirm({
      title: lang === "en" ? "Sign out?" : "Se déconnecter ?",
      message: lang === "en" ? "You'll need to log in again to access your portal." : "Vous devrez vous reconnecter pour accéder à votre portail.",
      confirmLabel: lang === "en" ? "Sign Out" : "Se Déconnecter",
      cancelLabel: lang === "en" ? "Cancel" : "Annuler",
      tone: "warning",
    });
    if (!ok) return;
    await signOut();
    showToast("info", lang === "en" ? "Signed out successfully." : "Déconnexion réussie.");
    navigate("/login");
  };
  const toggleLang = () => {
    const next = lang === "en" ? "fr" : "en";
    i18n.changeLanguage(next);
    localStorage.setItem("lwgsm_lang", next);
  };

  const [showTranslate, setShowTranslate] = useState(false);
  const TRANSLATE_LANGS = [
    { code: "en", label: "English" },{ code: "fr", label: "Français" },
    { code: "es", label: "Español" },{ code: "pt", label: "Português" },
    { code: "ar", label: "العربية" },{ code: "sw", label: "Kiswahili" },
    { code: "ha", label: "Hausa" },  { code: "yo", label: "Yorùbá" },
    { code: "ig", label: "Igbo" },   { code: "de", label: "Deutsch" },
    { code: "zh-CN", label: "中文" },
  ];
  // #7/#8: Use Google Translate widget properly - falls back to new tab
  const applyTranslate = (langCode: string) => {
    setShowTranslate(false);
    const el = document.querySelector(".goog-te-combo") as HTMLSelectElement | null;
    if (el) {
      el.value = langCode;
      el.dispatchEvent(new Event("change"));
    } else {
      // Widget not loaded - open translate.google.com correctly
      // Note: Google Translate cannot translate localhost URLs
      // For production, this will work correctly
      const currentUrl = window.location.href;
      if (currentUrl.includes('localhost')) {
        // In dev: just show a toast / info
        showToast("info", lang === "en"
          ? "Google Translate works on the live site. In development, please use the EN/FR toggle."
          : "Google Translate fonctionne sur le site en ligne. En développement, utilisez le bouton EN/FR.");
      } else {
        window.open(`https://translate.google.com/translate?sl=auto&tl=${langCode}&u=${encodeURIComponent(currentUrl)}`, "_blank");
      }
    }
  };
  // #3: Avatar URL from profile — updates reactively when profile changes
  const avatarUrl = profile?.avatar_url ?? null;
  const firstName = profile?.full_name?.split(" ")[0] ?? (lang === "en" ? "User" : "Utilisateur");

  return (
    <div className="flex h-screen bg-[#FAFBFC] overflow-hidden">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-30 lg:hidden print:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* SIDEBAR */}
      <aside className={`print:hidden fixed top-0 left-0 h-full w-64 bg-[#0A1628] flex flex-col z-40 transition-transform duration-300 ease-in-out ${sidebarOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"} lg:translate-x-0 lg:static lg:z-auto lg:shadow-none`}>
        <div className="flex items-center justify-between px-5 h-16 border-b border-white/[0.06] flex-shrink-0">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center font-black text-white text-[10px] tracking-tight select-none leading-none text-center">
              <img src="/favicon.png" alt="" />
            </div>
            <div>
              <div className="text-white font-bold text-[11px] leading-tight">LWGSM</div>
              <div className="text-white/30 text-[8px] uppercase tracking-[0.12em] mt-0.5">
                {lang === "en" ? portalLabel : portalLabelFr}
              </div>
            </div>
          </Link>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-white/40 hover:text-white transition-colors p-1">
            <X className="w-4 h-4" strokeWidth={2} />
          </button>
        </div>

        <div className="mx-3 mt-4 mb-3 bg-white/[0.04] border border-white/[0.06] rounded-xl px-4 py-3 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center text-navy font-black text-sm flex-shrink-0 select-none overflow-hidden">
              {avatarUrl
                ? <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
                : profile?.full_name?.charAt(0).toUpperCase() ?? "U"}
            </div>
            <div className="min-w-0">
              <div className="text-white text-sm font-semibold truncate leading-tight">{profile?.full_name ?? "—"}</div>
              <div className="text-white/35 text-[11px] truncate mt-0.5">{profile?.email ?? ""}</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const badgeCount = item.badgeCount ?? 0;
            return (
              <NavLink key={item.to} to={item.to} end={item.end}
                className={({ isActive }) =>
                  `group flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-150 relative
                  ${isActive ? "bg-[#F97316] text-white shadow-lg shadow-amber-500/25" : "text-white/50 hover:text-white hover:bg-white/[0.06]"}`
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon className={`w-[18px] h-[18px] flex-shrink-0 transition-colors ${isActive ? "text-white" : "text-white/40 group-hover:text-white"}`} strokeWidth={2} />
                    <span className="truncate">{lang === "en" ? item.label : item.fr}</span>
                    {badgeCount > 0 && (
                      <span className={`ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center ${isActive ? "bg-white/20 text-white" : "bg-[#F97316] text-white"}`}>
                        {badgeCount > 99 ? "99+" : badgeCount}
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>

        <div className="px-3 pb-4 pt-3 border-t border-white/[0.06] flex-shrink-0 space-y-1">
          <button onClick={toggleLang} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-white/50 hover:text-white hover:bg-white/[0.06] transition-all text-[13px] font-medium">
            <Globe className="w-[18px] h-[18px] flex-shrink-0" strokeWidth={2} />
            <span>{lang === "en" ? "Switch to Français" : "Passer à English"}</span>
          </button>
          <button onClick={handleSignOut} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-red-400/70 hover:text-red-400 hover:bg-red-400/10 transition-all text-[13px] font-medium">
            <LogOut className="w-[18px] h-[18px] flex-shrink-0" strokeWidth={2} />
            <span>{lang === "en" ? "Sign Out" : "Se Déconnecter"}</span>
          </button>
        </div>
      </aside>

      {/* MAIN */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0 print:overflow-visible">
        <header className="print:hidden bg-white border-b border-gray-100 h-16 flex items-center gap-4 px-4 md:px-6 flex-shrink-0 z-10">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-gray-400 hover:text-[#0A1628] transition-colors p-1 -ml-1" aria-label="Open menu">
            <Menu className="w-5 h-5" strokeWidth={2} />
          </button>

          <div className="flex-1 min-w-0 flex items-center gap-2.5">
            {breadcrumbs ? (
              <div className="flex items-center gap-1.5 text-sm overflow-hidden">
                {breadcrumbs.map((b, i) => (
                  <span key={i} className="flex items-center gap-1.5 min-w-0">
                    {i > 0 && <ChevronRight className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" strokeWidth={2.5} />}
                    {b.to ? <Link to={b.to} className="text-gray-500 hover:text-[#F97316] transition-colors truncate">{b.label}</Link>
                      : <span className="font-bold text-[#0A1628] truncate">{b.label}</span>}
                  </span>
                ))}
              </div>
            ) : title ? (
              <h1 className="font-bold text-[#0A1628] text-base truncate">{title}</h1>
            ) : (
              <span className="font-bold text-[#0A1628] text-base">
                {lang === "en" ? `Hello, ${firstName}` : `Bonjour, ${firstName}`}
              </span>
            )}
            {roleBadge}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={toggleLang} className="hidden sm:flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border border-gray-200 text-gray-500 hover:border-[#0A1628] hover:text-[#0A1628] transition-all">
              <Globe className="w-3.5 h-3.5" strokeWidth={2.5} />
              {lang === "en" ? "FR" : "EN"}
            </button>

            <NotificationBell role={role} lang={lang} />

            <Link to={profileTo} className="w-9 h-9 rounded-full bg-white flex items-center justify-center text-navy font-black text-sm flex-shrink-0 hover:opacity-90 transition-opacity select-none overflow-hidden">
              {avatarUrl
                ? <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
                : profile?.full_name?.charAt(0).toUpperCase() ?? "U"}
            </Link>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto print:overflow-visible">
          <div className="p-4 md:p-6 max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
      <BackToTop />
    </div>
  );
}