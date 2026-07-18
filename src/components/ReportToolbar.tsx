import { Download, Printer } from "lucide-react";

interface Props {
  lang: "en" | "fr";
  onExport: () => void;
  exportDisabled?: boolean;
}

export default function ReportToolbar({ lang, onExport, exportDisabled }: Props) {
  return (
    <div className="flex items-center gap-2 print:hidden">
      <button onClick={onExport} disabled={exportDisabled} className="btn-outline disabled:opacity-50">
        <Download className="w-4 h-4" strokeWidth={2} />
        {lang === "en" ? "Export CSV" : "Exporter CSV"}
      </button>
      <button onClick={() => window.print()} className="btn-outline">
        <Printer className="w-4 h-4" strokeWidth={2} />
        {lang === "en" ? "Print Report" : "Imprimer"}
      </button>
    </div>
  );
}
