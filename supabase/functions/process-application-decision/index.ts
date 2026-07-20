// supabase/functions/process-application-decision/index.ts
//
// Handles an admin's Approve/Reject decision on an application, end to end:
//
//   REJECT              -> mark rejected, email the applicant. No account
//                           is ever created for a rejected applicant.
//
//   APPROVE (new person) -> create their auth account (service-role only,
//                           never exposed to the client), enrol them in the
//                           course they applied for, generate a Supabase
//                           password-recovery link, and email it to them
//                           so they can set their own password and log in.
//
//   APPROVE (existing     -> just enrol them in the new course and email
//    student, i.e.            them to log in — no new account, no
//    application.student_id    password step, since they already have one.
//    is already set)
//
// In every path, if the Resend email fails or RESEND_API_KEY isn't set,
// the underlying database changes (account/enrolment/status) still go
// through — only the email step is reported as failed, so the client can
// fall back to a copy-message + mailto flow without redoing any of the
// actual approval work.
//
// Deploy:
//   supabase functions deploy process-application-decision
//
// Required secrets:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (auto-available to edge functions)
//   RESEND_API_KEY — from https://resend.com/api-keys

import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
// SUPABASE_SERVICE_ROLE_KEY is auto-injected by the platform and CANNOT be
// overridden with `supabase secrets set` (reserved SUPABASE_ prefix — the
// CLI silently skips it). If that auto-injected value is ever stale/invalid
// (e.g. after migrating to the new publishable/secret key format), set a
// custom secret instead: `supabase secrets set SERVICE_ROLE_KEY=<real secret key>`
// and it'll be preferred here.
const SERVICE_ROLE_KEY = Deno.env.get("SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM_EMAIL = "admissions@lwgsm.livingwatersglobalministry.org";
const SITE_URL = Deno.env.get("SITE_URL") ?? "https://lwgsm.livingwatersglobalministry.org";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function sendEmail(to: string, subject: string, html: string) {
  if (!RESEND_API_KEY) return { ok: false, error: "RESEND_API_KEY is not configured on this project." };
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: `LWGSM Admissions <${FROM_EMAIL}>`, to: [to], subject, html }),
  });
  if (!res.ok) return { ok: false, error: `Resend API error: ${await res.text()}` };
  return { ok: true };
}

function emailShell(bodyHtml: string) {
  return `
    <div style="font-family: Inter, Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #1A1D29;">
      <div style="background:#0D2B55; padding: 24px; border-radius: 12px 12px 0 0; text-align:center;">
        <h1 style="color:#fff; font-size: 18px; margin:0;">Living Waters Global School of Ministry</h1>
      </div>
      <div style="padding: 28px; border: 1px solid #eee; border-top: none; border-radius: 0 0 12px 12px;">
        ${bodyHtml}
        <p style="font-size: 13px; color: #64748B; margin-top: 24px;">
          Questions? Reach us at admissions@lwgsm.livingwatersglobalministry.org
        </p>
      </div>
    </div>
  `;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { applicationId, decision } = await req.json();
    if (!applicationId || !["approve", "reject"].includes(decision)) {
      return new Response(JSON.stringify({ error: "Missing applicationId or invalid decision." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: app, error: appErr } = await admin.from("applications").select("*").eq("id", applicationId).maybeSingle();
    if (appErr) {
      // TEMP DEBUG: surface the real DB/auth error so we can see what's
      // actually failing (bad key, RLS, wrong id type, etc). Remove the
      // `debug` field once this is diagnosed.
      return new Response(JSON.stringify({
        error: "Application lookup failed.",
        debug: { message: appErr.message, code: appErr.code, details: appErr.details, hint: appErr.hint },
      }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!app) {
      return new Response(JSON.stringify({ error: "Application not found.", debug: { applicationId } }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: course } = await admin.from("courses").select("title").eq("id", app.course_id).maybeSingle();
    const courseTitle = course?.title ?? "your course";

    // ── REJECT ──────────────────────────────────────────────────────
    if (decision === "reject") {
      await admin.from("applications").update({ status: "rejected" }).eq("id", applicationId);

      const emailResult = await sendEmail(
        app.applicant_email,
        "Update on Your LWGSM Application",
        emailShell(`
          <p>Dear ${app.applicant_name},</p>
          <p>Thank you for your interest in <strong>${courseTitle}</strong> at Living Waters Global School of Ministry.</p>
          <p>After prayerful review, we're unable to offer admission at this time. We encourage you to stay connected with us and reapply in the future.</p>
        `)
      );

      return new Response(JSON.stringify({ success: true, emailSent: emailResult.ok, emailError: emailResult.error }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── APPROVE ─────────────────────────────────────────────────────
    if (app.student_id) {
      // Existing student applying for another course — just enrol them,
      // no account or password step needed.
      await admin.from("enrollments").upsert(
        { student_id: app.student_id, course_id: app.course_id, status: "active" },
        { onConflict: "student_id,course_id" }
      );
      await admin.from("applications").update({ status: "approved" }).eq("id", applicationId);

      const emailResult = await sendEmail(
        app.applicant_email,
        "Your New Course Has Been Approved — LWGSM",
        emailShell(`
          <p>Dear ${app.applicant_name},</p>
          <p>Great news — your application for <strong>${courseTitle}</strong> has been approved and added to your account.</p>
          <p>Log in to your student portal to get started. You'll need to complete your registration payment for this course before accessing its content.</p>
          <p style="text-align:center; margin: 28px 0;">
            <a href="${SITE_URL}/login" style="background:#C9A227; color:#0D2B55; font-weight:bold; padding: 12px 28px; border-radius: 10px; text-decoration:none; display:inline-block;">
              Log In to My Portal
            </a>
          </p>
        `)
      );

      return new Response(JSON.stringify({ success: true, emailSent: emailResult.ok, emailError: emailResult.error, kind: "existing_student" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // New applicant — create their account now, server-side.
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: app.applicant_email,
      email_confirm: true,
      user_metadata: { full_name: app.applicant_name },
    });

    if (createErr || !created.user) {
      return new Response(JSON.stringify({ error: createErr?.message ?? "Could not create account." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = created.user.id;

    // handle_new_user trigger already created a bare profiles row —
    // fill in the extra fields we collected on the application.
    await admin.from("profiles").update({
      phone: app.phone,
      country: app.nationality,
      nationality: app.nationality,
    }).eq("id", userId);

    await admin.from("enrollments").upsert(
      { student_id: userId, course_id: app.course_id, status: "active" },
      { onConflict: "student_id,course_id" }
    );

    await admin.from("applications").update({ status: "approved", student_id: userId, invite_used: true }).eq("id", applicationId);

    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: "recovery",
      email: app.applicant_email,
    });

    if (linkErr || !linkData) {
      return new Response(JSON.stringify({ success: true, emailSent: false, emailError: "Account created, but couldn't generate a password-setup link." }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const emailResult = await sendEmail(
      app.applicant_email,
      "Your LWGSM Application Has Been Approved",
      emailShell(`
        <p>Dear ${app.applicant_name},</p>
        <p>Congratulations — your application for <strong>${courseTitle}</strong> has been approved and your student account is ready.</p>
        <p>Click below to set your password and access your portal. You'll need to complete your registration payment for this course before its content unlocks.</p>
        <p style="text-align:center; margin: 28px 0;">
          <a href="${linkData.properties.action_link}" style="background:#C9A227; color:#0D2B55; font-weight:bold; padding: 12px 28px; border-radius: 10px; text-decoration:none; display:inline-block;">
            Set My Password
          </a>
        </p>
      `)
    );

    return new Response(JSON.stringify({
      success: true,
      emailSent: emailResult.ok,
      emailError: emailResult.error,
      kind: "new_student",
      actionLink: linkData.properties.action_link,
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});