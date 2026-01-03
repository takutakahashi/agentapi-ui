"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Users, Plus, Trash2, Shield } from "lucide-react"

export default function TeamSettingsPage() {
  return (
    <ScrollArea className="h-full">
      <div className="p-6 max-w-2xl space-y-8">
        <div>
          <h2 className="text-lg font-semibold mb-1">Team Settings</h2>
          <p className="text-sm text-muted-foreground">
            Manage team access and collaboration
          </p>
        </div>

        <Separator />

        {/* Team Members Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-muted-foreground" />
              <h3 className="font-medium">Team Members</h3>
            </div>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Member
            </Button>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-sm font-medium">JD</span>
                </div>
                <div>
                  <p className="text-sm font-medium">John Doe</p>
                  <p className="text-xs text-muted-foreground">john@example.com</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">Admin</Badge>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-sm font-medium">JS</span>
                </div>
                <div>
                  <p className="text-sm font-medium">Jane Smith</p>
                  <p className="text-xs text-muted-foreground">jane@example.com</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">Member</Badge>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        <Separator />

        {/* Permissions Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-muted-foreground" />
            <h3 className="font-medium">Permissions</h3>
          </div>
          <div className="p-4 border rounded-lg bg-muted/30">
            <p className="text-sm text-muted-foreground">
              Team permissions and roles management coming soon.
            </p>
          </div>
        </div>
      </div>
    </ScrollArea>
  )
}
