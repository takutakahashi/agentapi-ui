'use client'

import { OneClickPushNotifications } from '@/app/components/OneClickPushNotifications'

export default function NotificationsSettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          プッシュ通知
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          プッシュ通知の設定を管理します
        </p>
      </div>

      <OneClickPushNotifications />
    </div>
  )
}
