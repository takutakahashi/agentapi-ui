"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Save, Key, Bell, Palette, Moon, Sun, Monitor } from "lucide-react"

export default function PersonalSettingsPage() {
  const [theme, setTheme] = React.useState<"light" | "dark" | "system">("system")
  const [notifications, setNotifications] = React.useState(true)

  return (
    <ScrollArea className="h-full">
      <div className="p-6 max-w-2xl space-y-8">
        <div>
          <h2 className="text-lg font-semibold mb-1">Personal Settings</h2>
          <p className="text-sm text-muted-foreground">
            Configure your personal preferences
          </p>
        </div>

        <Separator />

        {/* API Key Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Key className="h-5 w-5 text-muted-foreground" />
            <h3 className="font-medium">API Key</h3>
          </div>
          <div className="space-y-2">
            <Input
              type="password"
              placeholder="Enter your API key"
              className="max-w-md"
            />
            <p className="text-xs text-muted-foreground">
              Your API key is stored locally and encrypted
            </p>
          </div>
        </div>

        <Separator />

        {/* Theme Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Palette className="h-5 w-5 text-muted-foreground" />
            <h3 className="font-medium">Appearance</h3>
          </div>
          <div className="flex gap-2">
            {[
              { value: "light" as const, icon: Sun, label: "Light" },
              { value: "dark" as const, icon: Moon, label: "Dark" },
              { value: "system" as const, icon: Monitor, label: "System" },
            ].map((option) => (
              <Button
                key={option.value}
                variant={theme === option.value ? "default" : "outline"}
                size="sm"
                onClick={() => setTheme(option.value)}
                className="gap-2"
              >
                <option.icon className="h-4 w-4" />
                {option.label}
              </Button>
            ))}
          </div>
        </div>

        <Separator />

        {/* Notifications Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-muted-foreground" />
            <h3 className="font-medium">Notifications</h3>
          </div>
          <div className="flex items-center justify-between max-w-md">
            <div>
              <p className="text-sm font-medium">Push Notifications</p>
              <p className="text-xs text-muted-foreground">
                Receive notifications for session updates
              </p>
            </div>
            <Button
              variant={notifications ? "default" : "outline"}
              size="sm"
              onClick={() => setNotifications(!notifications)}
            >
              {notifications ? "Enabled" : "Disabled"}
            </Button>
          </div>
        </div>

        <Separator />

        <div className="flex justify-end">
          <Button>
            <Save className="h-4 w-4 mr-2" />
            Save Changes
          </Button>
        </div>
      </div>
    </ScrollArea>
  )
}
