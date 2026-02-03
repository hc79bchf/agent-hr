/**
 * CompareSnapshotsModal component for comparing two component snapshots side-by-side.
 * Shows diffs of content, description, tags, and metadata.
 */

import { useState, useEffect, useMemo } from 'react';
import { Modal } from '../ui/Modal';
import type { ComponentSnapshot, ComponentRegistryEntry } from '../../types';

interface CompareSnapshotsModalProps {
  isOpen: boolean;
  onClose: () => void;
  component: ComponentRegistryEntry;
  snapshots: ComponentSnapshot[];
}

/**
 * Simple text diff visualization.
 */
function TextDiff({ labelA, labelB, textA, textB }: { labelA: string; labelB: string; textA: string; textB: string }) {
  const hasChange = textA !== textB;

  if (!hasChange) {
    return (
      <div className="text-sm text-gray-500 italic">No changes</div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <div className="text-xs font-medium text-gray-500 mb-1">{labelA}</div>
        <pre className="text-xs bg-red-50 p-2 rounded-md overflow-auto max-h-48 whitespace-pre-wrap">
          {textA || <span className="text-gray-400 italic">(empty)</span>}
        </pre>
      </div>
      <div>
        <div className="text-xs font-medium text-gray-500 mb-1">{labelB}</div>
        <pre className="text-xs bg-green-50 p-2 rounded-md overflow-auto max-h-48 whitespace-pre-wrap">
          {textB || <span className="text-gray-400 italic">(empty)</span>}
        </pre>
      </div>
    </div>
  );
}

/**
 * Compare tags arrays.
 */
function TagsDiff({ labelA, labelB, tagsA, tagsB }: { labelA: string; labelB: string; tagsA: string[]; tagsB: string[] }) {
  const added = tagsB.filter(t => !tagsA.includes(t));
  const removed = tagsA.filter(t => !tagsB.includes(t));
  const unchanged = tagsA.filter(t => tagsB.includes(t));

  if (added.length === 0 && removed.length === 0) {
    return (
      <div className="text-sm text-gray-500 italic">No changes</div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <div className="text-xs font-medium text-gray-500 mb-1">{labelA}</div>
        <div className="flex flex-wrap gap-1">
          {removed.map(tag => (
            <span key={tag} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">
              {tag}
            </span>
          ))}
          {unchanged.map(tag => (
            <span key={tag} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
              {tag}
            </span>
          ))}
        </div>
      </div>
      <div>
        <div className="text-xs font-medium text-gray-500 mb-1">{labelB}</div>
        <div className="flex flex-wrap gap-1">
          {added.map(tag => (
            <span key={tag} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
              {tag}
            </span>
          ))}
          {unchanged.map(tag => (
            <span key={tag} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
              {tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Section wrapper with change indicator.
 */
function DiffSection({ title, hasChanges, children }: { title: string; hasChanges: boolean; children: React.ReactNode }) {
  return (
    <div className="p-3">
      <div className={`py-2 px-3 rounded font-medium text-sm mb-2 ${hasChanges ? 'bg-yellow-50 text-yellow-800' : 'bg-gray-50 text-gray-500'}`}>
        {title} {hasChanges ? '(changed)' : '(no changes)'}
      </div>
      {children}
    </div>
  );
}

/**
 * Modal for comparing two snapshots of a component.
 */
export function CompareSnapshotsModal({
  isOpen,
  onClose,
  component,
  snapshots,
}: CompareSnapshotsModalProps) {
  const [versionAId, setVersionAId] = useState<string>('');
  const [versionBId, setVersionBId] = useState<string>('');

  // Options include "current" and all snapshots
  const versionOptions = useMemo(() => {
    const options = [
      { id: 'current', label: 'Current', created_at: component.updated_at }
    ];
    snapshots.forEach(s => {
      options.push({ id: s.id, label: s.version_label, created_at: s.created_at });
    });
    return options;
  }, [component, snapshots]);

  // Initialize with most recent snapshot and current (if at least one snapshot exists)
  useEffect(() => {
    if (isOpen && snapshots.length >= 1 && !versionAId && !versionBId) {
      // Version A is older snapshot, Version B is current
      setVersionAId(snapshots[0]?.id || '');
      setVersionBId('current');
    }
  }, [isOpen, snapshots, versionAId, versionBId]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setVersionAId('');
      setVersionBId('');
    }
  }, [isOpen]);

  // Get data for version A and B
  const versionAData = useMemo(() => {
    if (versionAId === 'current') {
      return {
        name: component.name,
        description: component.description || '',
        content: component.content || '',
        tags: component.tags || [],
        component_metadata: component.component_metadata,
        label: 'Current',
      };
    }
    const snapshot = snapshots.find(s => s.id === versionAId);
    if (!snapshot) return null;
    return {
      name: snapshot.name,
      description: snapshot.description || '',
      content: snapshot.content || '',
      tags: snapshot.tags || [],
      component_metadata: snapshot.component_metadata,
      label: snapshot.version_label,
    };
  }, [versionAId, component, snapshots]);

  const versionBData = useMemo(() => {
    if (versionBId === 'current') {
      return {
        name: component.name,
        description: component.description || '',
        content: component.content || '',
        tags: component.tags || [],
        component_metadata: component.component_metadata,
        label: 'Current',
      };
    }
    const snapshot = snapshots.find(s => s.id === versionBId);
    if (!snapshot) return null;
    return {
      name: snapshot.name,
      description: snapshot.description || '',
      content: snapshot.content || '',
      tags: snapshot.tags || [],
      component_metadata: snapshot.component_metadata,
      label: snapshot.version_label,
    };
  }, [versionBId, component, snapshots]);

  const canCompare = versionAData && versionBData && versionAId !== versionBId;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Compare Versions" size="xl">
      <div className="space-y-4">
        {/* Version Selectors */}
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <label
              htmlFor="snapshot-a-select"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Version A (older)
            </label>
            <select
              id="snapshot-a-select"
              value={versionAId}
              onChange={(e) => setVersionAId(e.target.value)}
              className="block w-full pl-3 pr-10 py-2 text-sm border-gray-300 border rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="">Select version...</option>
              {versionOptions.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
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
              htmlFor="snapshot-b-select"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Version B (newer)
            </label>
            <select
              id="snapshot-b-select"
              value={versionBId}
              onChange={(e) => setVersionBId(e.target.value)}
              className="block w-full pl-3 pr-10 py-2 text-sm border-gray-300 border rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="">Select version...</option>
              {versionOptions.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Warning if same version selected */}
        {versionAId && versionBId && versionAId === versionBId && (
          <div className="text-sm text-yellow-600 bg-yellow-50 p-3 rounded-md">
            Please select two different versions to compare.
          </div>
        )}

        {/* Comparison Results */}
        <div className="max-h-96 overflow-y-auto border rounded-lg">
          {!canCompare ? (
            <div className="text-center py-8 text-sm text-gray-500">
              Select two different versions to compare
            </div>
          ) : (
            <div className="divide-y">
              {/* Name */}
              <DiffSection title="Name" hasChanges={versionAData.name !== versionBData.name}>
                <TextDiff
                  labelA={versionAData.label}
                  labelB={versionBData.label}
                  textA={versionAData.name}
                  textB={versionBData.name}
                />
              </DiffSection>

              {/* Description */}
              <DiffSection title="Description" hasChanges={versionAData.description !== versionBData.description}>
                <TextDiff
                  labelA={versionAData.label}
                  labelB={versionBData.label}
                  textA={versionAData.description}
                  textB={versionBData.description}
                />
              </DiffSection>

              {/* Tags */}
              <DiffSection
                title="Tags"
                hasChanges={JSON.stringify(versionAData.tags.slice().sort()) !== JSON.stringify(versionBData.tags.slice().sort())}
              >
                <TagsDiff
                  labelA={versionAData.label}
                  labelB={versionBData.label}
                  tagsA={versionAData.tags}
                  tagsB={versionBData.tags}
                />
              </DiffSection>

              {/* Content */}
              <DiffSection title="Content" hasChanges={versionAData.content !== versionBData.content}>
                <TextDiff
                  labelA={versionAData.label}
                  labelB={versionBData.label}
                  textA={versionAData.content}
                  textB={versionBData.content}
                />
              </DiffSection>

              {/* Metadata */}
              <DiffSection
                title="Metadata"
                hasChanges={JSON.stringify(versionAData.component_metadata) !== JSON.stringify(versionBData.component_metadata)}
              >
                <TextDiff
                  labelA={versionAData.label}
                  labelB={versionBData.label}
                  textA={JSON.stringify(versionAData.component_metadata, null, 2)}
                  textB={JSON.stringify(versionBData.component_metadata, null, 2)}
                />
              </DiffSection>
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
