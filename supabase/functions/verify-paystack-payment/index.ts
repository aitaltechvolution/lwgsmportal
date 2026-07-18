// supabase/functions/verify-paystack-payment/index.ts
//
// Verifies a Paystack transaction server-side and writes the
// authoritative payment record — this is the ONLY code path allowed to
// mark a payment 'success'. The client never writes that status itself
// (see migration_payments.sql, RLS policy "payments: student insert").
//
// Deploy:
//   supabase functions deploy verify-paystack-payment
//
// Required secrets (set with `supabase secrets set KEY=value`):
//   PAYSTACK_SECRET_KEY   — your Paystack secret key (sk_live_... / sk_test_...)
//   SUPABASE_URL          — auto-provided by the platform
//   SUPABASE_SERVICE_ROLE_KEY — auto-provided by the platform
//
// Called by the client as:
//   supabase.functions.invoke('verify-paystack-payment', { body: { reference } })

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PaystackVerifyResponse {
  status: boolean;
  message: string;
  data?: {
    status: string; // "success" | "failed" | "abandoned"
    reference: string;
    amount: number; // kobo
    currency: string;
    paid_at: string | null;
    metadata: Record<string, unknown> | null;
    customer: { email: string };
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (!PAYSTACK_SECRET_KEY) {
      throw new Error("PAYSTACK_SECRET_KEY is not configured on the server.");
    }

    // Identify the calling user from their JWT, so we only ever touch
    // a payment row that actually belongs to them.
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabaseAuthed = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await supabaseAuthed.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Not authenticated." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const callerId = userData.user.id;

    const { reference } = await req.json();
    if (!reference || typeof reference !== "string") {
      return new Response(JSON.stringify({ error: "Missing reference." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Service-role client: bypasses RLS, used only for the specific,
    // narrow writes below (never to satisfy an arbitrary client request).
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // The pending payment row must already exist (created client-side
    // right before the Paystack popup opens) and must belong to this user.
    const { data: existing, error: fetchErr } = await admin
      .from("payments")
      .select("id, student_id, status, amount_ngn")
      .eq("reference", reference)
      .maybeSingle();

    if (fetchErr || !existing) {
      return new Response(JSON.stringify({ error: "Unknown payment reference." }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (existing.student_id !== callerId) {
      return new Response(JSON.stringify({ error: "This payment does not belong to you." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (existing.status === "success") {
      // Already verified previously — return success idempotently rather
      // than re-verifying (avoids double-counting on retried calls).
      return new Response(JSON.stringify({ status: "success", already_verified: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Ask Paystack directly — this is the only source of truth for
    // whether money actually moved. Never trust the client's claim.
    const verifyRes = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` },
    });
    const verifyJson = (await verifyRes.json()) as PaystackVerifyResponse;

    if (!verifyRes.ok || !verifyJson.status || !verifyJson.data) {
      await admin.from("payments").update({ status: "failed" }).eq("reference", reference);
      return new Response(JSON.stringify({ error: verifyJson.message ?? "Verification failed.", status: "failed" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tx = verifyJson.data;

    // Cross-check the amount Paystack actually charged against the NGN
    // amount we locked in when this payment was initialized, so neither a
    // manipulated client-side amount nor a since-changed exchange rate can
    // cause a mismatch to slip through.
    const expectedKobo = Math.round((existing.amount_ngn ?? 0) * 100);
    const amountMatches = Math.abs(tx.amount - expectedKobo) < 100; // tolerate <1 naira rounding

    if (tx.status !== "success" || !amountMatches) {
      await admin.from("payments").update({ status: "failed" }).eq("reference", reference);
      return new Response(JSON.stringify({ status: "failed", reason: !amountMatches ? "amount_mismatch" : tx.status }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: updateErr } = await admin
      .from("payments")
      .update({ status: "success", paid_at: tx.paid_at ?? new Date().toISOString() })
      .eq("reference", reference);

    if (updateErr) throw updateErr;

    return new Response(JSON.stringify({ status: "success" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unexpected error." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
