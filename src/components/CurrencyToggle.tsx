import { useCurrency } from "@/contexts/CurrencyContext";
import { CURRENCIES } from "@/lib/constants";

export default function CurrencyToggle({ className = "" }: { className?: string }) {
  const { currency, setCurrency } = useCurrency();
  return (
    <div className={`inline-flex gap-1 bg-gray-100 p-1 rounded-xl ${className}`}>
      {CURRENCIES.map((c) => (
        <button
          key={c.code}
          onClick={() => setCurrency(c.code)}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-150
            ${currency === c.code ? "bg-white text-navy shadow-sm" : "text-slate hover:text-ink"}`}
        >
          {c.symbol} {c.code}
        </button>
      ))}
    </div>
  );
}
