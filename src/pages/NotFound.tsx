import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

export default function NotFound() {
  const { i18n } = useTranslation();
  const lang = (i18n.language.startsWith("fr") ? "fr" : "en") as "en" | "fr";

  return (
    <section className="mx-auto max-w-xl px-4 py-24 text-center">
      <h1 className="text-6xl font-bold text-brand">404</h1>
      <p className="mt-3 text-lavender/80">{lang === "en" ? "Page not found" : "Page introuvable"}</p>
      <Link to="/" className="btn-outline mt-6 inline-block">{lang === "en" ? "Go home" : "Retour à l'accueil"}</Link>
    </section>
  );
}
