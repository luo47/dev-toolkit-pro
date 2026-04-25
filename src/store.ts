import { create } from "zustand";
import { API_BASE_URL } from "./config";
import type { User } from "./hooks/useAuth";

interface AppState {
  user: User | null;
  loading: boolean;
  isDarkMode: boolean;
  toast: { message: string; type: "success" | "error" | "info" } | null;

  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  toggleDarkMode: () => void;
  showToast: (message: string, type?: "success" | "error" | "info") => void;
  hideToast: () => void;
  logout: () => Promise<void>;
}

let toastTimer: ReturnType<typeof setTimeout> | null = null;

export const useAppStore = create<AppState>((set) => ({
  user: null,
  loading: true,
  isDarkMode: localStorage.getItem("theme") !== "light",
  toast: null,

  setUser: (user) => set({ user }),
  setLoading: (loading) => set({ loading }),
  toggleDarkMode: () =>
    set((state) => {
      const next = !state.isDarkMode;
      localStorage.setItem("theme", next ? "dark" : "light");
      if (next) document.documentElement.classList.add("dark");
      else document.documentElement.classList.remove("dark");
      return { isDarkMode: next };
    }),
  showToast: (message, type = "success") => {
    if (toastTimer) clearTimeout(toastTimer);
    set({ toast: { message, type } });
    toastTimer = setTimeout(() => {
      set({ toast: null });
      toastTimer = null;
    }, 3000);
  },
  hideToast: () => set({ toast: null }),
  logout: async () => {
    try {
      await fetch(`${API_BASE_URL}/api/auth/logout`, { method: "POST", credentials: "include" });
      set({ user: null });
    } catch (error) {
      console.error("Failed to logout:", error);
    }
  },
}));
