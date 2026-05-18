'use client'

import { useState } from 'react'

export interface ClaudeSandboxFilesystemConfig {
  allowWrite?: string[]
  denyWrite?: string[]
  denyRead?: string[]
  allowRead?: string[]
}

export interface ClaudeSandboxNetworkConfig {
  allowedDomains?: string[]
  deniedDomains?: string[]
  allowLocalBinding?: boolean
  allowAllUnixSockets?: boolean
}

export interface ClaudeSandboxConfig {
  enabled?: boolean
  failIfUnavailable?: boolean
  autoAllowBashIfSandboxed?: boolean
  excludedCommands?: string[]
  allowUnsandboxedCommands?: boolean
  filesystem?: ClaudeSandboxFilesystemConfig
  network?: ClaudeSandboxNetworkConfig
}

export interface SandboxConfigState {
  enabled: boolean
  autoAllowBashIfSandboxed: boolean
  allowUnsandboxedCommands: boolean
  excludedCommands: string
  fsAllowWrite: string
  fsDenyRead: string
  networkAllowedDomains: string
  networkDeniedDomains: string
}

export function defaultSandboxConfigState(): SandboxConfigState {
  return {
    enabled: false,
    autoAllowBashIfSandboxed: true,
    allowUnsandboxedCommands: true,
    excludedCommands: '',
    fsAllowWrite: '',
    fsDenyRead: '',
    networkAllowedDomains: '',
    networkDeniedDomains: '',
  }
}

export function sandboxConfigStateToConfig(state: SandboxConfigState): ClaudeSandboxConfig | undefined {
  if (!state.enabled) return undefined

  const parseLines = (s: string): string[] =>
    s.split('\n').map(l => l.trim()).filter(Boolean)

  const excludedCommands = parseLines(state.excludedCommands)
  const fsAllowWrite = parseLines(state.fsAllowWrite)
  const fsDenyRead = parseLines(state.fsDenyRead)
  const allowedDomains = parseLines(state.networkAllowedDomains)
  const deniedDomains = parseLines(state.networkDeniedDomains)

  const config: ClaudeSandboxConfig = {
    enabled: true,
    autoAllowBashIfSandboxed: state.autoAllowBashIfSandboxed,
    allowUnsandboxedCommands: state.allowUnsandboxedCommands,
  }

  if (excludedCommands.length > 0) config.excludedCommands = excludedCommands

  if (fsAllowWrite.length > 0 || fsDenyRead.length > 0) {
    config.filesystem = {}
    if (fsAllowWrite.length > 0) config.filesystem.allowWrite = fsAllowWrite
    if (fsDenyRead.length > 0) config.filesystem.denyRead = fsDenyRead
  }

  if (allowedDomains.length > 0 || deniedDomains.length > 0) {
    config.network = {}
    if (allowedDomains.length > 0) config.network.allowedDomains = allowedDomains
    if (deniedDomains.length > 0) config.network.deniedDomains = deniedDomains
  }

  return config
}

interface SandboxConfigInputProps {
  state: SandboxConfigState
  onChange: (state: SandboxConfigState) => void
  disabled?: boolean
}

export default function SandboxConfigInput({ state, onChange, disabled }: SandboxConfigInputProps) {
  const [expanded, setExpanded] = useState(false)

  const update = (patch: Partial<SandboxConfigState>) => onChange({ ...state, ...patch })

  return (
    <div className="border border-gray-200 dark:border-gray-600 rounded-md overflow-hidden">
      {/* Header toggle */}
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600"
        disabled={disabled}
      >
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <span>Claude Sandbox 設定</span>
          {state.enabled && (
            <span className="text-xs bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 px-2 py-0.5 rounded-full">
              有効
            </span>
          )}
        </div>
        <svg
          className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="px-4 py-4 space-y-5">
          {/* Enable sandbox */}
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              id="sandbox-enabled"
              checked={state.enabled}
              onChange={e => update({ enabled: e.target.checked })}
              className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              disabled={disabled}
            />
            <div>
              <label htmlFor="sandbox-enabled" className="block text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer">
                サンドボックスを有効にする
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                bash コマンドをファイルシステム・ネットワーク分離環境内で実行します（macOS / Linux / WSL2）
              </p>
            </div>
          </div>

          {state.enabled && (
            <>
              {/* Auto allow bash */}
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="sandbox-auto-allow"
                  checked={state.autoAllowBashIfSandboxed}
                  onChange={e => update({ autoAllowBashIfSandboxed: e.target.checked })}
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  disabled={disabled}
                />
                <div>
                  <label htmlFor="sandbox-auto-allow" className="block text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer">
                    サンドボックス内の bash を自動承認する
                  </label>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    サンドボックス内で実行されるコマンドの承認プロンプトをスキップします（デフォルト: ON）
                  </p>
                </div>
              </div>

              {/* Allow unsandboxed commands */}
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="sandbox-allow-escape"
                  checked={state.allowUnsandboxedCommands}
                  onChange={e => update({ allowUnsandboxedCommands: e.target.checked })}
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  disabled={disabled}
                />
                <div>
                  <label htmlFor="sandbox-allow-escape" className="block text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer">
                    サンドボックス外実行（エスケープハッチ）を許可する
                  </label>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    <code className="text-xs bg-gray-100 dark:bg-gray-700 px-1 rounded">dangerouslyDisableSandbox</code> パラメータを許可します（デフォルト: ON）
                  </p>
                </div>
              </div>

              {/* Excluded commands */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  サンドボックス除外コマンド
                </label>
                <textarea
                  value={state.excludedCommands}
                  onChange={e => update({ excludedCommands: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white font-mono"
                  placeholder={'docker *\nnpm *'}
                  disabled={disabled}
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  1行1パターン。例: <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">docker *</code>
                </p>
              </div>

              {/* Filesystem */}
              <div className="border border-gray-200 dark:border-gray-600 rounded-md p-3 space-y-3">
                <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                  ファイルシステム制限
                </p>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    書き込み許可パス（allowWrite）
                  </label>
                  <textarea
                    value={state.fsAllowWrite}
                    onChange={e => update({ fsAllowWrite: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white font-mono"
                    placeholder={'/tmp/build\n~/.kube'}
                    disabled={disabled}
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    作業ディレクトリ外で書き込みを許可するパス（1行1パス）
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    読み取り禁止パス（denyRead）
                  </label>
                  <textarea
                    value={state.fsDenyRead}
                    onChange={e => update({ fsDenyRead: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white font-mono"
                    placeholder={'~/.aws\n~/.ssh'}
                    disabled={disabled}
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    読み取りをブロックするパス（1行1パス）
                  </p>
                </div>
              </div>

              {/* Network */}
              <div className="border border-gray-200 dark:border-gray-600 rounded-md p-3 space-y-3">
                <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                  ネットワーク制限
                </p>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    許可ドメイン（allowedDomains）
                  </label>
                  <textarea
                    value={state.networkAllowedDomains}
                    onChange={e => update({ networkAllowedDomains: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white font-mono"
                    placeholder={'github.com\n*.npmjs.org'}
                    disabled={disabled}
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    アウトバウンドトラフィックを許可するドメイン（1行1ドメイン、ワイルドカード対応）
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    拒否ドメイン（deniedDomains）
                  </label>
                  <textarea
                    value={state.networkDeniedDomains}
                    onChange={e => update({ networkDeniedDomains: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white font-mono"
                    placeholder={'internal.corp.example.com'}
                    disabled={disabled}
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    ブロックするドメイン（allowedDomains より優先）
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
