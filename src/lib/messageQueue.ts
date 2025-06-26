export type MessageStatus = 'pending' | 'sending' | 'sent' | 'failed' | 'cancelled';

export interface QueuedMessage {
  id: string;
  sessionId: string;
  content: string;
  timestamp: number;
  status: MessageStatus;
  retryCount: number;
  maxRetries: number;
  error?: string;
  progress?: number;
}

export interface QueueStats {
  pending: number;
  sending: number;
  sent: number;
  failed: number;
  total: number;
}

type QueueListener = (message: QueuedMessage) => void;
type StatsListener = (stats: QueueStats) => void;

class MessageQueue {
  private messages: Map<string, QueuedMessage> = new Map();
  private processing = false;
  private listeners: Set<QueueListener> = new Set();
  private statsListeners: Set<StatsListener> = new Set();
  private worker: Worker | null = null;
  private agentAPIClient: any = null; // eslint-disable-line @typescript-eslint/no-explicit-any

  constructor() {
    this.initializeWorker();
  }

  private initializeWorker() {
    if (typeof Worker !== 'undefined') {
      try {
        const workerBlob = new Blob([this.getWorkerScript()], { type: 'application/javascript' });
        this.worker = new Worker(URL.createObjectURL(workerBlob));
        this.worker.onmessage = (event) => {
          this.handleWorkerMessage(event.data);
        };
      } catch {
        console.warn('Web Worker not available, falling back to main thread processing');
      }
    }
  }

  private getWorkerScript() {
    return `
      let processing = false;
      let queue = [];
      
      self.onmessage = function(e) {
        const { type, data } = e.data;
        
        switch (type) {
          case 'ADD_MESSAGE':
            queue.push(data);
            if (!processing) {
              processQueue();
            }
            break;
          case 'CANCEL_MESSAGE':
            queue = queue.filter(msg => msg.id !== data.id);
            break;
        }
      };
      
      async function processQueue() {
        processing = true;
        
        while (queue.length > 0) {
          const message = queue.shift();
          
          try {
            self.postMessage({ type: 'MESSAGE_SENDING', data: message });
            
            // シミュレート送信処理（実際のAPI呼び出しはメインスレッドで行う）
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            self.postMessage({ type: 'MESSAGE_READY', data: message });
          } catch (error) {
            self.postMessage({ 
              type: 'MESSAGE_ERROR', 
              data: { ...message, error: error.message } 
            });
          }
        }
        
        processing = false;
      }
    `;
  }

  private handleWorkerMessage(data: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
    const { type, data: messageData } = data;
    
    switch (type) {
      case 'MESSAGE_SENDING':
        this.updateMessageStatus(messageData.id, 'sending');
        break;
      case 'MESSAGE_READY':
        // メインスレッドで実際のAPI呼び出しを実行
        this.sendMessageToAPI(messageData);
        break;
      case 'MESSAGE_ERROR':
        this.updateMessageStatus(messageData.id, 'failed', messageData.error);
        break;
    }
  }

  setAgentAPIClient(client: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
    this.agentAPIClient = client;
  }

  addMessage(sessionId: string, content: string, maxRetries = 3): string {
    const id = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const message: QueuedMessage = {
      id,
      sessionId,
      content,
      timestamp: Date.now(),
      status: 'pending',
      retryCount: 0,
      maxRetries,
      progress: 0
    };

    this.messages.set(id, message);
    this.notifyListeners(message);
    this.notifyStatsListeners();

    if (this.worker) {
      this.worker.postMessage({ type: 'ADD_MESSAGE', data: message });
    } else {
      // Fallback to main thread processing
      setTimeout(() => this.processMessageInMainThread(message), 0);
    }

    return id;
  }

  private async processMessageInMainThread(message: QueuedMessage) {
    this.updateMessageStatus(message.id, 'sending');
    
    try {
      await this.sendMessageToAPI(message);
    } catch (error) {
      this.updateMessageStatus(message.id, 'failed', (error as Error).message);
    }
  }

  private async sendMessageToAPI(message: QueuedMessage) {
    if (!this.agentAPIClient) {
      throw new Error('AgentAPI client not initialized');
    }

    try {
      const result = await this.agentAPIClient.sendSessionMessage(
        message.sessionId,
        {
          content: message.content,
          type: 'user'
        }
      );
      
      this.updateMessageStatus(message.id, 'sent');
      return result;
    } catch (error) {
      const currentMessage = this.messages.get(message.id);
      if (currentMessage && currentMessage.retryCount < currentMessage.maxRetries) {
        // 再試行
        this.scheduleRetry(message.id);
      } else {
        this.updateMessageStatus(message.id, 'failed', (error as Error).message);
      }
      throw error;
    }
  }

  private scheduleRetry(messageId: string) {
    const message = this.messages.get(messageId);
    if (!message) return;

    message.retryCount++;
    message.status = 'pending';
    
    // 指数バックオフ
    const delay = Math.min(1000 * Math.pow(2, message.retryCount - 1), 10000);
    
    setTimeout(() => {
      if (this.worker) {
        this.worker.postMessage({ type: 'ADD_MESSAGE', data: message });
      } else {
        this.processMessageInMainThread(message);
      }
    }, delay);

    this.notifyListeners(message);
  }

  retryMessage(messageId: string): boolean {
    const message = this.messages.get(messageId);
    if (!message || message.status === 'sending') {
      return false;
    }

    message.status = 'pending';
    message.retryCount = 0;
    message.error = undefined;
    
    if (this.worker) {
      this.worker.postMessage({ type: 'ADD_MESSAGE', data: message });
    } else {
      this.processMessageInMainThread(message);
    }

    this.notifyListeners(message);
    this.notifyStatsListeners();
    return true;
  }

  retryAllFailed(): number {
    const failedMessages = Array.from(this.messages.values())
      .filter(msg => msg.status === 'failed');
    
    failedMessages.forEach(msg => this.retryMessage(msg.id));
    return failedMessages.length;
  }

  cancelMessage(messageId: string): boolean {
    const message = this.messages.get(messageId);
    if (!message || message.status === 'sent') {
      return false;
    }

    this.updateMessageStatus(messageId, 'cancelled');
    
    if (this.worker) {
      this.worker.postMessage({ type: 'CANCEL_MESSAGE', data: { id: messageId } });
    }

    return true;
  }

  private updateMessageStatus(messageId: string, status: MessageStatus, error?: string) {
    const message = this.messages.get(messageId);
    if (!message) return;

    message.status = status;
    if (error) {
      message.error = error;
    }

    this.notifyListeners(message);
    this.notifyStatsListeners();
  }

  getMessage(messageId: string): QueuedMessage | undefined {
    return this.messages.get(messageId);
  }

  getAllMessages(): QueuedMessage[] {
    return Array.from(this.messages.values()).sort((a, b) => b.timestamp - a.timestamp);
  }

  getMessagesBySession(sessionId: string): QueuedMessage[] {
    return this.getAllMessages().filter(msg => msg.sessionId === sessionId);
  }

  getStats(): QueueStats {
    const messages = Array.from(this.messages.values());
    return {
      pending: messages.filter(m => m.status === 'pending').length,
      sending: messages.filter(m => m.status === 'sending').length,
      sent: messages.filter(m => m.status === 'sent').length,
      failed: messages.filter(m => m.status === 'failed').length,
      total: messages.length
    };
  }

  clearCompleted(): number {
    const completedMessages = Array.from(this.messages.entries())
      .filter(([, msg]) => msg.status === 'sent');
    
    completedMessages.forEach(([id]) => this.messages.delete(id));
    this.notifyStatsListeners();
    
    return completedMessages.length;
  }

  clearAll(): void {
    this.messages.clear();
    this.notifyStatsListeners();
  }

  onMessageUpdate(listener: QueueListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  onStatsUpdate(listener: StatsListener): () => void {
    this.statsListeners.add(listener);
    return () => this.statsListeners.delete(listener);
  }

  private notifyListeners(message: QueuedMessage) {
    this.listeners.forEach(listener => {
      try {
        listener(message);
      } catch (error) {
        console.error('Error in queue listener:', error);
      }
    });
  }

  private notifyStatsListeners() {
    const stats = this.getStats();
    this.statsListeners.forEach(listener => {
      try {
        listener(stats);
      } catch (error) {
        console.error('Error in stats listener:', error);
      }
    });
  }

  destroy() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.listeners.clear();
    this.statsListeners.clear();
    this.messages.clear();
  }
}

export const messageQueue = new MessageQueue();