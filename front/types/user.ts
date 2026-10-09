import { BaseListQueryParams } from "./api";
import { User, UserProfilePhoto, UserRole } from "./auth";

export type { User, UserProfilePhoto, UserRole };

export interface CreateUserRequest {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone: string;
  role: UserRole;
  isActive?: boolean;
  profilePhoto?: {
    url?: string;
    publicId?: string | null;
  };
}

export interface UpdateUserRequest {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  role?: UserRole;
  isActive?: boolean;
  profilePhoto?: {
    url?: string;
    publicId?: string | null;
  };
}

export interface UserQueryParams extends BaseListQueryParams {
  role?: UserRole;
  isActive?: boolean;
}

export interface ProfilePhotoResponseData {
  profilePhoto: UserProfilePhoto;
}
