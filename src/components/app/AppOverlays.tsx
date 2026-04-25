import { AnimatePresence, motion } from "framer-motion";

interface AppOverlaysProps {
  loading: boolean;
  toast: { message: string; type: "success" | "error" | "info" } | null;
}

export default function AppOverlays({ loading, toast }: AppOverlaysProps) {
  return (
    <>
      <AnimatePresence>
        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-[var(--bg-main)] flex flex-col items-center justify-center gap-4"
          >
            <div className="w-12 h-12 border-4 border-[var(--accent-color)] border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-medium text-[var(--text-secondary)] animate-pulse">正在初始化环境...</p>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[110]"
          >
            <div
              className={`px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 backdrop-blur-xl border ${
                toast.type === "success"
                  ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500"
                  : toast.type === "info"
                    ? "bg-blue-500/10 border-blue-500/20 text-blue-500"
                    : "bg-red-500/10 border-red-500/20 text-red-500"
              }`}
            >
              <div
                className={`w-2 h-2 rounded-full ${
                  toast.type === "success" ? "bg-emerald-500" : toast.type === "info" ? "bg-blue-500" : "bg-red-500"
                } animate-pulse`}
              />
              <span className="text-sm font-bold">{toast.message}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
