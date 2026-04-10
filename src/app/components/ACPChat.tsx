'use client';

/**
 * ACPChat
 *
 * Dedicated chat UI for claude-acp sessions.  Receives the already-established
 * ACP WebSocket connection from the parent (AgentAPIChat) so there is only one
 * WebSocket per session.
 *
 * Key behaviours:
 *  - Input is enabled whenever the ACP WebSocket is connected.
 *  - When the agent is running AND promptQueueing=true, sending is still allowed
 *    (the agent will queue the prompt internally).
 *  - The stop button sends a session/cancel ACP notification.
 *  - Connection state is shown clearly in the header.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import type { UseACPWebSocketResult } from '../hooks/useACPWebSocket';
import MessageItem from './MessageItem';
import { getEnterKeyBehavior, getFontSettings, FontSettings } from '../../types/settings';
import { InitialMessageCache } from '../../utils/initialMessageCache';

interface ACPChatProps {
  sessionId: string;
  acpWS: UseACPWebSocketResult;
}

export default function ACPChat({ sessionId, acpWS }: ACPChatProps) {
  const [inputValue, setInputValue] = useState('');
  const [fontSettings, setFontSettings] = useState<FontSettings>(() => getFontSettings());
  /** Prevents the initial message from being sent more than once. */
  const initialMessageSentRef = useRef(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(true);

  // ── Font settings sync ───────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<FontSettings>).detail;
      if (detail) setFontSettings(detail);
    };
    window.addEventListener('fontSettingsChanged', handler);
    return () => window.removeEventListener('fontSettingsChanged', handler);
  }, []);

  // ── Auto-send initial message ────────────────────────────────────────────
  // For claude-acp sessions the provisioner cannot send the initial message via
  // REST (acp-ws-server has no /message endpoint).  We send it here once the
  // ACP WebSocket is established and there are no existing messages yet.
  useEffect(() => {
    if (initialMessageSentRef.current) return;
    if (acpWS.acpMessages.length > 0) return; // existing conversation — don't re-send

    const cached = InitialMessageCache.getCachedMessages();
    if (cached.length === 0) return;

    initialMessageSentRef.current = true;
    const initialMsg = cached[0];
    InitialMessageCache.clearCache();
    acpWS.sendPrompt(initialMsg);
  // Run once on mount (ACPChat is only mounted when acpWS.isConnected is true)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Auto-scroll ──────────────────────────────────────────────────────────
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const handleScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const { scrollTop, scrollHeight, clientHeight } = container;
    shouldAutoScrollRef.current = scrollHeight - scrollTop - clientHeight < 120;
  }, []);

  useEffect(() => {
    if (shouldAutoScrollRef.current) scrollToBottom();
  }, [acpWS.acpMessages, scrollToBottom]);

  // ── Derived state ────────────────────────────────────────────────────────
  const canSend =
    acpWS.isConnected &&
    inputValue.trim().length > 0 &&
    (!acpWS.agentRunning || acpWS.promptQueueing);

  const inputDisabled = !acpWS.isConnected;

  const placeholder = !acpWS.isConnected
    ? acpWS.isConnecting
      ? 'Connecting via ACP…'
      : 'ACP connection failed — retrying…'
    : acpWS.agentRunning && !acpWS.promptQueueing
      ? 'Agent is running, please wait…'
      : 'Write a message…';

  // ── Send ─────────────────────────────────────────────────────────────────
  const sendMessage = useCallback(async () => {
    const text = inputValue.trim();
    if (!text || !canSend) return;
    setInputValue('');
    shouldAutoScrollRef.current = true;
    await acpWS.sendPrompt(text);
    setTimeout(scrollToBottom, 100);
  }, [inputValue, canSend, acpWS, scrollToBottom]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key !== 'Enter') return;
      const behavior = getEnterKeyBehavior();
      const modifier = e.metaKey || e.ctrlKey;
      const shouldSend = behavior === 'send' ? !modifier : modifier;
      if (shouldSend) {
        e.preventDefault();
        sendMessage();
      }
    },
    [sendMessage],
  );

  // ── Connection badge ─────────────────────────────────────────────────────
  const connectionBadge = acpWS.isConnected ? (
    <span className="text-xs text-blue-500 font-medium">⚡ ACP</span>
  ) : acpWS.isConnecting ? (
    <span className="text-xs text-yellow-500 font-medium">⏳ Connecting…</span>
  ) : (
    <span className="text-xs text-red-500 font-medium">⚠ Disconnected</span>
  );

  const isMac = typeof window !== 'undefined' && navigator.platform.includes('Mac');
  const modKey = isMac ? '⌘' : 'Ctrl';
  const enterHint =
    getEnterKeyBehavior() === 'send'
      ? `Enter: send, ${modKey}+Enter: new line`
      : `${modKey}+Enter: send, Enter: new line`;

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900" style={{ minHeight: 0 }}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-3 sm:px-6 py-1.5 sm:py-2 flex-shrink-0">
        <div className="flex items-center justify-between">

          <div className="flex items-center space-x-2 sm:space-x-4">
            <Link
              href="/chats"
              className="flex items-center space-x-1 sm:space-x-2 px-2 py-1 text-xs sm:text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors"
            >
              <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <span className="hidden sm:inline">Conversations</span>
            </Link>

            <div>
              <h2 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white">
                Chat
                <span className="ml-2 text-xs font-normal text-gray-500 dark:text-gray-400">
                  #{sessionId.substring(0, 6)}
                </span>
              </h2>
            </div>
          </div>

          <div className="flex items-center space-x-2 sm:space-x-4">
            {/* Agent running indicator */}
            <div className="flex items-center space-x-1">
              <div
                className={`w-2 h-2 rounded-full ${
                  acpWS.agentRunning
                    ? 'bg-yellow-400 animate-pulse'
                    : acpWS.isConnected
                    ? 'bg-green-500'
                    : 'bg-gray-400'
                }`}
              />
              <span className="text-xs text-gray-500 dark:text-gray-400 hidden sm:inline">
                {acpWS.agentRunning ? 'Running' : acpWS.isConnected ? 'Ready' : '—'}
              </span>
            </div>

            {connectionBadge}

            {/* Stop button — only while running */}
            {acpWS.agentRunning && (
              <button
                onClick={acpWS.cancelSession}
                className="px-2 sm:px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs sm:text-sm rounded-md transition-colors flex items-center space-x-1"
                title="Stop (session/cancel)"
              >
                <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10h6v4H9z" />
                </svg>
                <span className="hidden sm:inline">Stop</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Messages ────────────────────────────────────────────────────── */}
      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-3 sm:px-6 py-4"
        style={{ minHeight: 0 }}
      >
        {acpWS.acpMessages.length === 0 && (
          <div className="flex items-center justify-center h-32 text-gray-400 dark:text-gray-600 text-sm">
            {acpWS.isConnecting
              ? 'Connecting…'
              : acpWS.isConnected
              ? 'No messages yet. Say something!'
              : 'ACP connection failed. Retrying…'}
          </div>
        )}

        <div className="space-y-1">
          {acpWS.acpMessages.map((message) => (
            <MessageItem
              key={message.id}
              message={message}
              formatTimestamp={(ts) => new Date(ts).toLocaleTimeString()}
              fontSettings={fontSettings}
              isClaudeAgent={false}
            />
          ))}
        </div>

        {/* Streaming / thinking indicator */}
        {acpWS.agentRunning && (
          <div className="flex items-center space-x-2 px-4 py-3 text-gray-400 dark:text-gray-500 text-sm">
            <span className="flex space-x-1">
              <span
                className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"
                style={{ animationDelay: '0ms' }}
              />
              <span
                className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"
                style={{ animationDelay: '150ms' }}
              />
              <span
                className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"
                style={{ animationDelay: '300ms' }}
              />
            </span>
            <span>Agent is thinking…</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ── Input ───────────────────────────────────────────────────────── */}
      <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 sm:px-6 py-3 flex-shrink-0">
        <textarea
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={inputDisabled}
          rows={3}
          className="w-full resize-none border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[80px] disabled:opacity-50 disabled:cursor-not-allowed"
        />

        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-gray-400 dark:text-gray-500 hidden sm:block">
            {enterHint}
          </span>

          <div className="flex items-center space-x-2">
            {acpWS.promptQueueing && acpWS.agentRunning && (
              <span
                className="text-xs text-blue-400 hidden sm:inline"
                title="Agent supports prompt queueing — you can send while it runs"
              >
                Queue mode
              </span>
            )}

            <button
              onClick={sendMessage}
              disabled={!canSend}
              className="px-3 sm:px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed text-sm font-medium transition-colors"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
