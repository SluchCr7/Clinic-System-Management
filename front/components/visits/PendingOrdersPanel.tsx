"use client";

import React, { useState } from "react";
import {
  useGetPendingOrdersByPatientQuery,
  useUpdateLabOrderItemMutation,
} from "@/services/api/labOrderApi";
import type { PendingOrderItem, LabOrderItem } from "@/types/labOrder";
import { Button, Badge, Skeleton, toast } from "@/components/ui";
import { UpdateLabOrderStatusModal } from "@/components/lab-orders/UpdateLabOrderStatusModal";
import { extractApiError } from "@/services/api/baseQuery";
import {
  LuClock,
  LuFlaskConical,
  LuScanLine,
  LuCheck,
  LuSquarePen,
  LuTriangleAlert,
  LuCalendar,
} from "react-icons/lu";

interface PendingOrdersPanelProps {
  patientId: string;
  currentVisitId?: string;
  patientName?: string;
  isDoctor: boolean;
}

export const PendingOrdersPanel: React.FC<PendingOrdersPanelProps> = ({
  patientId,
  currentVisitId,
  patientName,
  isDoctor,
}) => {
  const { data, isLoading, refetch } = useGetPendingOrdersByPatientQuery(
    { patientId, currentVisitId },
    { skip: !patientId }
  );

  const [updateItem, { isLoading: isUpdating }] = useUpdateLabOrderItemMutation();
  const [activeItem, setActiveItem] = useState<LabOrderItem | null>(null);

  const pendingItems: PendingOrderItem[] = data?.data || [];

  if (isLoading) {
    return <Skeleton className="h-20 w-full rounded-xl" />;
  }

  if (pendingItems.length === 0) {
    return null;
  }

  const handleQuickReceive = async (itemId: string, itemName: string) => {
    try {
      await updateItem({
        id: itemId,
        data: {
          status: "received",
          receivedAt: new Date().toISOString(),
        },
      }).unwrap();
      toast.success(`تم استلام نتيجة "${itemName}" بنجاح`);
      refetch();
    } catch (err) {
      const errInfo = extractApiError(err);
      toast.error(errInfo.message || "فشل تسجيل استلام النتيجة");
    }
  };

  return (
    <>
      <div className="bg-amber-500/10 border-2 border-amber-500/40 rounded-xl p-4 shadow-sm flex flex-col gap-3">
        {/* Panel Header */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-500 flex items-center justify-center shrink-0">
              <LuClock className="w-5 h-5 animate-spin-slow" />
            </div>
            <div className="flex flex-col">
              <h4 className="font-bold text-amber-300 text-sm flex items-center gap-2">
                <span>طلبات سابقة بانتظار النتائج ({pendingItems.length})</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-500 text-slate-950 font-black">
                  مهم للمتابعة
                </span>
              </h4>
              <p className="text-xs text-slate-300 mt-0.5">
                توجد فحوصات مخبرية أو أشعة مطلوبة لهذا المريض في زيارات سابقة ولم تُسجل نتائجها بعد.
              </p>
            </div>
          </div>
        </div>

        {/* Pending Items List */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-1">
          {pendingItems.map((item) => {
            const isLab = item.type === "lab";
            const orderDate = item.visitDate || item.orderedAt;
            const formattedDate = orderDate
              ? new Date(orderDate).toLocaleDateString("ar-EG", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })
              : "زيارة سابقة";

            return (
              <div
                key={item.itemId}
                className="bg-surface/80 border border-amber-500/30 rounded-lg p-3 flex items-center justify-between gap-3 text-xs"
              >
                {/* Left: Item Info */}
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`p-2 rounded-md shrink-0 ${
                      isLab
                        ? "bg-teal-primary/15 text-teal-primary"
                        : "bg-purple-500/15 text-purple-400"
                    }`}
                  >
                    {isLab ? (
                      <LuFlaskConical className="w-4 h-4" />
                    ) : (
                      <LuScanLine className="w-4 h-4" />
                    )}
                  </div>

                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-ink truncate">{item.name}</span>
                      {item.code && (
                        <span className="font-mono text-[9px] text-slate-muted bg-paper px-1 rounded">
                          {item.code}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-[10px] text-slate-muted mt-0.5">
                      <span className="flex items-center gap-1">
                        <LuCalendar className="w-3 h-3" />
                        {formattedDate}
                      </span>
                      {item.priority === "urgent" && (
                        <span className="text-amber-400 font-bold">• عاجل</span>
                      )}
                      {item.labName && <span>• {item.labName}</span>}
                    </div>
                  </div>
                </div>

                {/* Right: Quick Action (Doctor Only) */}
                {isDoctor && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={isUpdating}
                      onClick={() => handleQuickReceive(item.itemId, item.name)}
                      leftIcon={<LuCheck className="w-3.5 h-3.5" />}
                      className="text-[11px] py-1 px-2.5 h-7"
                    >
                      استلام سريع
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setActiveItem({
                          _id: item.itemId,
                          name: item.name,
                          type: item.type,
                          status: "ordered",
                          code: item.code,
                          labName: item.labName,
                          resultNotes: item.resultNotes,
                        } as LabOrderItem)
                      }
                      leftIcon={<LuSquarePen className="w-3.5 h-3.5" />}
                      className="text-[11px] py-1 px-2 h-7"
                    >
                      تسجيل
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Doctor Update Modal */}
      {activeItem && (
        <UpdateLabOrderStatusModal
          isOpen={Boolean(activeItem)}
          onClose={() => setActiveItem(null)}
          item={activeItem}
          patientName={patientName}
          onSuccess={() => refetch()}
        />
      )}
    </>
  );
};

export default PendingOrdersPanel;
