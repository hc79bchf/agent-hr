/**
 * AccessRequestsPanel component.
 * Displays pending access requests for component owners to approve/deny.
 */

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { accessRequestsService } from '../../services/grants';
import type { ComponentAccessRequest, ComponentAccessLevel, RequestStatus } from '../../types';
import { Modal } from '../ui';

interface AccessRequestsPanelProps {
  componentId: string;
  pendingOnly?: boolean;
}

const ACCESS_LEVEL_LABELS: Record<ComponentAccessLevel, string> = {
  viewer: 'Viewer',
  executor: 'Executor',
  contributor: 'Contributor',
};

const ACCESS_LEVEL_COLORS: Record<ComponentAccessLevel, string> = {
  viewer: 'bg-gray-100 text-gray-800',
  executor: 'bg-blue-100 text-blue-800',
  contributor: 'bg-purple-100 text-purple-800',
};

const STATUS_COLORS: Record<RequestStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  denied: 'bg-red-100 text-red-800',
};

const STATUS_LABELS: Record<RequestStatus, string> = {
  pending: 'Pending',
  approved: 'Approved',
  denied: 'Denied',
};

export function AccessRequestsPanel({ componentId, pendingOnly: _pendingOnly = false }: AccessRequestsPanelProps) {
  const queryClient = useQueryClient();
  const [isDenyModalOpen, setIsDenyModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<ComponentAccessRequest | null>(null);
  const [denialReason, setDenialReason] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'denied'>('all');

  // Fetch requests
  const {
    data: requestsResponse,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['access-requests', 'component', componentId, statusFilter],
    queryFn: () => accessRequestsService.listByComponent(componentId, {
      status: statusFilter === 'all' ? undefined : statusFilter,
    }),
  });

  const requests = requestsResponse?.data || [];

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: (requestId: string) => accessRequestsService.approve(requestId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['access-requests', 'component', componentId] });
      queryClient.invalidateQueries({ queryKey: ['component-grants', componentId] });
    },
  });

  // Deny mutation
  const denyMutation = useMutation({
    mutationFn: ({ requestId, reason }: { requestId: string; reason: string }) =>
      accessRequestsService.deny(requestId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['access-requests', 'component', componentId] });
      handleCloseDenyModal();
    },
  });

  const handleApprove = useCallback(
    (request: ComponentAccessRequest) => {
      const agentName = request.agent_name || 'this agent';
      if (window.confirm(`Approve ${ACCESS_LEVEL_LABELS[request.requested_level]} access for ${agentName}?`)) {
        approveMutation.mutate(request.id);
      }
    },
    [approveMutation]
  );

  const handleOpenDenyModal = useCallback((request: ComponentAccessRequest) => {
    setSelectedRequest(request);
    setDenialReason('');
    setIsDenyModalOpen(true);
  }, []);

  const handleCloseDenyModal = useCallback(() => {
    setIsDenyModalOpen(false);
    setSelectedRequest(null);
    setDenialReason('');
  }, []);

  const handleDenySubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (selectedRequest && denialReason.trim()) {
        denyMutation.mutate({ requestId: selectedRequest.id, reason: denialReason });
      }
    },
    [selectedRequest, denialReason, denyMutation]
  );

  const pendingCount = requests.filter(r => r.is_pending).length;

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
        <span className="ml-2 text-gray-600">Loading requests...</span>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <p className="text-sm text-red-700">
          {(error as Error)?.message || 'Error loading requests'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with filter */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-medium text-gray-900">Access Requests</h4>
          {pendingCount > 0 && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
              {pendingCount} pending
            </span>
          )}
        </div>

        {/* Status filter */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500">Filter:</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className="text-xs border-gray-300 rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          >
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="denied">Denied</option>
            <option value="all">All</option>
          </select>
        </div>
      </div>

      {requests.length === 0 ? (
        <div className="text-center py-8 bg-gray-50 rounded-lg">
          <svg
            className="mx-auto h-10 w-10 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p className="mt-2 text-sm text-gray-500">
            No {statusFilter === 'all' ? '' : statusFilter} access requests
          </p>
        </div>
      ) : (
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <ul className="divide-y divide-gray-200">
            {requests.map((request) => (
              <li
                key={request.id}
                className={`px-4 py-4 sm:px-6 ${
                  request.is_pending
                    ? 'hover:bg-gray-50'
                    : 'bg-gray-50 opacity-60'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      {/* Agent icon */}
                      <div className="flex-shrink-0">
                        <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                          request.is_pending ? 'bg-indigo-100' : 'bg-gray-200'
                        }`}>
                          <svg className={`h-5 w-5 ${request.is_pending ? 'text-indigo-600' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                        </div>
                      </div>

                      {/* Request info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-sm font-medium ${request.is_pending ? 'text-gray-900' : 'text-gray-500'}`}>
                            {request.agent_name || `Agent ${request.agent_id.slice(0, 8)}...`}
                          </span>
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${ACCESS_LEVEL_COLORS[request.requested_level]}`}
                          >
                            {ACCESS_LEVEL_LABELS[request.requested_level]}
                          </span>
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[request.status]}`}
                          >
                            {STATUS_LABELS[request.status]}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                          <span>
                            Requested by {request.requester_name || 'Unknown'}
                          </span>
                          <span>•</span>
                          <span>
                            {new Date(request.requested_at).toLocaleDateString()}
                          </span>
                        </div>
                        {request.denial_reason && (
                          <p className="mt-1 text-sm text-red-600 bg-red-50 px-2 py-1 rounded">
                            <strong>Denial reason:</strong> {request.denial_reason}
                          </p>
                        )}
                        {request.resolved_at && (
                          <p className="mt-1 text-xs text-gray-400">
                            {request.status === 'approved' ? 'Approved' : 'Denied'} on {new Date(request.resolved_at).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Action buttons for pending requests */}
                  {request.is_pending && (
                    <div className="flex items-center gap-2 ml-4">
                      <button
                        onClick={() => handleApprove(request)}
                        disabled={approveMutation.isPending}
                        className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 transition-colors"
                      >
                        <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Approve
                      </button>
                      <button
                        onClick={() => handleOpenDenyModal(request)}
                        className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                      >
                        <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        Deny
                      </button>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Deny Modal */}
      <Modal isOpen={isDenyModalOpen} onClose={handleCloseDenyModal} title="Deny Access Request">
        <form onSubmit={handleDenySubmit} className="space-y-4">
          {selectedRequest && (
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-600">Denying access for:</p>
              <p className="text-lg font-medium text-gray-900">
                {selectedRequest.agent_name || `Agent ${selectedRequest.agent_id.slice(0, 8)}...`}
              </p>
              <p className="text-sm text-gray-500">
                Requested: {ACCESS_LEVEL_LABELS[selectedRequest.requested_level]} access
              </p>
            </div>
          )}

          <div>
            <label htmlFor="denial_reason" className="block text-sm font-medium text-gray-700">
              Reason for denial <span className="text-red-500">*</span>
            </label>
            <textarea
              id="denial_reason"
              value={denialReason}
              onChange={(e) => setDenialReason(e.target.value)}
              rows={3}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              placeholder="Please provide a reason for denying this request..."
              required
            />
            <p className="mt-1 text-xs text-gray-500">
              This will be visible to the requester.
            </p>
          </div>

          {denyMutation.isError && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3">
              <p className="text-sm text-red-700">
                {(denyMutation.error as Error)?.message || 'Failed to deny request'}
              </p>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={handleCloseDenyModal}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={denyMutation.isPending || !denialReason.trim()}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 disabled:opacity-50"
            >
              {denyMutation.isPending ? 'Denying...' : 'Deny Request'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default AccessRequestsPanel;
