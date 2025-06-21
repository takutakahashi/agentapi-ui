'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { createAgentAPIProxyClientFromStorage } from '../../lib/agentapi-proxy-client';
import { AgentAPIProxyError } from '../../lib/agentapi-proxy-client';
import { SessionMessage, SessionMessageListResponse } from '../../types/agentapi';
import { ProfileManager } from '../../utils/profileManager';
import { useBackgroundAwareInterval } from '../hooks/usePageVisibility';
import { messageTemplateManager } from '../../utils/messageTemplateManager';
import { MessageTemplate } from '../../types/messageTemplate';
import { recentMessagesManager } from '../../utils/recentMessagesManager';

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

function formatTextWithLinks(text: string): JSX.Element {
  if (!text || typeof text !== 'string') {
    return <>{text || ''}</>;
  }
  
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  
  const parts = text.split(urlRegex);
  
  return (
    <>
      {parts.map((part, index) => {
        if (urlRegex.test(part)) {
          return (
            <a
              key={index}
              href={part}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline whitespace-nowrap"
            >
              {part}
            </a>
          );
        }
        return part;
      })}
    </>
  );
}

export default function AgentAPIChat() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const sessionId = searchParams.get('session');
  
  // Get current profile and create profile-aware client
  const [currentProfile, setCurrentProfile] = useState(() => ProfileManager.getDefaultProfile());
  const [agentAPI, setAgentAPI] = useState<ReturnType<typeof createAgentAPIProxyClientFromStorage> | null>(null);
  const agentAPIRef = useRef<ReturnType<typeof createAgentAPIProxyClientFromStorage> | null>(null);
  
  // Initialize agentAPI only once after currentProfile is set
  useEffect(() => {
    if (currentProfile && !agentAPI) {
      const client = createAgentAPIProxyClientFromStorage(undefined, currentProfile.id);
      setAgentAPI(client);
      agentAPIRef.current = client;
    }
  }, [currentProfile, agentAPI]);
  
  // Initialize chat when agentAPI is ready
  useEffect(() => {
    if (agentAPI && sessionId) {
      const initializeChat = async () => {
        try {
          setError(null);
          
          if (sessionId) {
            // Session-based connection: load messages from agentapi-proxy
            try {
              if (!agentAPIRef.current) return;
              const sessionMessagesResponse = await agentAPIRef.current.getSessionMessages(sessionId, { limit: 100 });
              
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
    }
  }, [sessionId, agentAPI]);
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [agentStatus, setAgentStatus] = useState<AgentStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const [hasNewMessages, setHasNewMessages] = useState(false);
  const [showControlPanel, setShowControlPanel] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [recentMessages, setRecentMessages] = useState<string[]>([]);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
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

  // Listen for profile changes and recreate client
  useEffect(() => {
    const handleProfileChange = (event: CustomEvent) => {
      const newProfileId = event.detail.profileId;
      const newProfile = ProfileManager.getProfile(newProfileId);
      
      if (newProfile && newProfile.id !== currentProfile?.id) {
        setCurrentProfile(newProfile);
        loadTemplatesForProfile(newProfile.id);
        const client = createAgentAPIProxyClientFromStorage(undefined, newProfile.id);
        setAgentAPI(client);
        agentAPIRef.current = client;
      }
    };

    window.addEventListener('profileChanged', handleProfileChange as EventListener);
    
    return () => {
      window.removeEventListener('profileChanged', handleProfileChange as EventListener);
    };
  }, [currentProfile?.id]);

  useEffect(() => {
    if (currentProfile) {
      loadTemplatesForProfile(currentProfile.id);
      loadRecentMessages();
    }
  }, [currentProfile]);

  const loadTemplatesForProfile = async (profileId: string) => {
    try {
      const profileTemplates = await messageTemplateManager.getTemplatesForProfile(profileId);
      setTemplates(profileTemplates);
    } catch (error) {
      console.error('Failed to load templates:', error);
      setTemplates([]);
    }
  };

  const loadRecentMessages = async () => {
    if (!currentProfile) return;
    try {
      const messages = await recentMessagesManager.getRecentMessages(currentProfile.id);
      setRecentMessages(messages.map(msg => msg.content));
    } catch (error) {
      console.error('Failed to load recent messages:', error);
    }
  };

  // Session-based polling for messages (2 second interval)
  const pollMessages = useCallback(async () => {
    if (!isConnected || !sessionId || !agentAPIRef.current) return;
    
    try {
      // Poll both messages and status
      const [sessionMessagesResponse, sessionStatus] = await Promise.all([
        agentAPIRef.current.getSessionMessages(sessionId, { limit: 100 }),
        agentAPIRef.current.getSessionStatus(sessionId)
      ]);
      
      // Validate and safely handle session messages response
      if (!isValidSessionMessageResponse(sessionMessagesResponse)) {
        console.warn('Invalid session messages response structure during polling:', sessionMessagesResponse);
        return;
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
  }, [isConnected, sessionId]); // agentAPIを依存配列から除去

  // バックグラウンド対応の定期更新フック
  const pollingControl = useBackgroundAwareInterval(pollMessages, 1000, true);
  const pollingControlRef = useRef(pollingControl);
  pollingControlRef.current = pollingControl;

  // Setup real-time event listening
  useEffect(() => {
    const control = pollingControlRef.current;
    
    if (isConnected && sessionId) {
      control.start();
    } else {
      control.stop();
    }

    return () => {
      control.stop();
    };
  }, [isConnected, sessionId]); // pollingControlを依存配列から除去

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
        if (!agentAPIRef.current) {
          setError('AgentAPI client not available');
          return;
        }
        const sessionMessage = await agentAPIRef.current.sendSessionMessage(sessionId, {
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
        // 最近のメッセージに保存
        if (currentProfile) {
          await recentMessagesManager.saveMessage(currentProfile.id, messageContent);
          await loadRecentMessages();
        }
        
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

  const deleteSession = async () => {
    if (!sessionId) return;
    
    const confirmed = window.confirm('このセッションを削除しますか？この操作は元に戻せません。');
    if (!confirmed) return;

    setIsDeleting(true);
    setError(null);

    try {
      if (!agentAPIRef.current) {
        setError('AgentAPI client not available');
        return;
      }
      await agentAPIRef.current.delete(sessionId);
      // セッション削除後、conversation画面にリダイレクト
      router.push('/chats');
    } catch (err) {
      console.error('Failed to delete session:', err);
      if (err instanceof AgentAPIProxyError) {
        setError(`セッションの削除に失敗しました: ${err.message}`);
      } else {
        setError('セッションの削除に失敗しました');
      }
    } finally {
      setIsDeleting(false);
    }
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

            {/* Delete Session Button */}
            {sessionId && (
              <button
                onClick={deleteSession}
                disabled={isDeleting}
                className="p-2 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-200 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title={isDeleting ? 'セッションを削除中...' : 'セッションを削除'}
              >
                {isDeleting ? (
                  <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                )}
              </button>
            )}

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
                    <div className="whitespace-pre-wrap break-words overflow-wrap-anywhere max-w-full">
                      {formatTextWithLinks(message.content)}
                    </div>
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
          <div className="flex-1 relative">
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              onFocus={() => {
                if (templates.length > 0 && !inputValue.trim()) {
                  setShowTemplates(true);
                }
              }}
              onBlur={() => {
                setTimeout(() => setShowTemplates(false), 150);
              }}
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
            {showTemplates && templates.length > 0 && (
              <div className="absolute z-50 w-full bottom-full mb-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-60 overflow-y-auto">
                <div className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                  メッセージテンプレート
                </div>
                {templates.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => {
                      setInputValue(template.content);
                      setShowTemplates(false);
                    }}
                    className="w-full text-left px-3 py-3 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-white border-b border-gray-100 dark:border-gray-700 last:border-b-0"
                  >
                    <div className="font-medium text-sm">{template.name}</div>
                    <div className="line-clamp-2 text-xs text-gray-600 dark:text-gray-400 mt-1">
                      {template.content}
                    </div>
                  </button>
                ))}
              </div>
            )}
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
                
                {/* Template Button */}
                <button
                  onClick={() => setShowTemplateModal(true)}
                  disabled={!isConnected || isLoading}
                  className="px-2 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white text-xs rounded-md transition-colors disabled:cursor-not-allowed flex items-center"
                  title="テンプレートから選択"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
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

      {/* Template Selection Modal */}
      {showTemplateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">テンプレートから選択</h2>
                <button
                  onClick={() => setShowTemplateModal(false)}
                  className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            <div className="overflow-y-auto max-h-[calc(80vh-8rem)]">
              {/* Recent Messages Section */}
              {recentMessages.length > 0 && (
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">最近のメッセージ</h3>
                  <div className="space-y-2">
                    {recentMessages.map((message, index) => (
                      <button
                        key={index}
                        onClick={() => {
                          setInputValue(message);
                          setShowTemplateModal(false);
                        }}
                        className="w-full text-left px-3 py-2 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-md transition-colors"
                      >
                        <div className="text-sm text-gray-900 dark:text-white line-clamp-2">
                          {message}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Templates Section */}
              <div className="px-6 py-4">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">テンプレート</h3>
                {templates.length > 0 ? (
                  <div className="space-y-2">
                    {templates.map((template) => (
                      <button
                        key={template.id}
                        onClick={() => {
                          setInputValue(template.content);
                          setShowTemplateModal(false);
                        }}
                        className="w-full text-left px-3 py-3 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-md transition-colors"
                      >
                        <div className="font-medium text-sm text-gray-900 dark:text-white">{template.name}</div>
                        <div className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                          {template.content}
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    <p className="text-sm">テンプレートがありません</p>
                    <button
                      onClick={() => {
                        setShowTemplateModal(false);
                        router.push('/settings?tab=templates');
                      }}
                      className="mt-2 text-sm text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      テンプレートを作成
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
