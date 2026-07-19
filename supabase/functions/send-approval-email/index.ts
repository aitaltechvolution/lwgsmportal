// supabase/functions/send-approval-email/index.ts
//
// Sends the "your application was approved — set up your account" email
// via Resend. If RESEND_API_KEY isn't set, or the Resend call fails for
// any reason, this returns a clear error so the admin UI can fall back
// to a copy-the-message + mailto: flow instead of failing silently.
//
// Deploy:
//   supabase functions deploy send-approval-email
//
// Required secret:
//   RESEND_API_KEY — from https://resend.com/api-keys
//
// Called by the client as:
//   supabase.functions.invoke('send-approval-email', {
//     body: { to, applicantName, joinUrl }
//   })

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM_EMAIL = "admissions@lwgsm.livingwatersglobalministry.org";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function buildEmailHtml(applicantName: string, joinUrl: string) {
  return `
    <div style="font-family: Inter, Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #1A1D29;">
      <div style="background:#0D2B55; padding: 24px; border-radius: 12px 12px 0 0; text-align:center;">
        <h1 style="color:#fff; font-size: 18px; margin:0;">Living Waters Global School of Ministry</h1>
      </div>
      <div style="padding: 28px; border: 1px solid #eee; border-top: none; border-radius: 0 0 12px 12px;">
        <p>Dear ${applicantName},</p>
        <p>Congratulations — your application to LWGSM has been <strong>approved</strong>.</p>
        <p>Click the button below to choose your course and set a password for your student portal:</p>
        <p style="text-align:center; margin: 28px 0;">
          <a href="${joinUrl}" style="background:#C9A227; color:#0D2B55; font-weight:bold; padding: 12px 28px; border-radius: 10px; text-decoration:none; display:inline-block;">
            Complete My Registration
          </a>
        </p>
        <p style="font-size: 13px; color: #64748B;">If the button doesn't work, copy this link into your browser:<br/>${joinUrl}</p>
        <p style="font-size: 13px; color: #64748B; margin-top: 24px;">
          Questions? Reach us at admissions@lwgsm.livingwatersglobalministry.org
        </p>
      </div>
    </div>
  `;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { to, applicantName, joinUrl } = await req.json();

    if (!to || !applicantName || !joinUrl) {
      return new Response(JSON.stringify({ error: "Missing to, applicantName, or joinUrl" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: "RESEND_API_KEY is not configured on this project." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `LWGSM Admissions <${FROM_EMAIL}>`,
        to: [to],
        subject: "Your LWGSM Application Has Been Approved",
        html: buildEmailHtml(applicantName, joinUrl),
      }),
    });

    if (!resendRes.ok) {
      const detail = await resendRes.text();
      return new Response(JSON.stringify({ error: `Resend API error: ${detail}` }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await resendRes.json();
    return new Response(JSON.stringify({ success: true, id: data.id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
