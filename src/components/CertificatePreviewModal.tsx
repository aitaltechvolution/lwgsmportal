import { useRef } from "react";
import { X, Printer, Download, Loader2 } from "lucide-react";
import CertificateCard, { CertificateData } from "@/components/CertificateCard";
import { useCertificatePdf } from "@/lib/useCertificatePdf";

interface Props {
  open: boolean;
  onClose: () => void;
  data: CertificateData;
  lang: "en" | "fr";
}

export default function CertificatePreviewModal({ open, onClose, data, lang }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const { download, generating } = useCertificatePdf();

  if (!open) return null;

  const onDownload = () => download(cardRef, `${data.certificate_number}.pdf`);

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 print:p-0 animate-fade-in">
      <div className="absolute inset-0 bg-black/70 print:hidden" onClick={onClose} />
      <div className="relative w-full max-w-4xl print:max-w-full">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-4 print:hidden">
          <h3 className="font-bold text-white">{lang === "en" ? "Certificate Preview" : "Aperçu du Certificat"}</h3>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => window.print()} className="flex-1 sm:flex-initial justify-center flex items-center gap-1.5 text-xs font-bold text-white bg-white/10 hover:bg-white/20 px-3.5 py-2 rounded-lg transition-colors">
              <Printer className="w-3.5 h-3.5" strokeWidth={2} />
              {lang === "en" ? "Print" : "Imprimer"}
            </button>
            <button onClick={onDownload} disabled={generating} className="flex-1 sm:flex-initial justify-center flex items-center gap-1.5 text-xs font-bold text-navy bg-amber-400 hover:bg-amber-500 px-3.5 py-2 rounded-lg transition-colors disabled:opacity-60">
              {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={2.5} /> : <Download className="w-3.5 h-3.5" strokeWidth={2} />}
              {generating ? (lang === "en" ? "Preparing…" : "Préparation…") : (lang === "en" ? "Download PDF" : "Télécharger PDF")}
            </button>
            <button onClick={onClose} className="text-white/70 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-colors">
              <X className="w-4 h-4" strokeWidth={2} />
            </button>
          </div>
        </div>

        <div id="certificate-printable" className="w-full overflow-x-auto rounded-2xl shadow-2xl">
          {/* Fixed-size 640x453 card, scaled to fit the modal width responsively */}
          <div style={{ width: "100%", aspectRatio: "640/453" }} className="relative">
            <div style={{ position: "absolute", top: 0, left: 0, width: 640, height: 453, transform: "scale(var(--cert-scale))", transformOrigin: "top left" }} className="cert-scale-wrap">
              <CertificateCard ref={cardRef} {...data} />
            </div>
          </div>
        </div>
      </div>
      <style>{`
        .cert-scale-wrap { --cert-scale: 1; }
        @media (max-width: 1040px) {
          .cert-scale-wrap { --cert-scale: calc(min(100vw - 32px, 896px) / 640); }
        }
        @media (min-width: 1041px) {
          .cert-scale-wrap { --cert-scale: 1.4; }
        }
        @media print {
          body * { visibility: hidden; }
          #certificate-printable, #certificate-printable * { visibility: visible; }
          #certificate-printable { position: absolute; top: 0; left: 0; }
          .cert-scale-wrap { transform: none !important; }
        }
      `}</style>
    </div>
  );
}