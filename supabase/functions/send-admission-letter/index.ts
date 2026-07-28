// supabase/functions/send-admission-letter/index.ts
//
// Generates a Letter of Admission as a PDF (ministry logo, student name,
// matric number, date, programme — all fixed/auto-filled — plus an
// admin-editable main message) and emails it as an attachment to the
// student. Separate from the automatic "here's your login link" email
// process-application-decision sends on approval — this is a
// deliberate, admin-triggered action for a more formal document,
// callable any time for any existing student (not just at the moment
// of approval).
//
// Deploy:
//   supabase functions deploy send-admission-letter
//
// Required secrets:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (auto-available to edge functions)
//   RESEND_API_KEY — from https://resend.com/api-keys

import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { PDFDocument, StandardFonts, rgb } from "npm:pdf-lib@1.17.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM_EMAIL = "admissions@lwgsm.livingwatersglobalministry.org";
const DEFAULT_SITE_URL = Deno.env.get("SITE_URL") ?? "https://lwgsm.livingwatersglobalministry.org";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// Wraps `text` to fit within `maxWidth` (in PDF points) at the given font
// and size — pdf-lib has no built-in word wrap, so this does it manually,
// word by word, measuring each candidate line's width as it goes.
function wrapText(text: string, font: import("npm:pdf-lib@1.17.1").PDFFont, size: number, maxWidth: number): string[] {
  const paragraphs = text.split(/\n+/);
  const lines: string[] = [];
  for (const para of paragraphs) {
    const words = para.split(/\s+/).filter(Boolean);
    let current = "";
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) > maxWidth && current) {
        lines.push(current);
        current = word;
      } else {
        current = candidate;
      }
    }
    if (current) lines.push(current);
    lines.push(""); // blank line between paragraphs
  }
  while (lines.length && lines[lines.length - 1] === "") lines.pop();
  return lines;
}

async function buildLetterPdf(opts: {
  logoBytes: Uint8Array | null;
  schoolName: string;
  studentName: string;
  matricNumber: string;
  programmeTitle: string;
  admissionDate: string;
  mainMessage: string;
}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]); // A4 portrait, points
  const { width, height } = page.getSize();
  const margin = 56;
  const contentWidth = width - margin * 2;

  const fontRegular = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const navy = rgb(0.051, 0.169, 0.335); // #0D2B55
  const gold = rgb(0.788, 0.635, 0.153); // #C9A227
  const ink = rgb(0.102, 0.114, 0.161);
  const slate = rgb(0.392, 0.451, 0.545);

  let y = height - margin;

  // ── Header: logo + school name (fixed) ──────────────────────────────
  if (opts.logoBytes) {
    try {
      const logoImg = await doc.embedPng(opts.logoBytes);
      const logoDims = logoImg.scaleToFit(56, 56);
      page.drawImage(logoImg, { x: margin, y: y - logoDims.height, width: logoDims.width, height: logoDims.height });
    } catch {
      // If the logo fetch/embed ever fails, the letter still generates —
      // just without the image. Not worth failing the whole letter over.
    }
  }
  page.drawText(opts.schoolName, { x: margin + 70, y: y - 22, size: 14, font: fontBold, color: navy });
  page.drawText("Letter of Admission", { x: margin + 70, y: y - 40, size: 10, font: fontRegular, color: gold });
  y -= 80;

  page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 1, color: rgb(0.9, 0.9, 0.9) });
  y -= 30;

  // ── Date (fixed) ─────────────────────────────────────────────────────
  page.drawText(opts.admissionDate, { x: margin, y, size: 10, font: fontRegular, color: slate });
  y -= 28;

  // ── Greeting (fixed) ─────────────────────────────────────────────────
  page.drawText(`Dear ${opts.studentName},`, { x: margin, y, size: 11, font: fontBold, color: ink });
  y -= 24;

  // ── Admin-editable main message ──────────────────────────────────────
  const bodySize = 10.5;
  const bodyLineHeight = 15;
  for (const line of wrapText(opts.mainMessage, fontRegular, bodySize, contentWidth)) {
    if (y < margin + 140) break; // safety margin so we never overrun into the details box
    page.drawText(line, { x: margin, y, size: bodySize, font: fontRegular, color: ink });
    y -= bodyLineHeight;
  }
  y -= 14;

  // ── Fixed admission details box ──────────────────────────────────────
  const boxTop = y;
  const boxHeight = 96;
  page.drawRectangle({ x: margin, y: boxTop - boxHeight, width: contentWidth, height: boxHeight, color: rgb(0.976, 0.980, 0.988), borderColor: rgb(0.9, 0.9, 0.92), borderWidth: 1 });
  const rows: [string, string][] = [
    ["Full Name", opts.studentName],
    ["Matriculation Number", opts.matricNumber],
    ["Programme", opts.programmeTitle],
    ["Date of Admission", opts.admissionDate],
  ];
  let ry = boxTop - 20;
  for (const [label, value] of rows) {
    page.drawText(label.toUpperCase(), { x: margin + 16, y: ry, size: 8, font: fontBold, color: slate });
    page.drawText(value, { x: margin + 190, y: ry, size: 10, font: fontRegular, color: ink });
    ry -= 20;
  }
  y = boxTop - boxHeight - 30;

  // ── Closing (fixed) ──────────────────────────────────────────────────
  page.drawText("We look forward to walking this journey of learning and formation with you.", { x: margin, y, size: 10.5, font: fontRegular, color: ink });
  y -= 40;
  page.drawText(opts.schoolName, { x: margin, y, size: 10.5, font: fontBold, color: navy });
  y -= 14;
  page.drawText("Office of the Registrar", { x: margin, y, size: 9.5, font: fontRegular, color: slate });

  // ── Footer ───────────────────────────────────────────────────────────
  page.drawText("This letter was generated electronically and is valid without a physical signature.", {
    x: margin, y: margin - 10, size: 8, font: fontRegular, color: slate,
  });

  return doc.save();
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { studentId, programId } = await req.json();
    if (!studentId) {
      return new Response(JSON.stringify({ error: "Missing studentId." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const [{ data: profile }, { data: program }, { data: settingsRows }] = await Promise.all([
      admin.from("profiles").select("full_name, email, matric_number").eq("id", studentId).maybeSingle(),
      programId
        ? admin.from("programs").select("title, title_fr").eq("id", programId).maybeSingle()
        : Promise.resolve({ data: null }),
      admin.from("site_settings").select("key, value").in("key", ["admission_letter_message", "school_name_en"]),
    ]);

    if (!profile) {
      return new Response(JSON.stringify({ error: "Student not found." }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const settingsMap = new Map((settingsRows ?? []).map((r: { key: string; value: string }) => [r.key, r.value]));
    const mainMessage = settingsMap.get("admission_letter_message")
      ?? "Congratulations on your admission to Living Waters Global School of Ministry. We are delighted to welcome you into this programme.";
    const schoolName = settingsMap.get("school_name_en") ?? "Living Waters Global School of Ministry";

    // Logo is served as a static asset on the live site, not accessible
    // from the filesystem here — fetch it over HTTP. If it fails, the
    // letter still generates without it rather than failing outright.
    let logoBytes: Uint8Array | null = null;
    try {
      const logoRes = await fetch(`${DEFAULT_SITE_URL}/favicon.png`);
      if (logoRes.ok) logoBytes = new Uint8Array(await logoRes.arrayBuffer());
    } catch {
      // Non-fatal — see above.
    }

    const admissionDate = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

    const pdfBytes = await buildLetterPdf({
      logoBytes,
      schoolName,
      studentName: profile.full_name,
      matricNumber: profile.matric_number ?? "Pending assignment",
      programmeTitle: program?.title ?? "—",
      admissionDate,
      mainMessage,
    });

    // Resend expects attachment content as base64.
    let binary = "";
    for (const byte of pdfBytes) binary += String.fromCharCode(byte);
    const pdfBase64 = btoa(binary);

    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: "RESEND_API_KEY is not configured on this project." }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: `LWGSM Admissions <${FROM_EMAIL}>`,
        to: [profile.email],
        subject: "Your Letter of Admission — LWGSM",
        html: `
          <div style="font-family: Inter, Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #1A1D29;">
            <div style="background:#0D2B55; padding: 24px; border-radius: 12px 12px 0 0; text-align:center;">
              <h1 style="color:#fff; font-size: 18px; margin:0;">${schoolName}</h1>
            </div>
            <div style="padding: 28px; border: 1px solid #eee; border-top: none; border-radius: 0 0 12px 12px;">
              <p>Dear ${profile.full_name},</p>
              <p>Please find your official Letter of Admission attached to this email.</p>
              <p style="font-size: 13px; color: #64748B; margin-top: 24px;">
                Questions? Reach us at admissions@lwgsm.livingwatersglobalministry.org
              </p>
            </div>
          </div>
        `,
        attachments: [{ filename: "Letter of Admission.pdf", content: pdfBase64 }],
      }),
    });

    if (!res.ok) {
      return new Response(JSON.stringify({ error: `Resend API error: ${await res.text()}` }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error." }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
