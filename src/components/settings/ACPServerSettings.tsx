'use client'

interface ACPServerSettingsProps {
  acpServerEnabled: boolean
  onACPServerEnabledChange: (enabled: boolean) => void
}

export function ACPServerSettings({
  acpServerEnabled,
  onACPServerEnabledChange,
}: ACPServerSettingsProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <label
            htmlFor="acpServerEnabled"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            ACP サーバーモードを有効にする
          </label>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            有効にすると、agentapi-proxy の ACP (Agent Client Protocol) サーバー機能を使用します。
            セッションの作成・管理・メッセージ送受信に JSON-RPC 2.0 プロトコルを使用します。
          </p>
        </div>
        <button
          type="button"
          id="acpServerEnabled"
          onClick={() => onACPServerEnabledChange(!acpServerEnabled)}
          className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
            acpServerEnabled ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-600'
          }`}
          role="switch"
          aria-checked={acpServerEnabled}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
              acpServerEnabled ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {acpServerEnabled && (
        <div className="pl-4 border-l-2 border-blue-200 dark:border-blue-700 space-y-3">
          <p className="text-sm text-gray-700 dark:text-gray-300 font-medium">ACP サーバーモードの動作</p>
          <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1 list-disc list-inside">
            <li>セッション作成: <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">POST /acp</code> (<code>session/new</code>)</li>
            <li>セッション一覧: <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">POST /acp</code> (<code>session/list</code>)</li>
            <li>メッセージ送信: <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">POST /acp</code> (<code>session/prompt</code>)</li>
            <li>イベント受信: <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">GET /acp/sse?session_id=&lt;id&gt;</code></li>
          </ul>
          <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 p-2 rounded">
            ACP サーバーモードを使用するには、agentapi-proxy が ACP サーバー機能をサポートしている必要があります。
            セッション作成時にエージェントタイプが <code className="bg-amber-100 dark:bg-amber-800 px-1 rounded">claude-acp</code>、<code className="bg-amber-100 dark:bg-amber-800 px-1 rounded">codex-acp</code>、<code className="bg-amber-100 dark:bg-amber-800 px-1 rounded">pi-ollama</code>、<code className="bg-amber-100 dark:bg-amber-800 px-1 rounded">cursor</code> のいずれかに設定されます。
          </p>
        </div>
      )}

      <p className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 p-3 rounded-md">
        {acpServerEnabled
          ? 'ACP サーバーモードが有効です。チャット画面でのセッション作成・管理に ACP プロトコルが使用されます。'
          : 'ACP サーバーモードが無効です。通常の REST API を使用してセッションを管理します。'}
      </p>
    </div>
  )
}
