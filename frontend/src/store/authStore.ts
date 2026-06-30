import { create } from "zustand";
import { persist } from "zustand/middleware";
import { authApi } from "../lib/api";

interface User {
  id: string;
  email: string;
  username: string;
  full_name: string;
  role: string;
  avatar_url?: string;
  is_active: boolean;
}

interface AuthStore {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  fetchMe: () => Promise<void>;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,

      login: async (email: string, password: string) => {
        set({ isLoading: true });

        try {
          const response = await authApi.login(email, password);

          localStorage.setItem(
            "access_token",
            response.data.access_token
          );

          localStorage.setItem(
            "refresh_token",
            response.data.refresh_token
          );

          await get().fetchMe();
        } catch (error) {
          set({
            user: null,
            isAuthenticated: false,
          });
          throw error;
        } finally {
          set({
            isLoading: false,
          });
        }
      },

      logout: () => {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");

        set({
          user: null,
          isAuthenticated: false,
        });
      },

      fetchMe: async () => {
        try {
          const response = await authApi.me();

          set({
            user: response.data,
            isAuthenticated: true,
          });
        } catch {
          set({
            user: null,
            isAuthenticated: false,
          });
        }
      },
    }),
    {
      name: "auth-store",
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);