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
      {/* Abstract geometric mark representing: Care + Connection + Precision */}
      <div
        className={`${iconSizes[size]} shrink-0 rounded-md bg-teal-primary/10 flex items-center justify-center p-1.5 border border-teal-primary/20`}
      >
        <svg
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full text-teal-primary"
        >
          {/* Outer precise circular focus arcs */}
          <path
            d="M8 16C8 11.5817 11.5817 8 16 8"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <path
            d="M24 16C24 20.4183 20.4183 24 16 24"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          {/* Inner connecting node */}
          <circle cx="16" cy="16" r="3.5" fill="currentColor" />
          {/* Precision alignment ticks */}
          <circle cx="23" cy="9" r="1.5" fill="currentColor" className="opacity-80" />
          <circle cx="9" cy="23" r="1.5" fill="currentColor" className="opacity-80" />
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
            className={`text-[9px] uppercase tracking-wider font-medium mt-0.5 ${
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
