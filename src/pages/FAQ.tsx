import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown } from "lucide-react";
import { Link } from "react-router-dom";

const FAQS = [
  {
    en: { q: "What programmes does LWGSM offer?", a: "We offer Certificate, Diploma, and Advanced Diploma programmes in ministry and leadership development, each designed to build both academic depth and spiritual character." },
    fr: { q: "Quels programmes propose LWGSM ?", a: "Nous proposons des programmes de Certificat, Diplôme et Diplôme Avancé en ministère et développement du leadership, conçus pour renforcer à la fois la profondeur académique et le caractère spirituel." },
  },
  {
    en: { q: "How do I apply for admission?", a: "Visit our Admissions page and complete the online application form. Our team reviews every application and will reach out with next steps." },
    fr: { q: "Comment puis-je postuler ?", a: "Rendez-vous sur notre page Admissions et remplissez le formulaire de candidature en ligne. Notre équipe examine chaque candidature et vous contactera avec les prochaines étapes." },
  },
  {
    en: { q: "Are classes held online or in person?", a: "Our programmes are delivered both through a flexible online portal and in person, so students anywhere in the world can study at their own pace alongside live cohort sessions and assessments." },
    fr: { q: "Les cours sont-ils en ligne ou en présentiel ?", a: "Nos programmes sont proposés aussi bien en ligne via un portail flexible qu'en présentiel, afin que les étudiants du monde entier puissent étudier à leur propre rythme tout en suivant des sessions collectives en direct et des évaluations." },
  },
  {
    en: { q: "What are the payment options?", a: "Tuition can be paid via card or bank transfer, in Naira, US Dollars, or Euros. Manual bank transfers are confirmed by our finance team once the reference is submitted through your student portal." },
    fr: { q: "Quelles sont les options de paiement ?", a: "Les frais de scolarité peuvent être réglés par carte ou virement bancaire, en Naira, Dollars américains ou Euros. Les virements manuels sont confirmés par notre équipe financière une fois la référence soumise via votre portail étudiant." },
  },
  {
    en: { q: "Do I receive a certificate after completing a programme?", a: "Yes. Upon successful completion of all coursework, assignments, and exams, you'll receive an official, verifiable LWGSM certificate with a unique certificate number and QR code." },
    fr: { q: "Est-ce que je reçois un certificat après avoir terminé un programme ?", a: "Oui. Après avoir terminé avec succès tous les travaux, devoirs et examens, vous recevrez un certificat officiel et vérifiable de LWGSM, avec un numéro unique et un code QR." },
  },
  {
    en: { q: "How can I get in touch if my question isn't answered here?", a: "Send us a message on the Contact page, or reach out directly via phone or email — our team responds within 24–48 hours." },
    fr: { q: "Comment puis-je vous contacter si ma question n'est pas répondue ici ?", a: "Envoyez-nous un message via la page Contact, ou contactez-nous directement par téléphone ou e-mail — notre équipe répond sous 24 à 48 heures." },
  },
];

export default function FAQ() {
  const { i18n } = useTranslation();
  const lang = i18n.language.startsWith("fr") ? "fr" : "en";
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <section className="relative bg-navy py-20 px-4 overflow-hidden">
        <div className="relative max-w-4xl mx-auto text-center animate-fade-in-up">
          <p className="text-amber-400 text-xs uppercase tracking-[0.2em] font-bold mb-4">
            {lang === "en" ? "FAQ" : "FAQ"}
          </p>
          <h1 className="text-4xl md:text-5xl font-black text-white mb-4 leading-tight">
            {lang === "en" ? "Frequently Asked Questions" : "Questions Fréquemment Posées"}
          </h1>
          <p className="text-white/60 max-w-xl mx-auto">
            {lang === "en"
              ? "Answers to the questions we hear most from prospective and current students."
              : "Réponses aux questions les plus fréquentes de nos futurs et actuels étudiants."}
          </p>
        </div>
      </section>

      <section className="py-16 px-4 bg-gray-50">
        <div className="max-w-3xl mx-auto">
          <div className="space-y-3">
            {FAQS.map((faq, i) => {
              const { q, a } = faq[lang];
              const isOpen = openFaq === i;
              return (
                <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <button
                    onClick={() => setOpenFaq(isOpen ? null : i)}
                    className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left"
                    aria-expanded={isOpen}
                  >
                    <span className="font-semibold text-ink text-sm">{q}</span>
                    <ChevronDown
                      className={`w-4 h-4 text-slate flex-shrink-0 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                      strokeWidth={2.25}
                    />
                  </button>
                  <div
                    className="grid transition-all duration-200 ease-out"
                    style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}
                  >
                    <div className="overflow-hidden">
                      <p className="px-5 pb-4 text-sm text-slate leading-relaxed">{a}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-10 text-center">
            <p className="text-sm text-slate mb-3">
              {lang === "en" ? "Still have a question?" : "Vous avez encore une question ?"}
            </p>
            <Link to="/contact" className="btn-primary inline-flex items-center gap-2">
              {lang === "en" ? "Contact Us" : "Contactez-Nous"}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}