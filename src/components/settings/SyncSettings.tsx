interface SyncSettingsProps {
  gitRepository?: string
  storagePath?: string
  onChange: (gitRepository: string, storagePath: string) => void
}

export function SyncSettings({ gitRepository = '', storagePath = '', onChange }: SyncSettingsProps) {
  const handleGitRepositoryChange = (value: string) => {
    onChange(value, storagePath)
  }

  const handleStoragePathChange = (value: string) => {
    onChange(gitRepository, value)
  }

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="git-repository" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Git Repository URL
        </label>
        <input
          id="git-repository"
          type="text"
          value={gitRepository}
          onChange={(e) => handleGitRepositoryChange(e.target.value)}
          placeholder="https://github.com/username/settings-repo.git"
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
        />
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          設定を同期するGitリポジトリのURLを指定してください
        </p>
      </div>

      <div>
        <label htmlFor="storage-path" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Storage Path
        </label>
        <input
          id="storage-path"
          type="text"
          value={storagePath}
          onChange={(e) => handleStoragePathChange(e.target.value)}
          placeholder=".claude/settings"
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
        />
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          リポジトリ内の設定ファイルの保管パスを指定してください
        </p>
      </div>
    </div>
  )
}
