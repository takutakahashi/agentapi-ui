export type TaskStatus = 'todo' | 'done'
export type TaskType = 'user' | 'agent'

export interface TaskLink {
  id: string
  url: string
  title?: string
}

export interface Task {
  id: string
  title: string
  description?: string
  status: TaskStatus
  task_type: TaskType
  scope: 'user' | 'team'
  owner_id: string
  team_id?: string
  group_id?: string
  session_id?: string
  links: TaskLink[]
  created_at: string
  updated_at: string
}

export interface TaskListResponse {
  tasks: Task[]
  total: number
}

export interface TaskListParams {
  scope?: 'user' | 'team'
  team_id?: string
  group_id?: string
  status?: TaskStatus
  task_type?: TaskType
}
