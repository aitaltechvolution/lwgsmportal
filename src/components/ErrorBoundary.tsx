import { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

interface Props {
  children: ReactNode;
  /** When this value changes (e.g. the route pathname), a previously
   *  caught error is cleared automatically — lets the rest of the app
   *  (nav, sidebar) keep working after navigating away from a page that
   *  crashed, instead of staying stuck on the fallback screen forever. */
  resetKey?: string;
}

interface State {
  hasError: boolean;
  resetKey?: string;
}

/**
 * Catches render-time errors anywhere below it in the tree and shows a
 * friendly, bilingual fallback instead of a blank white screen. Language
 * here can't rely on react-i18next context (the error may have originated
 * inside that very tree), so both languages are shown side by side rather
 * than picked dynamically.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, resetKey: this.props.resetKey };

  static getDerivedStateFromError(): Partial<State> {
    return { hasError: true };
  }

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    if (props.resetKey !== state.resetKey) {
      return { hasError: false, resetKey: props.resetKey };
    }
    return null;
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error("Unhandled UI error:", error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen flex items-center justify-center bg-white px-6">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-5">
            <AlertTriangle className="w-8 h-8 text-red-500" strokeWidth={1.75} />
          </div>
          <h1 className="text-xl font-black text-ink mb-2">Something went wrong</h1>
          <p className="text-sm text-slate mb-1">
            We're sorry — this page ran into an unexpected error. Try reloading, or head back to safety below.
          </p>
          <p className="text-sm text-slate mb-6 italic">
            Une erreur inattendue s'est produite. Essayez de recharger la page, ou retournez à l'accueil ci-dessous.
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => window.location.reload()}
              className="flex items-center gap-2 text-sm font-bold bg-navy hover:bg-navy-light text-white px-5 py-2.5 rounded-xl transition-colors"
            >
              <RefreshCw className="w-4 h-4" strokeWidth={2} />
              Reload / Recharger
            </button>
            <a
              href="/"
              className="flex items-center gap-2 text-sm font-bold border border-gray-200 text-slate hover:border-navy hover:text-navy px-5 py-2.5 rounded-xl transition-all"
            >
              <Home className="w-4 h-4" strokeWidth={2} />
              Home / Accueil
            </a>
          </div>
        </div>
      </div>
    );
  }
}
