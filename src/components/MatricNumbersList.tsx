import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Badge } from "@/components/ui/primitives";
import { IdCard } from "lucide-react";

interface Props {
  studentId: string;
  /** profiles.matric_number — the single "primary" matric number tied to
   *  the certificate-issuance flow (see assign_matric_number(student, program, country)).
   *  Kept separate from the per-level ones below since they come from a
   *  different assignment path and could theoretically differ. */
  primaryMatric: string | null;
  lang: "en" | "fr";
}

interface Entry {
  matric_number: string;
  tag: string;
}

// Best-effort mapping from the raw `level` code stored on
// student_matric_numbers to a programme type, so we can show the
// student's own enrolled programme title as the tag instead of a bare
// code when possible. Falls back to the raw level/generic label
// otherwise — never guesses wrong, just shows what we actually have.
const LEVEL_TO_TYPE: Record<string, string> = {
  CC: "certificate", CERT: "certificate",
  DL: "diploma", DP: "diploma", DIP: "diploma",
  PS: "pastoral", PO: "pastoral", PAST: "pastoral",
};

export default function MatricNumbersList({ studentId, primaryMatric, lang }: Props) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!studentId) return;
    (async () => {
      const [{ data: levelRows }, { data: enrData }] = await Promise.all([
        supabase.from("student_matric_numbers").select("level, matric_number").eq("student_id", studentId),
        supabase.from("enrollments").select("programs:program_id(type, title, title_fr)").eq("student_id", studentId),
      ]);

      const programTitleByType = new Map<string, string>();
      (enrData as unknown as { programs: { type: string; title: string; title_fr: string | null } | null }[] ?? []).forEach(e => {
        if (e.programs?.type && !programTitleByType.has(e.programs.type)) {
          programTitleByType.set(e.programs.type, (lang === "fr" && e.programs.title_fr) ? e.programs.title_fr : e.programs.title);
        }
      });

      const seen = new Set<string>();
      const list: Entry[] = [];
      (levelRows as { level: string | null; matric_number: string }[] ?? []).forEach(r => {
        const guessedType = r.level ? LEVEL_TO_TYPE[r.level.toUpperCase()] : undefined;
        const tag = (guessedType && programTitleByType.get(guessedType))
          ?? (r.level ? `${lang === "en" ? "Level" : "Niveau"}: ${r.level}` : (lang === "en" ? "Programme" : "Programme"));
        list.push({ matric_number: r.matric_number, tag });
        seen.add(r.matric_number);
      });
      // The certificate-flow matric number is a separate assignment path
      // — include it too if it isn't already covered above.
      if (primaryMatric && !seen.has(primaryMatric)) {
        list.push({ matric_number: primaryMatric, tag: lang === "en" ? "Certificate" : "Certificat" });
      }
      setEntries(list);
      setLoading(false);
    })();
  }, [studentId, primaryMatric, lang]);

  if (loading || entries.length === 0) return null;

  return (
    <div className="bg-gray-50 border border-gray-100 rounded-xl p-4">
      <p className="text-xs font-bold text-slate uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
        <IdCard className="w-3.5 h-3.5" strokeWidth={2} />
        {lang === "en" ? "Your Matric Number(s)" : "Vos Numéro(s) Matricule(s)"}
      </p>
      <div className="space-y-2">
        {entries.map((e, i) => (
          <div key={i} className="flex items-center justify-between gap-3 bg-white rounded-lg px-3 py-2 border border-gray-100">
            <span className="font-mono text-sm font-semibold text-ink">{e.matric_number}</span>
            <Badge color="blue">{e.tag}</Badge>
          </div>
        ))}
      </div>
      {entries.length > 1 && (
        <p className="text-xs text-gray-400 mt-2">
          {lang === "en"
            ? "You have more than one because you're enrolled across different certificate types."
            : "Vous en avez plusieurs car vous êtes inscrit(e) dans différents types de certificats."}
        </p>
      )}
    </div>
  );
}
