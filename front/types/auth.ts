export type UserRole = "admin" | "doctor" | "receptionist";

export interface UserProfilePhoto {
  url: string | null;
  publicId: string | null;
}

export interface User {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  role: UserRole;
  profilePhoto?: UserProfilePhoto;
  isActive: boolean;
  lastLogin?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuthUserSummary {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface LoginResponseData {
  user: AuthUserSummary;
}

export interface GetMeResponseData {
  user: User;
}

export interface ChangePasswordData {
  currentPassword: string;
  newPassword: string;
}