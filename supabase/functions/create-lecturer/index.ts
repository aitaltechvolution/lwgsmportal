// supabase/functions/create-lecturer/index.ts
//
// Creates a lecturer account server-side using the Supabase service role.
//
// Why this exists: the admin UI previously called supabase.auth.signUp()
// directly from the browser to create a lecturer account. Supabase's client
// SDK signs the *newly created* user into the local session as soon as
// signUp() resolves — which silently replaced the admin's own session with
// the brand-new lecturer's session. From the admin's point of view this
// looked like being randomly signed out right after creating a lecturer.
//
// Creating the auth user with the service role (admin.auth.admin.createUser)
// happens entirely server-side and never touches the calling admin's
// client-side session, so the admin stays logged in throughout.
//
// Deploy:
//   supabase functions deploy create-lecturer
//
// Required secrets:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (auto-available to edge functions)

import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
// SUPABASE_SERVICE_ROLE_KEY is auto-injected by the platform and CANNOT be
// overridden with `supabase secrets set` (reserved SUPABASE_ prefix — the
// CLI silently skips it). If that auto-injected value is ever stale/invalid,
// set a custom secret instead: `supabase secrets set SERVICE_ROLE_KEY=<key>`
// and it'll be preferred here.
const SERVICE_ROLE_KEY = Deno.env.get("SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Verify the caller is an authenticated admin before doing anything
    // privileged. We check the caller's own JWT against the anon-scoped
    // client using the Authorization header they sent us, then confirm
    // their profile role is 'admin'.
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header." }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const callerClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: callerData, error: callerErr } = await callerClient.auth.getUser();
    if (callerErr || !callerData.user) {
      return new Response(JSON.stringify({ error: "Invalid session." }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: callerProfile } = await admin.from("profiles").select("role").eq("id", callerData.user.id).maybeSingle();
    if (callerProfile?.role !== "admin") {
      return new Response(JSON.stringify({ error: "Only admins can create lecturer accounts." }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { full_name, title, email, password, phone, country, courseIds } = await req.json();
    if (!full_name?.trim() || !email?.trim() || !password?.trim()) {
      return new Response(JSON.stringify({ error: "Name, email and password are required." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 1: create the auth user server-side — does NOT affect the
    // admin's own session, unlike a client-side signUp() call.
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: email.trim(),
      password,
      email_confirm: true,
      user_metadata: { full_name: full_name.trim(), role: "lecturer" },
    });
    if (createErr || !created.user) {
      return new Response(JSON.stringify({ error: createErr?.message ?? "Could not create account." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const uid = created.user.id;

    // Step 2: upsert profile as lecturer AND assign selected courses in a
    // single DB round trip via the setup_lecturer_profile() RPC (see
    // supabase/migrations/003_setup_lecturer_profile_rpc.sql). Doing both
    // in one transaction means they either both succeed or both roll back
    // together — previously these were two separate sequential calls,
    // which meant a slow/failed second call could leave a lecturer profile
    // created with no courses attached, and cost an extra network hop that
    // made the whole function more likely to trip a timeout.
    const { error: setupErr } = await admin.rpc("setup_lecturer_profile", {
      p_id: uid,
      p_full_name: full_name.trim(),
      p_title: title?.trim() || null,
      p_email: email.trim(),
      p_phone: phone?.trim() || null,
      p_country: country?.trim() || null,
      p_course_ids: Array.isArray(courseIds) && courseIds.length > 0 ? courseIds : null,
    });
    if (setupErr) {
      // The auth user was created either way — surface that so the admin
      // (or a retry) knows not to try creating this email again from
      // scratch, even though profile/course setup failed.
      return new Response(JSON.stringify({
        error: setupErr.message,
        userId: uid,
        note: "Auth account was created but profile/course setup failed. Re-running with the same email will fail (already registered) — contact support to finish setup manually for this user id.",
      }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, id: uid }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});