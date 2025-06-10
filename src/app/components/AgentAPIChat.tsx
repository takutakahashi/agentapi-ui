'use client';

import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { realAgentAPI, RealAgentAPIError } from '../../lib/real-agentapi-client';
import { createAgentAPIClientFromStorage, AgentAPIError } from '../../lib/agentapi-client';
import { Message, AgentStatus } from '../../types/real-agentapi';
import { SessionMessage } from '../../types/agentapi';

export default function AgentAPIChat() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session');
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [agentStatus, setAgentStatus] = useState<AgentStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Initialize session-based or direct AgentAPI connection
  useEffect(() => {
    const initializeChat = async () => {
      try {
        setError(null);
        
        if (sessionId) {
          // Session-based connection: load messages from agentapi-proxy
          try {
            const proxyClient = createAgentAPIClientFromStorage();
            const sessionMessagesResponse = await proxyClient.getSessionMessages(sessionId, { limit: 100 });
            
            // Convert SessionMessage to Message format for display
            const convertedMessages: Message[] = sessionMessagesResponse.messages.map((msg: SessionMessage, index: number) => ({
              id: parseInt(msg.id) || index, // Convert string ID to number
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
            if (err instanceof AgentAPIError) {
              setError(`Failed to load session messages: ${err.message} (Session: ${sessionId})`);
            } else {
              setError(`Failed to connect to session ${sessionId}`);
            }
            return;
          }
        }
        
        // Direct AgentAPI connection
        const apiClient = realAgentAPI;
        
        // Check if API is available
        const isHealthy = await apiClient.healthCheck();
        if (!isHealthy) {
          setError('AgentAPI is not available. Please check the connection.');
          return;
        }

        // Get initial status
        const status = await apiClient.getStatus();
        setAgentStatus(status);

        // Get message history
        const messagesResponse = await apiClient.getMessages();
        setMessages(messagesResponse.messages);

        setIsConnected(true);
      } catch (err) {
        console.error('Failed to initialize chat:', err);
        if (err instanceof RealAgentAPIError) {
          setError(`Failed to connect: ${err.message}`);
        } else {
          setError('Failed to connect to AgentAPI');
        }
      }
    };

    initializeChat();
  }, [sessionId]);

  // Setup real-time event listening
  useEffect(() => {
    if (!isConnected) return;

    const eventSource = realAgentAPI.subscribeToEvents(
      (message: Message) => {
        setMessages(prev => {
          // Avoid duplicates
          if (prev.some(m => m.id === message.id)) {
            return prev.map(m => m.id === message.id ? message : m);
          }
          return [...prev, message];
        });
      },
      (status: AgentStatus) => {
        setAgentStatus(status);
      },
      (error: Error) => {
        console.error('EventSource error:', error);
        setError('Real-time connection lost. Some updates may be delayed.');
      }
    );

    eventSourceRef.current = eventSource;

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [isConnected]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async () => {
    if (!inputValue.trim() || isLoading || !isConnected) return;
    
    if (!sessionId && agentStatus?.status === 'running') {
      setError('Agent is currently running. Please wait for it to become stable.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      if (sessionId) {
        // Send message via session
        const proxyClient = createAgentAPIClientFromStorage();
        const sessionMessage = await proxyClient.sendSessionMessage(sessionId, {
          content: inputValue.trim(),
          role: 'user'
        });

        // Convert to Message format and add to display
        const convertedMessage: Message = {
          id: parseInt(sessionMessage.id) || Date.now(), // Convert string ID to number
          role: sessionMessage.role === 'assistant' ? 'agent' : (sessionMessage.role === 'system' ? 'agent' : sessionMessage.role as 'user' | 'agent'),
          content: sessionMessage.content,
          timestamp: sessionMessage.timestamp
        };

        setMessages(prev => [...prev, convertedMessage]);
      } else {
        // Send message via direct AgentAPI
        const message = await realAgentAPI.sendMessage({
          content: inputValue.trim(),
          type: 'user'
        });

        setMessages(prev => [...prev, message]);
      }
      
      setInputValue('');
    } catch (err) {
      console.error('Failed to send message:', err);
      if (sessionId && err instanceof AgentAPIError) {
        setError(`Failed to send message: ${err.message} (Session: ${sessionId})`);
      } else if (err instanceof RealAgentAPIError) {
        setError(`Failed to send message: ${err.message}`);
      } else {
        setError('Failed to send message');
      }
    } finally {
      setIsLoading(false);
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
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-3 md:p-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              AgentAPI Chat
              {sessionId && (
                <span className="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400">
                  Session: {sessionId.substring(0, 8)}...
                </span>
              )}
            </h2>
          </div>
          <div className="flex items-center space-x-2 md:space-x-4">
            {agentStatus && (
              <div className="flex items-center space-x-1 md:space-x-2">
                <div className={`w-2 h-2 rounded-full ${agentStatus.status === 'stable' ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                <span className={`text-xs md:text-sm font-medium ${getStatusColor(agentStatus.status)}`}>
                  {agentStatus.status}
                </span>
              </div>
            )}
            <div className={`flex items-center space-x-1 md:space-x-2`}>
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span className={`text-xs md:text-sm ${isConnected ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
          </div>
        </div>
        {error && (
          <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-red-700 dark:text-red-400 text-sm">
            {error}
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 md:p-4 space-y-4 bg-gray-50 dark:bg-gray-900 mobile-scroll min-h-0">
        {messages.length === 0 && isConnected && (
          <div className="text-center text-gray-500 dark:text-gray-400 py-8">
            No messages yet. Start a conversation with the agent!
          </div>
        )}
        
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] md:max-w-lg px-3 md:px-4 py-2 rounded-lg ${
                message.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-600'
              }`}
            >
              <div className="whitespace-pre-wrap break-words text-sm md:text-base">{message.content}</div>
              <div
                className={`text-xs mt-1 ${
                  message.role === 'user' ? 'text-blue-100' : 'text-gray-500 dark:text-gray-400'
                }`}
              >
                {formatTimestamp(message.timestamp)}
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-3 md:p-4 flex-shrink-0">
        <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4">
          <textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={
              !isConnected 
                ? "Connecting to AgentAPI..." 
                : agentStatus?.status === 'running'
                  ? "Agent is running, please wait..."
                  : "Type your message and press Enter to send..."
            }
            className="flex-1 resize-none border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent min-h-[2.5rem]"
            rows={2}
            disabled={!isConnected || isLoading || agentStatus?.status === 'running'}
          />
          <button
            onClick={sendMessage}
            disabled={!isConnected || isLoading || !inputValue.trim() || agentStatus?.status === 'running'}
            className="px-4 md:px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed text-sm md:text-base flex-shrink-0"
          >
            {isLoading ? 'Sending...' : 'Send'}
          </button>
        </div>
        <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          Press Enter to send, Shift+Enter for new line
        </div>
      </div>
    </div>
  );
}