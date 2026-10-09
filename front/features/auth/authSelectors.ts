import type { RootState } from "@/redux/store";
import type { User, UserRole } from "@/types/auth";

export const selectCurrentUser = (state: RootState): User | null =>
  state.auth.user;

export const selectIsAuthenticated = (state: RootState): boolean =>
  state.auth.isAuthenticated;

export const selectIsInitialized = (state: RootState): boolean =>
  state.auth.isInitialized;

export const selectUserRole = (state: RootState): UserRole | undefined =>
  state.auth.user?.role;

export const selectIsAdmin = (state: RootState): boolean =>
  state.auth.user?.role === "admin";

export const selectIsDoctor = (state: RootState): boolean =>
  state.auth.user?.role === "doctor";

export const selectIsReceptionist = (state: RootState): boolean =>
  state.auth.user?.role === "receptionist";
