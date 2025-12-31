import {
  RefreshCw,
  CheckCircle,
  XCircle,
  Pause,
  StopCircle,
  Circle,
  Loader2,
  Rocket,
  AlertCircle,
  HelpCircle,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Chat } from "../../types/chat"
import { Session, SessionStatus } from "../../types/agentapi"

interface StatusBadgeProps {
  status: Chat["status"] | Session["status"] | SessionStatus
  variant?: "green" | "yellow" | "red" | "gray"
  className?: string
}

type StatusConfig = {
  bg: string
  text: string
  border: string
  icon: React.ReactNode
  label: string
  animate?: boolean
}

export default function StatusBadge({
  status,
  className = "",
}: StatusBadgeProps) {
  const getStatusConfig = (
    status: Chat["status"] | Session["status"] | SessionStatus
  ): StatusConfig => {
    const iconSize = "h-3.5 w-3.5"

    switch (status) {
      // Chat statuses
      case "running":
        return {
          bg: "bg-warning/10",
          text: "text-warning-foreground dark:text-warning",
          border: "border-warning/30",
          icon: <RefreshCw className={cn(iconSize, "animate-spin")} />,
          label: "Running",
          animate: true,
        }
      case "completed":
        return {
          bg: "bg-success/10",
          text: "text-success",
          border: "border-success/30",
          icon: <CheckCircle className={iconSize} />,
          label: "Completed",
        }
      case "failed":
        return {
          bg: "bg-destructive/10",
          text: "text-destructive",
          border: "border-destructive/30",
          icon: <XCircle className={iconSize} />,
          label: "Failed",
        }
      case "pending":
        return {
          bg: "bg-muted",
          text: "text-muted-foreground",
          border: "border-border",
          icon: <Pause className={iconSize} />,
          label: "Pending",
        }
      case "cancelled":
        return {
          bg: "bg-muted",
          text: "text-muted-foreground",
          border: "border-border",
          icon: <StopCircle className={iconSize} />,
          label: "Cancelled",
        }
      // Session statuses (API specification)
      case "creating":
        return {
          bg: "bg-primary/10",
          text: "text-primary",
          border: "border-primary/30",
          icon: <Loader2 className={cn(iconSize, "animate-spin")} />,
          label: "Creating",
          animate: true,
        }
      case "starting":
        return {
          bg: "bg-primary/10",
          text: "text-primary",
          border: "border-primary/30",
          icon: <Rocket className={cn(iconSize, "animate-pulse")} />,
          label: "Starting",
          animate: true,
        }
      case "active":
        return {
          bg: "bg-success/10",
          text: "text-success",
          border: "border-success/30",
          icon: <Circle className={cn(iconSize, "fill-success")} />,
          label: "Active",
        }
      case "unhealthy":
        return {
          bg: "bg-destructive/10",
          text: "text-destructive",
          border: "border-destructive/30",
          icon: <AlertCircle className={iconSize} />,
          label: "Unhealthy",
        }
      case "stopped":
        return {
          bg: "bg-muted",
          text: "text-muted-foreground",
          border: "border-border",
          icon: <StopCircle className={iconSize} />,
          label: "Stopped",
        }
      case "unknown":
      default:
        return {
          bg: "bg-muted",
          text: "text-muted-foreground",
          border: "border-border",
          icon: <HelpCircle className={iconSize} />,
          label: "Unknown",
        }
    }
  }

  const config = getStatusConfig(status)

  return (
    <span
      role="status"
      aria-label={`Status: ${config.label}`}
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors",
        config.bg,
        config.text,
        config.border,
        className
      )}
    >
      {config.icon}
      <span>{config.label}</span>
    </span>
  )
}
