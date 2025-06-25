export class InitialMessageCache {
  private static readonly STORAGE_KEY_PREFIX = 'agentapi_initial_message_cache_'
  private static readonly MAX_CACHE_SIZE = 2

  private static getStorageKey(profileId: string): string {
    return `${this.STORAGE_KEY_PREFIX}${profileId}`
  }

  static getCachedMessages(profileId?: string): string[] {
    if (!profileId) return []
    
    try {
      const cached = localStorage.getItem(this.getStorageKey(profileId))
      if (!cached) return []
      const messages = JSON.parse(cached)
      return Array.isArray(messages) ? messages : []
    } catch {
      return []
    }
  }

  static addMessage(message: string, profileId?: string): void {
    if (!message.trim() || !profileId) return

    try {
      const messages = this.getCachedMessages(profileId)
      
      // 既に同じメッセージが存在する場合は、それを削除してから先頭に追加
      const filteredMessages = messages.filter(m => m !== message)
      
      // 新しいメッセージを先頭に追加
      const updatedMessages = [message, ...filteredMessages]
      
      // 最大数を超えた場合は古いものを削除
      const limitedMessages = updatedMessages.slice(0, this.MAX_CACHE_SIZE)
      
      localStorage.setItem(this.getStorageKey(profileId), JSON.stringify(limitedMessages))
    } catch (error) {
      console.error('Failed to cache initial message:', error)
    }
  }

  static clearCache(profileId?: string): void {
    if (!profileId) return
    
    try {
      localStorage.removeItem(this.getStorageKey(profileId))
    } catch (error) {
      console.error('Failed to clear initial message cache:', error)
    }
  }

  // 全プロファイルのキャッシュをクリア
  static clearAllCaches(): void {
    try {
      const keysToRemove: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && key.startsWith(this.STORAGE_KEY_PREFIX)) {
          keysToRemove.push(key)
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key))
    } catch (error) {
      console.error('Failed to clear all initial message caches:', error)
    }
  }
}