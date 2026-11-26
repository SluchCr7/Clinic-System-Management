"use client";

import React, { useState, useEffect } from "react";
import { Modal, Button, Input, Textarea, FileInput, CustomSelect, toast } from "@/components/ui";
import {
  useUpdateLabOrderItemMutation,
  useDeleteLabOrderItemFileMutation,
} from "@/services/api/labOrderApi";
import { extractApiError } from "@/services/api/baseQuery";
import type { LabOrderItem } from "@/types/labOrder";
import {
  LuFlaskConical,
  LuScanLine,
  LuFileText,
  LuDownload,
  LuTrash2,
  LuCheck,
} from "react-icons/lu";

interface UpdateLabOrderStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: LabOrderItem | null;
  patientName?: string;
  onSuccess?: () => void;
}

export const UpdateLabOrderStatusModal: React.FC<UpdateLabOrderStatusModalProps> = ({
  isOpen,
  onClose,
  item,
  patientName,
  onSuccess,
}) => {
  const [updateItem, { isLoading: isUpdating }] = useUpdateLabOrderItemMutation();
  const [deleteFile, { isLoading: isDeletingFile }] = useDeleteLabOrderItemFileMutation();

  const [status, setStatus] = useState<string>("ordered");
  const [labName, setLabName] = useState("");
  const [resultNotes, setResultNotes] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  useEffect(() => {
    if (item) {
      const currentStatus =
        item.status === "REQUESTED"
          ? "ordered"
          : item.status === "RESULT_RECEIVED"
          ? "received"
          : item.status === "CANCELLED"
          ? "cancelled"
          : item.status;
      setStatus(currentStatus || "ordered");
      setLabName(item.labName || "");
      setResultNotes(item.resultNotes || "");
      setCancelReason(item.cancelReason || "");
      setSelectedFiles([]);
    }
  }, [item]);

  if (!item) return null;

  const isRadiology = item.type === "radiology" || item.type === "IMAGING";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (selectedFiles.length > 0) {
        // Send multipart form-data
        const formData = new FormData();
        formData.append("status", status);
        if (labName.trim()) formData.append("labName", labName.trim());
        if (resultNotes.trim()) formData.append("resultNotes", resultNotes.trim());
        if (status === "cancelled" && cancelReason.trim()) {
          formData.append("cancelReason", cancelReason.trim());
        }
        for (const file of selectedFiles) {
          formData.append("files", file);
        }

        await updateItem({ id: item._id, data: formData }).unwrap();
      } else {
        // Send JSON payload
        await updateItem({
          id: item._id,
          data: {
            status: status as "ordered" | "received" | "cancelled",
            labName: labName.trim() || undefined,
            resultNotes: resultNotes.trim() || undefined,
            cancelReason: status === "cancelled" ? cancelReason.trim() : undefined,
          },
        }).unwrap();
      }

      toast.success("تم تحديث حالة الفحص بنجاح");
      onSuccess?.();
      onClose();
    } catch (err) {
      const errInfo = extractApiError(err);
      toast.error(errInfo.message || "فشل تحديث حالة الفحص");
    }
  };

  const handleDeleteExistingFile = async (fileId: string) => {
    if (!confirm("هل أنت متأكد من حذف هذا الملف؟")) return;
    try {
      await deleteFile({ itemId: item._id, fileId }).unwrap();
      toast.success("تم حذف الملف بنجاح");
      onSuccess?.();
    } catch (err) {
      const errInfo = extractApiError(err);
      toast.error(errInfo.message || "فشل حذف الملف");
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="تحديث حالة الفحص والنتائج"
      subtitle={patientName ? `المريض: ${patientName} • ${item.name}` : item.name}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 text-xs">
        {/* Item Header Badge */}
        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-paper border border-border-subtle">
          <div className="p-2 rounded-md bg-teal-primary/10 text-teal-primary">
            {isRadiology ? (
              <LuScanLine className="w-5 h-5" />
            ) : (
              <LuFlaskConical className="w-5 h-5" />
            )}
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-ink text-sm">{item.name}</span>
            <span className="text-[11px] text-slate-muted">
              {isRadiology ? "فحص أشعة / تصوير طبي" : "تحليل مخبري"}
              {item.code ? ` (${item.code})` : ""}
            </span>
          </div>
        </div>

        {/* 1. Status Selection (Custom high-contrast dropdown) */}
        <CustomSelect
          label="حالة الطلب *"
          value={status}
          onChange={(val) => setStatus(val)}
          options={[
            { value: "ordered", label: "قيد الانتظار (في انتظار النتيجة)" },
            { value: "received", label: "تم استلام النتيجة" },
            { value: "cancelled", label: "ملغي" },
          ]}
        />

        {/* 2. Facility / Center Name */}
        <Input
          label={isRadiology ? "اسم مركز الأشعة (اختياري)" : "اسم معمل التحاليل (اختياري)"}
          placeholder={isRadiology ? "مثال: مركز النيل للأشعة" : "مثال: معمل البرج"}
          value={labName}
          onChange={(e) => setLabName(e.target.value)}
        />

        {/* 3. Result Notes */}
        <Textarea
          label="ملاحظات النتيجة والتقرير (اختياري)"
          placeholder="سجل ملخص النتيجة أو القراءات الهامة..."
          rows={3}
          value={resultNotes}
          onChange={(e) => setResultNotes(e.target.value)}
        />

        {/* 4. Cancel Reason (shown if status is cancelled) */}
        {status === "cancelled" && (
          <Textarea
            label="سبب الإلغاء (اختياري)"
            placeholder="اكتب سبب إلغاء هذا الفحص..."
            rows={2}
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
          />
        )}

        {/* 5. Existing Attached Files */}
        {item.resultFiles && item.resultFiles.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <span className="font-semibold text-ink text-[11px]">الملفات المرفقة سابقاً:</span>
            <div className="flex flex-col gap-1">
              {item.resultFiles.map((file) => (
                <div
                  key={file._id}
                  className="flex items-center justify-between p-2 rounded-md bg-paper border border-border-subtle text-xs"
                >
                  <a
                    href={`/api/lab-order-items/${item._id}/files/${file._id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-teal-primary hover:underline font-medium truncate"
                  >
                    <LuFileText className="w-4 h-4 shrink-0" />
                    <span className="truncate">{file.originalName}</span>
                    <LuDownload className="w-3.5 h-3.5 shrink-0" />
                  </a>

                  <button
                    type="button"
                    disabled={isDeletingFile}
                    onClick={() => handleDeleteExistingFile(file._id)}
                    className="p-1 rounded text-slate-muted hover:text-status-error hover:bg-status-error/10 transition-colors"
                    title="حذف الملف"
                  >
                    <LuTrash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 6. Upload Result Files */}
        <FileInput
          label={
            isRadiology
              ? "إرفاق صور/تقارير الأشعة (اختياري - يدعم صور متعددة)"
              : "إرفاق تقرير التحليل (اختياري)"
          }
          multiple={isRadiology}
          files={selectedFiles}
          onChange={setSelectedFiles}
          helperText="يدعم ملفات PDF و JPG و PNG حتى 10 ميجابايت."
        />

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-border-subtle">
          <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={isUpdating}>
            إلغاء
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            isLoading={isUpdating}
            leftIcon={<LuCheck className="w-4 h-4" />}
          >
            حفظ التغييرات
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default UpdateLabOrderStatusModal;
