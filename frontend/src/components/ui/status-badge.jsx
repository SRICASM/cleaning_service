import * as React from "react";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";
import {
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertCircle,
  CreditCard,
  CircleDashed,
} from "lucide-react";

const statusBadgeVariants = cva(
  "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors",
  {
    variants: {
      status: {
        // Booking statuses
        pending: "bg-amber-50 text-amber-700 border border-amber-200",
        confirmed: "bg-blue-50 text-blue-700 border border-blue-200",
        in_progress: "bg-purple-50 text-purple-700 border border-purple-200",
        completed: "bg-green-50 text-green-700 border border-green-200",
        cancelled: "bg-stone-100 text-stone-500 border border-stone-200",
        // Payment statuses
        paid: "bg-emerald-50 text-emerald-700 border border-emerald-200",
        unpaid: "bg-red-50 text-red-600 border border-red-200",
        refunded: "bg-orange-50 text-orange-700 border border-orange-200",
        // User statuses
        active: "bg-green-50 text-green-700 border border-green-200",
        inactive: "bg-stone-100 text-stone-500 border border-stone-200",
        suspended: "bg-red-50 text-red-600 border border-red-200",
      },
      size: {
        sm: "text-xs px-2 py-0.5",
        default: "text-xs px-3 py-1",
        lg: "text-sm px-4 py-1.5",
      },
    },
    defaultVariants: {
      status: "pending",
      size: "default",
    },
  }
);

const statusIcons = {
  pending: Clock,
  confirmed: CheckCircle2,
  in_progress: Loader2,
  completed: CheckCircle2,
  cancelled: XCircle,
  paid: CreditCard,
  unpaid: AlertCircle,
  refunded: CreditCard,
  active: CheckCircle2,
  inactive: CircleDashed,
  suspended: XCircle,
};

const statusLabels = {
  pending: "Pending",
  confirmed: "Confirmed",
  in_progress: "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
  paid: "Paid",
  unpaid: "Unpaid",
  refunded: "Refunded",
  active: "Active",
  inactive: "Inactive",
  suspended: "Suspended",
};

/**
 * Standardized status badge component
 *
 * @param {Object} props
 * @param {string} props.status - The status to display
 * @param {string} props.size - "sm" | "default" | "lg"
 * @param {boolean} props.showIcon - Whether to show the status icon
 * @param {string} props.label - Custom label (overrides default)
 * @param {string} props.className - Additional classes
 */
function StatusBadge({
  status,
  size = "default",
  showIcon = true,
  label,
  className,
  ...props
}) {
  const Icon = statusIcons[status] || AlertCircle;
  const displayLabel = label || statusLabels[status] || status;
  const isAnimated = status === "in_progress";

  return (
    <div
      className={cn(statusBadgeVariants({ status, size }), className)}
      {...props}
    >
      {showIcon && (
        <Icon
          className={cn(
            size === "sm" ? "w-3 h-3" : size === "lg" ? "w-4 h-4" : "w-3.5 h-3.5",
            isAnimated && "animate-spin"
          )}
        />
      )}
      <span>{displayLabel}</span>
    </div>
  );
}

export { StatusBadge, statusBadgeVariants };
