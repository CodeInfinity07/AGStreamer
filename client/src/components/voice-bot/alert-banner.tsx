import { AlertCircle, AlertTriangle, Info, CheckCircle2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type AlertType = "info" | "warning" | "error" | "success" | "loading";

interface AlertBannerProps {
  type: AlertType;
  title?: string;
  message: string;
  className?: string;
}

const alertConfig = {
  info: {
    icon: Info,
    className: "bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-800",
  },
  warning: {
    icon: AlertTriangle,
    className: "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800",
  },
  error: {
    icon: AlertCircle,
    className: "bg-red-50 text-red-800 border-red-200 dark:bg-red-950/30 dark:text-red-300 dark:border-red-800",
  },
  success: {
    icon: CheckCircle2,
    className: "bg-green-50 text-green-800 border-green-200 dark:bg-green-950/30 dark:text-green-300 dark:border-green-800",
  },
  loading: {
    icon: Loader2,
    className: "bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-800",
    iconClassName: "animate-spin",
  },
};

export function AlertBanner({ type, title, message, className }: AlertBannerProps) {
  const config = alertConfig[type];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        "flex items-start gap-3 p-4 rounded-lg border text-sm leading-relaxed",
        config.className,
        className
      )}
      role="alert"
      data-testid={`alert-${type}`}
    >
      <Icon 
        className={cn(
          "w-5 h-5 shrink-0 mt-0.5", 
          "iconClassName" in config && config.iconClassName
        )} 
      />
      <div className="flex-1">
        {title && (
          <p className="font-semibold mb-1">{title}</p>
        )}
        <p>{message}</p>
      </div>
    </div>
  );
}
