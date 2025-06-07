'use client';

import { useState, useEffect, useRef } from 'react';
import { realAgentAPI, RealAgentAPIError } from '../../lib/real-agentapi-client';
import { Message, AgentStatus } from '../../types/real-agentapi';

export default function AgentAPIChat() {
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

  // Load initial messages and status
  useEffect(() => {
    const initializeChat = async () => {
      try {
        setError(null);
        
        // Check if API is available
        const isHealthy = await realAgentAPI.healthCheck();
        if (!isHealthy) {
          setError('AgentAPI is not available. Please check the connection.');
          return;
        }

        // Get initial status
        const status = await realAgentAPI.getStatus();
        setAgentStatus(status);

        // Get message history
        const messagesResponse = await realAgentAPI.getMessages();
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
  }, []);

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
    
    if (agentStatus?.status === 'running') {
      setError('Agent is currently running. Please wait for it to become stable.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const message = await realAgentAPI.sendMessage({
        content: inputValue.trim(),
        type: 'user'
      });

      // Add the message immediately (it will be updated via EventSource if needed)
      setMessages(prev => [...prev, message]);
      setInputValue('');
    } catch (err) {
      console.error('Failed to send message:', err);
      if (err instanceof RealAgentAPIError) {
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
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">AgentAPI Chat</h2>
          <div className="flex items-center space-x-4">
            {agentStatus && (
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${agentStatus.status === 'stable' ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                <span className={`text-sm font-medium ${getStatusColor(agentStatus.status)}`}>
                  {agentStatus.status}
                </span>
              </div>
            )}
            <div className={`flex items-center space-x-2`}>
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span className={`text-sm ${isConnected ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
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
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 dark:bg-gray-900">
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
              className={`max-w-lg px-4 py-2 rounded-lg ${
                message.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-600'
              }`}
            >
              <div className="whitespace-pre-wrap break-words">{message.content}</div>
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
      <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4">
        <div className="flex space-x-4">
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
            className="flex-1 resize-none border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            rows={3}
            disabled={!isConnected || isLoading || agentStatus?.status === 'running'}
          />
          <button
            onClick={sendMessage}
            disabled={!isConnected || isLoading || !inputValue.trim() || agentStatus?.status === 'running'}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed"
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