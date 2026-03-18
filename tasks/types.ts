export type TaskStatus = 'pending' | 'running' | 'complete' | 'failed' | 'cancelled';
export type TaskPriority = 'low' | 'normal' | 'high' | 'critical';

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  agentId: string;
  tenantId: string;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
  createdBy: string;
  assignedTo?: string;
  parentTaskId?: string;
  subtasks?: string[];
  tags: string[];
  context: Record<string, unknown>;
  result?: TaskResult;
  logs: TaskLog[];
}

export interface TaskResult {
  success: boolean;
  output: string;
  error?: string;
  artifacts?: string[];
  toolsUsed?: string[];
  tokensUsed?: number;
}

export interface TaskLog {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  agentId?: string;
}

export interface TaskCreateInput {
  title: string;
  description: string;
  priority?: TaskPriority;
  agentId: string;
  tenantId: string;
  createdBy: string;
  parentTaskId?: string;
  tags?: string[];
  context?: Record<string, unknown>;
}

export interface TaskEvent {
  type:
    | 'task.created'
    | 'task.started'
    | 'task.completed'
    | 'task.failed'
    | 'task.cancelled'
    | 'task.log';
  taskId: string;
  agentId: string;
  tenantId: string;
  timestamp: string;
  data?: Record<string, unknown>;
}
