import { CheckCircle2, FileJson, Loader2, ShieldAlert, Terminal, XCircle } from "lucide-react";
import type { ReactNode } from "react";
import type { TestState, TestStatus } from "./helpers";

function StatusIcon({ status }: { status: TestStatus }) {
  if (status === "success") return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
  if (status === "error") return <XCircle className="w-5 h-5 text-red-500" />;
  if (status === "warning") return <ShieldAlert className="w-5 h-5 text-amber-500" />;
  if (status === "loading") {
    return <Loader2 className="w-5 h-5 text-[var(--accent-color)] animate-spin" />;
  }
  return null;
}

export default function ResultPanel({
  children,
  state,
  title,
}: {
  children?: ReactNode;
  state: TestState;
  title?: string;
}) {
  const displayTitle =
    state.status === "loading"
      ? "正在检测..."
      : title || state.title || (state.status === "error" ? "检测失败" : "检测成功");

  const toneClass = {
    idle: "bg-[var(--bg-surface)] border-[var(--border-color)] opacity-60 grayscale hover:grayscale-0 hover:opacity-100",
    loading: "bg-[var(--accent-color)]/5 border-[var(--accent-color)]/30 ring-4 ring-[var(--accent-color)]/5",
    success: "bg-emerald-500/5 border-emerald-500/30 shadow-lg shadow-emerald-500/5",
    error: "bg-red-500/5 border-red-500/30 shadow-lg shadow-red-500/5",
    warning: "bg-amber-500/5 border-amber-500/30 shadow-lg shadow-amber-500/5",
  }[state.status];

  return (
    <section className={`rounded-[16px] border p-4 transition-all duration-500 ${toneClass}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 overflow-hidden">
          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-[var(--text-primary)] truncate text-xs tracking-tight uppercase opacity-90">
              {displayTitle}
            </h3>
            {state.description && (
              <p className="text-[10px] text-[var(--text-secondary)] mt-0.5 truncate opacity-70">{state.description}</p>
            )}
          </div>
          <div className="shrink-0 scale-90">
            <StatusIcon status={state.status} />
          </div>
        </div>
        {state.url && (
          <p className="mt-1.5 text-[10px] font-mono break-all text-[var(--text-secondary)] opacity-40 leading-tight">
            {state.url}
          </p>
        )}
        {state.error && (
          <div className="mt-2 rounded-xl border border-red-500/10 bg-red-500/5 p-2.5">
            <p className="text-[11px] font-medium text-red-500">{state.error}</p>
          </div>
        )}
        {(state.requestBody || state.data) && (
          <div className="mt-2 pt-2 border-t border-[var(--border-color)]/30">
            <details className="group">
              <summary className="flex items-center gap-1.5 text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest cursor-pointer hover:text-[var(--accent-color)] transition-colors list-none">
                <FileJson className="w-3 h-3 transition-transform group-open:rotate-90" />
                查看原始报文
              </summary>
              <div className="mt-2 space-y-2 animate-in fade-in slide-in-from-top-1 duration-300">
                {state.requestBody && (
                  <div className="space-y-1.5">
                    <div className="text-[9px] font-bold text-[var(--accent-color)] flex items-center gap-1 uppercase opacity-60">
                      <Terminal className="w-2.5 h-2.5" />
                      Request Body
                    </div>
                    <pre className="p-2 rounded-xl bg-[var(--bg-main)] border border-[var(--border-color)] text-[9px] font-mono overflow-x-auto custom-scrollbar text-[var(--text-primary)]/80 leading-tight">
                      {JSON.stringify(state.requestBody, null, 2)}
                    </pre>
                  </div>
                )}
                {(state.data || state.details) && (
                  <div className="space-y-1.5">
                    <div
                      className={`text-[9px] font-bold flex items-center gap-1 uppercase opacity-60 ${state.status === "error" ? "text-red-500" : "text-emerald-500"}`}
                    >
                      {state.status === "error" ? (
                        <ShieldAlert className="w-2.5 h-2.5" />
                      ) : (
                        <CheckCircle2 className="w-2.5 h-2.5" />
                      )}
                      Response Body
                    </div>
                    <pre className="p-2 rounded-xl bg-[var(--bg-main)] border border-[var(--border-color)] text-[9px] font-mono overflow-x-auto custom-scrollbar text-[var(--text-primary)]/80 leading-tight">
                      {JSON.stringify(state.data || state.details, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </details>
          </div>
        )}
        {children}
      </div>
    </section>
  );
}
