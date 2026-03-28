import { AlertCircle, Check, ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import type React from "react";
import { STEP_CONFIG, type Step } from "./ChainTypes";

type RegexReplaceOptions = {
  pattern: string;
  flags: string;
  replacement: string;
};

type JsonToXmlOptions = {
  root: string;
  noRoot: boolean;
  noHeader: boolean;
};

export interface StepItemProps {
  step: Step;
  index: number;
  totalSteps: number;
  error: { stepId: string; message: string } | null;
  onUpdate: (id: string, updates: Partial<Step>) => void;
  onRemove: (id: string) => void;
  onMove: (index: number, direction: "up" | "down") => void;
}

const stripLegacyByLineValue = (value: string) => {
  try {
    const options = value ? JSON.parse(value) : {};
    if (!("byline" in options)) return undefined;
    delete options.byline;
    return Object.keys(options).length === 0 ? "" : JSON.stringify(options);
  } catch {
    return undefined;
  }
};

const StepItem: React.FC<StepItemProps> = ({
  step,
  index,
  totalSteps,
  error,
  onUpdate,
  onRemove,
  onMove,
}) => {
  const handleByLineToggle = (checked: boolean) => {
    const updates: Partial<Step> = { byline: checked };
    if (
      step.type === "base64-encode" ||
      step.type === "base64-decode" ||
      step.type === "regex-replace"
    ) {
      const normalizedValue = stripLegacyByLineValue(step.value);
      if (normalizedValue !== undefined) updates.value = normalizedValue;
    }
    onUpdate(step.id, updates);
  };

  return (
    <div
      className={`group relative bg-[var(--bg-surface)] border ${error?.stepId === step.id ? "border-[var(--error-color)]/50" : "border-[var(--border-color)]"} rounded-2xl p-4 transition-all hover:shadow-md`}
    >
      <div className="flex items-center gap-3 mb-3">
        <div className="flex items-center gap-1">
          <button
            onClick={() => onMove(index, "up")}
            disabled={index === 0}
            className="p-1 hover:bg-[var(--hover-color)] rounded text-[var(--text-secondary)] disabled:opacity-30"
          >
            <ChevronUp className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onMove(index, "down")}
            disabled={index === totalSteps - 1}
            className="p-1 hover:bg-[var(--hover-color)] rounded text-[var(--text-secondary)] disabled:opacity-30"
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="w-8 h-8 flex items-center justify-center bg-[var(--accent-color)]/10 rounded-lg text-[10px] font-bold text-[var(--accent-color)]">
          {STEP_CONFIG[step.type].icon}
        </div>
        <div className="flex-1">
          <div className="text-xs font-bold text-[var(--text-primary)]">
            {STEP_CONFIG[step.type].label}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={step.active}
            onChange={(e) => onUpdate(step.id, { active: e.target.checked })}
            className="w-4 h-4 rounded border-[var(--border-color)] text-[var(--accent-color)] focus:ring-[var(--accent-color)]"
          />
          <button
            onClick={() => onRemove(step.id)}
            className="p-1.5 hover:bg-red-500/10 text-[var(--text-secondary)] hover:text-red-500 rounded-lg transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {step.type === "regex-replace" &&
        (() => {
          let options: RegexReplaceOptions = { pattern: "", flags: "g", replacement: "" };
          try {
            if (step.value.startsWith("{")) {
              options = {
                ...options,
                ...(JSON.parse(step.value) as Partial<RegexReplaceOptions>),
              };
            }
          } catch (_e) {}

          const updateOptions = (updates: Partial<RegexReplaceOptions>) => {
            onUpdate(step.id, { value: JSON.stringify({ ...options, ...updates }) });
          };

          return (
            <div className="space-y-3 mt-3 pt-3 border-t border-[var(--border-color)]/30">
              <div className="flex bg-[var(--bg-main)] border border-[var(--border-color)] rounded-xl focus-within:ring-2 focus-within:ring-[var(--accent-color)]/30 transition-all overflow-hidden relative">
                <div className="flex items-center justify-center px-3 text-[var(--text-secondary)] font-mono text-xs border-r border-[var(--border-color)]">
                  /
                </div>
                <input
                  type="text"
                  value={options.pattern}
                  onChange={(e) => updateOptions({ pattern: e.target.value })}
                  placeholder="正则表达式"
                  className="flex-1 min-w-0 p-2 text-xs font-mono outline-none bg-transparent placeholder:font-sans placeholder:text-[var(--text-secondary)]/50"
                />
                <div className="flex items-center justify-center px-3 text-[var(--text-secondary)] font-mono text-xs border-l border-[var(--border-color)]">
                  /
                </div>
                <input
                  type="text"
                  value={options.flags}
                  onChange={(e) => updateOptions({ flags: e.target.value })}
                  placeholder="例: gm"
                  className="w-16 p-2 text-xs font-mono outline-none bg-transparent placeholder:font-sans text-center placeholder:text-[var(--text-secondary)]/50"
                />
              </div>
              <input
                type="text"
                value={options.replacement}
                onChange={(e) => updateOptions({ replacement: e.target.value })}
                placeholder="替换为... (支持 $1 分组和 \n 会被转义为换行)"
                className="w-full p-2.5 bg-[var(--bg-main)] border border-[var(--border-color)] rounded-xl text-xs font-mono outline-none focus:ring-2 focus:ring-[var(--accent-color)]/30 transition-all placeholder:font-sans placeholder:text-[var(--text-secondary)]/50"
              />
            </div>
          );
        })()}

      {["jsonpath", "xpath", "css", "js"].includes(step.type) && (
        <div className="space-y-2">
          <textarea
            value={step.value}
            onChange={(e) => onUpdate(step.id, { value: e.target.value })}
            placeholder={STEP_CONFIG[step.type].placeholder}
            className="w-full p-3 bg-[var(--bg-main)] border border-[var(--border-color)] rounded-xl text-xs font-mono outline-none focus:ring-2 focus:ring-[var(--accent-color)]/50 transition-all resize-none h-20"
          />
        </div>
      )}

      {(() => {
        const isBylineSupported = [
          "jsonpath",
          "xpath",
          "css",
          "base64-encode",
          "base64-decode",
          "url-encode",
          "url-decode",
          "regex-replace",
          "trim",
          "lowercase",
          "uppercase",
          "json-beautify",
          "json-compress",
          "xml-beautify",
          "xml-compress",
          "xml-to-json",
          "json-to-xml",
        ].includes(step.type);

        if (!isBylineSupported) return null;

        let stepByLine = !!step.byline;
        if (
          !stepByLine &&
          (step.type === "base64-encode" ||
            step.type === "base64-decode" ||
            step.type === "regex-replace")
        ) {
          try {
            const opts = JSON.parse(step.value);
            if (opts.byline) stepByLine = true;
          } catch (_e) {}
        }

        return (
          <div className="mt-3 pt-3 border-t border-[var(--border-color)]/30">
            <label className="flex items-center gap-2 cursor-pointer select-none group/label w-fit">
              <div className="relative flex items-center justify-center">
                <input
                  type="checkbox"
                  checked={stepByLine}
                  onChange={(e) => handleByLineToggle(e.target.checked)}
                  className="peer appearance-none w-4 h-4 rounded border border-[var(--border-color)] checked:bg-[var(--accent-color)] checked:border-[var(--accent-color)] transition-all cursor-pointer"
                />
                <Check className="absolute w-2.5 h-2.5 text-white opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none" />
              </div>
              <span className="text-[11px] font-medium text-[var(--text-secondary)] group-hover/label:text-[var(--text-primary)] transition-colors whitespace-nowrap">
                按行处理 (对每一行独立执行该步骤)
              </span>
            </label>
          </div>
        );
      })()}

      {step.type === "json-to-xml" &&
        (() => {
          let options: JsonToXmlOptions = { root: "root", noRoot: false, noHeader: false };
          try {
            if (step.value.startsWith("{")) {
              const parsed = JSON.parse(step.value) as Partial<JsonToXmlOptions>;
              options = { ...options, ...parsed };
            } else if (step.value === "__none__") {
              options.noRoot = true;
              options.root = "";
            } else if (step.value.trim()) {
              options.root = step.value.trim();
            }
          } catch (_e) {}

          const updateOptions = (updates: Partial<JsonToXmlOptions>) => {
            onUpdate(step.id, { value: JSON.stringify({ ...options, ...updates }) });
          };

          return (
            <div className="space-y-3 mt-3 pt-3 border-t border-[var(--border-color)]/30">
              <div className="relative">
                <input
                  type="text"
                  value={options.root}
                  disabled={options.noRoot}
                  onChange={(e) => updateOptions({ root: e.target.value })}
                  placeholder="根节点名称 (默认 root)"
                  className="w-full p-2.5 bg-[var(--bg-main)] border border-[var(--border-color)] rounded-xl text-xs outline-none focus:ring-2 focus:ring-[var(--accent-color)]/30 transition-all disabled:opacity-30 placeholder:text-[var(--text-secondary)]/50"
                />
              </div>
              <div className="flex flex-col gap-2.5">
                <label className="flex items-center gap-2 cursor-pointer select-none group/label">
                  <div className="relative flex items-center justify-center">
                    <input
                      type="checkbox"
                      checked={options.noRoot}
                      onChange={(e) => updateOptions({ noRoot: e.target.checked })}
                      className="peer appearance-none w-4 h-4 rounded border border-[var(--border-color)] checked:bg-[var(--accent-color)] checked:border-[var(--accent-color)] transition-all cursor-pointer"
                    />
                    <Check className="absolute w-2.5 h-2.5 text-white opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none" />
                  </div>
                  <span className="text-[11px] font-medium text-[var(--text-secondary)] group-hover/label:text-[var(--text-primary)] transition-colors whitespace-nowrap">
                    无根节点
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer select-none group/label">
                  <div className="relative flex items-center justify-center">
                    <input
                      type="checkbox"
                      checked={options.noHeader}
                      onChange={(e) => updateOptions({ noHeader: e.target.checked })}
                      className="peer appearance-none w-4 h-4 rounded border border-[var(--border-color)] checked:bg-[var(--accent-color)] checked:border-[var(--accent-color)] transition-all cursor-pointer"
                    />
                    <Check className="absolute w-2.5 h-2.5 text-white opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none" />
                  </div>
                  <span className="text-[11px] font-medium text-[var(--text-secondary)] group-hover/label:text-[var(--text-primary)] transition-colors whitespace-nowrap">
                    无 XML 声明头
                  </span>
                </label>
              </div>
            </div>
          );
        })()}

      {error?.stepId === step.id && (
        <div className="mt-2 text-[10px] text-[var(--error-color)] flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />
          {error.message}
        </div>
      )}
    </div>
  );
};

export default StepItem;
