'use client'

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { createCurrentDeploymentAgentAPIProxyClient } from '@/lib/agentapi-proxy-client'
import {
  ClusterSessionManager,
  LogicalSessionPool,
  SessionPoolBinding,
  SessionPoolSupplier,
} from '@/types/session_pool'

export default function SessionPoolsAdminPage() {
  const client = useMemo(() => createCurrentDeploymentAgentAPIProxyClient(), [])
  const [managers, setManagers] = useState<ClusterSessionManager[]>([])
  const [pools, setPools] = useState<LogicalSessionPool[]>([])
  const [suppliers, setSuppliers] = useState<SessionPoolSupplier[]>([])
  const [bindings, setBindings] = useState<Record<string, SessionPoolBinding[]>>({})
  const [managerName, setManagerName] = useState('')
  const [managerID, setManagerID] = useState('')
  const [poolName, setPoolName] = useState('')
  const [supplierPool, setSupplierPool] = useState('')
  const [minIdle, setMinIdle] = useState(1)
  const [maxRunners, setMaxRunners] = useState(10)
  const [subjectType, setSubjectType] = useState<'user' | 'team' | 'all'>('team')
  const [subjectID, setSubjectID] = useState('')
  const [bindingRole, setBindingRole] = useState<'use' | 'manage'>('use')
  const [bindingPool, setBindingPool] = useState('')
  const [bindingPriority, setBindingPriority] = useState(0)
  const [maxConcurrent, setMaxConcurrent] = useState(0)
  const [connectionToken, setConnectionToken] = useState('')
  const [error, setError] = useState('')

  const reload = useCallback(async () => {
    try {
      const [nextManagers, nextPools] = await Promise.all([
        client.listClusterSessionManagers(),
        client.listSessionPools(),
      ])
      const nextSuppliers = (await Promise.all(
        nextManagers.map((manager) => client.listSessionPoolSuppliers(manager.id)),
      )).flat()
      const nextBindings = await Promise.all(
        nextPools.map(async (pool) => [pool.name, await client.listSessionPoolBindings(pool.name)] as const),
      )
      setManagers(nextManagers)
      setPools(nextPools)
      setSuppliers(nextSuppliers)
      setBindings(Object.fromEntries(nextBindings))
      setManagerID((current) => current || nextManagers[0]?.id || '')
      setSupplierPool((current) => current || nextPools[0]?.name || '')
      setBindingPool((current) => current || nextPools[0]?.name || '')
      setError('')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '読み込みに失敗しました')
    }
  }, [client])

  useEffect(() => { void reload() }, [reload])

  const addManager = async (event: FormEvent) => {
    event.preventDefault()
    try {
      const result = await client.createClusterSessionManager(managerName)
      setConnectionToken(result.connection_token)
      setManagerName('')
      setManagerID(result.manager.id)
      await reload()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Manager登録に失敗しました')
    }
  }

  const addLogicalPool = async (event: FormEvent) => {
    event.preventDefault()
    try {
      const pool = await client.createSessionPool({ name: poolName })
      setPoolName('')
      setSupplierPool(pool.name)
      setBindingPool(pool.name)
      await reload()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Logical Pool作成に失敗しました')
    }
  }

  const addSupplier = async (event: FormEvent) => {
    event.preventDefault()
    try {
      await client.createSessionPoolSupplier(managerID, {
        pool: supplierPool,
        min_idle: minIdle,
        max_runners: maxRunners,
      })
      await reload()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Pool Supplier追加に失敗しました')
    }
  }

  const addBinding = async (event: FormEvent) => {
    event.preventDefault()
    try {
      await client.createSessionPoolBinding(bindingPool, subjectType, subjectID, bindingRole, bindingPriority, maxConcurrent)
      setSubjectID('')
      await reload()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Pool Binding作成に失敗しました')
    }
  }

  const removeBinding = async (pool: string, bindingID: string) => {
    try {
      await client.deleteSessionPoolBinding(pool, bindingID)
      await reload()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Pool Binding削除に失敗しました')
    }
  }

  const removeManager = async (manager: ClusterSessionManager) => {
    if (!window.confirm(`Session Manager「${manager.name}」を削除しますか？関連するSupplierと待機Runnerも削除されます。`)) return
    try {
      await client.deleteClusterSessionManager(manager.id)
      await reload()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Session Manager削除に失敗しました')
    }
  }

  const removePool = async (pool: LogicalSessionPool) => {
    if (!window.confirm(`Logical Pool「${pool.name}」を削除しますか？Supplier、Bindingなどの関連リソースも削除されます。`)) return
    try {
      await client.deleteSessionPool(pool.name)
      await reload()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Logical Pool削除に失敗しました')
    }
  }

  const removeSupplier = async (supplier: SessionPoolSupplier) => {
    const manager = managers.find((item) => item.id === supplier.manager_id)
    if (!window.confirm(`${manager?.name || supplier.manager_id} の「${supplier.pool}」Supplierを削除しますか？待機Runnerも削除されます。`)) return
    try {
      await client.deleteSessionPoolSupplier(supplier.manager_id, supplier.pool)
      await reload()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Pool Supplier削除に失敗しました')
    }
  }

  const input = 'w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900'
  const card = 'space-y-3 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800'

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Session Pools</h2>
        <p className="mt-1 text-sm text-gray-500">
          Logical Pool、Managerごとの供給設定、user/teamの利用権限をクラスタ全体で管理します。
        </p>
      </div>
      {error && <div role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {connectionToken && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          <strong>Connection token（再表示されません）</strong>
          <code className="mt-2 block break-all">{connectionToken}</code>
          <button type="button" className="mt-2 text-xs underline" onClick={() => setConnectionToken('')}>閉じる</button>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <form onSubmit={addManager} className={card}>
          <h3 className="font-semibold">1. Session Manager</h3>
          <p className="text-xs text-gray-500">Poolを供給する実行環境を登録します。</p>
          <input required className={input} value={managerName} onChange={(event) => setManagerName(event.target.value)} placeholder="Tokyo Kubernetes" />
          <button className="w-fit rounded bg-blue-600 px-3 py-2 text-sm text-white">Managerを登録</button>
        </form>

        <form onSubmit={addLogicalPool} className={card}>
          <h3 className="font-semibold">2. Logical Pool</h3>
          <p className="text-xs text-gray-500">認可やセッション要求が参照するクラスタ共通のPoolです。</p>
          <input required className={input} value={poolName} onChange={(event) => setPoolName(event.target.value)} placeholder="linux-standard" />
          <button className="w-fit rounded bg-blue-600 px-3 py-2 text-sm text-white">Logical Poolを作成</button>
        </form>

        <form onSubmit={addSupplier} className={card}>
          <h3 className="font-semibold">3. Pool Supplier</h3>
          <p className="text-xs text-gray-500">Managerが供給するLogical Poolとキャパシティを設定します。</p>
          <select required className={input} value={managerID} onChange={(event) => setManagerID(event.target.value)}>
            <option value="" disabled>Managerを選択</option>
            {managers.map((manager) => <option key={manager.id} value={manager.id}>{manager.name}</option>)}
          </select>
          <select required className={input} value={supplierPool} onChange={(event) => setSupplierPool(event.target.value)}>
            <option value="" disabled>Logical Poolを選択</option>
            {pools.map((pool) => <option key={pool.name} value={pool.name}>{pool.name}</option>)}
          </select>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs text-gray-500">Min idle<input required min={0} type="number" className={input} value={minIdle} onChange={(event) => setMinIdle(Number(event.target.value))} /></label>
            <label className="text-xs text-gray-500">Max runners<input required min={0} type="number" className={input} value={maxRunners} onChange={(event) => setMaxRunners(Number(event.target.value))} /></label>
          </div>
          <button disabled={!managerID || !supplierPool} className="w-fit rounded bg-blue-600 px-3 py-2 text-sm text-white disabled:opacity-50">Supplierを追加</button>
        </form>

        <form onSubmit={addBinding} className={card}>
          <h3 className="font-semibold">4. Pool Binding</h3>
          <p className="text-xs text-gray-500">Logical Poolを利用できるuser、team、またはクラスタ内の全員を指定します。</p>
          <select required className={input} value={bindingPool} onChange={(event) => setBindingPool(event.target.value)}>
            <option value="" disabled>Logical Poolを選択</option>
            {pools.map((pool) => <option key={pool.name} value={pool.name}>{pool.name}</option>)}
          </select>
          <select className={input} value={subjectType} onChange={(event) => {
            const nextType = event.target.value as 'user' | 'team' | 'all'
            setSubjectType(nextType)
            if (nextType === 'all') {
              setSubjectID('')
              setBindingRole('use')
            }
          }}>
            <option value="team">Team</option>
            <option value="user">User</option>
            <option value="all">All users and teams</option>
          </select>
          <select className={input} value={bindingRole} onChange={(event) => setBindingRole(event.target.value as 'use' | 'manage')}>
            <option value="use">Use</option>
            <option value="manage" disabled={subjectType === 'all'}>Manage</option>
          </select>
          <input required={subjectType !== 'all'} disabled={subjectType === 'all'} className={input} value={subjectID} onChange={(event) => setSubjectID(event.target.value)} placeholder={subjectType === 'all' ? 'Subject IDは不要です' : subjectType === 'team' ? 'org/team' : 'user-id'} />
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs text-gray-500">Priority<input type="number" className={input} value={bindingPriority} onChange={(event) => setBindingPriority(Number(event.target.value))} /></label>
            <label className="text-xs text-gray-500">Max concurrent<input min={0} type="number" className={input} value={maxConcurrent} onChange={(event) => setMaxConcurrent(Number(event.target.value))} /></label>
          </div>
          <button disabled={!bindingPool} className="w-fit rounded bg-blue-600 px-3 py-2 text-sm text-white disabled:opacity-50">Bindingを追加</button>
        </form>
      </div>

      <div className={card}>
        <h3 className="font-semibold">Session Managers</h3>
        <div className="flex flex-wrap gap-2">
          {managers.map((manager) => (
            <span key={manager.id} className="inline-flex items-center rounded bg-gray-100 px-3 py-2 text-sm dark:bg-gray-700">
              {manager.name}
              <button aria-label={`${manager.name}を削除`} className="ml-3 text-red-600" onClick={() => void removeManager(manager)}>削除</button>
            </span>
          ))}
          {!managers.length && <span className="text-sm text-gray-400">Managerはまだありません。</span>}
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <table className="w-full text-left text-sm">
          <thead><tr className="border-b"><th className="p-3">Logical Pool</th><th className="p-3">Suppliers</th><th className="p-3">Bindings</th></tr></thead>
          <tbody>
            {pools.map((pool) => (
              <tr key={pool.name} className="border-b align-top last:border-0">
                <td className="p-3">
                  <span className="font-medium">{pool.name}</span>
                  <button aria-label={`${pool.name}を削除`} className="ml-3 text-xs text-red-600" onClick={() => void removePool(pool)}>削除</button>
                </td>
                <td className="p-3">
                  {(suppliers.filter((supplier) => supplier.pool === pool.name)).map((supplier) => (
                    <div key={supplier.manager_id} className="mb-1">
                      {managers.find((manager) => manager.id === supplier.manager_id)?.name || supplier.manager_id}
                      <span className="ml-2 text-xs text-gray-500">idle {supplier.idle_runners || 0} / max {supplier.max_runners || '∞'}</span>
                      <button aria-label={`${supplier.pool}のSupplierを削除`} className="ml-2 text-xs text-red-600" onClick={() => void removeSupplier(supplier)}>削除</button>
                    </div>
                  ))}
                  {!suppliers.some((supplier) => supplier.pool === pool.name) && <span className="text-gray-400">未設定</span>}
                </td>
                <td className="p-3">
                  {(bindings[pool.name] || []).map((binding) => (
                    <span key={binding.id} className="mb-1 mr-2 inline-flex rounded bg-gray-100 px-2 py-1 text-xs dark:bg-gray-700">
                      {binding.subject_type}: {binding.subject_id || 'everyone'} ({binding.role || 'use'}, priority {binding.priority || 0}, max {binding.max_concurrent || '∞'})
                      <button aria-label={`${binding.subject_id}のBindingを削除`} className="ml-2 text-red-600" onClick={() => void removeBinding(pool.name, binding.id)}>×</button>
                    </span>
                  ))}
                  {!bindings[pool.name]?.length && <span className="text-gray-400">未設定</span>}
                </td>
              </tr>
            ))}
            {!pools.length && <tr><td colSpan={3} className="p-6 text-center text-gray-500">Logical Poolはまだありません。</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
