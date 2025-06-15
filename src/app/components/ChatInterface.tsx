'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { agentAPI } from '../../lib/api'
import { AgentAPIProxyError } from '../../lib/agentapi-proxy-client'
import { SessionMessage } from '../../types/agentapi'

interface Message {
  id: number
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: string
}

interface ChatInterfaceProps {
  sessionId: string
}

function convertSessionMessageId(id: string | number, fallbackId: number): number {
  const stringId = String(id)
  
  if (!stringId || stringId.trim() === '') {
    return fallbackId
  }
  
  const parsed = parseInt(stringId, 10)
  if (!isNaN(parsed) && parsed >= 0) {
    return parsed
  }
  
  let hash = 0
  for (let i = 0; i < stringId.length; i++) {
    const char = stringId.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  
  const hashId = Math.abs(hash)
  return hashId > 0 ? hashId : fallbackId
}

export default function ChatInterface({ sessionId }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const checkIfAtBottom = () => {
    if (!messagesContainerRef.current) return false
    const container = messagesContainerRef.current
    const threshold = 100
    return container.scrollHeight - container.scrollTop - container.clientHeight <= threshold
  }

  const handleScroll = () => {
    const isAtBottom = checkIfAtBottom()
    setShouldAutoScroll(isAtBottom)
  }

  const fetchMessages = useCallback(async () => {
    if (!sessionId) return

    try {
      setError(null)
      const response = await agentAPI.getSessionMessages!(sessionId, { limit: 100 })
      
      if (response?.messages) {
        const convertedMessages: Message[] = response.messages.map((msg: SessionMessage, index: number) => ({
          id: convertSessionMessageId(msg.id, index + 1),
          role: msg.role === 'assistant' ? 'assistant' : msg.role === 'system' ? 'system' : 'user',
          content: msg.content,
          timestamp: msg.timestamp
        }))
        
        setMessages(convertedMessages)
      }
    } catch (err) {
      console.error('Failed to fetch messages:', err)
      if (err instanceof AgentAPIProxyError) {
        setError(`Failed to load messages: ${err.message}`)
      } else {
        setError('Failed to load messages')
      }
    }
  }, [sessionId])

  const sendMessage = async () => {
    if (!inputValue.trim() || !sessionId || isLoading) return

    const messageContent = inputValue.trim()
    setInputValue('')
    setIsLoading(true)
    setError(null)

    const tempMessage: Message = {
      id: Date.now(),
      role: 'user',
      content: messageContent,
      timestamp: new Date().toISOString()
    }

    setMessages(prev => [...prev, tempMessage])

    try {
      await agentAPI.sendSessionMessage!(sessionId, {
        content: messageContent,
        type: 'user'
      })

      setTimeout(() => {
        fetchMessages()
      }, 1000)
    } catch (err) {
      console.error('Failed to send message:', err)
      if (err instanceof AgentAPIProxyError) {
        setError(`Failed to send message: ${err.message}`)
      } else {
        setError('Failed to send message')
      }
      
      setMessages(prev => prev.filter(msg => msg.id !== tempMessage.id))
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  useEffect(() => {
    fetchMessages()
    
    pollingIntervalRef.current = setInterval(() => {
      fetchMessages()
    }, 3000)

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
      }
    }
  }, [sessionId, fetchMessages])

  useEffect(() => {
    if (shouldAutoScroll) {
      scrollToBottom()
    }
  }, [messages, shouldAutoScroll])

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('ja-JP', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case 'user':
        return 'あなた'
      case 'assistant':
        return 'アシスタント'
      case 'system':
        return 'システム'
      default:
        return role
    }
  }

  const getRoleStyles = (role: string) => {
    switch (role) {
      case 'user':
        return 'bg-blue-600 text-white ml-auto'
      case 'assistant':
        return 'bg-gray-100 text-gray-900'
      case 'system':
        return 'bg-yellow-50 text-yellow-800 border border-yellow-200'
      default:
        return 'bg-gray-100 text-gray-900'
    }
  }

  return (
    <div className="flex flex-col h-full">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md m-4">
          {error}
        </div>
      )}

      <div 
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-4"
        onScroll={handleScroll}
      >
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              <div className="mb-4">
                <svg className="w-12 h-12 text-gray-400 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <p>メッセージはありません</p>
              <p className="text-sm mt-1">メッセージを送信して会話を開始しましょう</p>
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-4 py-2 ${getRoleStyles(message.role)}`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium opacity-75">
                    {getRoleDisplayName(message.role)}
                  </span>
                  <span className="text-xs opacity-50">
                    {formatTime(message.timestamp)}
                  </span>
                </div>
                <div className="whitespace-pre-wrap break-words">
                  {message.content}
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-gray-200 p-4">
        <div className="flex gap-2">
          <textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="メッセージを入力してください..."
            className="flex-1 resize-none rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            rows={1}
            disabled={isLoading}
          />
          <button
            onClick={sendMessage}
            disabled={!inputValue.trim() || isLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}