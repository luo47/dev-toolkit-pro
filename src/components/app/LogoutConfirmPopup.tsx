interface LogoutConfirmPopupProps {
  isSidebarOpen: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  source: "sidebar" | "topbar";
}

export default function LogoutConfirmPopup({
  isSidebarOpen,
  onCancel,
  onConfirm,
  source,
}: LogoutConfirmPopupProps) {
  const positionClass =
    source === "sidebar"
      ? `bottom-full left-0 mb-2 ${!isSidebarOpen ? "left-1/2 -translate-x-1/2 w-48" : "w-full"}`
      : "top-full right-0 mt-2 w-full";

  return (
    <div
      className={`absolute ${positionClass} min-w-[180px] bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl p-3 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-200 origin-bottom`}
    >
      <p className="text-xs text-[var(--text-primary)] mb-3 font-medium px-1">确定要退出登录吗？</p>
      <div className="flex gap-2">
        <button
          onClick={onConfirm}
          className="flex-1 py-2 bg-red-500 text-white text-[10px] font-bold rounded-xl hover:bg-red-600 transition-colors shadow-lg shadow-red-500/20"
        >
          确定退出
        </button>
        <button
          onClick={onCancel}
          className="flex-1 py-2 bg-[var(--hover-color)] text-[var(--text-secondary)] text-[10px] font-bold rounded-xl hover:bg-[var(--border-color)] transition-colors"
        >
          取消
        </button>
      </div>
    </div>
  );
}
