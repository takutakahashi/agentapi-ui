'use client'

interface MemorySettingsProps {
  memoryEnabled: boolean
  memorySummarizeDrafts: boolean | undefined
  onMemoryEnabledChange: (enabled: boolean) => void
  onMemorySummarizeDraftsChange: (enabled: boolean | undefined) => void
}

export function MemorySettings({
  memoryEnabled,
  memorySummarizeDrafts,
  onMemoryEnabledChange,
  onMemorySummarizeDraftsChange,
}: MemorySettingsProps) {
  return (
    <div className="space-y-6">
      {/* メモリ機能の有効/無効 */}
      <div className="flex items-center justify-between">
        <div>
          <label
            htmlFor="memoryEnabled"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            メモリ機能を有効にする
          </label>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            有効にすると、セッション中に取得した知識をメモリとして蓄積し、次回以降のセッションで活用されます
          </p>
        </div>
        <button
          type="button"
          id="memoryEnabled"
          onClick={() => onMemoryEnabledChange(!memoryEnabled)}
          className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
            memoryEnabled ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-600'
          }`}
          role="switch"
          aria-checked={memoryEnabled}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
              memoryEnabled ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {/* メモリ機能が有効な場合の詳細設定 */}
      {memoryEnabled && (
        <div className="pl-4 border-l-2 border-blue-200 dark:border-blue-700 space-y-4">
          {/* ドラフトメモリの自動集約 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              ドラフトメモリの自動集約
            </label>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              セッション終了後にドラフトメモリを自動的に集約するかどうかを設定します。
              「プロキシのデフォルト設定に従う」を選択すると、サーバー側の設定が適用されます。
            </p>
            <div className="space-y-2">
              {([
                {
                  value: undefined,
                  label: 'プロキシのデフォルト設定に従う',
                  description: 'サーバー側のグローバル設定（kubernetesSession.memorySummarizeDrafts）が適用される',
                },
                {
                  value: true,
                  label: '有効（常に集約する）',
                  description: 'セッション終了後に必ずドラフトメモリの集約セッションを開始する',
                },
                {
                  value: false,
                  label: '無効（集約しない）',
                  description: 'セッション終了後のドラフトメモリ集約をスキップする',
                },
              ] as { value: boolean | undefined; label: string; description: string }[]).map(
                ({ value, label, description }) => (
                  <label
                    key={String(value)}
                    className={`flex items-start p-3 rounded-lg border cursor-pointer transition-colors ${
                      memorySummarizeDrafts === value
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}
                  >
                    <input
                      type="radio"
                      name="memorySummarizeDrafts"
                      value={String(value)}
                      checked={memorySummarizeDrafts === value}
                      onChange={() => onMemorySummarizeDraftsChange(value)}
                      className="mt-0.5 h-4 w-4 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="ml-3">
                      <span className="block text-sm font-medium text-gray-900 dark:text-white">
                        {label}
                      </span>
                      <span className="block text-xs text-gray-500 dark:text-gray-400">
                        {description}
                      </span>
                    </div>
                  </label>
                )
              )}
            </div>
          </div>
        </div>
      )}

      <p className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 p-3 rounded-md">
        {memoryEnabled
          ? 'メモリ機能が有効です。セッションで蓄積されたメモリは次回以降のセッションで自動的に活用されます。'
          : 'メモリ機能が無効です。セッション中にメモリは蓄積されず、過去のメモリも参照されません。'}
      </p>
    </div>
  )
}
