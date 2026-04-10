'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createAgentAPIProxyClientFromStorage } from '../../lib/agentapi-proxy-client';
import { AgentAPIProxyError } from '../../lib/agentapi-proxy-client';
import { SessionMessage, SessionMessageListResponse, PendingAction } from '../../types/agentapi';
import { useBackgroundAwareInterval } from '../hooks/usePageVisibility';
import { messageTemplateManager } from '../../utils/messageTemplateManager';
import { MessageTemplate } from '../../types/messageTemplate';
import { recentMessagesManager } from '../../utils/recentMessagesManager';
import { pushNotificationManager } from '../../utils/pushNotification';
import { getEnterKeyBehavior, getFontSettings, FontSettings, setFontSettings as saveFontSettings, FontFamily } from '../../types/settings';
import ShareSessionButton from './ShareSessionButton';
import MessageItem from './MessageItem';
import ToolExecutionPane from './ToolExecutionPane';
import PlanApprovalModal from './PlanApprovalModal';
import AskUserQuestionModal from './AskUserQuestionModal';
import { useACPWebSocket } from '../hooks/useACPWebSocket';
import ACPChat from './ACPChat';

// Define local types for agent status
interface AgentStatus {
  status: 'stable' | 'running' | 'error';
  last_activity?: string;
  current_task?: string;
  /** Provisioner error message when status is 'error' */
  message?: string;
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

// PR URLを抽出する関数
function extractPRUrls(text: string): string[] {
  if (!text || typeof text !== 'string') return [];
  
  // GitHub/GitHub Enterprise PR URLのパターン
  // 1. GitHub.com: https://github.com/owner/repo/pull/number
  // 2. GitHub Enterprise: https://ghe.example.com/owner/repo/pull/number
  // GitHub Enterpriseは任意のドメインで動作するため、より汎用的なパターンを使用
  const prUrlRegex = /https?:\/\/[^\/\s]+\/[^\/\s]+\/[^\/\s]+\/pull\/\d+/g;
  const matches = text.match(prUrlRegex);
  
  // URLがGitHub形式のPR URLかを検証
  const validPRUrls = matches ? matches.filter(url => {
    // URLのパスが /owner/repo/pull/number の形式であることを確認
    const urlParts = url.split('/');
    const hasPullPath = urlParts.length >= 7 && urlParts[urlParts.length - 2] === 'pull';
    
    // pull以降が数値であることを確認
    const prNumber = urlParts[urlParts.length - 1];
    const hasValidPRNumber = /^\d+$/.test(prNumber);
    
    return hasPullPath && hasValidPRNumber;
  }) : [];
  
  const result = Array.from(new Set(validPRUrls)); // 重複を除去
  
  // デバッグ用ログ
  if (text.includes('pull')) {
    console.log('PR URL検索対象:', text);
    console.log('検出されたPR URL:', result);
  }
  
  return result;
}


interface AgentAPIChatProps {
  sessionId?: string;
}

export default function AgentAPIChat({ sessionId: propSessionId }: AgentAPIChatProps = {}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  // Use sessionId from props if provided, otherwise fall back to query param
  const sessionId = propSessionId || searchParams.get('session');

  // Create global API client
  const [agentAPI] = useState<ReturnType<typeof createAgentAPIProxyClientFromStorage>>(() => {
    return createAgentAPIProxyClientFromStorage();
  });
  const agentAPIRef = useRef<ReturnType<typeof createAgentAPIProxyClientFromStorage>>(agentAPI);

  // ACP WebSocket connection — tries WS first, falls back to polling on failure.
  // connectionFailed=true means polling mode should be used.
  const acpWS = useACPWebSocket(sessionId);

  // Keep ref in sync
  useEffect(() => {
    agentAPIRef.current = agentAPI;
  }, [agentAPI]);

  // Initialize push notifications
  useEffect(() => {
    pushNotificationManager.initialize().catch(console.error);
  }, []);
  
  // Initialize chat when agentAPI is ready - optimized for faster loading
  useEffect(() => {
    if (agentAPI && sessionId) {
      // Reset initial load flag when session changes
      setIsInitialLoadComplete(false);
      setIsStarting(false);
      // Clear any pending retry timer
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }

      const initializeChat = async () => {
        try {
          setError(null);
          setIsConnected(true); // Set connected immediately for better UX

          if (sessionId) {
            // Session-based connection: load latest messages
            try {
              if (!agentAPIRef.current) return;
              // Fetch only the latest 50 messages initially (direction: tail gets most recent)
              const sessionMessagesResponse = await agentAPIRef.current.getSessionMessages(sessionId, {
                limit: 50,
                direction: 'tail'
              });

              // Validate and safely handle session messages response
              if (!isValidSessionMessageResponse(sessionMessagesResponse)) {
                console.warn('Invalid session messages response structure:', sessionMessagesResponse);
              }

              // Store latest messages
              const fetchedMessages = sessionMessagesResponse?.messages || [];
              setMessages(fetchedMessages);

              // Check if there are more messages using hasMore field or total count
              const hasMore = sessionMessagesResponse?.hasMore ??
                             (sessionMessagesResponse?.total ? sessionMessagesResponse.total > fetchedMessages.length : false);
              setHasMoreMessages(hasMore);
              setError(null);
              setIsStarting(false);

              // Mark initial load as complete
              setIsInitialLoadComplete(true);

              // Scroll to bottom after messages are loaded
              setTimeout(() => {
                messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
              }, 100);

              return;
            } catch (err) {
              console.error('Failed to load session messages:', err);
              setIsConnected(false); // Only set disconnected on actual error
              if (err instanceof AgentAPIProxyError && (err.status === 502 || err.status === 503)) {
                // サービス起動中の可能性があるため、プロビジョナーのステータスを確認してから再試行
                if (agentAPIRef.current) {
                  try {
                    const provStatus = await agentAPIRef.current.getSessionStatus(sessionId);
                    if (provStatus.status === 'error') {
                      // プロビジョナーが恒久的に失敗した場合は再試行を停止してエラーを表示
                      const detail = provStatus.message || '不明なエラー';
                      setError(`セッションの起動に失敗しました: ${detail}`);
                      setIsStarting(false);
                      return;
                    }
                  } catch {
                    // ステータス確認に失敗した場合は通常の再試行を続行
                  }
                }
                setIsStarting(true);
                retryTimerRef.current = setTimeout(initializeChat, 2000);
                return;
              }
              if (err instanceof AgentAPIProxyError) {
                setError(`セッションメッセージの読み込みに失敗しました: ${err.message} (セッション: ${sessionId})`);
              } else {
                setError(`セッション ${sessionId} への接続に失敗しました`);
              }
              return;
            }
          } else {
            setError('No session ID provided. Please provide a session ID to connect.');
            setIsConnected(false);
            return;
          }
        } catch (err) {
          console.error('Failed to initialize chat:', err);
          setIsConnected(false);
          if (err instanceof AgentAPIProxyError && (err.status === 502 || err.status === 503)) {
            // サービス起動中の可能性があるため、処理中として扱い再試行
            setIsStarting(true);
            retryTimerRef.current = setTimeout(initializeChat, 2000);
            return;
          }
          if (err instanceof AgentAPIProxyError) {
            setError(`接続に失敗しました: ${err.message}`);
          } else {
            setError('AgentAPI Proxyへの接続に失敗しました');
          }
        }
      };

      // Use setTimeout to defer heavy initialization
      const timeoutId = setTimeout(initializeChat, 0);
      return () => {
        clearTimeout(timeoutId);
        if (retryTimerRef.current) {
          clearTimeout(retryTimerRef.current);
          retryTimerRef.current = null;
        }
      };
    }
  }, [sessionId, agentAPI]);

  const [messages, setMessages] = useState<SessionMessage[]>([]);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isInitialLoadComplete, setIsInitialLoadComplete] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const messageInputRef = useRef<HTMLTextAreaElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [fontSettings, setFontSettings] = useState<FontSettings>(() => getFontSettings());
  const [agentStatus, setAgentStatus] = useState<AgentStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const [hasNewMessages, setHasNewMessages] = useState(false);
  const [showControlPanel, setShowControlPanel] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [recentMessages, setRecentMessages] = useState<string[]>([]);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showPRLinks, setShowPRLinks] = useState(false);
  const [prLinks, setPRLinks] = useState<string[]>([]);
  const [showFontSettings, setShowFontSettings] = useState(false);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [planContent, setPlanContent] = useState<string>('');
  const [agentType, setAgentType] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesTopRef = useRef<HTMLDivElement>(null);
  const prevMessagesLengthRef = useRef(0);
  const prevAgentStatusRef = useRef<AgentStatus | null>(null);
  const lastLoadTimeRef = useRef<number>(0);

  // ── ACP + polling message merge ─────────────────────────────────────────────
  // When ACP WebSocket is connected (or connecting with restored history),
  // new messages arrive through it and are persisted to sessionStorage.
  // For claude-acp sessions: ACP messages are the source of truth for history.
  // For other sessions: REST polling is used (unchanged behaviour).
  const displayMessages = useMemo(() => {
    if (acpWS.acpMessages.length === 0) return messages;
    // Merge: REST history first, then any ACP messages not already in REST list
    // (REST history is always empty for claude-acp sessions, so this is effectively
    // just the ACP messages with deduplication for safety)
    const existingIds = new Set(messages.map((m) => m.id));
    const newACP = acpWS.acpMessages.filter((m) => !existingIds.has(m.id));
    return newACP.length > 0 ? [...messages, ...newACP] : messages;
  }, [messages, acpWS.acpMessages]);

  // Effective agent status: use ACP running state when WS is connected
  const effectiveAgentStatus = useMemo<AgentStatus | null>(() => {
    if (acpWS.isConnected) {
      return { status: acpWS.agentRunning ? 'running' : 'stable' };
    }
    return agentStatus;
  }, [acpWS.isConnected, acpWS.agentRunning, agentStatus]);

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

  const loadMoreMessages = useCallback(async () => {
    if (!hasMoreMessages || isLoadingMore || !sessionId || !agentAPIRef.current) return;

    // Prevent loading if less than 2 seconds have passed since last load
    const now = Date.now();
    const timeSinceLastLoad = now - lastLoadTimeRef.current;
    const cooldownPeriod = 2000; // 2 seconds

    if (timeSinceLastLoad < cooldownPeriod) {
      console.log(`[loadMoreMessages] Cooldown active. Wait ${Math.ceil((cooldownPeriod - timeSinceLastLoad) / 1000)}s before loading more.`);
      return;
    }

    const container = messagesContainerRef.current;
    if (!container) return;

    // Update last load time
    lastLoadTimeRef.current = now;

    // Save current scroll position
    const previousScrollHeight = container.scrollHeight;
    const previousScrollTop = container.scrollTop;

    setIsLoadingMore(true);
    try {
      // Get the oldest message ID (smallest ID)
      const oldestMessage = messages[0];
      if (!oldestMessage || typeof oldestMessage.id !== 'number') {
        console.error('Invalid oldest message:', oldestMessage);
        setIsLoadingMore(false);
        setHasMoreMessages(false);
        return;
      }

      console.log('[loadMoreMessages] Fetching messages before ID:', oldestMessage.id);

      // Fetch messages before the oldest message ID using cursor-based pagination
      const response = await agentAPIRef.current.getSessionMessages(sessionId, {
        before: oldestMessage.id,
        limit: 50
      });

      if (!isValidSessionMessageResponse(response)) {
        console.warn('Invalid session messages response:', response);
        setIsLoadingMore(false);
        return;
      }

      const olderMessages = response?.messages || [];
      console.log(`[loadMoreMessages] Fetched ${olderMessages.length} older messages`);

      if (olderMessages.length > 0) {
        // Prepend older messages to the beginning
        setMessages(prev => [...olderMessages, ...prev]);

        // Use hasMore field from response to determine if there are more messages
        const hasMore = response?.hasMore ?? (olderMessages.length >= 50);
        setHasMoreMessages(hasMore);

        // Restore scroll position after DOM update
        setTimeout(() => {
          if (container) {
            const newScrollHeight = container.scrollHeight;
            const scrollDiff = newScrollHeight - previousScrollHeight;
            container.scrollTop = previousScrollTop + scrollDiff;
            console.log('[loadMoreMessages] Restored scroll position, scrollDiff:', scrollDiff);
          }
        }, 0);
      } else {
        console.log('[loadMoreMessages] No more older messages');
        setHasMoreMessages(false);
      }
    } catch (err) {
      console.error('Failed to load more messages:', err);
    } finally {
      setIsLoadingMore(false);
    }
  }, [hasMoreMessages, isLoadingMore, sessionId, messages]);

  // ESCキーでモーダルを閉じる
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (showQuestionModal) {
          setShowQuestionModal(false)
        } else if (showTemplateModal) {
          setShowTemplateModal(false)
        } else if (showPRLinks) {
          setShowPRLinks(false)
        } else if (showFontSettings) {
          setShowFontSettings(false)
        }
      }
    }

    if (showQuestionModal || showTemplateModal || showPRLinks || showFontSettings) {
      document.addEventListener('keydown', handleKeyDown)
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [showQuestionModal, showTemplateModal, showPRLinks, showFontSettings])

  // Listen for font settings changes
  useEffect(() => {
    const handleFontSettingsChange = (event: Event) => {
      const customEvent = event as CustomEvent<FontSettings>
      if (customEvent.detail) {
        setFontSettings(customEvent.detail)
      }
    }

    window.addEventListener('fontSettingsChanged', handleFontSettingsChange)

    return () => {
      window.removeEventListener('fontSettingsChanged', handleFontSettingsChange)
    }
  }, []);

  // IntersectionObserver for infinite scroll (load more on scroll up)
  // Only activate after initial load is complete to prevent premature loading
  // Disabled while loading to prevent multiple simultaneous requests
  useEffect(() => {
    const topElement = messagesTopRef.current;

    // Don't observe if:
    // - Element doesn't exist
    // - No more messages to load
    // - Initial load not complete
    // - Currently loading (prevents rapid multiple requests)
    if (!topElement || !hasMoreMessages || !isInitialLoadComplete || isLoadingMore) {
      console.log('[IntersectionObserver] Skip setup:', {
        hasElement: !!topElement,
        hasMoreMessages,
        isInitialLoadComplete,
        isLoadingMore
      });
      return;
    }

    console.log('[IntersectionObserver] Setting up observer');

    const observer = new IntersectionObserver(
      (entries) => {
        console.log('[IntersectionObserver] Callback triggered:', {
          isIntersecting: entries[0].isIntersecting,
          hasMoreMessages
        });
        // Only trigger if the top element is visible
        if (entries[0].isIntersecting) {
          console.log('[IntersectionObserver] Loading more messages...');
          loadMoreMessages();
        }
      },
      { threshold: 0.1, root: messagesContainerRef.current }
    );

    observer.observe(topElement);

    return () => {
      console.log('[IntersectionObserver] Disconnecting observer');
      observer.disconnect();
    };
  }, [hasMoreMessages, isLoadingMore, loadMoreMessages, isInitialLoadComplete]);


  const loadTemplates = useCallback(async () => {
    try {
      const allTemplates = await messageTemplateManager.getTemplates();
      setTemplates(allTemplates);
    } catch (error) {
      console.error('Failed to load templates:', error);
      setTemplates([]);
    }
  }, []);

  const loadRecentMessages = useCallback(async () => {
    try {
      const messages = await recentMessagesManager.getRecentMessages();
      setRecentMessages(messages.map(msg => msg.content));
    } catch (error) {
      console.error('Failed to load recent messages:', error);
    }
  }, []);

  useEffect(() => {
    // Defer template and recent message loading to improve initial render speed
    const timeoutId = setTimeout(() => {
      loadTemplates();
      loadRecentMessages();
    }, 100);
    return () => clearTimeout(timeoutId);
  }, [loadRecentMessages, loadTemplates]);

  // Session-based polling for messages (optimized interval)
  const pollMessages = useCallback(async () => {
    if (!isConnected || !sessionId || !agentAPIRef.current) return;

    try {
      // Get the latest message ID for polling new messages only (claude agent only)
      const latestMessage = messages[messages.length - 1];
      const latestMessageId = latestMessage && typeof latestMessage.id === 'number' ? latestMessage.id : undefined;

      // Poll messages, status, and pending actions
      // For claude agents: fetch only new messages using 'after' parameter
      // For other agents: always fetch all messages to ensure timeline is updated
      const [sessionMessagesResponse, sessionStatus, pendingActions] = await Promise.all([
        agentAPIRef.current.getSessionMessages(sessionId,
          agentType === 'claude' && latestMessageId !== undefined ? {
            after: latestMessageId, // Get messages with ID > latestMessageId (newer messages)
            limit: 50
          } : {
            limit: 50,
            direction: 'tail' // Get latest 50 messages
          }
        ),
        agentAPIRef.current.getSessionStatus(sessionId),
        agentAPIRef.current.getPendingActions(sessionId)
      ]);

      // Validate and safely handle session messages response
      if (!isValidSessionMessageResponse(sessionMessagesResponse)) {
        console.warn('Invalid session messages response structure during polling:', sessionMessagesResponse);
        return;
      }

      // Use SessionMessage directly for display
      const newMessages = sessionMessagesResponse?.messages || [];

      // Handle message updates based on agent type
      if (newMessages.length > 0) {
        if (agentType === 'claude') {
          // For claude agents: filter and append only truly new messages
          setMessages(prevMessages => {
            const existingIds = new Set(prevMessages.map(m => m.id));
            const trulyNewMessages = newMessages.filter(m => !existingIds.has(m.id));

            if (trulyNewMessages.length === 0) return prevMessages;

            return [...prevMessages, ...trulyNewMessages];
          });
        } else {
          // For other agents: always update with all messages to reflect timeline changes
          setMessages(newMessages);
        }
      }

      // Handle pending actions
      const questionAction = pendingActions.find(a => a.type === 'answer_question');
      if (questionAction && !pendingAction) {
        setPendingAction(questionAction);
        setShowQuestionModal(true);
      } else if (!questionAction && pendingAction) {
        // Question was answered/cleared
        setPendingAction(null);
        setShowQuestionModal(false);
      }

      setAgentStatus(sessionStatus);
      // When the provisioner has permanently failed, surface the error once.
      if (
        sessionStatus.status === 'error' &&
        prevAgentStatusRef.current?.status !== 'error'
      ) {
        const detail = sessionStatus.message || '不明なエラー';
        setError(`セッションの起動に失敗しました: ${detail}`);
      }
      prevAgentStatusRef.current = sessionStatus;
    } catch (err) {
      console.error('Failed to poll session data:', err);
      if (err instanceof AgentAPIProxyError) {
        if (err.status === 502 || err.status === 503) {
          // サービス一時停止の可能性があるため、エラーを表示せず継続
          console.warn('Received 502/503 during polling, continuing...');
        } else {
          setError(`Failed to update messages: ${err.message}`);
        }
      }
    }
  }, [isConnected, sessionId, pendingAction, messages, agentType]); // agentAPIを依存配列から除去

  const handleAnswerSubmit = useCallback(async (answers: Record<string, string | string[]>) => {
    if (!sessionId || !agentAPIRef.current || !pendingAction) return;

    try {
      await agentAPIRef.current.sendAction(sessionId, {
        type: 'answer_question',
        answers
      });

      // Clear pending action and close modal
      setPendingAction(null);
      setShowQuestionModal(false);
    } catch (err) {
      console.error('Failed to submit answers:', err);
      if (err instanceof AgentAPIProxyError) {
        setError(`Failed to submit answers: ${err.message}`);
      }
    }
  }, [sessionId, pendingAction]);

  const handleQuestionModalClose = useCallback(() => {
    setShowQuestionModal(false);
  }, []);

  // バックグラウンド対応の定期更新フック
  const pollingControl = useBackgroundAwareInterval(pollMessages, 1000, true);
  const pollingControlRef = useRef(pollingControl);
  pollingControlRef.current = pollingControl;

  // Setup real-time event listening.
  // When the ACP WebSocket is connected we get live updates through it, so
  // there is no need to poll.  We only start polling when:
  //  - The HTTP connection is established (isConnected)
  //  - AND the ACP WebSocket has either failed or is still connecting
  //    (acpWS.isConnecting means we haven't yet decided — keep polling stopped
  //     until the verdict is in to avoid double-fetching).
  useEffect(() => {
    const control = pollingControlRef.current;

    const shouldPoll = isConnected && sessionId && !acpWS.isConnected && !acpWS.isConnecting;

    if (shouldPoll) {
      control.start();
    } else {
      control.stop();
    }

    return () => {
      control.stop();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, sessionId, acpWS.isConnected, acpWS.isConnecting]);

  // Get agent type from /status endpoint
  useEffect(() => {
    const fetchAgentType = async () => {
      if (!sessionId || !agentAPIRef.current) {
        return;
      }

      try {
        const status = await agentAPIRef.current.getSessionStatus(sessionId);
        setAgentType(status.agent_type || null);
      } catch (error) {
        console.error('Failed to get agent type:', error);
        // If we can't get the agent type, assume it's not claude
        setAgentType(null);
      }
    };

    fetchAgentType();
  }, [sessionId]);

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
    
    // PR URLを抽出してリストに追加
    const allPRUrls = messages.reduce((urls: string[], message) => {
      const prUrls = extractPRUrls(message.content);
      return [...urls, ...prUrls];
    }, []);
    
    // 重複を除去してステートを更新
    const uniquePRUrls = Array.from(new Set(allPRUrls));
    setPRLinks(uniquePRUrls);
    
    prevMessagesLengthRef.current = currentLength;
  }, [messages, shouldAutoScroll]);

  const sendMessage = useCallback(async (messageType: 'user' | 'raw' = 'user', content?: string) => {
    const messageContent = content || inputValue.trim();
    
    if (!messageContent && messageType === 'user') return;
    if (isLoading || !isConnected) return;
    
    // For claude-acp sessions with promptQueueing support, allow sending while running.
    // For other agent types, block sending while running.
    if (effectiveAgentStatus?.status === 'running' && messageType === 'user') {
      if (!(agentType === 'claude-acp' && acpWS.promptQueueing)) {
        setError('Agent is currently running. Please wait for it to become stable.');
        return;
      }
    }

    setIsLoading(true);
    setError(null);

    try {
      if (sessionId) {
        if (acpWS.isConnected && messageType === 'user') {
          // ── ACP WebSocket mode ──────────────────────────────────────────
          // sendPrompt adds the user message optimistically and streams the
          // assistant reply via sessionUpdate notifications.
          const ok = await acpWS.sendPrompt(messageContent);
          if (!ok) {
            setError('メッセージ送信に失敗しました (ACP)');
            return;
          }
        } else if (agentType === 'claude-acp' && messageType === 'user') {
          // ── claude-acp sessions require ACP WebSocket — never use HTTP ──
          if (acpWS.isConnecting) {
            setError('ACP WebSocket接続中です。しばらくお待ちください。');
          } else {
            setError('ACP WebSocket接続に失敗しました。再接続を試みています...');
          }
          return;
        } else {
          // ── REST / polling mode (fallback) ──────────────────────────────
          if (!agentAPIRef.current) {
            setError('AgentAPI client not available');
            return;
          }
          const sessionMessage = await agentAPIRef.current.sendSessionMessage(sessionId, {
            content: messageContent,
            type: messageType
          });

          // For user messages, add to messages
          if (messageType === 'user') {
            setMessages(prev => [...prev, sessionMessage]);
          }
        }
      } else {
        setError('No session ID available. Cannot send message.');
        return;
      }

      if (messageType === 'user') {
        // 最近のメッセージに保存
        await recentMessagesManager.saveMessage(messageContent);
        await loadRecentMessages();

        setInputValue('');
        // メッセージ送信時は必ずスクロール
        setShouldAutoScroll(true);
        setTimeout(() => scrollToBottom(), 100);
      }
    } catch (err) {
      console.error('Failed to send message:', err);
      if (err instanceof AgentAPIProxyError) {
        // Handle timeout errors specially
        if (err.code === 'TIMEOUT_ERROR') {
          setError(`${err.message}`);
        } else {
          setError(`メッセージ送信に失敗しました: ${err.message} (セッション: ${sessionId})`);
        }
      } else {
        setError(`メッセージ送信に失敗しました: ${err instanceof Error ? err.message : '不明なエラー'}`);
      }
    } finally {
      setIsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputValue, isLoading, isConnected, sessionId, agentStatus, effectiveAgentStatus, agentType, loadRecentMessages, acpWS.isConnected, acpWS.isConnecting, acpWS.sendPrompt, acpWS.promptQueueing]);

  const handleShowPlanModal = useCallback((content: string) => {
    setPlanContent(content);
    setShowPlanModal(true);
  }, []);

  // Memoize plan modal callbacks for each message to prevent unnecessary re-renders
  const planModalCallbacks = useMemo(() => {
    const callbacks = new Map<string, () => void>();
    messages.forEach(message => {
      if (message.type === 'plan') {
        callbacks.set(message.id.toString(), () => handleShowPlanModal(message.content));
      }
    });
    return callbacks;
  }, [messages, handleShowPlanModal]);

  const handleApprovePlan = useCallback(async (approved: boolean) => {
    if (!sessionId || !agentAPIRef.current) {
      setError('Session not available for plan approval');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await agentAPIRef.current.sendAction(sessionId, {
        type: 'approve_plan',
        approved
      });

      // モーダルを閉じる
      setShowPlanModal(false);

      // スクロールを有効にして下部へ移動
      setShouldAutoScroll(true);
      setTimeout(() => scrollToBottom(), 100);
    } catch (err) {
      console.error('Failed to approve plan:', err);
      if (err instanceof AgentAPIProxyError) {
        setError(`プラン承認に失敗しました: ${err.message}`);
      } else {
        setError(`プラン承認に失敗しました: ${err instanceof Error ? err.message : '不明なエラー'}`);
      }
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);

  const sendStopSignal = async () => {
    try {
      if (agentType === 'claude-acp') {
        // ACP セッション: session/cancel notification を使用
        acpWS.cancelSession();
        console.log('Stop signal sent via session/cancel (ACP)');
      } else if (agentType === 'claude' || agentType === 'codex') {
        // agentapi ベースのエージェント（claude, codex）: /action エンドポイントを使用
        if (!sessionId || !agentAPIRef.current) {
          setError('セッションが利用できません');
          return;
        }
        await agentAPIRef.current.sendAction(sessionId, { type: 'stop_agent' });
        console.log('Stop signal sent via /action endpoint (agent type:', agentType, ')');
      } else {
        // デフォルト・素のシェルセッション: Ctrl+C を送信
        if (!sessionId || !agentAPIRef.current) {
          setError('セッションが利用できません');
          return;
        }
        await agentAPIRef.current.sendSessionMessage(sessionId, {
          content: '\x03', // Ctrl+C
          type: 'raw'
        });
        console.log('Stop signal sent via Ctrl+C (raw message)');
      }
    } catch (err) {
      console.error('Failed to send stop signal:', err);
      setError('停止シグナルの送信に失敗しました');
    }
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


  const deleteSession = useCallback(async () => {
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
  }, [sessionId, router]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      const enterKeyBehavior = getEnterKeyBehavior();
      // 'send' モード: Enter で送信、Cmd/Ctrl+Enter で改行
      // 'newline' モード: Enter で改行、Cmd/Ctrl+Enter で送信
      const isModifierKeyPressed = e.metaKey || e.ctrlKey;
      const shouldSend = enterKeyBehavior === 'send' ? !isModifierKeyPressed : isModifierKeyPressed;

      if (shouldSend) {
        e.preventDefault();
        sendMessage();
      }
    }
  };

  const handleFontSizeChange = (newSize: number) => {
    const newSettings = { ...fontSettings, fontSize: newSize };
    saveFontSettings(newSettings);  // Save to localStorage and trigger event
  };

  const handleFontFamilyChange = (newFamily: FontFamily) => {
    const newSettings = { ...fontSettings, fontFamily: newFamily };
    saveFontSettings(newSettings);  // Save to localStorage and trigger event
  };

  const formatTimestamp = useCallback((timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString();
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'stable': return 'text-green-600 dark:text-green-400';
      case 'running': return 'text-yellow-600 dark:text-yellow-400';
      default: return 'text-gray-600 dark:text-gray-400';
    }
  };

  // ── ACP sessions: use dedicated ACP chat component ──────────────────────
  // agentType is fetched asynchronously; wait until it resolves before
  // deciding which UI to render so we don't flash the wrong component.
  if (agentType === 'claude-acp' && sessionId) {
    return <ACPChat sessionId={sessionId} acpWS={acpWS} />;
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900" style={{ position: 'relative', minHeight: 0 }}>
      {/* Header */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-3 sm:px-6 py-1.5 sm:py-2 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 sm:space-x-4">
            <Link
              href="/chats"
              className="flex items-center space-x-1 sm:space-x-2 px-2 py-1 text-xs sm:text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors"
              title="Go to Conversations"
            >
              <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <span className="hidden sm:inline">Conversations</span>
            </Link>
            <div>
              <h2 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white">
                <span className="inline">Chat</span>
                {sessionId && (
                  <span className="ml-2 text-xs font-normal text-gray-500 dark:text-gray-400 inline">
                    #{sessionId.substring(0, 6)}
                  </span>
                )}
              </h2>
            </div>
          </div>
          <div className="flex items-center space-x-2 sm:space-x-4">
            {/* Agent Status */}
            {effectiveAgentStatus && (
              <div className="flex items-center space-x-1 sm:space-x-2">
                <div className={`w-2 h-2 rounded-full ${effectiveAgentStatus.status === 'stable' ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                <span className={`text-xs ${getStatusColor(effectiveAgentStatus.status)} hidden sm:inline`}>
                  {effectiveAgentStatus.status === 'stable' ? 'Agent Available' : effectiveAgentStatus.status === 'running' ? 'Agent Running' : effectiveAgentStatus.status}
                </span>
                {agentType === 'claude-acp' && (
                  <span
                    className={`text-xs hidden sm:inline ${acpWS.isConnected ? 'text-blue-500' : acpWS.isConnecting ? 'text-yellow-500' : 'text-red-500'}`}
                    title={acpWS.isConnected ? 'ACP WebSocket connected' : acpWS.isConnecting ? 'ACP connecting...' : 'ACP disconnected - retrying'}
                  >
                    {acpWS.isConnected ? '⚡ACP' : acpWS.isConnecting ? '⏳ACP' : '⚠ACP'}
                  </span>
                )}
              </div>
            )}


            {/* Stop Button */}
            {effectiveAgentStatus?.status === 'running' && (
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

            {/* PR Links Button - 必要なときだけ表示 */}
            {prLinks.length > 0 && (
              <button
                onClick={() => setShowPRLinks(!showPRLinks)}
                className="p-2 text-purple-500 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-200 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-md transition-colors relative"
                title={`プルリクエスト (${prLinks.length}個)`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
                <span className="absolute -top-1 -right-1 bg-purple-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                  {prLinks.length}
                </span>
              </button>
            )}


            {/* Share Session Button */}
            {sessionId && agentAPI && (
              <ShareSessionButton sessionId={sessionId} agentAPI={agentAPI} />
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
        {agentStatus?.status === 'error' && (
          <div className="flex flex-col items-center justify-center py-12 px-6">
            <div className="mb-4 text-red-500 dark:text-red-400">
              <svg className="w-14 h-14 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
            <p className="text-lg font-semibold text-red-600 dark:text-red-400">セッションの起動に失敗しました</p>
            {agentStatus.message && (
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 max-w-lg text-center break-words">
                {agentStatus.message}
              </p>
            )}
            <p className="mt-4 text-xs text-gray-400 dark:text-gray-500">セッションを削除して再作成してください</p>
          </div>
        )}

        {isStarting && !isConnected && agentStatus?.status !== 'error' && (
          <div className="text-center text-gray-500 dark:text-gray-400 py-12">
            <div className="mb-3">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            </div>
            <p className="text-lg font-medium">処理中...</p>
            <p className="text-sm mt-1">セッションへの接続を待機しています</p>
          </div>
        )}

        {displayMessages.length === 0 && isConnected && (
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

        {/* Loading indicator for infinite scroll - at the top */}
        {isLoadingMore && (
          <div className="flex justify-center items-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">読み込み中...</span>
          </div>
        )}

        {/* Intersection observer target for infinite scroll */}
        <div ref={messagesTopRef} style={{ height: '1px' }} />

        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {(() => {
            const renderedMessages: JSX.Element[] = [];
            const processedIds = new Set<number>();

            displayMessages.forEach((message) => {
              // すでに処理済みのメッセージはスキップ
              if (processedIds.has(message.id)) return;

              // parentToolUseId を持つ tool_result は親の tool_use と一緒に表示されるのでスキップ
              if (message.role === 'tool_result' && message.parentToolUseId) {
                processedIds.add(message.id);
                return;
              }

              // tool_use の場合、対応する tool_result を探す
              if (message.role === 'agent' && message.toolUseId) {
                const toolResult = displayMessages.find(m =>
                  m.role === 'tool_result' &&
                  m.parentToolUseId === message.toolUseId
                );

                if (toolResult) {
                  processedIds.add(toolResult.id);
                }

                renderedMessages.push(
                  <MessageItem
                    key={message.id}
                    message={message}
                    toolResult={toolResult}
                    formatTimestamp={formatTimestamp}
                    fontSettings={fontSettings}
                    onShowPlanModal={planModalCallbacks.get(message.id.toString())}
                    isClaudeAgent={agentType === 'claude' || agentType === 'codex'}
                  />
                );
                processedIds.add(message.id);
                return;
              }

              // 通常のメッセージ (user, assistant, agent without toolUseId, standalone tool_result)
              if (
                message.role === 'user' ||
                message.role === 'assistant' ||
                message.role === 'agent' ||
                message.role === 'tool_result'
              ) {
                renderedMessages.push(
                  <MessageItem
                    key={message.id}
                    message={message}
                    formatTimestamp={formatTimestamp}
                    fontSettings={fontSettings}
                    onShowPlanModal={planModalCallbacks.get(message.id.toString())}
                    isClaudeAgent={agentType === 'claude' || agentType === 'codex'}
                  />
                );
                processedIds.add(message.id);
              }
            });

            return renderedMessages;
          })()}
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

      {/* ツール実行確認ペーン */}
      {sessionId && <ToolExecutionPane sessionId={sessionId} agentStatus={effectiveAgentStatus?.status} />}

      {/* Input */}
      <div className="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 px-4 sm:px-6 py-3 flex-shrink-0">
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
              ref={messageInputRef}
              aria-label="Message"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => {
                // テンプレートの自動表示を無効化
              }}
              onBlur={() => {
                setTimeout(() => setShowTemplates(false), 150);
              }}
              placeholder={
                !isConnected
                  ? "Connecting..."
                  : effectiveAgentStatus?.status === 'running' && !(agentType === 'claude-acp' && acpWS.promptQueueing)
                    ? "Agent is running, please wait..."
                    : "Write a comment..."
              }
              className="w-full resize-none border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[80px]"
              rows={3}
              disabled={!isConnected || isLoading || (effectiveAgentStatus?.status === 'running' && !(agentType === 'claude-acp' && acpWS.promptQueueing))}
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
                {(() => {
                  const enterKeyBehavior = getEnterKeyBehavior();
                  const isMac = typeof window !== 'undefined' && navigator.platform.includes('Mac');
                  const modifierKey = isMac ? '⌘' : 'Ctrl';

                  if (enterKeyBehavior === 'send') {
                    return `Press Enter to send, ${modifierKey}+Enter for new line`;
                  } else {
                    return `Press ${modifierKey}+Enter to send, Enter for new line`;
                  }
                })()}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 block sm:hidden">
                {(() => {
                  const enterKeyBehavior = getEnterKeyBehavior();
                  const isMac = typeof window !== 'undefined' && navigator.platform.includes('Mac');
                  const modifierKey = isMac ? '⌘' : 'Ctrl';

                  if (enterKeyBehavior === 'send') {
                    return `Enter: send`;
                  } else {
                    return `${modifierKey}+Enter: send`;
                  }
                })()}
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

                {/* Font Settings Button */}
                <button
                  onClick={() => setShowFontSettings(!showFontSettings)}
                  className="px-2 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs rounded-md transition-colors flex items-center relative"
                  title="フォント設定"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
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
                  disabled={!isConnected || isLoading || !inputValue.trim() || (effectiveAgentStatus?.status === 'running' && !(agentType === 'claude-acp' && acpWS.promptQueueing)) || (agentType === 'claude-acp' && !acpWS.isConnected)}
                  aria-label="Send"
                  className="px-3 sm:px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed text-sm font-medium"
                  title={agentType === 'claude-acp' && !acpWS.isConnected ? (acpWS.isConnecting ? 'ACP接続中...' : 'ACP接続失敗 - 再接続中') : undefined}
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
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowTemplateModal(false)
            }
          }}
        >
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

      {/* PR Links Modal */}
      {showPRLinks && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowPRLinks(false)
            }
          }}
        >
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  プルリクエスト一覧 ({prLinks.length}個)
                </h2>
                <button
                  onClick={() => setShowPRLinks(false)}
                  className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            <div className="overflow-y-auto max-h-[calc(80vh-8rem)] px-6 py-4">
              {prLinks.length > 0 ? (
                <div className="space-y-3">
                  {prLinks.map((url, index) => {
                    // URLからドメイン、リポジトリ名、PR番号を抽出
                    const urlParts = url.split('/');
                    const domain = urlParts[2]; // ドメイン名
                    const prNumber = urlParts[urlParts.length - 1];
                    
                    // リポジトリ名を取得（owner/repo形式）
                    const ownerIndex = urlParts.findIndex(part => part === 'pull') - 2;
                    const owner = urlParts[ownerIndex] || '';
                    const repo = urlParts[ownerIndex + 1] || '';
                    const repoName = owner && repo ? `${owner}/${repo}` : '';
                    
                    // GitHub.com以外の場合はドメイン名も表示
                    const isGitHubCom = domain === 'github.com';
                    
                    return (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-md">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm text-gray-900 dark:text-white truncate">
                            {repoName}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {!isGitHubCom && (
                              <span className="text-purple-600 dark:text-purple-400">{domain} • </span>
                            )}
                            プルリクエスト #{prNumber}
                          </div>
                        </div>
                        <div className="flex items-center space-x-2 ml-4">
                          <button
                            onClick={() => navigator.clipboard.writeText(url)}
                            className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded"
                            title="URLをコピー"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          </button>
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white text-xs rounded-md transition-colors"
                          >
                            開く
                            <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <svg className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                  <p className="text-sm">プルリクエストのURLが見つかりませんでした</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Font Settings Popup */}
      {showFontSettings && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowFontSettings(false)
            }
          }}
        >
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  フォント設定
                </h2>
                <button
                  onClick={() => setShowFontSettings(false)}
                  className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="px-6 py-4 space-y-6">
              {/* Font Size Slider */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  フォントサイズ: {fontSettings.fontSize}px
                </label>
                <input
                  type="range"
                  min="12"
                  max="20"
                  value={fontSettings.fontSize}
                  onChange={(e) => handleFontSizeChange(parseInt(e.target.value))}
                  className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-600"
                />
                <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                  <span>12px</span>
                  <span>20px</span>
                </div>
              </div>

              {/* Font Family */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  フォントファミリー
                </label>
                <div className="space-y-2">
                  <label className={`flex items-center p-3 rounded-lg border cursor-pointer transition-colors ${
                    fontSettings.fontFamily === 'sans-serif'
                      ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}>
                    <input
                      type="radio"
                      name="fontFamily"
                      value="sans-serif"
                      checked={fontSettings.fontFamily === 'sans-serif'}
                      onChange={() => handleFontFamilyChange('sans-serif')}
                      className="h-4 w-4 text-purple-600 focus:ring-purple-500"
                    />
                    <div className="ml-3">
                      <span className="block text-sm font-medium text-gray-900 dark:text-white">
                        Sans-serif
                      </span>
                      <span className="block text-xs text-gray-500 dark:text-gray-400">
                        通常のフォント（読みやすさ重視）
                      </span>
                    </div>
                  </label>

                  <label className={`flex items-center p-3 rounded-lg border cursor-pointer transition-colors ${
                    fontSettings.fontFamily === 'monospace'
                      ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}>
                    <input
                      type="radio"
                      name="fontFamily"
                      value="monospace"
                      checked={fontSettings.fontFamily === 'monospace'}
                      onChange={() => handleFontFamilyChange('monospace')}
                      className="h-4 w-4 text-purple-600 focus:ring-purple-500"
                    />
                    <div className="ml-3">
                      <span className="block text-sm font-medium text-gray-900 dark:text-white font-mono">
                        Monospace
                      </span>
                      <span className="block text-xs text-gray-500 dark:text-gray-400">
                        等幅フォント（コード表示に適している）
                      </span>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex justify-end">
                <button
                  onClick={() => setShowFontSettings(false)}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-md transition-colors"
                >
                  閉じる
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Plan Approval Modal */}
      <PlanApprovalModal
        isOpen={showPlanModal}
        planContent={planContent}
        onApprove={() => handleApprovePlan(true)}
        onReject={() => handleApprovePlan(false)}
        onClose={() => setShowPlanModal(false)}
        isLoading={isLoading}
      />

      {/* AskUserQuestion Modal */}
      {showQuestionModal && pendingAction?.content?.questions && (
        <AskUserQuestionModal
          questions={pendingAction.content.questions}
          onSubmit={handleAnswerSubmit}
          onClose={handleQuestionModalClose}
        />
      )}
    </div>
  );
}
