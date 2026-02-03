/**
 * Deployment service for managing agent deployments.
 */

import { get, post } from './api';
import type {
  Deployment,
  DeployRequest,
  DeployResponse,
  DeploymentListResponse,
  ChatRequest,
  ChatResponse,
} from '../types';

/**
 * Deploy an agent as a Docker container.
 * @param agentId - The agent's UUID.
 * @param data - Optional deployment configuration.
 * @returns The created deployment and status message.
 */
export async function deployAgent(
  agentId: string,
  data?: DeployRequest
): Promise<DeployResponse> {
  return post<DeployResponse>(`/api/agents/${agentId}/deploy`, data ?? {});
}

/**
 * Get the active (running) deployment for an agent.
 * @param agentId - The agent's UUID.
 * @returns The active deployment, or null if none.
 */
export async function getActiveDeployment(
  agentId: string
): Promise<Deployment | null> {
  return get<Deployment | null>(`/api/agents/${agentId}/deployment/active`);
}

/**
 * List all deployments for an agent.
 * @param agentId - The agent's UUID.
 * @param status - Optional status filter.
 * @returns List of deployments.
 */
export async function listDeployments(
  agentId: string,
  status?: string
): Promise<DeploymentListResponse> {
  const params = status ? `?status_filter=${status}` : '';
  return get<DeploymentListResponse>(`/api/agents/${agentId}/deployments${params}`);
}

/**
 * Get deployment status including container health.
 * @param deploymentId - The deployment's UUID.
 * @returns Deployment status with container info.
 */
export async function getDeployment(deploymentId: string): Promise<Deployment> {
  return get<Deployment>(`/api/deployments/${deploymentId}`);
}

/**
 * Stop a running deployment.
 * @param deploymentId - The deployment's UUID.
 * @returns The updated deployment.
 */
export async function stopDeployment(deploymentId: string): Promise<Deployment> {
  return post<Deployment>(`/api/deployments/${deploymentId}/stop`);
}

/**
 * Response from stopping all deployments.
 */
export interface StopAllResponse {
  message: string;
  stopped_count: number;
  failed_count: number;
  errors: { deployment_id: string; agent_id: string; error: string }[] | null;
}

/**
 * Stop all running deployments. Admin only.
 * @returns Summary of stopped deployments.
 */
export async function stopAllDeployments(): Promise<StopAllResponse> {
  return post<StopAllResponse>('/api/deployments/stop-all');
}

/**
 * Send a message to a deployed agent.
 * @param deploymentId - The deployment's UUID.
 * @param message - The message to send.
 * @param conversationId - Optional conversation ID for context.
 * @returns The agent's response.
 */
export async function chatWithDeployment(
  deploymentId: string,
  message: string,
  conversationId?: string
): Promise<ChatResponse> {
  const request: ChatRequest = { message, conversation_id: conversationId };
  return post<ChatResponse>(`/api/deployments/${deploymentId}/chat`, request);
}

/**
 * Get WebSocket URL for streaming chat.
 * @param deploymentId - The deployment's UUID.
 * @returns WebSocket URL.
 */
export function getWebSocketUrl(deploymentId: string): string {
  const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
  const wsProtocol = baseUrl.startsWith('https') ? 'wss' : 'ws';
  const wsBaseUrl = baseUrl.replace(/^https?/, wsProtocol);
  return `${wsBaseUrl}/api/deployments/${deploymentId}/ws`;
}

/**
 * Deployment service object for convenient access.
 */
export const deploymentService = {
  deploy: deployAgent,
  getActive: getActiveDeployment,
  list: listDeployments,
  get: getDeployment,
  stop: stopDeployment,
  stopAll: stopAllDeployments,
  chat: chatWithDeployment,
  getWebSocketUrl,
};
