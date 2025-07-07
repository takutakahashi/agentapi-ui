import { useEffect, useState } from 'react'
import { getRuntimeConfig } from '@/lib/runtime-config'

export function useRuntimeConfig() {
  const [config, setConfig] = useState<{
    singleProfileMode: boolean
    agentApiProxyUrl: string
    loading: boolean
    error: string | null
  }>({
    singleProfileMode: false,
    agentApiProxyUrl: 'http://localhost:8080',
    loading: true,
    error: null,
  })

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const runtimeConfig = await getRuntimeConfig()
        setConfig({
          singleProfileMode: runtimeConfig?.singleProfileMode || false,
          agentApiProxyUrl: runtimeConfig?.agentApiProxyUrl || 'http://localhost:8080',
          loading: false,
          error: null,
        })
      } catch (error) {
        setConfig(prev => ({
          ...prev,
          loading: false,
          error: error instanceof Error ? error.message : 'Failed to load runtime config',
        }))
      }
    }

    fetchConfig()
  }, [])

  return config
}