// supabase/functions/delete-account/index.ts
//
// Fully deletes a user account: both their `public.profiles` row AND the
// underlying `auth.users` record.
//
// Root cause this fixes: the admin UI previously deleted a student/lecturer
// by running `supabase.from("profiles").delete()` directly from the
// browser. The anon/authenticated client key can delete rows from
// `profiles`, but it can NEVER delete a row from `auth.users` — that table
// is only reachable through the service-role-only `auth.admin` API. The
// result was a "zombie" account: the profile disappeared from every admin
// screen, but Supabase Auth still had a live user with that email address.
//
// Two symptoms followed from that:
//   1. If the person tried to re-apply/re-register with the same email,
//      our "does this email already exist" pre-check
//      (email_already_registered RPC) only looks at `profiles`, so it
//      passed — but then approval (process-application-decision) tried
//      `auth.admin.createUser()` for that email and Supabase Auth
//      rejected it as already registered.
//   2. Any application row that still referenced the old `student_id`
//      (e.g. for "send admission letter") looked up a profile that no
//      longer existed -> "student not found", even though Auth still had
//      a record for that person.
//
// Deleting the `auth.users` row (which this function does) also cascades
// to delete the matching `profiles` row automatically, since
// `profiles.id` has `references auth.users(id) on delete cascade`.
//
// Deploy:
//   supabase functions deploy delete-account
//
// Required secrets:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (auto-available to edge functions)
//
// Also requires the 013_find_profile_delete_blockers_rpc.sql migration —
// used below to turn Supabase Auth's unhelpful generic
// "Database error deleting user" into a specific, actionable message
// naming exactly which table (and how many rows) is blocking the delete.

import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Only an authenticated admin may delete accounts.
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
      return new Response(JSON.stringify({ error: "Only admins can delete accounts." }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { userId } = await req.json();
    if (!userId) {
      return new Response(JSON.stringify({ error: "Missing userId." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (userId === callerData.user.id) {
      return new Response(JSON.stringify({ error: "You can't delete your own account." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Deleting the auth user cascades to delete the profiles row too
    // (profiles.id references auth.users.id on delete cascade), so a
    // single call cleans up both sides.
    const { error: delErr } = await admin.auth.admin.deleteUser(userId);
    if (delErr) {
      // Auth's own error message here is always the same generic
      // "Database error deleting user" no matter what actually blocked
      // it — it never says which table or row. Ask the database itself
      // which foreign key is actually the problem so the admin gets a
      // real answer instead of a dead end.
      let detail = "";
      try {
        const { data: blockers, error: rpcErr } = await admin.rpc("find_profile_delete_blockers", { p_id: userId });
        if (rpcErr) {
          // Surface *why* the diagnostic didn't run, rather than silently
          // falling back to the bare generic message — that silence is
          // exactly what makes this bug hard to debug from the admin UI.
          // Most likely cause: migration 013_find_profile_delete_blockers_rpc.sql
          // hasn't been applied to this project yet.
          detail = ` (diagnostic unavailable: ${rpcErr.message} — check that migration 013_find_profile_delete_blockers_rpc.sql has been run)`;
        } else if (blockers && blockers.length > 0) {
          detail = " Blocked by: " + blockers
            .map((b: { table_name: string; column_name: string; row_count: number }) =>
              `${b.row_count} row(s) in "${b.table_name}" (${b.column_name})`)
            .join(", ") + ". These need to be reassigned or deleted first, or that table's foreign key needs an ON DELETE CASCADE/SET NULL rule.";
        } else {
          // Diagnostic ran cleanly and found nothing — the blocker is
          // something other than a plain single-column FK to
          // profiles/auth.users (e.g. a trigger, a composite FK, or a
          // constraint added directly against auth.* internals).
          detail = " (No blocking foreign key found via profiles/auth.users — this may be a trigger or a constraint the diagnostic doesn't cover yet. Check the Supabase Auth logs for this project for the underlying Postgres error.)";
        }
      } catch (diagErr) {
        detail = ` (diagnostic threw: ${diagErr instanceof Error ? diagErr.message : String(diagErr)})`;
      }

      // If the auth user is already gone but a profile row somehow still
      // exists (the reverse of the usual zombie-account problem), clean
      // that up too rather than leaving it stuck.
      if (/not.*found/i.test(delErr.message)) {
        await admin.from("profiles").delete().eq("id", userId);
        return new Response(JSON.stringify({ success: true, note: "Auth user was already gone; removed leftover profile." }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: delErr.message + detail }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});