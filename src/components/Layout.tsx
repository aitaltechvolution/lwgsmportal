import { ReactNode, useState, useEffect } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { Menu, X, Globe, Languages } from "lucide-react";
import BackToTop from "@/components/BackToTop";
import { useConfirm } from "@/contexts/ConfirmContext";

const NAV_LINKS = [
  { to: "/",           en: "Home",        fr: "Accueil",     end: true },
  { to: "/programs",   en: "Programmes",  fr: "Programmes" },
  { to: "/about",      en: "About Us",    fr: "À Propos" },
  { to: "/admissions", en: "Admissions",  fr: "Admissions" },
  { to: "/faq",         en: "FAQ",         fr: "FAQ" },
  { to: "/contact",    en: "Contact",     fr: "Contact" },
];

const FOOTER_PROGRAMMES = [
  { to: "/programs?type=certificate", en: "Certificate Programmes",  fr: "Certificats" },
  { to: "/programs?type=diploma",     en: "Diploma Programmes",      fr: "Diplômes" },
  { to: "/programs?type=advanced",    en: "Advanced Diploma",        fr: "Diplôme Avancé" },
];

const FOOTER_INSTITUTION = [
  { to: "/about",           en: "About LWGSM",      fr: "À Propos" },
  { to: "/about#leadership",en: "Leadership",        fr: "Direction" },
  { to: "/admissions",      en: "Admissions",        fr: "Admissions" },
];

const FOOTER_STUDENTS = [
  { to: "/student",  en: "Student Portal",    fr: "Portail Étudiant" },
  { to: "/verify",   en: "Verify Certificate",fr: "Vérifier Certificat" },
  { to: "/contact",  en: "Contact Us",        fr: "Contactez-Nous" },
];

// Google Translate supported languages
const TRANSLATE_LANGS = [
  { code: "en", label: "English" },
  { code: "fr", label: "Français" },
  { code: "es", label: "Español" },
  { code: "pt", label: "Português" },
  { code: "ar", label: "العربية" },
  { code: "sw", label: "Kiswahili" },
  { code: "ha", label: "Hausa" },
  { code: "yo", label: "Yorùbá" },
  { code: "ig", label: "Igbo" },
  { code: "de", label: "Deutsch" },
  { code: "zh-CN", label: "中文" },
];

function Navbar() {
  const { i18n } = useTranslation();
  const { session, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const lang = i18n.language.startsWith("fr") ? "fr" : "en";
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showTranslate, setShowTranslate] = useState(false);

  const toggleLang = () => {
    const next = lang === "en" ? "fr" : "en";
    i18n.changeLanguage(next);
    localStorage.setItem("lwgsm_lang", next);
  };

  // ✅ FIX #7: Sign-out confirmation on public nav
  const handleSignOut = async () => {
    setMobileOpen(false);
    const ok = await confirm({
      title: lang === "en" ? "Sign out?" : "Se déconnecter ?",
      message: lang === "en"
        ? "You will be returned to the home page."
        : "Vous serez redirigé vers la page d'accueil.",
      confirmLabel: lang === "en" ? "Sign Out" : "Se Déconnecter",
      cancelLabel: lang === "en" ? "Cancel" : "Annuler",
      tone: "warning",
    });
    if (!ok) return;
    await signOut();
    navigate("/");
  };

  // ✅ FIX #8: Apply Google Translate
  const applyTranslate = (langCode: string) => {
    // Google Translate widget approach
    const el = document.querySelector(".goog-te-combo") as HTMLSelectElement | null;
    if (el) {
      el.value = langCode;
      el.dispatchEvent(new Event("change"));
    } else {
      // Fallback: reload via translate.google.com
      window.open(`https://translate.google.com/translate?sl=auto&tl=${langCode}&u=${encodeURIComponent(window.location.href)}`, "_blank");
    }
    setShowTranslate(false);
  };

  const dashPath = profile?.role === "admin" ? "/admin" : profile?.role === "lecturer" ? "/lecturer" : "/student";
  const activeCls = ({ isActive }: { isActive: boolean }) =>
    `px-3 py-2 text-sm font-medium transition-colors duration-150 rounded-md ${isActive ? "text-amber-400" : "text-white/70 hover:text-white hover:bg-white/5"}`;

  return (
    <header className="bg-navy-dark border-b-2 border-brand sticky top-0 z-50 shadow-lg">
      {/* ✅ FIX #8: Google Translate element (hidden, but needed for widget) */}
      <div id="google_translate_element" style={{ display: "none" }} />

      <div className="max-w-7xl mx-auto flex items-center justify-between px-4 h-16">
        {/* Logo — keeps abbreviation at logo only per requirement */}
        <Link to="/" className="flex items-center gap-2.5 flex-shrink-0">
          <div className="w-9 h-9 rounded-lg flex bg-white items-center justify-center font-black text-white text-sm tracking-tight">
            <img src={"/favicon.png"} alt="logo"/>
          </div>
          <div className="hidden sm:block">
            {/* ✅ FIX #5: Short name in logo, full on hover tooltip */}
            <div className="text-white font-bold text-sm leading-none">LWGSM</div>
            <div className="text-white/40 text-[10px] uppercase tracking-widest">School of Ministry</div>
          </div>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map(l => (
            <NavLink key={l.to} to={l.to} end={l.end} className={activeCls}>
              {lang === "en" ? l.en : l.fr}
            </NavLink>
          ))}
        </nav>

        {/* Right actions */}
        <div className="flex items-center gap-2">
          {/* EN/FR toggle */}
          <button onClick={toggleLang}
            className="hidden sm:flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full border border-white/15 text-white/60 hover:text-white hover:border-white/30 transition-all duration-150">
            <Globe className="w-3 h-3" strokeWidth={2.5} />
            {lang === "en" ? "FR" : "EN"}
          </button>

          {/* ✅ FIX #8: Google Translate button — clearly visible */}
          <div className="relative hidden sm:block">
            <button
              onClick={() => setShowTranslate(v => !v)}
              className="flex items-center gap-1.5 text-xs font-bold px-2.5 py-1.5 rounded-full bg-brand/20 border border-brand/40 text-amber-300 hover:bg-brand/30 hover:text-amber-200 transition-all duration-150"
              title="Translate page"
            >
              <Languages className="w-3.5 h-3.5" strokeWidth={2} />
              <span>Translate</span>
            </button>
            {showTranslate && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowTranslate(false)} />
                <div className="absolute right-0 top-full mt-2 bg-white rounded-xl shadow-2xl border border-gray-100 py-1.5 z-50 w-48 max-h-72 overflow-y-auto">
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider px-3 py-1.5">
                    {lang === "en" ? "Translate page to…" : "Traduire la page en…"}
                  </p>
                  {TRANSLATE_LANGS.map(l => (
                    <button key={l.code} onClick={() => applyTranslate(l.code)}
                      className="w-full text-left px-3 py-2 text-sm text-ink font-medium hover:bg-orange-50 hover:text-brand transition-colors">
                      {l.label}
                    </button>
                  ))}
                  <div className="border-t border-gray-100 px-3 py-2">
                    <p className="text-[9px] text-gray-400">Powered by Google Translate. Opens in a new tab for most pages.</p>
                  </div>
                </div>
              </>
            )}
          </div>

          {session ? (
            <>
              <Link to={dashPath}
                className="hidden sm:inline-flex text-sm font-semibold px-3 py-1.5 rounded-lg border border-brand/40 text-amber-400 hover:bg-brand/10 transition-colors duration-150">
                {lang === "en" ? "Dashboard" : "Tableau de bord"}
              </Link>
              <button onClick={handleSignOut}
                className="text-xs text-white/50 hover:text-red-400 px-2 transition-colors hidden sm:inline">
                {lang === "en" ? "Sign out" : "Déconnexion"}
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="text-sm text-white/60 hover:text-white px-2 transition-colors hidden sm:inline">
                {lang === "en" ? "Login" : "Connexion"}
              </Link>
              <Link to="/admissions"
                className="hidden sm:inline-flex text-sm font-bold px-4 py-1.5 rounded-lg bg-brand hover:bg-brand-light text-white transition-all duration-150 hover:-translate-y-0.5 shadow-glow">
                {lang === "en" ? "Apply Now" : "Candidater"}
              </Link>
            </>
          )}

          <button onClick={() => setMobileOpen(o => !o)} className="md:hidden text-white/70 hover:text-white p-1 transition-colors">
            {mobileOpen ? <X className="w-5 h-5" strokeWidth={2} /> : <Menu className="w-5 h-5" strokeWidth={2} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-white/10 bg-navy-dark px-4 py-3 space-y-1 animate-fade-in">
          {NAV_LINKS.map(l => (
            <NavLink key={l.to} to={l.to} end={l.end} onClick={() => setMobileOpen(false)}
              className={({ isActive }) => `block px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${isActive ? "bg-brand/10 text-amber-400" : "text-white/70 hover:text-white hover:bg-white/5"}`}>
              {lang === "en" ? l.en : l.fr}
            </NavLink>
          ))}
          <div className="flex items-center gap-2 pt-2 border-t border-white/10 mt-2 flex-wrap">
            <button onClick={toggleLang}
              className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border border-white/15 text-white/60">
              <Globe className="w-3 h-3" strokeWidth={2.5} />{lang === "en" ? "FR" : "EN"}
            </button>
            <button onClick={() => setShowTranslate(v => !v)}
              className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full bg-brand/20 border border-brand/40 text-amber-300">
              <Languages className="w-3.5 h-3.5" strokeWidth={2} />Translate
            </button>
            {session ? (
              <>
                <Link to={dashPath} onClick={() => setMobileOpen(false)}
                  className="text-sm font-semibold px-3 py-1.5 rounded-lg border border-brand/40 text-amber-400">
                  {lang === "en" ? "Dashboard" : "Tableau de bord"}
                </Link>
                <button onClick={handleSignOut} className="text-xs text-white/50 px-2">
                  {lang === "en" ? "Sign out" : "Déconnexion"}
                </button>
              </>
            ) : (
              <>
                <Link to="/login" onClick={() => setMobileOpen(false)} className="text-sm text-white/60 px-2">
                  {lang === "en" ? "Login" : "Connexion"}
                </Link>
                <Link to="/admissions" onClick={() => setMobileOpen(false)}
                  className="text-sm font-bold px-4 py-1.5 rounded-lg bg-brand text-white">
                  {lang === "en" ? "Apply Now" : "Candidater"}
                </Link>
              </>
            )}
          </div>
          {showTranslate && (
            <div className="mt-2 bg-white/95 rounded-xl border border-white/10 py-1.5">
              <p className="text-[10px] text-navy/50 font-bold uppercase tracking-wider px-3 py-1.5">
                {lang === "en" ? "Translate page to…" : "Traduire la page en…"}
              </p>
              {TRANSLATE_LANGS.map(l => (
                <button key={l.code} onClick={() => { applyTranslate(l.code); setMobileOpen(false); }}
                  className="w-full text-left px-3 py-2 text-sm text-ink font-medium hover:bg-orange-50 hover:text-brand transition-colors">
                  {l.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </header>
  );
}

function Footer() {
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const lang = i18n.language.startsWith("fr") ? "fr" : "en";

  // ✅ FIX #4: Footer programme links → navigate then smooth-scroll to programmes grid
  const handleProgLink = (to: string) => {
    navigate(to);
    // After navigation settles, scroll to the programme grid
    setTimeout(() => {
      const el = document.getElementById("programmes-grid");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 120);
  };

  return (
    <footer className="bg-navy-dark text-white/60 pt-12 pb-6 px-4 mt-16">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center overflow-hidden flex-shrink-0">
                <img src="/favicon.png" alt="logo" className="w-full h-full object-contain" />
              </div>
              <span className="text-white font-bold text-sm">LWGSM</span>
            </div>
            <p className="text-xs leading-relaxed mb-3">
              {lang === "en"
                ? "To raise a generation of Spirit-filled, biblically grounded, and transformational leaders whocarry God's presence, advance His Kingdom, and impact nations through Christ-centeredministry and service"
                : ""}
            </p>
            <p className="text-xs text-amber-400/80 italic">
              {lang === "en" ? "Equipping Saints • Raising Kingdom Leaders • Transforming Nations" : ""}
            </p>
          </div>

          {/* Programmes */}
          <div>
            <h4 className="text-white text-xs font-bold uppercase tracking-widest mb-4">
              {lang === "en" ? "Programmes" : "Programmes"}
            </h4>
            <ul className="space-y-2">
              {FOOTER_PROGRAMMES.map(l => (
                <li key={l.to}>
                  <button onClick={() => handleProgLink(l.to)}
                    className="text-xs hover:text-amber-400 transition-colors duration-150 text-left">
                    {lang === "en" ? l.en : l.fr}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Institution */}
          <div>
            <h4 className="text-white text-xs font-bold uppercase tracking-widest mb-4">
              {lang === "en" ? "Institution" : "Institution"}
            </h4>
            <ul className="space-y-2">
              {FOOTER_INSTITUTION.map(l => (
                <li key={l.to}>
                  <Link to={l.to} className="text-xs hover:text-amber-400 transition-colors duration-150">
                    {lang === "en" ? l.en : l.fr}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Students */}
          <div>
            <h4 className="text-white text-xs font-bold uppercase tracking-widest mb-4">
              {lang === "en" ? "Students" : "Étudiants"}
            </h4>
            <ul className="space-y-2">
              {FOOTER_STUDENTS.map(l => (
                <li key={l.to}>
                  <Link to={l.to} className="text-xs hover:text-amber-400 transition-colors duration-150">
                    {lang === "en" ? l.en : l.fr}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Contact strip */}
        <div className="border-t border-white/10 pt-5 pb-3">
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-white/40 mb-4">
            <span>📍 Police Head Quaters, Eleyele, Ibadan, Nigeria</span>
            <a href="tel:+2348110652969" className="hover:text-amber-400 transition-colors">📞 +234 811 065 2969</a>
            <a href="tel:+2347063730930" className="hover:text-amber-400 transition-colors">📞 +234 706 373 0930</a>
            <a href="tel:+2295779696" className="hover:text-amber-400 transition-colors">📞 +229 577 969 63</a>
            <a href="mailto:info@lwgsm.livingwatersglobalministry.org" className="hover:text-amber-400 transition-colors">✉ info@lwgsm.livingwatersglobalministry.org</a>
            <a href="mailto:admissions@lwgsm.livingwatersglobalministry.org" className="hover:text-amber-400 transition-colors">✉ admissions@lwgsm.livingwatersglobalministry.org</a>
            <a href="https://livingwatersglobalministry.org" target="_blank" rel="noopener noreferrer"
              className="hover:text-amber-400 transition-colors">🌐 livingwatersglobalministry.org</a>
          </div>
          <div className="flex flex-col sm:flex-row justify-between items-center gap-2 text-xs">
            <span>© {new Date().getFullYear()} Living Waters Global School of Ministry. {lang === "en" ? "All rights reserved." : "Tous droits réservés."}</span>
            <div className="flex gap-4">
              <Link to="/verify" className="hover:text-amber-400 transition-colors">{lang === "en" ? "Verify Certificate" : "Vérifier Certificat"}</Link>
              <Link to="/faq" className="hover:text-amber-400 transition-colors">FAQ</Link>
              <Link to="/contact" className="hover:text-amber-400 transition-colors">{lang === "en" ? "Contact" : "Contact"}</Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default function Layout({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const isPortal = pathname.startsWith("/student") || pathname.startsWith("/lecturer") || pathname.startsWith("/admin");

  // ✅ FIX #8: Inject Google Translate script once
  useEffect(() => {
    if (document.getElementById("google-translate-script")) return;
    const script = document.createElement("script");
    script.id = "google-translate-script";
    script.src = "//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
    script.async = true;
    document.head.appendChild(script);
    (window as typeof window & { googleTranslateElementInit?: () => void }).googleTranslateElementInit = () => {
      // @ts-ignore
      new window.google.translate.TranslateElement(
        { pageLanguage: "en", layout: 0, autoDisplay: false },
        "google_translate_element"
      );
    };
  }, []);

  if (isPortal) return <>{children}</>;

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />
      <BackToTop />
    </div>
  );
}