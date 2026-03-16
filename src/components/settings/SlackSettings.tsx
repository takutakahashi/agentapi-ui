"use client";

import React from "react";

interface SlackSettingsProps {
  slackUserId?: string;
  onChange: (slackUserId: string) => void;
}

export function SlackSettings({ slackUserId, onChange }: SlackSettingsProps) {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
          Slack User ID を設定すると、通知を Slack DM で受け取れます。
          Slack User ID は Slack のプロフィールページから確認できます（例: U012AB3CD）。
        </p>
      </div>
      <div>
        <label
          htmlFor="slack-user-id"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          Slack User ID
        </label>
        <input
          id="slack-user-id"
          type="text"
          value={slackUserId || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder="U012AB3CD"
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm font-mono"
        />
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          空欄にすると Slack 通知が無効になります。
        </p>
      </div>
    </div>
  );
}
