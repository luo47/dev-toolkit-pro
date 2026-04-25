import { useCallback, useEffect } from "react";
import { API_BASE_URL } from "../config";
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

  const fetchUser = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
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
  }, [setLoading, setUser]);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const loginWithProvider = (provider: User["provider"]) => {
    window.location.href = `${API_BASE_URL}/api/auth/${provider}/login?t=${Date.now()}`;
  };

  const logout = async () => {
    try {
      await fetch(`${API_BASE_URL}/api/auth/logout`, {
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
