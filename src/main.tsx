import React, { Component, type ErrorInfo, type ReactNode } from "react";
import ReactDOM from "react-dom/client";
import "primeicons/primeicons.css";
import "primereact/resources/primereact.min.css";
import "./App.css";
import "./styles/primereact.css";

interface StartupBoundaryProps {
  children: ReactNode;
}

interface StartupBoundaryState {
  error: Error | null;
}

class StartupBoundary extends Component<StartupBoundaryProps, StartupBoundaryState> {
  state: StartupBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): StartupBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("Application render failed", error, info);
  }

  render(): ReactNode {
    if (this.state.error) return <StartupError error={this.state.error} />;
    return this.props.children;
  }
}

function StartupError({ error }: { error: unknown }) {
  const message = error instanceof Error ? error.message : String(error);
  document.title = `MC Planner error: ${message}`;
  return <main className="startup-error" role="alert">
    <p className="startup-error__eyebrow">MC Planner</p>
    <h1>Application startup failed</h1>
    <p>{message}</p>
    <button type="button" onClick={() => window.location.reload()}>Reload application</button>
  </main>;
}

const rootElement = document.getElementById("root");

window.addEventListener("error", (event) => {
  document.title = `MC Planner error: ${event.message}`;
});
window.addEventListener("unhandledrejection", (event) => {
  const message = event.reason instanceof Error ? event.reason.message : String(event.reason);
  document.title = `MC Planner error: ${message}`;
});

if (!rootElement) {
  document.body.textContent = "MC Planner could not find its root element.";
} else {
  const root = ReactDOM.createRoot(rootElement);

  void import("./App")
    .then(({ default: App }) => {
      root.render(
        <React.StrictMode>
          <StartupBoundary>
            <App />
          </StartupBoundary>
        </React.StrictMode>,
      );
    })
    .catch((error: unknown) => {
      console.error("Application module failed to load", error);
      root.render(<StartupError error={error} />);
    });
}
