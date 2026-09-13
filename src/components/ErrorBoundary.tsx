import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  /** Use full-viewport height for a top-level (app-root) boundary; false
   *  fits its container instead, for a boundary nested inside a layout
   *  that already has its own header/sidebar chrome around it. */
  fullScreen?: boolean;
}

interface State {
  error: Error | null;
}

// React error boundaries have to be class components — there's no hook
// equivalent yet. Without this, any single component throwing during
// render (a bad data shape, a missing field, anything) unmounts the
// entire app to a blank white screen with no explanation, which is
// exactly what happened repeatedly while wiring up the AI brain
// dashboards earlier — the user only ever saw a blank page, never a
// clue what broke.
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      const fullScreen = this.props.fullScreen ?? true;
      return (
        <div
          className={`w-full flex items-center justify-center bg-black text-white px-6 ${
            fullScreen ? "min-h-screen" : "py-20 rounded-2xl"
          }`}
        >
          <div className="max-w-lg text-center space-y-6">
            <h1 className="text-3xl font-bold text-yellow-300">
              Something went wrong
            </h1>
            <p className="text-white/70">
              This screen hit an error and couldn't render. Your data is
              safe — reloading usually fixes it.
            </p>

            <pre className="text-left text-xs text-red-300/80 bg-black/40 border border-red-500/30 rounded-lg p-4 overflow-auto max-h-40">
              {this.state.error.message}
            </pre>

            <div className="flex justify-center gap-4">
              <button
                onClick={() => window.location.reload()}
                className="px-5 py-2 rounded-lg bg-yellow-500 text-black font-semibold hover:bg-yellow-400 transition"
              >
                Reload
              </button>
              <button
                onClick={() => {
                  this.setState({ error: null });
                  window.location.href = "/";
                }}
                className="px-5 py-2 rounded-lg bg-black/40 border border-yellow-400/40 text-yellow-300 font-semibold hover:bg-black/60 transition"
              >
                Go Home
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
