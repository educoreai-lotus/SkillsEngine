/**
 * Career Path Hierarchy Browser Component
 * 
 * Displays competencies in a hierarchical tree structure organized by layers.
 * Allows HR to browse and select competencies/topics for a user's career path.
 */

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';

/**
 * Recursive component for rendering competency nodes
 */
function CompetencyNode({
  competency,
  level = 0,
  isAdded = false,
  onToggle,
  onAdd,
  onRemove,
  expandedNodes = new Set(),
  addedCompetencyIds = []
}) {
  const hasChildren = competency.children && competency.children.length > 0;
  const isExpanded = expandedNodes.has(competency.competency_id);
  const isCore = competency.core_competency === true;
  const indentLevel = level * 24; // 24px per level

  return (
    <div className="competency-node">
      <div
        className={`
          flex items-center gap-3 p-3 rounded-lg border transition-all
          ${isAdded
            ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-300 dark:border-emerald-700'
            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-emerald-300 dark:hover:border-emerald-600'
          }
          ${level === 0 ? 'font-semibold' : level === 1 ? 'font-medium' : ''}
        `}
        style={{ marginLeft: `${indentLevel}px` }}
      >
        {/* Expand/Collapse Icon */}
        {hasChildren ? (
          <button
            onClick={() => onToggle(competency.competency_id)}
            className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className={`h-4 w-4 text-slate-600 dark:text-slate-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
            </svg>
          </button>
        ) : (
          <div className="w-6" /> // Spacer for alignment
        )}

        {/* Competency Icon */}
        <div className="flex-shrink-0">
          {isCore ? (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-500" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
              <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
            </svg>
          )}
        </div>

        {/* Competency Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className={`
              text-slate-800 dark:text-slate-100 truncate
              ${level === 0 ? 'text-lg' : level === 1 ? 'text-base' : 'text-sm'}
            `}>
              {competency.competency_name}
            </h3>
            {isAdded && (
              <span className="px-2 py-0.5 text-xs font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded flex items-center gap-1">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Added
              </span>
            )}
            {hasChildren && (
              <span className="px-2 py-0.5 text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 rounded">
                {competency.children.length} {competency.children.length === 1 ? 'sub-competency' : 'sub-competencies'}
              </span>
            )}
          </div>
          {competency.competency_description && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-1">
              {competency.competency_description}
            </p>
          )}
        </div>

        {/* Add/Remove Button - Only show for leaf nodes (core competencies) */}
        <div className="flex-shrink-0">
          {!hasChildren ? (
            // Leaf node (core competency) - can be added/removed
            isAdded ? (
              <button
                onClick={() => onRemove(competency.competency_id)}
                className="px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors flex items-center gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                Remove
              </button>
            ) : (
              <button
                onClick={() => onAdd(competency)}
                className="px-4 py-2 text-sm font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors flex items-center gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                </svg>
                Add
              </button>
            )
          ) : (
            // Parent competency - show info message instead of button
            <span className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400 italic">
              Select sub-competencies below
            </span>
          )}
        </div>
      </div>

      {/* Render Children */}
      {hasChildren && isExpanded && (
        <div className="mt-2 space-y-2">
          {competency.children.map((child) => {
            // Check if this specific child is added
            const childIsAdded = addedCompetencyIds && addedCompetencyIds.includes(child.competency_id);
            return (
              <CompetencyNode
                key={child.competency_id}
                competency={child}
                level={level + 1}
                isAdded={childIsAdded}
                onToggle={onToggle}
                onAdd={onAdd}
                onRemove={onRemove}
                expandedNodes={expandedNodes}
                addedCompetencyIds={addedCompetencyIds}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Main Hierarchy Browser Component
 */
export default function CareerPathHierarchyBrowser({
  userId,
  targetRole,
  userName,
  onAddCompetency,
  onRemoveCompetency,
  addedCompetencyIds = []
}) {
  const [hierarchy, setHierarchy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedNodes, setExpandedNodes] = useState(new Set());

  // Find root competency by career path name and load hierarchy
  useEffect(() => {
    const loadHierarchy = async () => {
      if (!targetRole || !userId) return;

      setLoading(true);
      setError(null);

      try {
        // Step 1: Search for competency matching the career path name
        const searchResponse = await api.searchCompetencies(targetRole, { limit: 5 });
        const competencies = searchResponse.data || [];

        // Find exact or closest match
        let rootCompetency = competencies.find(
          comp => comp.competency_name.toLowerCase() === targetRole.toLowerCase()
        ) || competencies[0];

        if (!rootCompetency) {
          setError(`No competency found matching "${targetRole}"`);
          setLoading(false);
          return;
        }

        // Step 2: Get complete hierarchy
        const hierarchyResponse = await api.getCompetencyCompleteHierarchy(rootCompetency.competency_id);
        const hierarchyData = hierarchyResponse.data;

        if (!hierarchyData) {
          setError('Failed to load competency hierarchy');
          setLoading(false);
          return;
        }

        // Build recursive children structure
        const buildChildren = (comp) => {
          if (!comp.children || comp.children.length === 0) {
            return { ...comp, children: [] };
          }
          return {
            ...comp,
            children: comp.children.map(buildChildren)
          };
        };

        const fullHierarchy = buildChildren(hierarchyData);
        setHierarchy(fullHierarchy);

        // Expand root by default
        setExpandedNodes(new Set([fullHierarchy.competency_id]));
      } catch (err) {
        console.error('Error loading hierarchy:', err);
        setError('Failed to load competency hierarchy. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    loadHierarchy();
  }, [targetRole, userId]);

  const handleToggle = (competencyId) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(competencyId)) {
      newExpanded.delete(competencyId);
    } else {
      newExpanded.add(competencyId);
    }
    setExpandedNodes(newExpanded);
  };

  const handleAdd = async (competency) => {
    if (onAddCompetency) {
      await onAddCompetency(competency);
    }
  };

  const handleRemove = async (competencyId) => {
    if (onRemoveCompetency) {
      await onRemoveCompetency(competencyId);
    }
  };

  // Check if competency is added (recursive check)
  const isCompetencyAdded = useCallback((competency) => {
    if (addedCompetencyIds.includes(competency.competency_id)) {
      return true;
    }
    // Check children recursively
    if (competency.children) {
      return competency.children.some(child => isCompetencyAdded(child));
    }
    return false;
  }, [addedCompetencyIds]);

  if (loading) {
    return (
      <div className="glass rounded-xl p-6">
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass rounded-xl p-6">
        <div className="text-center py-8 text-red-600 dark:text-red-400">
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (!hierarchy) {
    return (
      <div className="glass rounded-xl p-6">
        <div className="text-center py-8 text-slate-500 dark:text-slate-400">
          <p>No hierarchy found for "{targetRole}"</p>
        </div>
      </div>
    );
  }

  return (
    <div className="career-path-hierarchy-browser">
      {/* Header Section */}
      <div className="glass rounded-xl p-6 mb-6">
        <p className="text-slate-600 dark:text-slate-400 mt-2">
          Select competencies and topics for the user to learn.
        </p>
      </div>

      {/* Hierarchy Tree */}
      <div className="glass rounded-xl p-6">
        <div className="space-y-2">
          <CompetencyNode
            competency={hierarchy}
            level={0}
            isAdded={addedCompetencyIds.includes(hierarchy.competency_id)}
            onToggle={handleToggle}
            onAdd={handleAdd}
            onRemove={handleRemove}
            expandedNodes={expandedNodes}
            addedCompetencyIds={addedCompetencyIds}
          />
        </div>

        {/* Legend */}
        <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-700">
          <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">Legend:</p>
          <div className="flex flex-wrap gap-4 text-xs">
            <div className="flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
                <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
              </svg>
              <span className="text-slate-600 dark:text-slate-400">Parent Competency</span>
            </div>
            <div className="flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-500" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
              </svg>
              <span className="text-slate-600 dark:text-slate-400">Learning Topic (Core)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded text-xs">
                Added
              </span>
              <span className="text-slate-600 dark:text-slate-400">Already in Career Path</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

