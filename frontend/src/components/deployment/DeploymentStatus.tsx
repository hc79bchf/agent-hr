/**
 * DeploymentStatus component - Shows deployment status with actions.
 */

import type { Deployment, DeploymentStatus as DeploymentStatusType } from '../../types';

interface DeploymentStatusProps {
  deployment: Deployment | null | undefined;
  isLoading?: boolean;
  onDeploy: () => void;
  onStop: () => void;
  onChat: () => void;
  isDeploying?: boolean;
  isStopping?: boolean;
}

/**
 * Get status badge color based on deployment status.
 */
function getStatusColor(status: DeploymentStatusType): string {
  switch (status) {
    case 'running':
      return 'bg-green-100 text-green-800';
    case 'pending':
    case 'building':
    case 'starting':
      return 'bg-yellow-100 text-yellow-800';
    case 'stopping':
      return 'bg-orange-100 text-orange-800';
    case 'stopped':
      return 'bg-gray-100 text-gray-800';
    case 'failed':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

/**
 * Get human-readable status label.
 */
function getStatusLabel(status: DeploymentStatusType): string {
  switch (status) {
    case 'running':
      return 'Running';
    case 'pending':
      return 'Pending';
    case 'building':
      return 'Building...';
    case 'starting':
      return 'Starting...';
    case 'stopping':
      return 'Stopping...';
    case 'stopped':
      return 'Stopped';
    case 'failed':
      return 'Failed';
    default:
      return status;
  }
}

/**
 * DeploymentStatus component.
 */
export function DeploymentStatus({
  deployment,
  isLoading,
  onDeploy,
  onStop,
  onChat,
  isDeploying,
  isStopping,
}: DeploymentStatusProps) {
  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center gap-2">
        <div className="w-20 h-8 bg-gray-200 rounded animate-pulse" />
      </div>
    );
  }

  // No deployment - show deploy button
  if (!deployment) {
    return (
      <button
        onClick={onDeploy}
        disabled={isDeploying}
        className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isDeploying ? (
          <>
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Deploying...
          </>
        ) : (
          <>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
              />
            </svg>
            Deploy
          </>
        )}
      </button>
    );
  }

  // Has deployment - show status and actions
  const isRunning = deployment.status === 'running';
  const isTransitioning = ['pending', 'building', 'starting', 'stopping'].includes(deployment.status);

  return (
    <div className="flex items-center gap-3">
      {/* Status Badge */}
      <span
        className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-full ${getStatusColor(deployment.status)}`}
      >
        {isTransitioning && (
          <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
              fill="none"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        )}
        {isRunning && (
          <span className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
        )}
        {getStatusLabel(deployment.status)}
      </span>

      {/* Port info */}
      {isRunning && deployment.port && (
        <span className="text-xs text-gray-500">
          Port: {deployment.port}
        </span>
      )}

      {/* Chat button - only when running */}
      {isRunning && (
        <button
          onClick={onChat}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
          Chat
        </button>
      )}

      {/* Stop button - only when running */}
      {isRunning && (
        <button
          onClick={onStop}
          disabled={isStopping}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-red-300 text-red-600 text-sm font-medium rounded-lg hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isStopping ? (
            <>
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              Stopping...
            </>
          ) : (
            <>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z"
                />
              </svg>
              Stop
            </>
          )}
        </button>
      )}

      {/* Deploy button - only when stopped or failed */}
      {(deployment.status === 'stopped' || deployment.status === 'failed') && (
        <button
          onClick={onDeploy}
          disabled={isDeploying}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isDeploying ? (
            <>
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              Deploying...
            </>
          ) : (
            <>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              Redeploy
            </>
          )}
        </button>
      )}

      {/* Error message */}
      {deployment.status === 'failed' && deployment.error_message && (
        <span className="text-xs text-red-600 truncate max-w-xs" title={deployment.error_message}>
          {deployment.error_message}
        </span>
      )}
    </div>
  );
}
