import { AlertCircle, AlertTriangle, Info } from "lucide-react";
import { Button } from "./Button";
import { Modal } from "./Modal";

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "warning" | "info";
  isLoading?: boolean;
}

export const ConfirmDialog = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "danger",
  isLoading = false,
}: ConfirmDialogProps) => {
  const variants = {
    danger: {
      icon: AlertCircle,
      color: "text-red-500",
      bg: "bg-red-500/10",
      btn: "bg-red-500 hover:bg-red-600 text-white shadow-sm",
    },
    warning: {
      icon: AlertTriangle,
      color: "text-amber-500",
      bg: "bg-amber-500/10",
      btn: "bg-amber-500 hover:bg-amber-600 text-white shadow-sm",
    },
    info: {
      icon: Info,
      color: "text-blue-500",
      bg: "bg-blue-500/10",
      btn: "bg-blue-500 hover:bg-blue-600 text-white shadow-sm",
    },
  };

  const currentVariant = variants[variant];
  const Icon = currentVariant.icon;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="space-y-4">
        <div className="flex gap-4">
          <div
            className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${currentVariant.bg} ${currentVariant.color}`}
          >
            <Icon size={20} />
          </div>
          <div className="space-y-2 pt-1">
            <p className="text-sm text-muted-foreground leading-relaxed">
              {description}
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button
            variant="ghost"
            onClick={onClose}
            disabled={isLoading}
            size="sm"
            className="h-9"
          >
            {cancelText}
          </Button>
          <Button
            onClick={onConfirm}
            isLoading={isLoading}
            size="sm"
            className={`h-9 px-4 ${currentVariant.btn}`}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
