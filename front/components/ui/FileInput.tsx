"use client";

import React, { useRef, useState } from "react";
import { LuUpload, LuFileText, LuImage, LuX, LuCircleAlert } from "react-icons/lu";

export interface FileInputProps {
  label?: string;
  error?: string;
  helperText?: string;
  accept?: string;
  multiple?: boolean;
  maxSizeMB?: number;
  files: File[];
  onChange: (files: File[]) => void;
  disabled?: boolean;
  required?: boolean;
  className?: string;
}

export const FileInput: React.FC<FileInputProps> = ({
  label,
  error,
  helperText,
  accept = ".pdf,.jpg,.jpeg,.png",
  multiple = false,
  maxSizeMB = 10,
  files,
  onChange,
  disabled = false,
  required = false,
  className = "",
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 بايت";
    const k = 1024;
    const sizes = ["بايت", "كيلوبايت", "ميجابايت"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  const validateAndAddFiles = (incomingFiles: FileList | null) => {
    if (!incomingFiles || incomingFiles.length === 0) return;
    setLocalError(null);

    const validFiles: File[] = [];
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    const allowedExts = [".pdf", ".jpg", ".jpeg", ".png"];

    for (let i = 0; i < incomingFiles.length; i++) {
      const file = incomingFiles[i];
      const ext = `.${file.name.split(".").pop()?.toLowerCase()}`;

      if (!allowedExts.includes(ext)) {
        setLocalError(`نوع الملف غير مدعوم: ${file.name}. الصيغ المسموحة: PDF, JPG, PNG`);
        return;
      }

      if (file.size > maxSizeBytes) {
        setLocalError(`حجم الملف "${file.name}" أكبر من الحد المسموح (${maxSizeMB} ميجابايت).`);
        return;
      }

      validFiles.push(file);
      if (!multiple) break;
    }

    if (multiple) {
      onChange([...files, ...validFiles]);
    } else {
      onChange(validFiles.slice(0, 1));
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (!disabled) {
      validateAndAddFiles(e.dataTransfer.files);
    }
  };

  const removeFile = (indexToRemove: number) => {
    onChange(files.filter((_, idx) => idx !== indexToRemove));
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className={`flex flex-col gap-2 w-full text-start ${className}`}>
      {label && (
        <label className="text-xs font-semibold text-ink flex items-center gap-1 select-none">
          {label}
          {required && <span className="text-status-error">*</span>}
        </label>
      )}

      {/* Hidden native input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        className="hidden"
        onChange={(e) => {
          validateAndAddFiles(e.target.files);
        }}
      />

      {/* Custom Drag & Drop / Upload Box */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !disabled && fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-all duration-150 flex flex-col items-center justify-center gap-2 select-none ${
          disabled
            ? "bg-paper/40 border-border-subtle cursor-not-allowed opacity-60"
            : isDragging
            ? "border-teal-primary bg-teal-primary/10"
            : error || localError
            ? "border-status-error/60 bg-status-error/5 hover:bg-status-error/10"
            : "border-border-subtle hover:border-teal-primary/60 bg-surface/60 hover:bg-paper/50"
        }`}
      >
        <div className="w-10 h-10 rounded-full bg-teal-primary/15 text-teal-primary flex items-center justify-center">
          <LuUpload className="w-5 h-5" />
        </div>

        <div className="flex flex-col gap-0.5">
          <div className="flex items-center justify-center gap-2">
            <span className="inline-flex items-center justify-center px-3 py-1 text-xs font-bold text-white bg-teal-primary hover:bg-teal-dark rounded-md transition-colors shadow-sm">
              اختر ملف
            </span>
            <span className="text-xs text-slate-muted">أو اسحب الملفات وأفلتها هنا</span>
          </div>
          <span className="text-[11px] text-slate-light mt-1">
            الصيغ المدعومة: PDF, PNG, JPG (الحد الأقصى {maxSizeMB} ميجابايت)
          </span>
        </div>
      </div>

      {/* Selected Files List */}
      {files.length > 0 && (
        <div className="flex flex-col gap-1.5 mt-1">
          {files.map((file, idx) => {
            const isPdf = file.name.toLowerCase().endsWith(".pdf");
            return (
              <div
                key={`${file.name}-${idx}`}
                className="flex items-center justify-between p-2 rounded-md bg-paper border border-border-subtle text-xs text-ink"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {isPdf ? (
                    <LuFileText className="w-4 h-4 text-red-400 shrink-0" />
                  ) : (
                    <LuImage className="w-4 h-4 text-teal-primary shrink-0" />
                  )}
                  <div className="flex flex-col min-w-0">
                    <span className="font-medium truncate text-xs" title={file.name}>
                      {file.name}
                    </span>
                    <span className="text-[10px] text-slate-muted">
                      {formatFileSize(file.size)}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile(idx);
                  }}
                  className="p-1 rounded text-slate-muted hover:text-status-error hover:bg-status-error/10 transition-colors shrink-0"
                  title="حذف الملف"
                >
                  <LuX className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Errors / Helper */}
      {(error || localError) && (
        <p className="text-[11px] text-status-error flex items-center gap-1">
          <LuCircleAlert className="w-3.5 h-3.5 shrink-0" />
          {error || localError}
        </p>
      )}
      {!error && !localError && helperText && (
        <p className="text-[11px] text-slate-muted">{helperText}</p>
      )}
    </div>
  );
};

export default FileInput;
