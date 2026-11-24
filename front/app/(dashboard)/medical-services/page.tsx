"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  useGetMedicalServicesQuery,
  useGetCategoriesQuery,
  useCreateMedicalServiceMutation,
  useUpdateMedicalServiceMutation,
  useActivateMedicalServiceMutation,
  useDeactivateMedicalServiceMutation,
} from "@/services/api/medicalServiceApi";
import { useGetDoctorsQuery } from "@/services/api/doctorApi";
import type {
  MedicalService,
  MedicalServiceQueryParams,
  CreateMedicalServiceRequest,
} from "@/types/medicalService";
import {
  PageHeader,
  DataTable,
  Button,
  Select,
  Input,
  Textarea,
  Badge,
  Modal,
  Drawer,
  toast,
  type Column,
} from "@/components/ui";
import { extractApiError } from "@/services/api/baseQuery";
import { selectUserRole, selectCurrentUser } from "@/features/auth/authSelectors";
import { useAppSelector } from "@/redux/hooks";
import {
  LuPlus,
  LuPencil,
  LuTrash2,
  LuCircleCheck,
  LuClock,
  LuCopy,
  LuDownload,
  LuUpload,
  LuSparkles,
  LuHistory,
  LuRefreshCw,
  LuSearch,
  LuCheck,
  LuFileSpreadsheet,
} from "react-icons/lu";

// Quick-start service templates
const TEMPLATE_SERVICES = [
  {
    name: "كشف جديد (New Consultation)",
    code: "CONS-01",
    category: "استشارات",
    price: 250,
    duration: 20,
    description: "فحص سريري شامل للمريض لأول مرة مع تقييم التاريخ المرضي.",
  },
  {
    name: "إعادة كشف (Follow-up Consultation)",
    code: "CONS-02",
    category: "استشارات",
    price: 100,
    duration: 15,
    description: "متابعة الحالة وتقييم الاستجابة للعلاج وإجراء الفحوصات الدورية.",
  },
  {
    name: "رسم قلب (ECG Test)",
    code: "ECG-01",
    category: "فحوصات",
    price: 150,
    duration: 15,
    description: "تخطيط كهربية القلب 12-Lead مع التقرير وقراءة النتائج.",
  },
  {
    name: "سونار بطن وحوض (Ultrasound)",
    code: "US-01",
    category: "فحوصات",
    price: 300,
    duration: 25,
    description: "فحص بالموجات فوق الصوتية لأعضاء البطن والحوض.",
  },
  {
    name: "تغيير على جرح (Wound Dressing)",
    code: "WND-01",
    category: "إجراءات",
    price: 80,
    duration: 15,
    description: "تنظيف وتطهير الجروح السطحية والجراحية وتغيير الضمادات.",
  },
  {
    name: "فك غرز جراحية (Suture Removal)",
    code: "SUT-01",
    category: "إجراءات",
    price: 120,
    duration: 15,
    description: "إزالة الغرز أو الدبابيس الجراحية مع تعقيم الموضع.",
  },
  {
    name: "حقنة عضل أو وريد (IM / IV Injection)",
    code: "INJ-01",
    category: "تمريض",
    price: 40,
    duration: 10,
    description: "إعطاء الحقن العلاجية المقررة في الروشتة بواسطة تمريض معتمد.",
  },
  {
    name: "جلسة استنشاق نيبولايزر (Nebulizer)",
    code: "NEB-01",
    category: "إجراءات",
    price: 75,
    duration: 20,
    description: "جلسة نيبولايزر موسع للشعب ومذيب للمخاط مع قياس الأكسجين.",
  },
];

// Helper to auto-suggest acronym uppercase code from name
function generateSuggestedCode(name: string): string {
  if (!name.trim()) return "";
  const cleaned = name.replace(/[^\w\s\u0600-\u06FF]/gi, " ").trim();
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length === 1) {
    const w = words[0];
    const letters = w.replace(/[^a-zA-Z]/g, "").toUpperCase();
    if (letters.length >= 3) return `${letters.slice(0, 4)}-01`;
    return `SVC-${Math.floor(100 + Math.random() * 900)}`;
  }
  const acronym = words
    .map((w) => {
      const match = w.match(/[a-zA-Z]/);
      return match ? match[0].toUpperCase() : "";
    })
    .join("");
  if (acronym.length >= 2) return `${acronym.slice(0, 5)}-01`;
  return `SVC-${Math.floor(100 + Math.random() * 900)}`;
}

export default function MedicalServicesPage() {
  const { t } = useTranslation();
  const role = useAppSelector(selectUserRole);
  const currentUser = useAppSelector(selectCurrentUser);

  const isDoctor = role === "doctor";
  const isAdmin = role === "admin";
  const isReceptionist = role === "receptionist";
  const canManage = isDoctor || isAdmin;

  // Admin: selected doctor
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>("");
  const { data: doctorsData } = useGetDoctorsQuery(
    { limit: 100 },
    { skip: !isAdmin }
  );

  // Search debouncing
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Query state
  const [queryParams, setQueryParams] = useState<MedicalServiceQueryParams>({
    page: 1,
    limit: 10,
    search: "",
    category: undefined,
    isActive: undefined,
  });

  // Sync debounced search with query params
  useEffect(() => {
    setQueryParams((prev) => ({
      ...prev,
      search: debouncedSearch.trim() || undefined,
      page: 1,
    }));
  }, [debouncedSearch]);

  // Sync admin selected doctor
  useEffect(() => {
    if (isAdmin) {
      setQueryParams((prev) => ({
        ...prev,
        doctor: selectedDoctorId || undefined,
        page: 1,
      }));
    }
  }, [isAdmin, selectedDoctorId]);

  const effectiveDoctorId = isAdmin ? selectedDoctorId : undefined;

  // Queries & Mutations
  const { data, isLoading, isError, refetch } = useGetMedicalServicesQuery(queryParams);
  const { data: categoriesData } = useGetCategoriesQuery(
    effectiveDoctorId ? { doctor: effectiveDoctorId } : undefined
  );

  const [createMedicalService, { isLoading: isCreating }] = useCreateMedicalServiceMutation();
  const [updateMedicalService, { isLoading: isUpdating }] = useUpdateMedicalServiceMutation();
  const [activateMedicalService, { isLoading: isActivating }] = useActivateMedicalServiceMutation();
  const [deactivateMedicalService, { isLoading: isDeactivating }] = useDeactivateMedicalServiceMutation();

  // Add/Edit Drawer State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingService, setEditingService] = useState<MedicalService | null>(null);
  const [codeManuallyEdited, setCodeManuallyEdited] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState<{
    name: string;
    code: string;
    category: string;
    price: number;
    duration: number;
    description: string;
    notes: string;
    isActive: boolean;
  }>({
    name: "",
    code: "",
    category: "",
    price: 150,
    duration: 20,
    description: "",
    notes: "",
    isActive: true,
  });

  // Deactivate/Activate Confirmation Modals
  const [deactivateTarget, setDeactivateTarget] = useState<MedicalService | null>(null);
  const [activateTarget, setActivateTarget] = useState<MedicalService | null>(null);

  // Quick-Start Templates Modal
  const [isQuickStartOpen, setIsQuickStartOpen] = useState(false);
  const [selectedTemplates, setSelectedTemplates] = useState<
    Array<(typeof TEMPLATE_SERVICES)[0] & { selected: boolean }>
  >([]);
  const [isBulkSaving, setIsBulkSaving] = useState(false);

  // CSV Import Ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Open Create
  const handleOpenCreate = () => {
    setIsEditMode(false);
    setEditingService(null);
    setCodeManuallyEdited(false);
    setFieldErrors({});
    setFormData({
      name: "",
      code: "",
      category: categoriesData?.data?.[0] || "استشارات",
      price: 150,
      duration: 20,
      description: "",
      notes: "",
      isActive: true,
    });
    setIsFormOpen(true);
  };

  // Open Edit
  const handleOpenEdit = (svc: MedicalService) => {
    setIsEditMode(true);
    setEditingService(svc);
    setCodeManuallyEdited(true);
    setFieldErrors({});
    setFormData({
      name: svc.name,
      code: svc.code,
      category: svc.category,
      price: svc.price,
      duration: svc.duration,
      description: svc.description || "",
      notes: svc.notes || "",
      isActive: svc.isActive,
    });
    setIsFormOpen(true);
  };

  // Open Duplicate
  const handleDuplicate = (svc: MedicalService) => {
    setIsEditMode(false);
    setEditingService(null);
    setCodeManuallyEdited(true);
    setFieldErrors({});
    setFormData({
      name: `${svc.name} (نسخة)`,
      code: `${svc.code}-COPY`,
      category: svc.category,
      price: svc.price,
      duration: svc.duration,
      description: svc.description || "",
      notes: svc.notes || "",
      isActive: true,
    });
    setIsFormOpen(true);
  };

  // Handle Form Name Change (auto-suggest code)
  const handleNameChange = (name: string) => {
    setFormData((prev) => {
      const next = { ...prev, name };
      if (!isEditMode && !codeManuallyEdited) {
        next.code = generateSuggestedCode(name);
      }
      return next;
    });
    if (fieldErrors.name) {
      setFieldErrors((prev) => ({ ...prev, name: "" }));
    }
  };

  // Handle Submit Create/Edit
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErrors({});

    const trimmedName = formData.name.trim();
    const trimmedCode = formData.code.trim().toUpperCase();
    const trimmedCat = formData.category.trim();

    const errors: Record<string, string> = {};
    if (!trimmedName || trimmedName.length < 2) {
      errors.name = "اسم الخدمة يجب أن يكون حرفين على الأقل";
    }
    if (!trimmedCode || trimmedCode.length < 2) {
      errors.code = "كود الخدمة مطلوب ويجب ألا يقل عن حرفين";
    }
    if (!trimmedCat) {
      errors.category = "يرجى اختيار أو كتابة فئة الخدمة";
    }
    if (formData.price < 0) {
      errors.price = "السعر لا يمكن أن يكون سالباً";
    }
    if (formData.duration < 1 || formData.duration > 600) {
      errors.duration = "مدة الخدمة يجب أن تكون بين 1 و 600 دقيقة";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    try {
      if (isEditMode && editingService) {
        await updateMedicalService({
          id: editingService._id,
          data: {
            name: trimmedName,
            code: trimmedCode,
            category: trimmedCat,
            price: Number(formData.price),
            duration: Number(formData.duration),
            description: formData.description.trim() || null,
            notes: formData.notes.trim() || null,
            isActive: formData.isActive,
            doctor: isAdmin && selectedDoctorId ? selectedDoctorId : undefined,
          },
        }).unwrap();
        toast.success(t("medicalServices.success.updated"));
      } else {
        await createMedicalService({
          name: trimmedName,
          code: trimmedCode,
          category: trimmedCat,
          price: Number(formData.price),
          duration: Number(formData.duration),
          description: formData.description.trim() || undefined,
          notes: formData.notes.trim() || undefined,
          isActive: formData.isActive,
          doctor: isAdmin && selectedDoctorId ? selectedDoctorId : undefined,
        }).unwrap();
        toast.success(t("medicalServices.success.created"));
      }
      setIsFormOpen(false);
    } catch (err: unknown) {
      const extracted = extractApiError(err);
      if (extracted.status === 409 || extracted.message?.includes("كود الخدمة")) {
        setFieldErrors({ code: "كود الخدمة مستخدم بالفعل في عيادتك. يرجى اختيار كود آخر." });
      } else {
        toast.error(extracted.message || (isEditMode ? t("medicalServices.errors.updateFailed") : t("medicalServices.errors.createFailed")));
      }
    }
  };

  // Confirm Deactivate
  const handleConfirmDeactivate = async () => {
    if (!deactivateTarget) return;
    try {
      await deactivateMedicalService(deactivateTarget._id).unwrap();
      toast.success(t("medicalServices.success.deactivated"));
      setDeactivateTarget(null);
    } catch (err) {
      const extracted = extractApiError(err);
      toast.error(extracted.message || t("medicalServices.errors.deactivateFailed"));
    }
  };

  // Confirm Activate
  const handleConfirmActivate = async () => {
    if (!activateTarget) return;
    try {
      await activateMedicalService(activateTarget._id).unwrap();
      toast.success(t("medicalServices.success.activated"));
      setActivateTarget(null);
    } catch (err) {
      const extracted = extractApiError(err);
      toast.error(extracted.message || t("medicalServices.errors.activateFailed"));
    }
  };

  // Quick Start Open
  const handleOpenQuickStart = () => {
    setSelectedTemplates(
      TEMPLATE_SERVICES.map((tmpl) => ({
        ...tmpl,
        selected: true,
      }))
    );
    setIsQuickStartOpen(true);
  };

  // Bulk Save Quick Start Templates
  const handleSaveQuickStart = async () => {
    const toCreate = selectedTemplates.filter((t) => t.selected);
    if (toCreate.length === 0) {
      toast.error("يرجى اختيار خدمة واحدة على الأقل لإضافتها.");
      return;
    }

    setIsBulkSaving(true);
    let created = 0;
    let failed = 0;

    for (const item of toCreate) {
      try {
        await createMedicalService({
          name: item.name,
          code: item.code,
          category: item.category,
          price: Number(item.price),
          duration: Number(item.duration),
          description: item.description,
          doctor: isAdmin && selectedDoctorId ? selectedDoctorId : undefined,
        }).unwrap();
        created++;
      } catch {
        failed++;
      }
    }

    setIsBulkSaving(false);
    setIsQuickStartOpen(false);
    if (created > 0) {
      toast.success(`تمت إضافة ${created} خدمة بنجاح!`);
    }
    if (failed > 0) {
      toast.error(`تعذر إضافة ${failed} خدمة (قد تكون مضافة مسبقاً أو هناك تكرار في الكود).`);
    }
  };

  // Export CSV
  const handleExportCsv = () => {
    if (!data?.data || data.data.length === 0) {
      toast.error("لا توجد خدمات متاحة للتصدير.");
      return;
    }
    const headers = ["الكود", "اسم الخدمة", "الفئة", "السعر (ج.م)", "المدة (دقيقة)", "الحالة", "الوصف"];
    const rows = data.data.map((s) => [
      `"${s.code.replace(/"/g, '""')}"`,
      `"${s.name.replace(/"/g, '""')}"`,
      `"${s.category.replace(/"/g, '""')}"`,
      s.price,
      s.duration,
      s.isActive ? "نشط" : "غير نشط",
      `"${(s.description || "").replace(/"/g, '""')}"`,
    ]);

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `medical-services-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Import CSV Trigger
  const handleImportCsvClick = () => {
    fileInputRef.current?.click();
  };

  // Handle CSV file selected
  const handleCsvFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const text = evt.target?.result as string;
        const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
        if (lines.length < 2) {
          toast.error("ملف CSV فارغ أو غير صالح.");
          return;
        }

        let imported = 0;
        let skipped = 0;

        // Skip header
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
          if (cols.length >= 4) {
            const code = cols[0];
            const name = cols[1];
            const category = cols[2];
            const price = parseFloat(cols[3]) || 0;
            const duration = cols[4] ? parseInt(cols[4], 10) || 20 : 20;
            const description = cols[6] || "";

            if (code && name && category) {
              try {
                await createMedicalService({
                  code: code.toUpperCase(),
                  name,
                  category,
                  price,
                  duration,
                  description,
                  doctor: isAdmin && selectedDoctorId ? selectedDoctorId : undefined,
                }).unwrap();
                imported++;
              } catch {
                skipped++;
              }
            }
          }
        }

        if (imported > 0) {
          toast.success(`تم استيراد ${imported} خدمة بنجاح!`);
        }
        if (skipped > 0) {
          toast.error(`تم تخطي ${skipped} خدمة بسبب أخطاء أو تكرار الكود.`);
        }
      } catch (err) {
        toast.error("فشل في معالجة ملف CSV.");
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.readAsText(file);
  };

  // Table Columns
  const columns: Column<MedicalService>[] = useMemo(
    () => [
      {
        key: "code",
        header: t("medicalServices.table.code"),
        render: (svc) => (
          <span className="font-mono text-xs font-bold text-teal-dark bg-teal-subtle/30 px-2 py-0.5 rounded border border-teal-subtle/50">
            {svc.code}
          </span>
        ),
      },
      {
        key: "name",
        header: t("medicalServices.table.serviceDescription"),
        render: (svc) => (
          <div className="flex flex-col gap-0.5">
            <span className="font-semibold text-ink text-xs">{svc.name}</span>
            {svc.description && (
              <span className="text-[11px] text-slate-muted line-clamp-1">
                {svc.description}
              </span>
            )}
            {svc.notes && (
              <span className="text-[10px] text-slate-light italic line-clamp-1">
                {svc.notes}
              </span>
            )}
          </div>
        ),
      },
      {
        key: "category",
        header: t("medicalServices.table.category"),
        render: (svc) => (
          <Badge variant="neutral" size="sm">
            {svc.category}
          </Badge>
        ),
      },
      {
        key: "duration",
        header: t("medicalServices.table.duration"),
        render: (svc) => (
          <span className="inline-flex items-center gap-1.5 text-xs text-slate-dark">
            <LuClock className="w-3.5 h-3.5 text-slate-light" />
            {svc.duration} {t("medicalServices.minutes")}
          </span>
        ),
      },
      {
        key: "price",
        header: t("medicalServices.table.standardFee"),
        render: (svc) => (
          <span className="font-bold text-ink text-xs font-mono">
            {Number(svc.price).toLocaleString()} {t("medicalServices.egp")}
          </span>
        ),
      },
      {
        key: "isActive",
        header: t("medicalServices.table.status"),
        render: (svc) => (
          <Badge
            variant={svc.isActive ? "success" : "neutral"}
            size="sm"
            dot
          >
            {svc.isActive ? t("common.active") : t("common.inactive")}
          </Badge>
        ),
      },
      ...(canManage
        ? [
            {
              key: "actions",
              header: t("medicalServices.table.actions"),
              align: "right" as const,
              render: (svc: MedicalService) => (
                <div className="flex items-center justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDuplicate(svc)}
                    title={t("medicalServices.duplicate")}
                    className="text-slate-muted hover:text-ink"
                  >
                    <LuCopy className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleOpenEdit(svc)}
                    title={t("common.edit")}
                    className="text-slate-muted hover:text-teal-primary"
                  >
                    <LuPencil className="w-3.5 h-3.5" />
                  </Button>
                  {svc.isActive ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeactivateTarget(svc)}
                      title={t("medicalServices.deactivate")}
                      className="text-status-error hover:bg-status-error-bg"
                    >
                      <LuTrash2 className="w-3.5 h-3.5" />
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setActivateTarget(svc)}
                      title={t("medicalServices.activate")}
                      className="text-status-success hover:bg-status-success-bg"
                    >
                      <LuCheck className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              ),
            },
          ]
        : []),
    ],
    [canManage, t]
  );

  return (
    <div className="flex flex-col gap-5">
      {/* Hidden CSV File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleCsvFileChange}
        accept=".csv,text/csv"
        className="hidden"
      />

      <PageHeader
        title={t("medicalServices.title")}
        subtitle={
          isReceptionist
            ? "عرض قائمة الخدمات والأسعار الخاصة بالطبيب المعتمد لعيادتك"
            : t("medicalServices.subtitle")
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {canManage && (
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleExportCsv}
                  leftIcon={<LuDownload className="w-3.5 h-3.5" />}
                >
                  {t("medicalServices.exportCsv")}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleImportCsvClick}
                  leftIcon={<LuUpload className="w-3.5 h-3.5" />}
                >
                  {t("medicalServices.importCsv")}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleOpenQuickStart}
                  leftIcon={<LuSparkles className="w-3.5 h-3.5 text-amber-500" />}
                >
                  {t("medicalServices.quickStart")}
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleOpenCreate}
                  leftIcon={<LuPlus className="w-4 h-4" />}
                >
                  {t("medicalServices.addService")}
                </Button>
              </>
            )}
          </div>
        }
      />

      {/* Admin Doctor Selector */}
      {isAdmin && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 bg-paper p-3.5 rounded-lg border border-teal-subtle/60 shadow-xs">
          <span className="text-xs font-semibold text-ink flex items-center gap-1.5 whitespace-nowrap">
            <span className="w-2 h-2 rounded-full bg-teal-primary" />
            {t("medicalServices.selectDoctor")}
          </span>
          <div className="w-full sm:w-80">
            <Select
              value={selectedDoctorId}
              onChange={(e) => setSelectedDoctorId(e.target.value)}
              placeholder="اختر الطبيب لعرض خدماته..."
              options={[
                { value: "", label: t("medicalServices.allDoctors") },
                ...(doctorsData?.data?.map((d) => {
                  const docUser = typeof d.user === "object" && d.user ? d.user : null;
                  const name = docUser ? `د. ${docUser.firstName} ${docUser.lastName}` : "طبيب";
                  return {
                    value: docUser?._id || d._id,
                    label: `${name} — ${d.specialization}`,
                  };
                }) || []),
              ]}
            />
          </div>
          {selectedDoctorId && (
            <span className="text-[11px] text-teal-dark font-medium">
              يتم الآن عرض وتعديل خدمات الطبيب المحدد
            </span>
          )}
        </div>
      )}

      {/* Toolbar / Filters */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-surface p-3.5 rounded-lg border border-border-subtle">
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          {/* Search box */}
          <div className="relative w-full sm:w-64">
            <LuSearch className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-light" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="ابحث بالاسم أو الكود..."
              className="w-full pr-9 pl-3 py-1.5 text-xs rounded-md bg-paper border border-border-subtle text-ink placeholder:text-slate-light focus:outline-none focus:ring-1 focus:ring-teal-primary focus:border-teal-primary"
            />
          </div>

          {/* Category Filter */}
          <div className="w-44">
            <Select
              value={queryParams.category || ""}
              onChange={(e) =>
                setQueryParams((prev) => ({
                  ...prev,
                  category: e.target.value || undefined,
                  page: 1,
                }))
              }
              placeholder={t("medicalServices.allCategories")}
              options={[
                { value: "", label: t("medicalServices.allCategories") },
                ...(categoriesData?.data?.map((cat) => ({
                  value: cat,
                  label: cat,
                })) || []),
              ]}
            />
          </div>

          {/* Status Filter */}
          <div className="w-40">
            <Select
              value={
                queryParams.isActive === undefined
                  ? ""
                  : queryParams.isActive
                  ? "true"
                  : "false"
              }
              onChange={(e) =>
                setQueryParams((prev) => ({
                  ...prev,
                  isActive:
                    e.target.value === ""
                      ? undefined
                      : e.target.value === "true",
                  page: 1,
                }))
              }
              placeholder={t("medicalServices.allStatuses")}
              options={[
                { value: "", label: t("medicalServices.allStatuses") },
                { value: "true", label: t("medicalServices.activeServices") },
                { value: "false", label: t("medicalServices.inactiveServices") },
              ]}
            />
          </div>
        </div>

        {/* Counter and Refresh */}
        <div className="flex items-center justify-between lg:justify-end gap-3 text-xs text-slate-muted">
          <span>
            {t("medicalServices.totalServices")}{" "}
            <strong className="text-ink font-mono font-bold">
              {data?.pagination?.total || 0}
            </strong>
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            title="تحديث البيانات"
            className="p-1.5"
          >
            <LuRefreshCw className="w-3.5 h-3.5 text-slate-muted" />
          </Button>
        </div>
      </div>

      {/* Main Table */}
      <DataTable
        columns={columns}
        data={data?.data}
        isLoading={isLoading}
        isError={isError}
        onRetry={refetch}
        emptyTitle={t("medicalServices.emptyTitle")}
        emptyDescription={t("medicalServices.emptyDescription")}
        pagination={data?.pagination}
        onPageChange={(page) => setQueryParams((prev) => ({ ...prev, page }))}
        emptyAction={
          canManage ? (
            <div className="flex flex-wrap items-center justify-center gap-2.5 mt-2">
              <Button
                variant="primary"
                size="sm"
                onClick={handleOpenCreate}
                leftIcon={<LuPlus className="w-4 h-4" />}
              >
                {t("medicalServices.addFirstService")}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleOpenQuickStart}
                leftIcon={<LuSparkles className="w-3.5 h-3.5 text-amber-500" />}
              >
                {t("medicalServices.quickStart")}
              </Button>
            </div>
          ) : undefined
        }
      />

      {/* Add / Edit Drawer */}
      <Drawer
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        size="md"
        title={
          <div className="flex items-center gap-2">
            <span className="font-bold text-ink">
              {isEditMode ? "تعديل الخدمة الطبية" : "إضافة خدمة طبية جديدة"}
            </span>
          </div>
        }
      >
        <form onSubmit={handleFormSubmit} className="flex flex-col gap-4 text-xs">
          {/* Service Name */}
          <div>
            <label className="text-[11px] font-semibold text-slate-dark block mb-1">
              اسم الخدمة *
            </label>
            <Input
              value={formData.name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="مثال: رسم قلب، كشف جديد، غيار على جرح..."
              required
            />
            {fieldErrors.name && (
              <span className="text-[11px] text-status-error mt-0.5 block">
                {fieldErrors.name}
              </span>
            )}
          </div>

          {/* Procedure Code */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-semibold text-slate-dark block">
                كود الخدمة *
              </label>
              {!isEditMode && (
                <span className="text-[10px] text-slate-muted">
                  (يتم اقتراحه تلقائياً وقابل للتعديل)
                </span>
              )}
            </div>
            <Input
              value={formData.code}
              onChange={(e) => {
                setCodeManuallyEdited(true);
                setFormData((prev) => ({
                  ...prev,
                  code: e.target.value.toUpperCase(),
                }));
                if (fieldErrors.code) {
                  setFieldErrors((prev) => ({ ...prev, code: "" }));
                }
              }}
              placeholder="مثال: ECG-01, CONS-01"
              required
            />
            {fieldErrors.code && (
              <span className="text-[11px] text-status-error mt-0.5 block font-medium">
                {fieldErrors.code}
              </span>
            )}
          </div>

          {/* Category with autocomplete datalist */}
          <div>
            <label className="text-[11px] font-semibold text-slate-dark block mb-1">
              الفئة *
            </label>
            <input
              list="service-categories-list"
              value={formData.category}
              onChange={(e) => {
                setFormData((prev) => ({ ...prev, category: e.target.value }));
                if (fieldErrors.category) {
                  setFieldErrors((prev) => ({ ...prev, category: "" }));
                }
              }}
              placeholder="اختر فئة سابقة أو اكتب فئة جديدة..."
              className="w-full px-3 py-2 text-xs rounded-md bg-paper border border-border-subtle text-ink placeholder:text-slate-light focus:outline-none focus:ring-1 focus:ring-teal-primary focus:border-teal-primary"
              required
            />
            <datalist id="service-categories-list">
              {categoriesData?.data?.map((cat) => (
                <option key={cat} value={cat} />
              ))}
              <option value="استشارات" />
              <option value="فحوصات" />
              <option value="إجراءات" />
              <option value="تمريض" />
              <option value="جراحة صغرى" />
            </datalist>
            {fieldErrors.category && (
              <span className="text-[11px] text-status-error mt-0.5 block">
                {fieldErrors.category}
              </span>
            )}
          </div>

          {/* Price & Duration */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-slate-dark block mb-1">
                السعر (ج.م) *
              </label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={formData.price}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    price: parseFloat(e.target.value) || 0,
                  }))
                }
                required
              />
              {fieldErrors.price && (
                <span className="text-[11px] text-status-error mt-0.5 block">
                  {fieldErrors.price}
                </span>
              )}
            </div>
            <div>
              <label className="text-[11px] font-semibold text-slate-dark block mb-1">
                المدة التقريبية (دقيقة) *
              </label>
              <Input
                type="number"
                min="1"
                max="600"
                value={formData.duration}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    duration: parseInt(e.target.value, 10) || 1,
                  }))
                }
                required
              />
              {fieldErrors.duration && (
                <span className="text-[11px] text-status-error mt-0.5 block">
                  {fieldErrors.duration}
                </span>
              )}
            </div>
          </div>

          {/* Status (In Edit Mode) */}
          {isEditMode && (
            <div className="flex items-center justify-between p-3 bg-paper rounded-lg border border-border-subtle">
              <div>
                <span className="font-semibold text-ink block">حالة الخدمة</span>
                <span className="text-[11px] text-slate-muted">
                  {formData.isActive ? "الخدمة مفعلة ومتاحة للاختيار" : "الخدمة معطلة مؤقتاً"}
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, isActive: e.target.checked }))
                  }
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-border-subtle peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-teal-primary" />
              </label>
            </div>
          )}

          {/* Description */}
          <div>
            <label className="text-[11px] font-semibold text-slate-dark block mb-1">
              الوصف الإكلينيكي / ملاحظات التحضير
            </label>
            <Textarea
              rows={2}
              value={formData.description}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, description: e.target.value }))
              }
              placeholder="تعليمات أو تحضيرات خاصة بالخدمة للمريض أو التمريض..."
            />
          </div>

          {/* Internal Notes */}
          <div>
            <label className="text-[11px] font-semibold text-slate-dark block mb-1">
              ملاحظات داخلية للعيادة
            </label>
            <Textarea
              rows={2}
              value={formData.notes}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, notes: e.target.value }))
              }
              placeholder="ملاحظات تنظيمية خاصة بالطاقم الطبي..."
            />
          </div>

          {/* Audit Info in Edit Mode */}
          {isEditMode && editingService && (
            <div className="p-3 bg-paper rounded-lg border border-border-subtle flex flex-col gap-1.5 text-[11px] text-slate-muted">
              <div className="flex items-center gap-1.5 font-medium text-slate-dark">
                <LuHistory className="w-3.5 h-3.5 text-teal-primary" />
                <span>معلومات التدقيق والتعديل:</span>
              </div>
              <div>
                تاريخ الإنشاء:{" "}
                <span className="font-mono text-ink">
                  {new Date(editingService.createdAt).toLocaleString("ar-EG")}
                </span>
              </div>
              {editingService.updatedBy && (
                <div>
                  آخر تعديل بواسطة:{" "}
                  <span className="font-medium text-ink">
                    {typeof editingService.updatedBy === "object"
                      ? `${editingService.updatedBy.firstName || ""} ${editingService.updatedBy.lastName || ""}`.trim()
                      : "المستخدم"}
                  </span>{" "}
                  في{" "}
                  <span className="font-mono text-ink">
                    {new Date(editingService.updatedAt).toLocaleString("ar-EG")}
                  </span>
                </div>
              )}

              {/* Price history */}
              {editingService.priceHistory && editingService.priceHistory.length > 0 && (
                <div className="mt-1 pt-1 border-t border-border-subtle">
                  <span className="block font-semibold text-slate-dark mb-1">
                    سجل تغير الأسعار ({editingService.priceHistory.length}):
                  </span>
                  <div className="max-h-24 overflow-y-auto space-y-1">
                    {editingService.priceHistory.map((ph, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between text-[10px] text-slate-muted bg-surface px-2 py-0.5 rounded"
                      >
                        <span className="font-mono font-bold text-teal-dark">
                          {ph.price} ج.م
                        </span>
                        <span className="font-mono text-slate-light">
                          {new Date(ph.changedAt).toLocaleDateString("ar-EG")}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border-subtle mt-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setIsFormOpen(false)}
            >
              {t("common.cancel")}
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isCreating || isUpdating}
              disabled={isCreating || isUpdating}
              leftIcon={<LuCircleCheck className="w-3.5 h-3.5" />}
            >
              {isEditMode ? "حفظ التعديلات" : "إضافة الخدمة"}
            </Button>
          </div>
        </form>
      </Drawer>

      {/* Deactivate Confirmation Modal */}
      <Modal
        isOpen={Boolean(deactivateTarget)}
        onClose={() => setDeactivateTarget(null)}
        title={t("medicalServices.confirmDeactivate")}
      >
        <div className="flex flex-col gap-4 text-xs">
          <p className="text-slate-muted">
            هل أنت متأكد من رغبتك في إلغاء تفعيل الخدمة{" "}
            <strong className="text-ink">{deactivateTarget?.name}</strong> (
            <span className="font-mono">{deactivateTarget?.code}</span>)؟
          </p>
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-md text-amber-800 dark:text-amber-300 text-[11px] leading-relaxed">
            {t("medicalServices.activateNotice")}
          </div>
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border-subtle">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setDeactivateTarget(null)}
            >
              {t("common.cancel")}
            </Button>
            <Button
              variant="danger"
              size="sm"
              isLoading={isDeactivating}
              onClick={handleConfirmDeactivate}
            >
              {t("medicalServices.confirmDeactivate")}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Activate Confirmation Modal */}
      <Modal
        isOpen={Boolean(activateTarget)}
        onClose={() => setActivateTarget(null)}
        title={t("medicalServices.confirmActivate")}
      >
        <div className="flex flex-col gap-4 text-xs">
          <p className="text-slate-muted">
            هل ترغب في إعادة تفعيل الخدمة الطبية{" "}
            <strong className="text-ink">{activateTarget?.name}</strong> (
            <span className="font-mono">{activateTarget?.code}</span>) لتصبح
            متاحة مجدداً في تسجيل الزيارات والفواتير؟
          </p>
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border-subtle">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setActivateTarget(null)}
            >
              {t("common.cancel")}
            </Button>
            <Button
              variant="primary"
              size="sm"
              isLoading={isActivating}
              onClick={handleConfirmActivate}
            >
              {t("medicalServices.confirmActivate")}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Quick-Start Templates Modal */}
      <Modal
        isOpen={isQuickStartOpen}
        onClose={() => setIsQuickStartOpen(false)}
        size="lg"
        title="إضافة خدمات مقترحة جاهزة (Quick Start)"
        subtitle="حدد الخدمات التي تقدمها عيادتك وعدل الأسعار حسب رغبتك قبل الإضافة"
      >
        <div className="flex flex-col gap-4 text-xs">
          <div className="border border-border-subtle rounded-md overflow-hidden max-h-96 overflow-y-auto">
            <table className="w-full text-xs text-right">
              <thead className="bg-paper border-b border-border-subtle text-slate-muted font-medium sticky top-0">
                <tr>
                  <th className="py-2 px-3 text-center w-10">اختر</th>
                  <th className="py-2 px-3">الخدمة</th>
                  <th className="py-2 px-3">الكود</th>
                  <th className="py-2 px-3">الفئة</th>
                  <th className="py-2 px-3 w-28">السعر (ج.م)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {selectedTemplates.map((item, idx) => (
                  <tr key={item.code} className={item.selected ? "bg-teal-subtle/10" : "opacity-60"}>
                    <td className="py-2 px-3 text-center">
                      <input
                        type="checkbox"
                        checked={item.selected}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setSelectedTemplates((prev) =>
                            prev.map((t, i) => (i === idx ? { ...t, selected: checked } : t))
                          );
                        }}
                        className="rounded border-border-subtle text-teal-primary focus:ring-teal-primary"
                      />
                    </td>
                    <td className="py-2 px-3 font-semibold text-ink">
                      {item.name}
                    </td>
                    <td className="py-2 px-3 font-mono text-slate-dark">
                      {item.code}
                    </td>
                    <td className="py-2 px-3">
                      <Badge variant="neutral" size="sm">
                        {item.category}
                      </Badge>
                    </td>
                    <td className="py-2 px-3">
                      <input
                        type="number"
                        min="0"
                        step="5"
                        disabled={!item.selected}
                        value={item.price}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          setSelectedTemplates((prev) =>
                            prev.map((t, i) => (i === idx ? { ...t, price: val } : t))
                          );
                        }}
                        className="w-24 px-2 py-1 text-xs rounded border border-border-subtle bg-paper text-ink font-mono font-bold"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-border-subtle">
            <span className="text-slate-muted">
              تم تحديد{" "}
              <strong className="text-ink">
                {selectedTemplates.filter((t) => t.selected).length}
              </strong>{" "}
              خدمة
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setIsQuickStartOpen(false)}
              >
                {t("common.cancel")}
              </Button>
              <Button
                variant="primary"
                size="sm"
                isLoading={isBulkSaving}
                onClick={handleSaveQuickStart}
                leftIcon={<LuCircleCheck className="w-3.5 h-3.5" />}
              >
                تأكيد وإضافة الخدمات المحددة
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
