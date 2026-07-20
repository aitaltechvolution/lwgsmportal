import { FormEvent, useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import AuthCard from "@/components/AuthCard";
import PasswordInput from "@/components/PasswordInput";
import { useToast } from "@/contexts/ToastContext";
import { Loader2, CheckCircle2 } from "lucide-react";

interface Invite {
  id: string;
  applicant_name: string;
  applicant_email: string;
  phone: string | null;
  nationality: string | null;
  course_id: string | null;
  program_id: string | null;
  invite_used: boolean;
}

interface CourseOption {
  id: string;
  title: string;
  code: string | null;
  program_id: string | null;
}

export default function JoinInvite() {
  const { token } = useParams<{ token: string }>();
  const { signUp } = useAuth();
  const { showToast } = useToast();
  const nav = useNavigate();

  const [loading, setLoading] = useState(true);
  const [invite, setInvite] = useState<Invite | null>(null);
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [courseId, setCourseId] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<"confirm" | "success" | null>(null);

  useEffect(() => {
    if (!token) return;
    (async () => {
      const [inviteRes, coursesRes] = await Promise.all([
        supabase.from("applications").select("id, applicant_name, applicant_email, phone, nationality, course_id, program_id, invite_used")
          .eq("invite_token", token).maybeSingle(),
        supabase.from("courses").select("id, title, code, program_id").eq("is_published", true).order("title"),
      ]);
      setInvite(inviteRes.data as Invite | null);
      setCourses((coursesRes.data ?? []) as CourseOption[]);
      if ((inviteRes.data as Invite | null)?.course_id) {
        setCourseId((inviteRes.data as Invite).course_id!);
      }
      setLoading(false);
    })();
  }, [token]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!invite) return;
    if (!courseId) { setError("Please choose a course to continue."); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }

    setSubmitting(true);
    setError(null);
    try {
      const { confirmationSent } = await signUp({
        full_name: invite.applicant_name,
        email: invite.applicant_email,
        password,
        phone: invite.phone ?? "",
        country: invite.nationality ?? "Nigeria",
        nationality: invite.nationality ?? "Nigeria",
        language_pref: "en",
      });

      if (confirmationSent) {
        localStorage.setItem("lwgsm_pending_invite", JSON.stringify({ applicationId: invite.id, courseId }));
        setDone("confirm");
      } else {
        const { data: userData } = await supabase.auth.getUser();
        if (userData.user) {
          const chosenCourse = courses.find(c => c.id === courseId);
          await supabase.from("enrollments").upsert(
            { student_id: userData.user.id, course_id: courseId, program_id: chosenCourse?.program_id ?? null, status: "active" },
            { onConflict: "student_id,course_id" }
          );
          await supabase.from("applications").update({ invite_used: true }).eq("id", invite.id);
        }
        setDone("success");
        showToast("success", "Welcome to LWGSM! Redirecting to your portal…");
        setTimeout(() => nav("/student"), 1500);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create your account.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <AuthCard title="Loading…">
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-navy" /></div>
      </AuthCard>
    );
  }

  if (!invite || invite.invite_used) {
    return (
      <AuthCard title="Invite Not Valid">
        <div className="text-center space-y-3 py-4">
          <p className="text-gray-500 text-sm">
            {!invite
              ? "This invite link is invalid or has expired."
              : "This invite has already been used. If this is you, please log in instead."}
          </p>
          <Link to="/login" className="btn-primary inline-block mt-2">Go to Login</Link>
        </div>
      </AuthCard>
    );
  }

  if (done === "confirm") {
    return (
      <AuthCard title="Check Your Email">
        <div className="text-center space-y-4 py-4">
          <div className="text-5xl">📧</div>
          <p className="text-gray-600 text-sm">
            We sent a confirmation link to <strong>{invite.applicant_email}</strong>. Click it, then come back and log in — your course will be ready.
          </p>
          <Link to="/login" className="btn-primary inline-block mt-2">Go to Login</Link>
        </div>
      </AuthCard>
    );
  }

  if (done === "success") {
    return (
      <AuthCard title="Welcome to LWGSM!">
        <div className="text-center space-y-3 py-4">
          <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto" strokeWidth={1.75} />
          <p className="text-gray-600 text-sm">Your account is ready. Taking you to your student portal…</p>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Complete Your Registration">
      <form onSubmit={onSubmit} className="space-y-4">
        <p className="text-sm text-gray-500 text-center -mt-2 mb-2">
          Welcome, <strong className="text-ink">{invite.applicant_name}</strong> — your application was approved. Choose your course and set a password to access your student portal.
        </p>
        <div>
          <label className="label">Course</label>
          <select required value={courseId} onChange={e => setCourseId(e.target.value)} className="input">
            <option value="">Select a course…</option>
            {courses.map(c => (
              <option key={c.id} value={c.id}>{c.title}{c.code ? ` (${c.code})` : ""}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Set a Password</label>
          <PasswordInput required minLength={6} className="input" value={password} onChange={e => setPassword(e.target.value)} />
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button disabled={submitting} className="btn-primary w-full flex items-center justify-center gap-2">
          {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating your account…</> : "Create My Account"}
        </button>
      </form>
    </AuthCard>
  );
}