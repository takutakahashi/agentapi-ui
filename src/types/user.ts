// agentapi-proxy /user/info から取得するユーザー情報
export interface ProxyUserInfo {
  username: string
  teams: string[]
}

// 統合されたユーザー情報
export interface UserInfo {
  type: 'github' | 'api_key' | 'proxy'
  user?: {
    // GitHub OAuth 用
    id?: number
    login?: string
    name?: string
    email?: string
    avatar_url?: string
    // 共通
    authenticated?: boolean
  }
  // agentapi-proxy から取得した情報
  proxy?: ProxyUserInfo
}
