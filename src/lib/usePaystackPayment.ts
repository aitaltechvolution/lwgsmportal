import { useCallback } from "react";
import PaystackPop from "@paystack/inline-js";
import { supabase } from "@/lib/supabase";

interface InitiateArgs {
  email: string;
  amountUsd: number;
  exchangeRate: number; // USD -> NGN, locked in at the moment of payment
  /** Exact Naira amount to charge/record, when one exists (e.g. an
   *  admin-configured fixed fee). Takes priority over amountUsd * exchangeRate
   *  so fixed fees never drift from the amount the admin actually set. */
  amountNgn?: number;
  studentId: string;
  paymentType: string;
  publicKey: string;
  courseId?: string;
  /** Set for registration payments, which unlock every course under a
   *  programme at once rather than one specific course. */
  programId?: string;
  /** Free-text description stored on the payments row. Used by flows that
   *  have no dedicated FK column on `payments` (e.g. certificate fees) to
   *  identify which specific item a pending/success row belongs to. */
  description?: string;
}

interface InitiateResult {
  status: "success" | "failed" | "cancelled";
  reference: string;
}

function generateReference() {
  // Paystack requires unique, case-sensitive references; date + random
  // suffix is sufficient entropy for this volume of transactions.
  return `lwgsm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Wraps the full Paystack Inline flow:
 *  1. Create a 'pending' payments row first (the only status a student is
 *     allowed to insert — see migration_payments.sql RLS policy).
 *  2. Open the Paystack popup for that exact reference/amount.
 *  3. On the popup's onSuccess, call the verify-paystack-payment Edge
 *     Function, which is the only thing allowed to flip the row to
 *     'success' (it re-verifies with Paystack's API using the secret key,
 *     server-side, rather than trusting the popup callback by itself).
 */
export function usePaystackPayment() {
  const initiate = useCallback(async (args: InitiateArgs): Promise<InitiateResult> => {
    const { email, amountUsd, exchangeRate, amountNgn: amountNgnOverride, studentId, paymentType, publicKey, courseId, programId, description } = args;
    const reference = generateReference();
    const amountNgn = amountNgnOverride ?? Math.round(amountUsd * exchangeRate * 100) / 100;
    const amountKobo = Math.round(amountNgn * 100);

    const { error: insErr } = await supabase.from("payments").insert({
      student_id: studentId,
      type: paymentType,
      amount: amountNgn,
      currency: "NGN",
      amount_usd: amountUsd,
      amount_ngn: amountNgn,
      method: "paystack",
      status: "pending",
      reference,
      course_id: courseId ?? null,
      program_id: programId ?? null,
      description: description ?? null,
    });
    if (insErr) throw insErr;

    return new Promise<InitiateResult>((resolve, reject) => {
      try {
        const popup = new PaystackPop();
        popup.newTransaction({
          key: publicKey,
          email,
          amount: amountKobo,
          currency: "NGN",
          reference,
          metadata: {
            student_id: studentId,
            payment_type: paymentType,
            custom_fields: [
              { display_name: "Student ID", variable_name: "student_id", value: studentId },
              { display_name: "Payment Type", variable_name: "payment_type", value: paymentType },
            ],
          },
          onSuccess: async () => {
            try {
              const { data, error } = await supabase.functions.invoke("verify-paystack-payment", {
                body: { reference },
              });
              if (error) throw error;
              const result = data as { status?: string; error?: string };
              if (result.status === "success") {
                resolve({ status: "success", reference });
              } else {
                resolve({ status: "failed", reference });
              }
            } catch (err) {
              reject(err instanceof Error ? err : new Error("Verification failed."));
            }
          },
          onCancel: async () => {
            // Leave the row 'pending' rather than writing 'failed' from the
            // client — the student may resume/retry; an admin can also see
            // it sitting in Pending if it's never completed.
            resolve({ status: "cancelled", reference });
          },
          onError: (err) => {
            reject(new Error(err.message || "Payment could not be started."));
          },
        });
      } catch (err) {
        reject(err instanceof Error ? err : new Error("Could not open the payment popup."));
      }
    });
  }, []);

  return { initiate };
}
