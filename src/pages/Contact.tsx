import { useState, FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/lib/supabase";
import { MapPin, Phone, Mail, Clock, CheckCircle2, Loader2, Globe2 } from "lucide-react";
import { useToast } from "@/contexts/ToastContext";


const CONTACT_INFO = [
  {
    icon: MapPin,
    en: "Address",
    fr: "Adresse",
    value: "Police Headquarters, Eleyele, Ibadan, Oyo State, Nigeria",
    href: "https://maps.google.com/?q=Eleyele+Ibadan+Nigeria",
  },
  {
    icon: Phone,
    en: "Phone",
    fr: "Téléphone",
    value: "+229 577 969 63 · +234 811 065 2969 · +234 706 373 0930",
    href: "tel:+2348110652969",
  },
  {
    icon: Mail,
    en: "Email",
    fr: "E-mail",
    value: "info@lwgsm.livingwatersglobalministry.org",
    href: "mailto:info@lwgsm.livingwatersglobalministry.org",
  },
  {
    icon: Mail,
    en: "Admissions",
    fr: "Admissions",
    value: "admissions@lwgsm.livingwatersglobalministry.org",
    href: "mailto:admissions@lwgsm.livingwatersglobalministry.org",
  },
  {
    icon: Globe2,
    en: "Website",
    fr: "Site Web",
    value: "livingwatersglobalministry.org",
    href: "https://livingwatersglobalministry.org",
  },
  {
    icon: Clock,
    en: "Office Hours",
    fr: "Heures de Bureau",
    value: "Monday – Friday · 8:00 AM – 5:00 PM WAT",
    href: null,
  },
];

export default function Contact() {
  const { i18n } = useTranslation();
  const { showToast } = useToast();
  const lang = i18n.language.startsWith("fr") ? "fr" : "en";

  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [status, setStatus] = useState<"idle" | "sending" | "ok">("idle");

  const set = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm(f => ({ ...f, [k]: e.target.value }));

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setStatus("sending");
    const { error } = await supabase.from("contact_messages").insert({
      name: form.name, email: form.email,
      subject: form.subject, message: form.message,
    });
    if (error) {
      setStatus("idle");
      showToast("error", lang === "en" ? "Message failed to send. Please try again." : "Échec d'envoi. Veuillez réessayer.");
    } else {
      setStatus("ok");
      showToast("success", lang === "en" ? "Message sent! We'll respond within 24–48 hours." : "Message envoyé ! Nous répondrons sous 24 à 48 heures.");
    }
  };

  const inputCls = "w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-navy/50 focus:ring-2 focus:ring-navy/10 transition-all shadow-sm";

  return (
    <div className="min-h-screen bg-white">

      {/* Hero */}
      <section className="relative bg-navy py-20 px-4 overflow-hidden">
        <img src="https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=1400&q=80&fit=crop"
          alt="" aria-hidden className="absolute inset-0 w-full h-full object-cover opacity-10 pointer-events-none" />
        <div className="relative max-w-4xl mx-auto text-center animate-fade-in-up">
          <p className="text-amber-400 text-xs uppercase tracking-[0.2em] font-bold mb-4">
            {lang === "en" ? "Get in Touch" : "Contactez-Nous"}
          </p>
          <h1 className="text-4xl md:text-5xl font-black text-white mb-4 leading-tight">
            {lang === "en" ? "We'd Love to Hear From You" : "Nous Aimerions Avoir de Vos Nouvelles"}
          </h1>
        </div>
      </section>

      <section className="py-16 px-4">
        <div className="max-w-5xl mx-auto grid md:grid-cols-5 gap-10">

          {/* Contact info */}
          <div className="md:col-span-2 space-y-5 animate-fade-in-up">
            <h2 className="text-xl font-black text-navy mb-6">
              {lang === "en" ? "Contact Information" : "Informations de Contact"}
            </h2>
            {CONTACT_INFO.map((c, i) => {
              const Icon = c.icon;
              const label = lang === "en" ? c.en : c.fr;
              return (
                <div key={i} className="flex items-start gap-4 p-4 rounded-2xl border border-gray-100 hover:border-navy/20 hover:shadow-sm transition-all duration-200">
                  <div className="w-10 h-10 rounded-xl bg-navy/5 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-5 h-5 text-navy" strokeWidth={1.75} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate uppercase tracking-wider mb-0.5">{label}</p>
                    {c.href ? (
                      <a href={c.href} target={c.href.startsWith('http') ? '_blank' : undefined}
                        rel="noopener noreferrer"
                        className="text-sm text-ink hover:text-brand transition-colors font-medium leading-snug">
                        {c.value}
                      </a>
                    ) : (
                      <p className="text-sm text-ink font-medium leading-snug">{c.value}</p>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Ministry parent link */}
            <div className="mt-4 p-4 rounded-2xl bg-navy/5 border border-navy/10">
              <p className="text-xs font-bold text-navy uppercase tracking-wider mb-1">
                {lang === "en" ? "Parent Ministry" : "Ministère Parent"}
              </p>
              <a href="https://livingwatersglobalministry.org" target="_blank" rel="noopener noreferrer"
                className="text-sm text-brand hover:underline font-semibold">
                Living Waters Global Ministry →
              </a>
            </div>
          </div>

          {/* Form */}
          <div className="md:col-span-3 animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
            <h2 className="text-xl font-black text-navy mb-6">
              {lang === "en" ? "Send Us a Message" : "Envoyez-Nous un Message"}
            </h2>

            {status === "ok" ? (
              <div className="bg-green-50 border border-green-100 rounded-2xl p-10 text-center animate-scale-in">
                <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-4" strokeWidth={1.75} />
                <h3 className="font-bold text-green-700 text-lg mb-2">
                  {lang === "en" ? "Message Received!" : "Message Reçu !"}
                </h3>
                <p className="text-green-600 text-sm">
                  {lang === "en"
                    ? "Thank you for reaching out. Our team will respond within 24–48 hours."
                    : "Merci de nous avoir contactés. Notre équipe répondra sous 24 à 48 heures."}
                </p>
              </div>
            ) : (
              <form onSubmit={onSubmit} className="space-y-4 bg-white rounded-2xl border border-gray-100 shadow-xl p-7">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      {lang === "en" ? "Full Name" : "Nom Complet"} *
                    </label>
                    <input type="text" required value={form.name} onChange={set("name")} className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      {lang === "en" ? "Email" : "E-mail"} *
                    </label>
                    <input type="email" required value={form.email} onChange={set("email")} className={inputCls} />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    {lang === "en" ? "Subject" : "Sujet"} *
                  </label>
                  <select required value={form.subject} onChange={set("subject")} className={inputCls}>
                    <option value="">{lang === "en" ? "Select a topic…" : "Choisir un sujet…"}</option>
                    <option value="Admissions Enquiry">{lang === "en" ? "Admissions Enquiry" : "Demande d'Admission"}</option>
                    <option value="Programme Information">{lang === "en" ? "Programme Information" : "Informations sur les Programmes"}</option>
                    <option value="Student Support">{lang === "en" ? "Student Support" : "Support Étudiant"}</option>
                    <option value="Payment & Finance">{lang === "en" ? "Payment & Finance" : "Paiement et Finance"}</option>
                    <option value="Partnership">{lang === "en" ? "Partnership / Ministry Collaboration" : "Partenariat / Collaboration Ministérielle"}</option>
                    <option value="General">{lang === "en" ? "General Enquiry" : "Demande Générale"}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    {lang === "en" ? "Message" : "Message"} *
                  </label>
                  <textarea required rows={5} value={form.message} onChange={set("message")}
                    placeholder={lang === "en"
                      ? "Tell us how we can help you…"
                      : "Dites-nous comment nous pouvons vous aider…"}
                    className={`${inputCls} resize-none`} />
                </div>
                <button type="submit" disabled={status === "sending"}
                  className="w-full bg-navy hover:bg-navy/90 text-white font-bold py-3.5 rounded-xl transition-all duration-200 hover:-translate-y-0.5 shadow-lg disabled:opacity-60 disabled:translate-y-0 flex items-center justify-center gap-2">
                  {status === "sending"
                    ? <><Loader2 className="w-4 h-4 animate-spin" strokeWidth={2.5} />{lang === "en" ? "Sending…" : "Envoi…"}</>
                    : (lang === "en" ? "Send Message" : "Envoyer le Message")}
                </button>
              </form>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}