'use client'

import React, { useState } from 'react'
import { MCPServerConfig } from '../types/profile'

interface MCPServerSettingsProps {
  mcpServers: MCPServerConfig[]
  onChange: (mcpServers: MCPServerConfig[]) => void
  title?: string
  description?: string
}

export default function MCPServerSettings({ 
  mcpServers, 
  onChange, 
  title = "MCP Servers",
  description = "Configure Model Context Protocol servers for this profile"
}: MCPServerSettingsProps) {
  const [editingServer, setEditingServer] = useState<MCPServerConfig | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)

  const defaultServer: MCPServerConfig = {
    id: '',
    name: '',
    endpoint: '',
    enabled: true,
    transport: 'stdio',
    command: '',
    args: [],
    env: {},
    timeout: 30000
  }

  const [formData, setFormData] = useState<MCPServerConfig>(defaultServer)

  const handleAddServer = () => {
    setFormData({ ...defaultServer, id: Date.now().toString() })
    setEditingServer(null)
    setShowAddForm(true)
  }

  const handleEditServer = (server: MCPServerConfig) => {
    setFormData({ ...server })
    setEditingServer(server)
    setShowAddForm(true)
  }

  const handleSaveServer = () => {
    if (!formData.name.trim()) {
      alert('Server name is required')
      return
    }

    let updatedServers
    if (editingServer) {
      // Update existing server
      updatedServers = mcpServers.map(server => 
        server.id === editingServer.id ? formData : server
      )
    } else {
      // Add new server
      updatedServers = [...mcpServers, formData]
    }

    onChange(updatedServers)
    setShowAddForm(false)
    setEditingServer(null)
    setFormData(defaultServer)
  }

  const handleDeleteServer = (serverId: string) => {
    if (confirm('Are you sure you want to delete this MCP server?')) {
      const updatedServers = mcpServers.filter(server => server.id !== serverId)
      onChange(updatedServers)
    }
  }

  const handleToggleEnabled = (serverId: string) => {
    const updatedServers = mcpServers.map(server =>
      server.id === serverId ? { ...server, enabled: !server.enabled } : server
    )
    onChange(updatedServers)
  }

  const handleCancel = () => {
    setShowAddForm(false)
    setEditingServer(null)
    setFormData(defaultServer)
  }

  const addArg = () => {
    setFormData({
      ...formData,
      args: [...(formData.args || []), '']
    })
  }

  const updateArg = (index: number, value: string) => {
    const newArgs = [...(formData.args || [])]
    newArgs[index] = value
    setFormData({
      ...formData,
      args: newArgs
    })
  }

  const removeArg = (index: number) => {
    const newArgs = [...(formData.args || [])]
    newArgs.splice(index, 1)
    setFormData({
      ...formData,
      args: newArgs
    })
  }

  const addEnvVar = () => {
    const key = prompt('Environment variable name:')
    if (key && key.trim()) {
      setFormData({
        ...formData,
        env: {
          ...formData.env,
          [key]: ''
        }
      })
    }
  }

  const updateEnvVar = (key: string, value: string) => {
    setFormData({
      ...formData,
      env: {
        ...formData.env,
        [key]: value
      }
    })
  }

  const removeEnvVar = (key: string) => {
    const newEnv = { ...formData.env }
    delete newEnv[key]
    setFormData({
      ...formData,
      env: newEnv
    })
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">{title}</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">{description}</p>
      </div>

      {/* Server List */}
      <div className="space-y-2">
        {mcpServers.map((server) => (
          <div
            key={server.id}
            className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg"
          >
            <div className="flex items-center space-x-3">
              <input
                type="checkbox"
                checked={server.enabled}
                onChange={() => handleToggleEnabled(server.id)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <div>
                <div className="font-medium text-gray-900 dark:text-white">
                  {server.name}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  {server.transport} • {server.command || server.endpoint}
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => handleEditServer(server)}
                className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
              >
                Edit
              </button>
              <button
                onClick={() => handleDeleteServer(server.id)}
                className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add Server Button */}
      {!showAddForm && (
        <button
          onClick={handleAddServer}
          className="w-full p-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-500 dark:text-gray-400 hover:border-gray-400 dark:hover:border-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
        >
          + Add MCP Server
        </button>
      )}

      {/* Add/Edit Server Form */}
      {showAddForm && (
        <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800">
          <h4 className="text-md font-medium text-gray-900 dark:text-white mb-4">
            {editingServer ? 'Edit MCP Server' : 'Add MCP Server'}
          </h4>
          
          <div className="space-y-4">
            {/* Basic Settings */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Server Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="My MCP Server"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Transport
                </label>
                <select
                  value={formData.transport}
                  onChange={(e) => setFormData({ ...formData, transport: e.target.value as 'stdio' | 'sse' | 'websocket' })}
                  className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="stdio">stdio</option>
                  <option value="sse">sse</option>
                  <option value="websocket">websocket</option>
                </select>
              </div>
            </div>

            {/* Transport-specific settings */}
            {formData.transport === 'stdio' ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Command
                  </label>
                  <input
                    type="text"
                    value={formData.command}
                    onChange={(e) => setFormData({ ...formData, command: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="node"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Arguments
                  </label>
                  {formData.args?.map((arg, index) => (
                    <div key={index} className="flex items-center space-x-2 mt-2">
                      <input
                        type="text"
                        value={arg}
                        onChange={(e) => updateArg(index, e.target.value)}
                        className="flex-1 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        placeholder="argument"
                      />
                      <button
                        onClick={() => removeArg(index)}
                        className="text-red-600 hover:text-red-800 dark:text-red-400"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={addArg}
                    className="mt-2 text-blue-600 hover:text-blue-800 dark:text-blue-400"
                  >
                    + Add Argument
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Endpoint URL
                </label>
                <input
                  type="url"
                  value={formData.endpoint}
                  onChange={(e) => setFormData({ ...formData, endpoint: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="http://localhost:3000"
                />
              </div>
            )}

            {/* Environment Variables */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Environment Variables
              </label>
              {Object.entries(formData.env || {}).map(([key, value]) => (
                <div key={key} className="flex items-center space-x-2 mt-2">
                  <input
                    type="text"
                    value={key}
                    disabled
                    className="w-1/3 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-gray-100 dark:bg-gray-600 text-gray-900 dark:text-white"
                  />
                  <input
                    type="text"
                    value={value}
                    onChange={(e) => updateEnvVar(key, e.target.value)}
                    className="flex-1 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="value"
                  />
                  <button
                    onClick={() => removeEnvVar(key)}
                    className="text-red-600 hover:text-red-800 dark:text-red-400"
                  >
                    Remove
                  </button>
                </div>
              ))}
              <button
                onClick={addEnvVar}
                className="mt-2 text-blue-600 hover:text-blue-800 dark:text-blue-400"
              >
                + Add Environment Variable
              </button>
            </div>

            {/* Timeout */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Timeout (ms)
              </label>
              <input
                type="number"
                value={formData.timeout || 30000}
                onChange={(e) => setFormData({ ...formData, timeout: parseInt(e.target.value) || 30000 })}
                className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                min="1000"
                step="1000"
              />
            </div>

            {/* Form Actions */}
            <div className="flex justify-end space-x-3">
              <button
                onClick={handleCancel}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveServer}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                {editingServer ? 'Update' : 'Add'} Server
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}