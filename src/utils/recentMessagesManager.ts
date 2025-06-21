export interface RecentMessage {
  id: string;
  content: string;
  timestamp: number;
  profileId: string;
}

const STORAGE_KEY_PREFIX = 'recent_messages_';
const MAX_RECENT_MESSAGES = 10;

class RecentMessagesManager {
  private getStorageKey(profileId: string): string {
    return `${STORAGE_KEY_PREFIX}${profileId}`;
  }

  async saveMessage(profileId: string, content: string): Promise<void> {
    try {
      const messages = await this.getRecentMessages(profileId);
      
      // 重複を避ける（同じ内容のメッセージは最新のものだけ保持）
      const filteredMessages = messages.filter(msg => msg.content !== content);
      
      const newMessage: RecentMessage = {
        id: crypto.randomUUID(),
        content,
        timestamp: Date.now(),
        profileId,
      };
      
      // 新しいメッセージを先頭に追加
      const updatedMessages = [newMessage, ...filteredMessages];
      
      // 最大数を超えた場合は古いものから削除
      const trimmedMessages = updatedMessages.slice(0, MAX_RECENT_MESSAGES);
      
      localStorage.setItem(this.getStorageKey(profileId), JSON.stringify(trimmedMessages));
    } catch (error) {
      console.error('Failed to save recent message:', error);
    }
  }
  
  async getRecentMessages(profileId: string): Promise<RecentMessage[]> {
    try {
      const stored = localStorage.getItem(this.getStorageKey(profileId));
      if (!stored) return [];
      
      const messages = JSON.parse(stored) as RecentMessage[];
      
      // 最新のものから並べる
      return messages.sort((a, b) => b.timestamp - a.timestamp);
    } catch (error) {
      console.error('Failed to get recent messages:', error);
      return [];
    }
  }
  
  async clearRecentMessages(profileId: string): Promise<void> {
    try {
      localStorage.removeItem(this.getStorageKey(profileId));
    } catch (error) {
      console.error('Failed to clear recent messages:', error);
    }
  }
}

export const recentMessagesManager = new RecentMessagesManager();