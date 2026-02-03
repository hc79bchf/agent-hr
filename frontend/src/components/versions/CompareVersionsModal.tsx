/**
 * CompareVersionsModal component for comparing two agent versions side-by-side.
 * Shows diffs organized by component type (skills, tools, memory, agents).
 */

import { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { DiffItem } from './DiffItem';
import { useVersionCompare } from '../../hooks';
import type { AgentVersion, DiffSummary } from '../../types';

interface CompareVersionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  agentId: string;
  versions: AgentVersion[];
}

interface SectionHeaderProps {
  title: string;
  summary?: DiffSummary;
}

/**
 * Section header showing title and change summary.
 */
function SectionHeader({ title, summary }: SectionHeaderProps) {
  if (
    !summary ||
    (summary.added === 0 && summary.removed === 0 && summary.modified === 0)
  ) {
    return (
      <div className="py-2 px-3 bg-gray-50 rounded text-sm text-gray-500">
        {title} (no changes)
      </div>
    );
  }

  const parts = [];
  if (summary.added > 0) parts.push(`${summary.added} added`);
  if (summary.removed > 0) parts.push(`${summary.removed} removed`);
  if (summary.modified > 0) parts.push(`${summary.modified} modified`);

  return (
    <div className="py-2 px-3 bg-gray-100 rounded font-medium text-sm text-gray-900">
      {title} ({parts.join(', ')})
    </div>
  );
}

/**
 * Modal for comparing two versions of an agent.
 */
export function CompareVersionsModal({
  isOpen,
  onClose,
  agentId,
  versions,
}: CompareVersionsModalProps) {
  const [versionAId, setVersionAId] = useState('');
  const [versionBId, setVersionBId] = useState('');

  // Initialize with first two versions when modal opens
  useEffect(() => {
    if (versions.length >= 2 && !versionAId && !versionBId) {
      // Version A is older (index 1), Version B is newer (index 0)
      setVersionAId(versions[1]?.id || '');
      setVersionBId(versions[0]?.id || '');
    }
  }, [versions, versionAId, versionBId]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setVersionAId('');
      setVersionBId('');
    }
  }, [isOpen]);

  const { data: comparison, isLoading } = useVersionCompare(
    agentId,
    versionAId,
    versionBId,
    { enabled: isOpen && Boolean(versionAId) && Boolean(versionBId) }
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Compare Versions" size="xl">
      <div className="space-y-4">
        {/* Version Selectors */}
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <label
              htmlFor="version-a-select"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Version A
            </label>
            <select
              id="version-a-select"
              value={versionAId}
              onChange={(e) => setVersionAId(e.target.value)}
              className="block w-full pl-3 pr-10 py-2 text-sm border-gray-300 border rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="">Select version...</option>
              {versions.map((v) => (
                <option key={v.id} value={v.id}>
                  v{v.version_number} ({v.change_type})
                </option>
              ))}
            </select>
          </div>
          <div className="pt-6">
            <svg
              className="w-6 h-6 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M14 5l7 7m0 0l-7 7m7-7H3"
              />
            </svg>
          </div>
          <div className="flex-1">
            <label
              htmlFor="version-b-select"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Version B
            </label>
            <select
              id="version-b-select"
              value={versionBId}
              onChange={(e) => setVersionBId(e.target.value)}
              className="block w-full pl-3 pr-10 py-2 text-sm border-gray-300 border rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="">Select version...</option>
              {versions.map((v) => (
                <option key={v.id} value={v.id}>
                  v{v.version_number} ({v.change_type})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Comparison Results */}
        <div className="max-h-96 overflow-y-auto border rounded-lg">
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin inline-block h-8 w-8 border-4 border-gray-200 border-t-indigo-600 rounded-full" />
              <p className="mt-2 text-sm text-gray-500">Comparing versions...</p>
            </div>
          ) : !comparison ? (
            <div className="text-center py-8 text-sm text-gray-500">
              Select two versions to compare
            </div>
          ) : (
            <div className="divide-y">
              {/* Skills */}
              <div className="p-3">
                <SectionHeader title="Skills" summary={comparison.summary.skills} />
                {comparison.skills.map((diff) => (
                  <DiffItem key={diff.name} diff={diff} />
                ))}
              </div>

              {/* MCP Tools */}
              <div className="p-3">
                <SectionHeader
                  title="MCP Tools"
                  summary={comparison.summary.mcp_tools}
                />
                {comparison.mcp_tools.map((diff) => (
                  <DiffItem key={diff.name} diff={diff} />
                ))}
              </div>

              {/* Memory */}
              <div className="p-3">
                <SectionHeader title="Memory" summary={comparison.summary.memory} />
                {comparison.memory.map((diff) => (
                  <DiffItem key={diff.name} diff={diff} />
                ))}
              </div>

              {/* Agents */}
              <div className="p-3">
                <SectionHeader title="Agents" summary={comparison.summary.agents} />
                {comparison.agents.map((diff) => (
                  <DiffItem key={diff.name} diff={diff} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-4 border-t">
          <button
            onClick={onClose}
            type="button"
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}
