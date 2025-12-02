import { useState, useEffect } from 'react'
import type { MergeAnalysis } from '../../types'

interface MergePreviewDialogProps {
  sourceBranch: string
  targetBranch: string
  workspacePath: string
  onConfirm: (options: { squash: boolean }) => void
  onCancel: () => void
}

export function MergePreviewDialog({
  sourceBranch,
  targetBranch,
  workspacePath,
  onConfirm,
  onCancel
}: MergePreviewDialogProps) {
  const [analysis, setAnalysis] = useState<MergeAnalysis | null>(null)
  const [loading, setLoading] = useState(true)
  const [squash, setSquash] = useState(true)

  useEffect(() => {
    loadAnalysis()
  }, [sourceBranch, targetBranch, workspacePath])

  const loadAnalysis = async () => {
    setLoading(true)
    const result = await window.api.git.analyzeMerge(workspacePath, sourceBranch, targetBranch)
    if (result.success && result.data) {
      setAnalysis(result.data)
    } else {
      setAnalysis({
        canMerge: false,
        behindCount: 0,
        conflictFiles: [],
        changedFiles: [],
        error: result.error || 'Failed to analyze merge'
      })
    }
    setLoading(false)
  }

  const hasConflicts = analysis && analysis.conflictFiles.length > 0

  return (
    <div className="fixed inset-0 bg-black/40 flex items-start justify-center pt-[10%] z-50">
      <div className="bg-surface border border-default rounded shadow-lg w-[500px] max-h-[70vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-default">
          <h2 className="text-lg font-semibold">Merge Preview</h2>
          <p className="text-sm text-muted mt-1">
            <span className="font-mono text-secondary">{sourceBranch}</span>
            <span className="mx-2">→</span>
            <span className="font-mono text-secondary">{targetBranch}</span>
          </p>
        </div>

        {/* Content */}
        {loading ? (
          <div className="p-6 text-center">
            <div className="animate-spin w-6 h-6 border-2 border-accent border-t-transparent rounded-full mx-auto mb-2" />
            <p className="text-muted">Analyzing merge...</p>
          </div>
        ) : analysis ? (
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Error state */}
            {analysis.error && (
              <div className="p-3 rounded bg-red-500/10 border border-red-500/30">
                <p className="text-red-400 font-medium">Cannot analyze merge</p>
                <p className="text-muted text-sm mt-1">{analysis.error}</p>
              </div>
            )}

            {/* Warning: target has moved ahead */}
            {analysis.behindCount > 0 && (
              <div className="flex items-start gap-2 p-3 rounded bg-yellow-500/10 border border-yellow-500/30">
                <span className="text-yellow-400 text-lg">⚠</span>
                <div className="text-sm">
                  <p className="font-medium text-yellow-400">
                    {targetBranch} has {analysis.behindCount} new commit
                    {analysis.behindCount > 1 ? 's' : ''}
                  </p>
                  <p className="text-muted mt-0.5">
                    Changes were made to {targetBranch} after this branch was created
                  </p>
                </div>
              </div>
            )}

            {/* Conflict warning */}
            {hasConflicts && (
              <div className="flex items-start gap-2 p-3 rounded bg-red-500/10 border border-red-500/30">
                <span className="text-red-400 text-lg">⚠</span>
                <div className="text-sm">
                  <p className="font-medium text-red-400">
                    Potential conflicts in {analysis.conflictFiles.length} file
                    {analysis.conflictFiles.length > 1 ? 's' : ''}
                  </p>
                  <ul className="text-muted font-mono mt-1 space-y-0.5 max-h-24 overflow-y-auto">
                    {analysis.conflictFiles.map((f) => (
                      <li key={f} className="truncate">
                        • {f}
                      </li>
                    ))}
                  </ul>
                  <p className="text-muted mt-2">
                    These files were modified in both branches and may need manual resolution.
                  </p>
                </div>
              </div>
            )}

            {/* Files to be merged */}
            {analysis.changedFiles.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-2">
                  Files to be merged ({analysis.changedFiles.length})
                </h3>
                <div className="space-y-1 max-h-48 overflow-y-auto rounded bg-hover/30 p-2">
                  {analysis.changedFiles.map((file) => (
                    <div key={file.filePath} className="flex items-center gap-2 text-xs">
                      <span
                        className={
                          analysis.conflictFiles.includes(file.filePath)
                            ? 'text-yellow-400'
                            : 'text-green-400'
                        }
                      >
                        {analysis.conflictFiles.includes(file.filePath) ? '⚠' : '✓'}
                      </span>
                      <span
                        className={`font-mono w-4 ${
                          file.status === 'added'
                            ? 'text-green-400'
                            : file.status === 'deleted'
                              ? 'text-red-400'
                              : 'text-yellow-400'
                        }`}
                      >
                        {file.status === 'added'
                          ? 'A'
                          : file.status === 'deleted'
                            ? 'D'
                            : 'M'}
                      </span>
                      <span className="font-mono truncate flex-1">{file.filePath}</span>
                      <span className="text-green-400">+{file.additions}</span>
                      <span className="text-red-400">-{file.deletions}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* No changes */}
            {analysis.changedFiles.length === 0 && !analysis.error && (
              <div className="text-center py-4 text-muted">
                <p>No changes to merge</p>
                <p className="text-xs mt-1">
                  The branches may already be in sync
                </p>
              </div>
            )}

            {/* Merge options */}
            {analysis.changedFiles.length > 0 && (
              <div className="pt-2 border-t border-default">
                <h3 className="text-sm font-semibold mb-2">Merge Options</h3>
                <label className="flex items-start gap-2 cursor-pointer p-2 rounded hover:bg-hover">
                  <input
                    type="radio"
                    checked={squash}
                    onChange={() => setSquash(true)}
                    className="w-4 h-4 mt-0.5"
                  />
                  <div>
                    <span className="font-medium">Squash merge</span>
                    <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-accent/20 text-accent">
                      recommended
                    </span>
                    <p className="text-xs text-muted mt-0.5">
                      Combines all commits into a single commit on {targetBranch}
                    </p>
                  </div>
                </label>
                <label className="flex items-start gap-2 cursor-pointer p-2 rounded hover:bg-hover mt-1">
                  <input
                    type="radio"
                    checked={!squash}
                    onChange={() => setSquash(false)}
                    className="w-4 h-4 mt-0.5"
                  />
                  <div>
                    <span className="font-medium">Regular merge</span>
                    <p className="text-xs text-muted mt-0.5">
                      Preserves individual commit history with a merge commit
                    </p>
                  </div>
                </label>
              </div>
            )}
          </div>
        ) : null}

        {/* Footer */}
        <div className="p-4 border-t border-default flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded border border-default hover:bg-hover transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm({ squash })}
            disabled={loading || !analysis?.canMerge || analysis.changedFiles.length === 0}
            className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {hasConflicts ? 'Merge (may conflict)' : 'Merge'}
          </button>
        </div>
      </div>
    </div>
  )
}
