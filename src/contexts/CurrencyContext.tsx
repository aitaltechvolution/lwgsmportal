import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { CurrencyCode, CURRENCIES } from "@/lib/constants";

interface CurrencyContextValue {
  currency: CurrencyCode;
  setCurrency: (c: CurrencyCode) => void;
  usdToNgn: number;
  usdToEur: number;
  setUsdToNgn: (rate: number) => Promise<void>;
  setUsdToEur: (rate: number) => Promise<void>;
  convert: (amountUsd: number) => number;
  format: (amountUsd: number) => string;
  loading: boolean;
  // Legacy alias
  exchangeRate: number;
  setExchangeRate: (rate: number) => Promise<void>;
}

const CurrencyContext = createContext<CurrencyContextValue | undefined>(undefined);
const STORAGE_KEY = "lwgsm_currency";

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState<CurrencyCode>(
    () => (localStorage.getItem(STORAGE_KEY) as CurrencyCode) || "USD"
  );
  const [usdToNgn, setUsdToNgnState] = useState<number>(1600);
  const [usdToEur, setUsdToEurState] = useState<number>(0.92);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("site_settings")
      .select("key, value")
      .in("key", ["usd_to_ngn", "usd_to_eur", "default_currency"])
      .then(({ data }) => {
        const map = new Map((data ?? []).map((r: { key: string; value: string }) => [r.key, r.value]));
        const ngn = Number(map.get("usd_to_ngn"));
        const eur = Number(map.get("usd_to_eur"));
        if (ngn && !isNaN(ngn)) setUsdToNgnState(ngn);
        if (eur && !isNaN(eur)) setUsdToEurState(eur);
        if (!localStorage.getItem(STORAGE_KEY)) {
          const def = map.get("default_currency") as CurrencyCode | undefined;
          if (def && ["USD","EUR","NGN"].includes(def)) setCurrencyState(def as CurrencyCode);
        }
        setLoading(false);
      });
  }, []);

  const setCurrency = useCallback((c: CurrencyCode) => {
    setCurrencyState(c);
    localStorage.setItem(STORAGE_KEY, c);
  }, []);

  const setUsdToNgn = useCallback(async (rate: number) => {
    await supabase.from("site_settings").upsert({ key: "usd_to_ngn", value: String(rate) });
    setUsdToNgnState(rate);
  }, []);

  const setUsdToEur = useCallback(async (rate: number) => {
    await supabase.from("site_settings").upsert({ key: "usd_to_eur", value: String(rate) });
    setUsdToEurState(rate);
  }, []);

  const convert = useCallback((amountUsd: number) => {
    if (currency === "NGN") return amountUsd * usdToNgn;
    if ((currency as string) === "EUR") return amountUsd * usdToEur;
    return amountUsd;
  }, [currency, usdToNgn, usdToEur]);

  const format = useCallback((amountUsd: number) => {
    const meta = CURRENCIES.find(c => c.code === currency) ?? CURRENCIES[0];
    const value = convert(amountUsd);
    const decimals = currency === "NGN" ? 0 : 2;
    return `${meta.symbol}${value.toLocaleString(undefined, { maximumFractionDigits: decimals })}`;
  }, [currency, convert]);

  return (
    <CurrencyContext.Provider value={{
      currency, setCurrency,
      usdToNgn, usdToEur,
      setUsdToNgn, setUsdToEur,
      convert, format, loading,
      // Legacy aliases
      exchangeRate: usdToNgn,
      setExchangeRate: setUsdToNgn,
    }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error("useCurrency must be used within CurrencyProvider");
  return ctx;
}
