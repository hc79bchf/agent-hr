/**
 * Deployment-related types.
 */

/**
 * Deployment status values.
 */
export type DeploymentStatus =
  | 'pending'
  | 'building'
  | 'starting'
  | 'running'
  | 'stopping'
  | 'stopped'
  | 'failed';

/**
 * Container status info.
 */
export interface ContainerStatus {
  status: string;
  running: boolean;
  health: string;
  started_at?: string;
  finished_at?: string;
}

/**
 * Agent deployment record.
 */
export interface Deployment {
  id: string;
  agent_id: string;
  version_id: string;
  status: DeploymentStatus;
  container_id?: string;
  image_id?: string;
  port?: number;
  error_message?: string;
  created_by?: string;
  created_at: string;
  started_at?: string;
  stopped_at?: string;
  container?: ContainerStatus;
}

/**
 * Request body for deploying an agent.
 */
export interface DeployRequest {
  version_id?: string;
}

/**
 * Response from deploy endpoint.
 */
export interface DeployResponse {
  deployment: Deployment;
  message: string;
}

/**
 * Response from listing deployments.
 */
export interface DeploymentListResponse {
  data: Deployment[];
  total: number;
}

/**
 * Request body for chat endpoint.
 */
export interface ChatRequest {
  message: string;
  conversation_id?: string;
}

/**
 * Response from chat endpoint.
 */
export interface ChatResponse {
  response: string;
  conversation_id: string;
}

/**
 * Chat message in conversation.
 */
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

/**
 * WebSocket message types.
 */
export type WebSocketMessageType = 'message' | 'chunk' | 'done' | 'error';

/**
 * WebSocket message format.
 */
export interface WebSocketMessage {
  type: WebSocketMessageType;
  content?: string;
  conversation_id?: string;
  error?: string;
}
