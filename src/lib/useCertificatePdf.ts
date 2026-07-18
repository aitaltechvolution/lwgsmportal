import { useCallback, useState } from "react";
import { RefObject } from "react";

/**
 * Renders a DOM node (the certificate card) to a canvas, then drops that
 * image into a landscape A4 PDF and triggers a download. html2canvas and
 * jspdf are loaded lazily on first use so they never add to the initial
 * bundle for people who never touch a certificate.
 */
export function useCertificatePdf() {
  const [generating, setGenerating] = useState(false);

  const download = useCallback(async (nodeRef: RefObject<HTMLElement>, filename: string) => {
    if (!nodeRef.current) return;
    setGenerating(true);
    try {
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);
      const canvas = await html2canvas(nodeRef.current, { scale: 2, backgroundColor: null });
      const imgData = canvas.toDataURL("image/png");
      // 800x566 px node ≈ landscape A4 ratio (297mm x 210mm)
      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      pdf.addImage(imgData, "PNG", 0, 0, pageWidth, pageHeight);
      pdf.save(filename);
    } finally {
      setGenerating(false);
    }
  }, []);

  return { download, generating };
}