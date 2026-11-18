import React from "react";

interface LogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  variant?: "dark" | "light" | "auto";
}

export default function Logo({
  className = "",
  size = "md",
  showText = true,
  variant = "auto",
}: LogoProps) {
  const iconSizes = {
    sm: "w-6 h-6",
    md: "w-8 h-8",
    lg: "w-10 h-10",
  };

  const textSizes = {
    sm: "text-sm",
    md: "text-base",
    lg: "text-lg",
  };

  const isExplicitLight = variant === "light";

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <div
        className={`${iconSizes[size]} shrink-0 rounded-lg bg-gradient-to-br from-teal-primary to-teal-dark flex items-center justify-center shadow-sm`}
      >
        <svg
          viewBox="0 0 64 64"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full"
          aria-hidden="true"
        >
          <path
            d="M16 46L28.7 18.6C30 15.8 34 15.8 35.3 18.6L48 46"
            stroke="#F5FFFD"
            strokeWidth="4.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M13.5 34H23L28.7 26L36 41L42 30L45 34H50.5"
            stroke="#A8F0D8"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      {showText && (
        <div className="flex flex-col">
          <span
            className={`font-semibold tracking-tight leading-none ${textSizes[size]} ${
              isExplicitLight ? "text-white" : "text-ink"
            }`}
          >
            Aura<span className="text-teal-primary font-normal">Clinic</span>
          </span>
          <span
            className={`text-[8px] uppercase tracking-[0.16em] font-medium mt-1 ${
              isExplicitLight ? "text-slate-light" : "text-slate-muted"
            }`}
          >
            Clinical Operations
          </span>
        </div>
      )}
    </div>
  );
}
