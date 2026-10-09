import React from "react";

export interface AvatarProps {
  src?: string | null;
  name?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function Avatar({
  src,
  name = "User",
  size = "md",
  className = "",
}: AvatarProps) {
  const sizeStyles = {
    sm: "w-7 h-7 text-[11px]",
    md: "w-9 h-9 text-xs",
    lg: "w-12 h-12 text-sm",
  };

  const getInitials = (str: string) => {
    const parts = str.trim().split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return str.slice(0, 2).toUpperCase();
  };

  return (
    <div
      className={`${sizeStyles[size]} rounded-full bg-mint border border-teal-primary/20 text-teal-dark font-semibold flex items-center justify-center shrink-0 overflow-hidden select-none ${className}`}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={name}
          className="w-full h-full object-cover"
        />
      ) : (
        <span>{getInitials(name)}</span>
      )}
    </div>
  );
}

export default Avatar;
