import { useEffect, useEffectEvent } from "react";
import { useAppStore } from "../store";
import "../types";

export interface User {
  id: string;
  provider: "github" | "linuxdo";
  provider_user_id: string;
  username: string;
  name?: string;
  avatar_url?: string;
}

export function useAuth() {
  const { user, loading, setUser, setLoading } = useAppStore();

  const fetchUser = useEffectEvent(async () => {
    try {
      const baseUrl = import.meta.env.VITE_API_URL || "";
      const response = await fetch(`${baseUrl}/api/auth/me`, {
        credentials: "include",
      });
      if (response.ok) {
        const data = (await response.json()) as { user: User | null };
        setUser(data.user || null);
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error("Failed to fetch user:", error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  });

  useEffect(() => {
    fetchUser();
  }, []);

  const loginWithProvider = (provider: User["provider"]) => {
    const baseUrl = import.meta.env.VITE_API_URL || "";
    window.location.href = `${baseUrl}/api/auth/${provider}/login?t=${Date.now()}`;
  };

  const logout = async () => {
    try {
      const baseUrl = import.meta.env.VITE_API_URL || "";
      await fetch(`${baseUrl}/api/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
      setUser(null);
    } catch (error) {
      console.error("Failed to logout:", error);
    }
  };

  return { user, loading, loginWithProvider, logout };
}
