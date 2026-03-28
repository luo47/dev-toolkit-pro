import { ArrowUpDown, Check, Save, X } from "lucide-react";
import type { RefObject } from "react";
import { getFilteredGroups } from "./helpers";

interface SnippetEditorModalProps {
  formData: {
    title: string;
    code: string;
    language: string;
    tags: string;
  };
  isCreating: boolean;
  isDarkMode: boolean;
  isLangOpen: boolean;
  langRef: RefObject<HTMLDivElement | null>;
  langSearch: string;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  onCancel: () => void;
  onLangOpenChange: (open: boolean) => void;
  onLangSearchChange: (value: string) => void;
  onSave: () => void;
  onUpdateFormData: (updates: Partial<SnippetEditorModalProps["formData"]>) => void;
}

export default function SnippetEditorModal({
  formData,
  isCreating,
  isDarkMode,
  isLangOpen,
  langRef,
  langSearch,
  textareaRef,
  onCancel,
  onLangOpenChange,
  onLangSearchChange,
  onSave,
  onUpdateFormData,
}: SnippetEditorModalProps) {
  const filteredGroups = getFilteredGroups(langSearch);

  return (
    <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center p-0 md:p-6 animate-in fade-in duration-300">
      <button
        type="button"
        aria-label="关闭片段编辑器"
        className={`absolute inset-0 backdrop-blur-sm ${isDarkMode ? "bg-black/80" : "bg-black/20"}`}
        onClick={onCancel}
      />
      <div className="relative w-full max-w-[800px] h-[95vh] md:h-auto max-h-[95vh] bg-[var(--bg-surface)] rounded-t-[32px] md:rounded-[28px] border border-[var(--border-color)] shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-10 md:slide-in-from-bottom-4">
        <div className="flex justify-between items-center px-6 py-5 border-b border-[var(--border-color)] shrink-0">
          <h3 className="text-xl font-bold">{isCreating ? "新建代码片段" : "编辑代码片段"}</h3>
          <button
            type="button"
            onClick={onCancel}
            className="p-2 hover:bg-[var(--hover-color)] rounded-xl text-[var(--text-secondary)]"
          >
            <X size={24} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase px-1">
                片段标题
              </label>
              <input
                value={formData.title}
                onChange={(e) => onUpdateFormData({ title: e.target.value })}
                className="w-full h-12 bg-[var(--bg-input)] border border-[var(--border-color)] rounded-2xl px-4 text-sm outline-none focus:ring-2 focus:ring-blue-500/30 transition-all"
              />
            </div>
            <div className="space-y-1 relative z-[60]">
              <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase px-1">
                语言
              </label>
              <div className="relative" ref={langRef}>
                <button
                  type="button"
                  onClick={() => onLangOpenChange(!isLangOpen)}
                  className="w-full h-12 bg-[var(--bg-input)] border border-[var(--border-color)] rounded-2xl px-4 text-sm outline-none cursor-pointer flex justify-between items-center"
                >
                  <span className="font-bold text-blue-500 uppercase">{formData.language}</span>
                  <ArrowUpDown className="w-4 h-4 opacity-50" />
                </button>
                {isLangOpen && (
                  <div className="absolute top-full left-0 w-full mt-2 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl shadow-2xl z-[150] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                    <div className="p-3 border-b border-[var(--border-color)] bg-[var(--bg-main)]/50">
                      <input
                        placeholder="搜索语言..."
                        value={langSearch}
                        onChange={(e) => onLangSearchChange(e.target.value)}
                        className="w-full h-10 bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl px-4 text-xs outline-none focus:ring-2 focus:ring-blue-500/30 transition-all"
                      />
                    </div>
                    <div className="max-h-[280px] overflow-y-auto custom-scrollbar p-1">
                      {filteredGroups.length === 0 ? (
                        <div className="py-10 text-center text-xs text-[var(--text-secondary)] italic">
                          未找到匹配项
                        </div>
                      ) : (
                        filteredGroups.map((group) => (
                          <div key={group.label} className="mb-2 last:mb-0">
                            <div className="px-3 py-1 text-[9px] font-black opacity-30 uppercase tracking-widest">
                              {group.label}
                            </div>
                            {group.options.map((option) => (
                              <button
                                type="button"
                                key={option.value}
                                onClick={() => {
                                  onUpdateFormData({ language: option.value });
                                  onLangOpenChange(false);
                                  onLangSearchChange("");
                                }}
                                className={`mx-1 px-3 py-2 text-xs rounded-xl cursor-pointer transition-all flex items-center justify-between group/lang ${formData.language === option.value ? "bg-[var(--accent-color)] text-white font-bold shadow-lg shadow-[var(--accent-color)]/20" : "hover:bg-[var(--hover-color)] text-[var(--text-primary)]"}`}
                              >
                                <span className="uppercase">{option.label}</span>
                                {formData.language === option.value && <Check size={12} />}
                              </button>
                            ))}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="space-y-1 relative z-[10]">
            <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase px-1">
              代码内容 *
            </label>
            <textarea
              ref={textareaRef}
              value={formData.code}
              onChange={(e) => onUpdateFormData({ code: e.target.value })}
              className="w-full h-[40vh] md:h-64 font-mono text-sm bg-[var(--code-bg)] text-[var(--code-text)] border border-[var(--border-color)] rounded-2xl px-5 py-4 outline-none focus:ring-2 focus:ring-blue-500/20 transition-all resize-none shadow-inner z-[10]"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase px-1">
              标签 (逗号分隔)
            </label>
            <input
              value={formData.tags}
              onChange={(e) => onUpdateFormData({ tags: e.target.value })}
              className="w-full h-12 bg-[var(--bg-input)] border border-[var(--border-color)] rounded-2xl px-4 text-sm outline-none"
            />
          </div>
        </div>
        <div className="p-6 border-t border-[var(--border-color)] flex gap-3 shrink-0">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 h-14 bg-[var(--hover-color)] rounded-2xl text-sm font-bold text-[var(--text-secondary)]"
          >
            取消
          </button>
          <button
            type="button"
            onClick={onSave}
            className="flex-[2] h-14 bg-[var(--accent-color)] text-white rounded-2xl text-sm font-black uppercase tracking-wider flex items-center justify-center gap-3 shadow-xl shadow-[var(--accent-color)]/20"
          >
            <Save size={20} />
            保存变更
          </button>
        </div>
      </div>
    </div>
  );
}
