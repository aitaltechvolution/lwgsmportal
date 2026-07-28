import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true },
});

// supabase.functions.invoke() resolves with `error` set to a
// FunctionsHttpError whenever the edge function responds with a non-2xx
// status — but `error.message` is always the generic string
// "Edge Function returned a non-2xx status code", never the actual JSON
// body the function sent back (e.g. { error: "Student not found." }).
// Left unhandled, every failure — "duplicate account", "student not
// found", validation errors, everything — surfaces to the admin/user as
// that one meaningless generic message.
//
// The real response body lives on `error.context`, which is the raw
// fetch Response object. This reads it (as JSON first, falling back to
// plain text) and returns the actual message, falling back to the
// generic one only if the body truly can't be read.
export async function getFunctionErrorMessage(
  error: unknown,
  fallback = "Something went wrong. Please try again."
): Promise<string> {
  const ctx = (error as { context?: Response })?.context;
  if (ctx && typeof ctx.clone === "function") {
    try {
      const body = await ctx.clone().json();
      if (body?.error) return body.error as string;
      if (body?.message) return body.message as string;
    } catch {
      try {
        const text = await ctx.clone().text();
        if (text) return text;
      } catch {
        // fall through to generic fallback below
      }
    }
  }
  return (error as { message?: string })?.message || fallback;
}
