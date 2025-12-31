"use client"

import { useRouter } from "next/navigation"
import { useState, useEffect, useRef } from "react"
import {
  LogOut,
  Filter,
  Plus,
  Bell,
  Settings,
  Loader2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { OneClickPushNotifications } from "./OneClickPushNotifications"

interface TopBarProps {
  title: string
  subtitle?: string
  showFilterButton?: boolean
  filterButtonText?: string
  onFilterToggle?: () => void
  showSettingsButton?: boolean
  showPushNotificationButton?: boolean
  showLogoutButton?: boolean
  showNewSessionButton?: boolean
  onNewSession?: () => void
  children?: React.ReactNode
}

export default function TopBar({
  title,
  subtitle,
  showFilterButton = false,
  filterButtonText = "Filter",
  onFilterToggle,
  showSettingsButton = true,
  showPushNotificationButton = true,
  showLogoutButton = true,
  showNewSessionButton = false,
  onNewSession,
  children,
}: TopBarProps) {
  const router = useRouter()
  const [showPushNotificationPopover, setShowPushNotificationPopover] =
    useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)

  const handleLogout = async () => {
    if (loggingOut) return
    setLoggingOut(true)
    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
      })
      if (response.ok) {
        router.push("/login")
      }
    } catch (error) {
      console.error("Logout failed:", error)
    } finally {
      setLoggingOut(false)
    }
  }

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node)
      ) {
        setShowPushNotificationPopover(false)
      }
    }

    if (showPushNotificationPopover) {
      document.addEventListener("mousedown", handleClickOutside)
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [showPushNotificationPopover])

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="px-4 md:px-6 lg:px-8 py-3 md:py-4">
        <div className="flex items-center justify-between gap-4">
          {/* Title section */}
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight truncate">
              {title}
            </h1>
            {subtitle && (
              <p className="text-sm text-muted-foreground mt-0.5 truncate">
                {subtitle}
              </p>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Filter button */}
            {showFilterButton && onFilterToggle && (
              <Button variant="secondary" size="sm" onClick={onFilterToggle}>
                <Filter className="h-4 w-4" />
                <span className="hidden sm:inline ml-2">{filterButtonText}</span>
              </Button>
            )}

            {/* New session button */}
            {showNewSessionButton && onNewSession && (
              <Button size="sm" onClick={onNewSession}>
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline ml-2">New Session</span>
              </Button>
            )}

            {/* Push notification button */}
            {showPushNotificationButton && (
              <div className="relative" ref={popoverRef}>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() =>
                    setShowPushNotificationPopover(!showPushNotificationPopover)
                  }
                  aria-label="Push notifications"
                  className={cn(
                    showPushNotificationPopover && "bg-accent"
                  )}
                >
                  <Bell className="h-5 w-5" />
                </Button>

                {showPushNotificationPopover && (
                  <div className="absolute right-0 mt-2 w-80 z-50 animate-fade-in">
                    <OneClickPushNotifications />
                  </div>
                )}
              </div>
            )}

            {/* Settings button */}
            {showSettingsButton && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => router.push("/settings")}
                aria-label="Settings"
              >
                <Settings className="h-5 w-5" />
              </Button>
            )}

            {/* Logout button */}
            {showLogoutButton && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleLogout}
                disabled={loggingOut}
                aria-label="Logout"
                className="hover:text-destructive"
              >
                {loggingOut ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <LogOut className="h-5 w-5" />
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Additional content */}
        {children && <div className="mt-3">{children}</div>}
      </div>
    </header>
  )
}
