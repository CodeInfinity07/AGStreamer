import { Loader2, CheckCircle2, XCircle, AlertCircle, Wifi, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { ConnectionStatus, type ConnectionStatusType, type NetworkQualityType, NetworkQuality } from "@shared/schema";

interface StatusDisplayProps {
  status: ConnectionStatusType;
  networkQuality?: NetworkQualityType;
}

const statusConfig = {
  [ConnectionStatus.DISCONNECTED]: {
    icon: WifiOff,
    label: "Disconnected",
    className: "bg-muted text-muted-foreground",
  },
  [ConnectionStatus.CONNECTING]: {
    icon: Loader2,
    label: "Connecting...",
    className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    iconClassName: "animate-spin",
  },
  [ConnectionStatus.CONNECTED]: {
    icon: CheckCircle2,
    label: "Connected",
    className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  },
  [ConnectionStatus.RECONNECTING]: {
    icon: Loader2,
    label: "Reconnecting...",
    className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    iconClassName: "animate-spin",
  },
  [ConnectionStatus.ERROR]: {
    icon: XCircle,
    label: "Connection Error",
    className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  },
};

function getNetworkQualityInfo(quality: NetworkQualityType) {
  switch (quality) {
    case NetworkQuality.EXCELLENT:
      return { label: "Excellent", bars: 4, color: "text-green-500" };
    case NetworkQuality.GOOD:
      return { label: "Good", bars: 3, color: "text-green-500" };
    case NetworkQuality.POOR:
      return { label: "Poor", bars: 2, color: "text-amber-500" };
    case NetworkQuality.BAD:
      return { label: "Bad", bars: 1, color: "text-red-500" };
    case NetworkQuality.VERY_BAD:
    case NetworkQuality.DOWN:
      return { label: "Critical", bars: 0, color: "text-red-500" };
    default:
      return { label: "Unknown", bars: -1, color: "text-muted-foreground" };
  }
}

function NetworkBars({ quality }: { quality: NetworkQualityType }) {
  const info = getNetworkQualityInfo(quality);
  
  if (info.bars === -1) return null;
  
  return (
    <div 
      className="flex items-end gap-0.5 ml-3" 
      title={`Network: ${info.label}`}
      data-testid="network-quality-indicator"
    >
      {[1, 2, 3, 4].map((bar) => (
        <div
          key={bar}
          className={cn(
            "w-1 rounded-sm transition-colors",
            bar <= info.bars ? info.color.replace("text-", "bg-") : "bg-muted"
          )}
          style={{ height: `${bar * 3 + 4}px` }}
        />
      ))}
    </div>
  );
}

export function StatusDisplay({ status, networkQuality = NetworkQuality.UNKNOWN }: StatusDisplayProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        "flex items-center justify-center h-14 rounded-lg px-6 font-semibold transition-colors",
        config.className
      )}
      data-testid="status-display"
    >
      <Icon className={cn("w-5 h-5 mr-2", config.iconClassName)} />
      <span data-testid="status-text">{config.label}</span>
      {status === ConnectionStatus.CONNECTED && (
        <NetworkBars quality={networkQuality} />
      )}
    </div>
  );
}
