import { supabase } from "@/lib/supabase";

/**
 * Fire-and-forget usage event logger for the System Usage report.
 * Never throws — a failed analytics write should never block the actual
 * user-facing action (viewing a file, logging in, etc.).
 */
export async function logUsageEvent(
  userId: string,
  eventType: "login" | "material_view" | "submission_created",
  opts: { courseId?: string; materialId?: string } = {}
) {
  try {
    await supabase.from("usage_events").insert({
      user_id: userId,
      event_type: eventType,
      course_id: opts.courseId ?? null,
      material_id: opts.materialId ?? null,
    });
  } catch {
    /* analytics logging is best-effort; never surfaces an error to the user */
  }
}
