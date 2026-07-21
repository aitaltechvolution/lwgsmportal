import { forwardRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import logo from "/favicon.png"

export interface CertificateData {
  certificate_number: string;
  student_name: string;
  program_title_en: string;
  program_title_fr?: string | null;
  completion_date: string | null;
  verify_url: string;
  /** Level-specific matric number (certificate / diploma / pastoral
   *  ordination) — see supabase/migration_matric_certificate_payment.sql. */
  matric_number?: string | null;
  /** Whether the certificate-collection fee has been confirmed. When
   *  false/undefined, a diagonal "PREVIEW" watermark is rendered over the
   *  certificate. Defaults to true so any caller that hasn't been updated
   *  to pass this yet keeps the old (unwatermarked) behaviour. */
  is_paid?: boolean;
}

/**
 * The certificate itself — navy background, orange frame, lavender text,
 * bilingual copy. Rendered at a fixed pixel size (640x453, ~A4 landscape
 * ratio, 80% of the previous 800x566) so html2canvas captures it
 * identically regardless of viewport; callers scale it down for
 * on-screen preview with a CSS transform.
 */
const CertificateCard = forwardRef<HTMLDivElement, CertificateData>(function CertificateCard(
  { certificate_number, student_name, program_title_en, program_title_fr, completion_date, verify_url, matric_number, is_paid = true },
  ref
) {
  const dateStr = completion_date
    ? new Date(completion_date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
    : "—";

  return (
    <div
      ref={ref}
      style={{
        width: 640,
        height: 453,
        background: "linear-gradient(135deg, #000018 0%, #0a0f3d 100%)",
        position: "relative",
        fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
        color: "rgba(200,200,250,1)",
        overflow: "hidden",
        flexShrink: 0,
      }}
    >
      {/* Orange border frame */}
      <div style={{ position: "absolute", inset: 10, border: "2px solid #C9A227", borderRadius: 4 }} />
      <div style={{ position: "absolute", inset: 19, border: "1px solid rgba(249,115,22,0.4)", borderRadius: 4 }} />

      <div style={{ position: "relative", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", padding: "35px 51px", textAlign: "center" }}>
        <img src={logo} style={{ width: 36, height: 36, marginBottom: 9, objectFit: "contain" }} />

        <div style={{ fontWeight: 900, fontSize: 14, color: "white" }}>LIVING WATERS GLOBAL SCHOOL OF MINISTRY</div>
        <div style={{ fontSize: 9, color: "rgba(200,200,250,0.6)", marginTop: 2 }}>École Mondiale du Ministère des Eaux Vives</div>

        <div style={{ width: 51, height: 2, background: "#C9A227", margin: "14px 0" }} />

        <div style={{ fontSize: 10, color: "rgba(200,200,250,0.75)", fontStyle: "italic" }}>
          This is to certify that &nbsp;·&nbsp; Nous certifions que
        </div>

        <div style={{ fontSize: 27, fontWeight: 900, color: "white", margin: "11px 0 6px" }}>
          {student_name}
        </div>

        <div style={{ fontSize: 10, color: "rgba(200,200,250,0.75)", fontStyle: "italic", marginBottom: 4 }}>
          has successfully completed &nbsp;·&nbsp; a complété avec succès
        </div>

        <div style={{ fontSize: 15, fontWeight: 800, color: "#E0BE4E", maxWidth: 448 }}>
          {program_title_en}
        </div>
        {program_title_fr && (
          <div style={{ fontSize: 10, color: "rgba(200,200,250,0.65)", marginTop: 2 }}>{program_title_fr}</div>
        )}

        <div style={{ fontSize: 9, color: "rgba(200,200,250,0.6)", marginTop: 11 }}>
          Date of Completion / Date d'achèvement: <span style={{ color: "white", fontWeight: 700 }}>{dateStr}</span>
        </div>

        {matric_number && (
          <div style={{ fontSize: 9, color: "rgba(200,200,250,0.6)", marginTop: 3 }}>
            Matric No. / N° Matricule: <span style={{ color: "#E0BE4E", fontWeight: 700, fontFamily: "monospace" }}>{matric_number}</span>
          </div>
        )}

        {/* Footer row: signature + cert number + QR */}
        <div style={{ position: "absolute", bottom: 32, left: 51, right: 51, display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
          <div style={{ textAlign: "left" }}>
            <div style={{ width: 96, borderBottom: "1px solid rgba(200,200,250,0.4)", marginBottom: 4, height: 18 }} />
            <div style={{ fontSize: 10, fontWeight: 800, color: "white" }}>Prophet Onido Innocent A.</div>
            <div style={{ fontSize: 8, fontWeight: 700, color: "white", marginTop: 1 }}>Authorized Signatory</div>
            <div style={{ fontSize: 7, color: "rgba(200,200,250,0.5)" }}>Signataire Autorisé</div>
          </div>

          {/* <div style={{ textAlign: "center" }}>
            <div style={{ background: "white", padding: 4, borderRadius: 5, display: "inline-block" }}>
              <QRCodeSVG value={verify_url} size={46} level="M" />
            </div>
          </div> */}

          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 7, color: "rgba(200,200,250,0.5)", marginBottom: 2 }}>Certificate No. / N° de Certificat</div>
            <div style={{ fontSize: 10, fontWeight: 800, color: "#E0BE4E", fontFamily: "monospace" }}>{certificate_number}</div>
          </div>
        </div>
      </div>

      {/* Unpaid / unconfirmed collection fee — diagonal tiled "PREVIEW"
          watermark across the whole card. Rendered last so it sits above
          every other layer; pointerEvents "none" keeps it from blocking
          any future interactive controls. Removed entirely (not just
          hidden) once is_paid is true, so paid certificates are 100% clean. */}
      {!is_paid && (
        <div
          aria-hidden
          style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 20 }}
        >
          {Array.from({ length: 5 }).map((_, row) =>
            Array.from({ length: 4 }).map((_, col) => (
              <div
                key={`wm-${row}-${col}`}
                style={{
                  position: "absolute",
                  top: row * 110 - 40,
                  left: col * 200 - 70 + (row % 2 === 0 ? 0 : 100),
                  fontSize: 30,
                  fontWeight: 900,
                  letterSpacing: 2,
                  color: "rgba(255,255,255,0.22)",
                  transform: "rotate(-30deg)",
                  whiteSpace: "nowrap",
                  textTransform: "uppercase",
                }}
              >
                PREVIEW
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
});

export default CertificateCard;