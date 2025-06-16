'use client';

import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { agentAPI } from '../../lib/api';
import { AgentAPIProxyError } from '../../lib/agentapi-proxy-client';
import { SessionMessage, SessionMessageListResponse } from '../../types/agentapi';

// Define local types for message and agent status
interface Message {
  id: number;
  role: 'user' | 'agent';
  content: string;
  timestamp: string;
}

interface AgentStatus {
  status: 'stable' | 'running' | 'error';
  last_activity?: string;
  current_task?: string;
}

// Type guard function to validate session message response
function isValidSessionMessageResponse(response: unknown): response is SessionMessageListResponse {
  return (
    response !== null &&
    typeof response === 'object' &&
    'messages' in response &&
    Array.isArray((response as SessionMessageListResponse).messages)
  );
}

// Utility function to safely convert string or number IDs to numbers
function convertSessionMessageId(id: string | number, fallbackId: number): number {
  // Convert to string safely
  const stringId = String(id);
  
  // Handle empty string
  if (!stringId || stringId.trim() === '') {
    return fallbackId;
  }
  
  // Try to parse as number
  const parsed = parseInt(stringId, 10);
  if (!isNaN(parsed) && parsed >= 0) {
    return parsed;
  }
  
  // For negative numbers or non-numeric strings, create a stable hash
  // This ensures the same string always produces the same number
  let hash = 0;
  for (let i = 0; i < stringId.length; i++) {
    const char = stringId.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  // Ensure positive number and use fallback if hash is problematic
  const hashId = Math.abs(hash);
  return hashId > 0 ? hashId : fallbackId;
}

export default function AgentAPIChat() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const sessionId = searchParams.get('session');
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [agentStatus, setAgentStatus] = useState<AgentStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const [hasNewMessages, setHasNewMessages] = useState(false);
  const [showControlPanel, setShowControlPanel] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const prevMessagesLengthRef = useRef(0);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const checkIfAtBottom = () => {
    if (!messagesContainerRef.current) return false;
    const container = messagesContainerRef.current;
    const threshold = 100; // 100px以内なら「下部にいる」と判断
    return container.scrollHeight - container.scrollTop - container.clientHeight <= threshold;
  };

  const handleScroll = useCallback(() => {
    if (!messagesContainerRef.current) return;
    
    const isAtBottom = checkIfAtBottom();
    setShouldAutoScroll(isAtBottom);
    
    // 下部にスクロールしたら新着メッセージ通知をクリア
    if (isAtBottom) {
      setHasNewMessages(false);
    }
  }, []);

  // Initialize session-based or direct AgentAPI connection
  useEffect(() => {
    const initializeChat = async () => {
      try {
        setError(null);
        
        if (sessionId) {
          // Session-based connection: load messages from agentapi-proxy
          try {
            const sessionMessagesResponse = await agentAPI.getSessionMessages(sessionId, { limit: 100 });
            
            // Validate and safely handle session messages response
            if (!isValidSessionMessageResponse(sessionMessagesResponse)) {
              console.warn('Invalid session messages response structure:', sessionMessagesResponse);
            }
            
            // Convert SessionMessage to Message format for display with safe array handling
            const messages = sessionMessagesResponse?.messages || [];
            const convertedMessages: Message[] = messages.map((msg: SessionMessage, index: number) => ({
              id: convertSessionMessageId(msg.id, Date.now() + index), // Safe ID conversion with unique fallback
              role: msg.role === 'assistant' ? 'agent' : (msg.role === 'system' ? 'agent' : msg.role as 'user' | 'agent'), // Convert roles to Message format
              content: msg.content,
              timestamp: msg.timestamp
            }));
            
            setMessages(convertedMessages);
            setIsConnected(true);
            setError(null);
            return;
          } catch (err) {
            console.error('Failed to load session messages:', err);
            if (err instanceof AgentAPIProxyError) {
              setError(`Failed to load session messages: ${err.message} (Session: ${sessionId})`);
            } else {
              setError(`Failed to connect to session ${sessionId}`);
            }
            return;
          }
        } else {
          setError('No session ID provided. Please provide a session ID to connect.');
          return;
        }
      } catch (err) {
        console.error('Failed to initialize chat:', err);
        if (err instanceof AgentAPIProxyError) {
          setError(`Failed to connect: ${err.message}`);
        } else {
          setError('Failed to connect to AgentAPI Proxy');
        }
      }
    };

    initializeChat();
  }, [sessionId]);

  // Setup real-time event listening
  useEffect(() => {
    if (!isConnected || !sessionId) return;

    // Session-based polling for messages (1 second interval)
    const pollMessages = async () => {
      try {
        // Poll both messages and status
        const [sessionMessagesResponse, sessionStatus] = await Promise.all([
          agentAPI.getSessionMessages(sessionId, { limit: 100 }),
          agentAPI.getSessionStatus(sessionId)
        ]);
        
        // Validate and safely handle session messages response
        if (!isValidSessionMessageResponse(sessionMessagesResponse)) {
          console.warn('Invalid session messages response structure during polling:', sessionMessagesResponse);
        }
        
        // Convert SessionMessage to Message format for display with safe array handling
        const messages = sessionMessagesResponse?.messages || [];
        const convertedMessages: Message[] = messages.map((msg: SessionMessage, index: number) => ({
          id: convertSessionMessageId(msg.id, Date.now() + index), // Safe ID conversion with unique fallback
          role: msg.role === 'assistant' ? 'agent' : (msg.role === 'system' ? 'agent' : msg.role as 'user' | 'agent'), // Convert roles to Message format
          content: msg.content,
          timestamp: msg.timestamp
        }));
        
        setMessages(convertedMessages);
        setAgentStatus(sessionStatus);
      } catch (err) {
        console.error('Failed to poll session data:', err);
        if (err instanceof AgentAPIProxyError) {
          setError(`Failed to update messages: ${err.message}`);
        }
      }
    };

    // Initial poll
    pollMessages();

    // Set up polling every 1 second
    const pollInterval = setInterval(pollMessages, 1000);
    pollingIntervalRef.current = pollInterval;

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [isConnected, sessionId]);

  // Handle new messages and auto-scroll
  useEffect(() => {
    const currentLength = messages.length;
    const previousLength = prevMessagesLengthRef.current;
    
    // 新しいメッセージが追加された場合
    if (currentLength > previousLength) {
      if (shouldAutoScroll) {
        // ユーザーが下部にいる場合のみ自動スクロール
        scrollToBottom();
      } else {
        // ユーザーが上部を見ている場合は新着通知を表示
        setHasNewMessages(true);
      }
    }
    
    prevMessagesLengthRef.current = currentLength;
  }, [messages, shouldAutoScroll]);

  const sendMessage = async (messageType: 'user' | 'raw' = 'user', content?: string) => {
    const messageContent = content || inputValue.trim();
    
    if (!messageContent && messageType === 'user') return;
    if (isLoading || !isConnected) return;
    
    if (agentStatus?.status === 'running' && messageType === 'user') {
      setError('Agent is currently running. Please wait for it to become stable.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      if (sessionId) {
        // Send message via session
        const sessionMessage = await agentAPI.sendSessionMessage(sessionId, {
          content: messageContent,
          type: messageType
        });

        // For user messages, convert to Message format and add to display
        if (messageType === 'user') {
          const convertedMessage: Message = {
            id: convertSessionMessageId(sessionMessage.id, Date.now()), // Safe ID conversion
            role: sessionMessage.role === 'assistant' ? 'agent' : (sessionMessage.role === 'system' ? 'agent' : sessionMessage.role as 'user' | 'agent'),
            content: sessionMessage.content,
            timestamp: sessionMessage.timestamp
          };

          setMessages(prev => [...prev, convertedMessage]);
        }
      } else {
        setError('No session ID available. Cannot send message.');
        return;
      }
      
      if (messageType === 'user') {
        setInputValue('');
        // メッセージ送信時は必ずスクロール
        setShouldAutoScroll(true);
        setTimeout(() => scrollToBottom(), 100);
      }
    } catch (err) {
      console.error('Failed to send message:', err);
      if (err instanceof AgentAPIProxyError) {
        setError(`Failed to send message: ${err.message} (Session: ${sessionId})`);
      } else {
        setError('Failed to send message');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const sendStopSignal = () => {
    // Send ESC key (raw message)
    sendMessage('raw', '\u001b');
  };

  const sendArrowUp = () => {
    // Send up arrow key (raw message)
    sendMessage('raw', '\u001b[A');
  };

  const sendArrowDown = () => {
    // Send down arrow key (raw message)
    sendMessage('raw', '\u001b[B');
  };

  const sendEnterKey = () => {
    // Send enter key (raw message)
    sendMessage('raw', '\r');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'stable': return 'text-green-600 dark:text-green-400';
      case 'running': return 'text-yellow-600 dark:text-yellow-400';
      default: return 'text-gray-600 dark:text-gray-400';
    }
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900" style={{ position: 'relative', minHeight: 0 }}>
      {/* Header */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">
              <span className="block sm:inline">AgentAPI Chat</span>
              {sessionId && (
                <span className="ml-0 sm:ml-2 text-sm font-normal text-gray-500 dark:text-gray-400 block sm:inline">
                  #{sessionId.substring(0, 8)}
                </span>
              )}
            </h2>
          </div>
          <div className="flex items-center space-x-2 sm:space-x-4">
            {/* Agent Status */}
            {agentStatus && (
              <div className="flex items-center space-x-1 sm:space-x-2">
                <div className={`w-2 h-2 rounded-full ${agentStatus.status === 'stable' ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                <span className={`text-xs sm:text-sm ${getStatusColor(agentStatus.status)} hidden sm:inline`}>
                  {agentStatus.status === 'stable' ? 'Agent Available' : agentStatus.status === 'running' ? 'Agent Running' : agentStatus.status}
                </span>
              </div>
            )}


            {/* Stop Button */}
            {agentStatus?.status === 'running' && (
              <button
                onClick={sendStopSignal}
                disabled={!isConnected || isLoading}
                className="px-2 sm:px-3 py-1 bg-red-600 hover:bg-red-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white text-xs sm:text-sm rounded-md transition-colors disabled:cursor-not-allowed flex items-center space-x-1"
                title="Force Stop (ESC)"
              >
                <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10h6v4H9z" />
                </svg>
                <span className="hidden sm:inline">Stop</span>
              </button>
            )}
            
            {/* Connection Status */}
            <div className="flex items-center space-x-1 sm:space-x-2">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span className={`text-xs sm:text-sm ${isConnected ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'} hidden sm:inline`}>
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>

            {/* Settings Navigation Button */}
            <button
              onClick={() => router.push('/settings')}
              className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors"
              title="Settings"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>
        </div>
        {error && (
          <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md text-red-700 dark:text-red-400 text-sm">
            {error}
          </div>
        )}
        
      </div>

      {/* Messages */}
      <div 
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto bg-white dark:bg-gray-900 mobile-scroll min-h-0 relative"
        style={{ 
          overscrollBehavior: 'contain',
          WebkitOverflowScrolling: 'touch',
          transform: 'translateZ(0)' // GPU acceleration
        }}
      >
        {messages.length === 0 && isConnected && (
          <div className="text-center text-gray-500 dark:text-gray-400 py-12">
            <div className="mb-3">
              <svg className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <p className="text-lg font-medium">No conversation yet</p>
            <p className="text-sm mt-1">Start a conversation with the agent below</p>
          </div>
        )}
        
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {messages.map((message) => (
            <div key={message.id} className="px-4 sm:px-6 py-4">
              <div className="flex items-start space-x-2 sm:space-x-3">
                <div className="flex-shrink-0">
                  <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center ${
                    message.role === 'user' 
                      ? 'bg-blue-500 text-white' 
                      : 'bg-purple-500 text-white'
                  }`}>
                    {message.role === 'user' ? (
                      <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                      </svg>
                    ) : (
                      <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                      </svg>
                    )}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-1 sm:space-x-2 mb-2">
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {message.role === 'user' ? 'You' : 'AgentAPI'}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {formatTimestamp(message.timestamp)}
                    </span>
                  </div>
                  <div className="prose prose-sm max-w-none text-gray-700 dark:text-gray-300">
                    <div className="whitespace-pre-wrap break-words overflow-wrap-anywhere max-w-full">{message.content}</div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div ref={messagesEndRef} />
        
        {/* 新着メッセージ通知とスクロールボタン */}
        {hasNewMessages && (
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
            <button
              onClick={() => {
                setShouldAutoScroll(true);
                setHasNewMessages(false);
                scrollToBottom();
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-full shadow-lg flex items-center space-x-2 transition-colors"
            >
              <span className="text-sm">新しいメッセージ</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            </button>
          </div>
        )}
        
        {/* スクロールボタン（新着メッセージがない場合でも表示） */}
        {!shouldAutoScroll && !hasNewMessages && (
          <div className="absolute bottom-4 right-4">
            <button
              onClick={() => {
                setShouldAutoScroll(true);
                scrollToBottom();
              }}
              className="bg-gray-600 hover:bg-gray-700 text-white p-2 rounded-full shadow-lg transition-colors"
              title="最新メッセージにスクロール"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 px-4 sm:px-6 py-4 flex-shrink-0">
        {/* Control Panel */}
        {showControlPanel && (
          <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md">
            <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">Agent Controls</h3>
            <div className="flex flex-wrap gap-2">
              {/* Arrow Up Button */}
              <button
                onClick={sendArrowUp}
                disabled={!isConnected || isLoading}
                className="px-2 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white text-xs rounded-md transition-colors disabled:cursor-not-allowed flex items-center space-x-1"
                title="Send Up Arrow Key"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
                <span>↑</span>
              </button>
              
              {/* Arrow Down Button */}
              <button
                onClick={sendArrowDown}
                disabled={!isConnected || isLoading}
                className="px-2 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white text-xs rounded-md transition-colors disabled:cursor-not-allowed flex items-center space-x-1"
                title="Send Down Arrow Key"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
                <span>↓</span>
              </button>
              
              {/* Enter Button */}
              <button
                onClick={sendEnterKey}
                disabled={!isConnected || isLoading}
                className="px-2 py-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white text-xs rounded-md transition-colors disabled:cursor-not-allowed flex items-center space-x-1"
                title="Send Enter Key"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Enter</span>
              </button>
              
              {/* ESC Button (existing functionality) */}
              <button
                onClick={sendStopSignal}
                disabled={!isConnected || isLoading}
                className="px-2 py-1 bg-red-600 hover:bg-red-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white text-xs rounded-md transition-colors disabled:cursor-not-allowed flex items-center space-x-1"
                title="Send ESC Key (Force Stop)"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>ESC</span>
              </button>
            </div>
          </div>
        )}
        
        <div className="flex items-start space-x-2 sm:space-x-3">
          <div className="flex-shrink-0">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-blue-500 text-white flex items-center justify-center">
              <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
              </svg>
            </div>
          </div>
          <div className="flex-1">
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={
                !isConnected 
                  ? "Connecting..." 
                  : agentStatus?.status === 'running'
                    ? "Agent is running, please wait..."
                    : "Write a comment..."
              }
              className="w-full resize-none border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[80px]"
              rows={3}
              disabled={!isConnected || isLoading || agentStatus?.status === 'running'}
            />
            <div className="flex items-center justify-between mt-3">
              <div className="text-xs text-gray-500 dark:text-gray-400 hidden sm:block">
                Press Enter to send, Shift+Enter for new line
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 block sm:hidden">
                Enter: send
              </div>
              <div className="flex items-center space-x-2">
                {/* Control Panel Toggle */}
                <button
                  onClick={() => setShowControlPanel(!showControlPanel)}
                  disabled={!isConnected}
                  className="px-2 py-2 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white text-xs rounded-md transition-colors disabled:cursor-not-allowed flex items-center"
                  title="Toggle Control Panel"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4" />
                  </svg>
                </button>
                
                <button
                  onClick={() => sendMessage()}
                  disabled={!isConnected || isLoading || !inputValue.trim() || agentStatus?.status === 'running'}
                  className="px-3 sm:px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed text-sm font-medium"
                >
                  {isLoading ? 'Sending...' : 'Comment'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}