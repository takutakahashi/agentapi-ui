'use client'

import { useState, useEffect } from 'react'
import { pushNotificationManager } from '../utils/pushNotification'

export default function PushNotificationSettings() {
  const [isSupported, setIsSupported] = useState(false)
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [isInitializing, setIsInitializing] = useState(false)
  const [initializationStep, setInitializationStep] = useState<string>('')
  const [testTitle, setTestTitle] = useState('Test Notification')
  const [testBody, setTestBody] = useState('This is a test push notification from AgentAPI')
  const [isSendingTest, setIsSendingTest] = useState(false)
  const [testResult, setTestResult] = useState<string | null>(null)

  useEffect(() => {
    setIsSupported(pushNotificationManager.isSupported())
    
    if (pushNotificationManager.isSupported()) {
      checkPermissionAndSubscription()
    }
  }, [])

  const checkPermissionAndSubscription = async () => {
    const perm = await pushNotificationManager.getPermissionStatus()
    setPermission(perm)
    
    const subscription = await pushNotificationManager.getSubscription()
    setIsSubscribed(!!subscription)
  }

  const handleInitialize = async () => {
    setIsInitializing(true)
    setInitializationStep('Starting initialization...')
    setTestResult(null)
    
    try {
      // コンソールログをキャプチャするために少し待つ
      const originalLog = console.log
      const logs: string[] = []
      console.log = (...args) => {
        logs.push(args.join(' '))
        originalLog(...args)
        setInitializationStep(args.join(' '))
      }

      const success = await pushNotificationManager.initialize()
      
      // ログ関数を復元
      console.log = originalLog
      
      if (success) {
        await checkPermissionAndSubscription()
        setTestResult('Push notifications initialized successfully!')
        setInitializationStep('Initialization completed')
      } else {
        setTestResult('Failed to initialize push notifications')
        setInitializationStep('Initialization failed')
      }
    } catch (error) {
      console.error('Initialization error:', error)
      setTestResult(`Error initializing push notifications: ${error}`)
      setInitializationStep('Error occurred')
    } finally {
      setIsInitializing(false)
      setTimeout(() => setInitializationStep(''), 3000)
    }
  }

  const handleUnsubscribe = async () => {
    try {
      const success = await pushNotificationManager.unsubscribe()
      if (success) {
        setIsSubscribed(false)
        setTestResult('Successfully unsubscribed from push notifications')
      } else {
        setTestResult('Failed to unsubscribe')
      }
    } catch (error) {
      console.error('Unsubscribe error:', error)
      setTestResult('Error unsubscribing')
    }
  }

  const handleSendTest = async () => {
    if (!testTitle.trim() || !testBody.trim()) {
      setTestResult('Please enter both title and body for the test notification')
      return
    }

    setIsSendingTest(true)
    setTestResult(null)
    
    try {
      const response = await fetch('/api/push/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: testTitle,
          body: testBody,
        }),
      })

      const result = await response.json()
      
      if (response.ok) {
        setTestResult(`Test notification sent! Delivered to ${result.sentCount} subscribers.`)
      } else {
        setTestResult(`Failed to send test notification: ${result.error}`)
      }
    } catch (error) {
      console.error('Send test error:', error)
      setTestResult('Error sending test notification')
    } finally {
      setIsSendingTest(false)
    }
  }

  const handleLocalTest = async () => {
    try {
      await pushNotificationManager.sendLocalNotification(testTitle, testBody)
      setTestResult('Local test notification sent!')
    } catch (error) {
      console.error('Local test error:', error)
      setTestResult('Error sending local test notification')
    }
  }

  if (!isSupported) {
    return (
      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6">
        <h2 className="text-xl font-semibold text-yellow-900 dark:text-yellow-100 mb-2">
          Push Notifications Not Supported
        </h2>
        <p className="text-sm text-yellow-600 dark:text-yellow-400">
          Your browser does not support push notifications. Please use a modern browser with push notification support.
        </p>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
        Push Notification Settings
      </h2>
      
      <div className="space-y-4">
        {/* Status */}
        <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Permission Status
            </label>
            <span className={`text-sm font-semibold ${
              permission === 'granted' ? 'text-green-600' : 
              permission === 'denied' ? 'text-red-600' : 
              'text-yellow-600'
            }`}>
              {permission}
            </span>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Subscription Status
            </label>
            <span className={`text-sm font-semibold ${isSubscribed ? 'text-green-600' : 'text-gray-600'}`}>
              {isSubscribed ? 'Subscribed' : 'Not Subscribed'}
            </span>
          </div>
        </div>

        {/* Controls */}
        <div className="space-y-3">
          <div className="flex flex-wrap gap-3">
            {permission !== 'granted' || !isSubscribed ? (
              <button
                onClick={handleInitialize}
                disabled={isInitializing}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {isInitializing && (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                )}
                {isInitializing ? 'Initializing...' : 'Enable Push Notifications'}
              </button>
            ) : (
              <button
                onClick={handleUnsubscribe}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
              >
                Disable Push Notifications
              </button>
            )}
          </div>
          
          {/* Initialization Progress */}
          {isInitializing && initializationStep && (
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-sm text-blue-600 dark:text-blue-400">
                {initializationStep}
              </p>
            </div>
          )}
        </div>

        {/* Test Notification */}
        {isSubscribed && (
          <div className="border-t border-gray-200 dark:border-gray-600 pt-4">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">
              Test Notifications
            </h3>
            
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Test Title
                </label>
                <input
                  type="text"
                  value={testTitle}
                  onChange={(e) => setTestTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Test Body
                </label>
                <textarea
                  value={testBody}
                  onChange={(e) => setTestBody(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={handleLocalTest}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                >
                  Send Local Test
                </button>
                
                <button
                  onClick={handleSendTest}
                  disabled={isSendingTest}
                  className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                >
                  {isSendingTest && (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  )}
                  {isSendingTest ? 'Sending...' : 'Send Push Test'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Result */}
        {testResult && (
          <div className={`p-3 rounded-lg text-sm ${
            testResult.includes('Error') || testResult.includes('Failed')
              ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800'
              : 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-800'
          }`}>
            {testResult}
          </div>
        )}
      </div>
    </div>
  )
}