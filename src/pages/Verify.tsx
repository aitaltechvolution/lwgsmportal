import { useState, FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/lib/supabase";
import { ShieldCheck, XCircle, AlertTriangle, CheckCircle2, Download } from "lucide-react";

interface Certificate {
  id: string;
  certificate_number: string;
  student_name: string;
  is_verified: boolean;
  issue_date?: string;
  completion_date?: string;
  certificate_url?: string;
  programs?: { title: string; title_fr?: string };
}

export default function Verify() {
  const { i18n } = useTranslation();
  const lang = i18n.language.startsWith("fr") ? "fr" : "en";
  const [certNumber, setCertNumber] = useState("");
  const [result, setResult] = useState<Certificate | null | "not_found">(null);
  const [searching, setSearching] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSearching(true);
    setResult(null);
    const { data } = await supabase
      .from("certificates")
      .select("*, programs(title,title_fr)")
      .eq("certificate_number", certNumber.trim().toUpperCase())
      .maybeSingle();
    setResult((data as Certificate | null) ?? "not_found");
    setSearching(false);
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <section className="bg-navy py-16 px-4">
        <div className="max-w-2xl mx-auto text-center animate-fade-in-up">
          <div className="inline-flex items-center gap-2 text-amber-400 text-xs uppercase tracking-[0.2em] font-bold mb-4">
            <ShieldCheck className="w-4 h-4" strokeWidth={2} />
            {lang === "en" ? "Verification" : "Vérification"}
          </div>
          <h1 className="text-4xl font-black text-white mb-4">
            {lang === "en" ? "Verify a Certificate" : "Vérifier un Certificat"}
          </h1>
          <p className="text-white/60 text-sm">
            {lang === "en"
              ? "Enter the certificate number found on any LWGSM-issued document to verify its authenticity."
              : "Entrez le numéro de certificat figurant sur tout document émis par LWGSM pour vérifier son authenticité."}
          </p>
        </div>
      </section>

      <section className="py-16 px-4">
        <div className="max-w-lg mx-auto">
          <form onSubmit={onSubmit} className="card p-6 mb-6 animate-fade-in-up" style={{ animationDelay: "0.05s" }}>
            <label className="label">{lang === "en" ? "Certificate Number" : "Numéro de Certificat"}</label>
            <div className="flex gap-3">
              <input
                type="text"
                required
                placeholder="LWGSM-2024-0001"
                value={certNumber}
                onChange={(e) => setCertNumber(e.target.value)}
                className="input flex-1 uppercase"
              />
              <button
                type="submit"
                disabled={searching}
                className="btn-primary px-5 disabled:opacity-60 disabled:translate-y-0"
              >
                {searching ? "…" : (lang === "en" ? "Verify" : "Vérifier")}
              </button>
            </div>
          </form>

          {/* Result: not found */}
          {result === "not_found" && (
            <div className="bg-red-50 border border-red-100 rounded-2xl p-6 text-center animate-scale-in">
              <div className="w-12 h-12 rounded-2xl bg-red-100 flex items-center justify-center mx-auto mb-3">
                <XCircle className="w-6 h-6 text-red-600" strokeWidth={2} />
              </div>
              <p className="font-semibold text-red-700">
                {lang === "en" ? "Certificate Not Found" : "Certificat Introuvable"}
              </p>
              <p className="text-red-500 text-sm mt-1">
                {lang === "en" ? "No certificate found with that number. Check for typos and try again." : "Aucun certificat trouvé avec ce numéro. Vérifiez les fautes de frappe."}
              </p>
            </div>
          )}

          {/* Result: found */}
          {result && result !== "not_found" && (
            <div className={`rounded-2xl border p-6 animate-scale-in ${result.is_verified ? "bg-green-50 border-green-100" : "bg-yellow-50 border-yellow-100"}`}>
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${result.is_verified ? "bg-green-100" : "bg-yellow-100"}`}>
                  {result.is_verified
                    ? <CheckCircle2 className="w-6 h-6 text-green-600" strokeWidth={2} />
                    : <AlertTriangle className="w-6 h-6 text-yellow-600" strokeWidth={2} />}
                </div>
                <div>
                  <h3 className={`font-bold text-lg ${result.is_verified ? "text-green-700" : "text-yellow-700"}`}>
                    {result.is_verified
                      ? (lang === "en" ? "Certificate Verified" : "Certificat Vérifié")
                      : (lang === "en" ? "Unverified" : "Non Vérifié")}
                  </h3>
                  <p className="text-xs text-gray-400"># {result.certificate_number}</p>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate font-medium">{lang === "en" ? "Student" : "Étudiant"}</span>
                  <span className="text-ink font-semibold">{result.student_name}</span>
                </div>
                {result.programs && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate font-medium">{lang === "en" ? "Programme" : "Programme"}</span>
                    <span className="text-ink font-semibold">
                      {(lang === "fr" && result.programs.title_fr) ? result.programs.title_fr : result.programs.title}
                    </span>
                  </div>
                )}
                {result.issue_date && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate font-medium">{lang === "en" ? "Issued" : "Émis le"}</span>
                    <span className="text-ink">{new Date(result.issue_date).toLocaleDateString(lang === "fr" ? "fr-FR" : "en-GB", { day: "numeric", month: "long", year: "numeric" })}</span>
                  </div>
                )}
              </div>
              {result.certificate_url && (
                <a
                  href={result.certificate_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 flex items-center justify-center gap-2 text-sm font-semibold text-navy border border-navy/15 rounded-xl py-2.5 hover:bg-navy hover:text-white transition-all duration-200"
                >
                  <Download className="w-4 h-4" strokeWidth={2} />
                  {lang === "en" ? "View Certificate" : "Voir le Certificat"}
                </a>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
