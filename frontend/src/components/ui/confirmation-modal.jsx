import * as React from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2 } from "lucide-react";

/**
 * Reusable confirmation modal component
 *
 * @param {Object} props
 * @param {boolean} props.open - Whether the modal is open
 * @param {function} props.onOpenChange - Callback when open state changes
 * @param {string} props.title - Modal title
 * @param {string} props.description - Modal description
 * @param {React.ReactNode} props.children - Optional additional content
 * @param {string} props.confirmText - Text for confirm button (default: "Confirm")
 * @param {string} props.cancelText - Text for cancel button (default: "Cancel")
 * @param {function} props.onConfirm - Callback when confirmed
 * @param {function} props.onCancel - Callback when cancelled
 * @param {boolean} props.loading - Whether action is in progress
 * @param {string} props.variant - "default" | "destructive" (default: "default")
 */
const ConfirmationModal = ({
  open,
  onOpenChange,
  title,
  description,
  children,
  confirmText = "Confirm",
  cancelText = "Cancel",
  onConfirm,
  onCancel,
  loading = false,
  variant = "default",
}) => {
  const handleCancel = () => {
    onCancel?.();
    onOpenChange?.(false);
  };

  const handleConfirm = async () => {
    await onConfirm?.();
  };

  const confirmButtonClass =
    variant === "destructive"
      ? "bg-red-600 hover:bg-red-700 text-white focus:ring-red-600"
      : "bg-green-900 hover:bg-green-800 text-white focus:ring-green-900";

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="rounded-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle className={`font-heading text-xl ${variant === "destructive" ? "text-red-600" : "text-green-900"}`}>
            {title}
          </AlertDialogTitle>
          {description && (
            <AlertDialogDescription className="text-stone-600">
              {description}
            </AlertDialogDescription>
          )}
        </AlertDialogHeader>
        {children && <div className="py-2">{children}</div>}
        <AlertDialogFooter className="gap-3 sm:gap-3">
          <AlertDialogCancel
            onClick={handleCancel}
            disabled={loading}
            className="rounded-full"
          >
            {cancelText}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={loading}
            className={`rounded-full ${confirmButtonClass}`}
          >
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {loading ? "Please wait..." : confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export { ConfirmationModal };
