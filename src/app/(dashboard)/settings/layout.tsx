"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { User, Users } from "lucide-react"

const settingsNav = [
  {
    title: "Personal",
    href: "/settings/personal",
    icon: User,
    description: "Your personal settings",
  },
  {
    title: "Team",
    href: "/settings/team",
    icon: Users,
    description: "Team settings and collaboration",
  },
]

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()

  return (
    <div className="flex-1 flex flex-col md:flex-row">
      <aside className="w-full md:w-64 border-b md:border-b-0 md:border-r bg-muted/30">
        <div className="p-4 md:p-6">
          <h1 className="text-xl font-bold mb-1">Settings</h1>
          <p className="text-sm text-muted-foreground">
            Manage your preferences
          </p>
        </div>
        <nav className="px-2 pb-4 md:pb-6">
          {settingsNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                pathname === item.href
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-background/50"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.title}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}
