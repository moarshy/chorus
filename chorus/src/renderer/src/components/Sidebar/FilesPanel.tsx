import { useEffect, useState, useCallback } from 'react'
import { Tree, NodeRendererProps } from 'react-arborist'
import { useWorkspaceStore } from '../../stores/workspace-store'
import { useFileTreeStore } from '../../stores/file-tree-store'
import type { DirectoryEntry } from '../../types'

interface TreeNode {
  id: string
  name: string
  path: string
  isDirectory: boolean
  children?: TreeNode[]
}

export function FilesPanel(): JSX.Element {
  const { workspaces, selectedWorkspaceId, selectFile } = useWorkspaceStore()
  const { expandedPaths, toggleExpanded } = useFileTreeStore()
  const [treeData, setTreeData] = useState<TreeNode[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const selectedWorkspace = workspaces.find((ws) => ws.id === selectedWorkspaceId)

  // Load directory contents
  const loadDirectory = useCallback(async (path: string): Promise<TreeNode[]> => {
    try {
      const result = await window.api.fs.listDirectory(path)
      if (result.success && result.data) {
        return result.data.map((entry: DirectoryEntry) => ({
          id: entry.path,
          name: entry.name,
          path: entry.path,
          isDirectory: entry.isDirectory,
          children: entry.isDirectory ? [] : undefined
        }))
      }
    } catch (error) {
      console.error('Failed to load directory:', error)
    }
    return []
  }, [])

  // Load root directory when workspace changes
  useEffect(() => {
    if (!selectedWorkspace) {
      setTreeData([])
      return
    }

    setIsLoading(true)
    loadDirectory(selectedWorkspace.path).then((data) => {
      setTreeData(data)
      setIsLoading(false)
    })
  }, [selectedWorkspace, loadDirectory])

  // Handle node toggle
  const handleToggle = async (id: string) => {
    toggleExpanded(id)
  }

  // Handle node select
  const handleSelect = (nodes: TreeNode[]) => {
    const node = nodes[0]
    if (node && !node.isDirectory) {
      selectFile(node.path)
    }
  }

  // Custom node renderer
  const Node = ({ node, style, dragHandle }: NodeRendererProps<TreeNode>) => {
    const data = node.data
    const isExpanded = expandedPaths.has(data.id)

    const handleClick = async () => {
      if (data.isDirectory) {
        handleToggle(data.id)
        // Load children if expanding and no children loaded
        if (!isExpanded && (!node.children || node.children.length === 0)) {
          const children = await loadDirectory(data.path)
          // Update tree data with children
          setTreeData((prev) => updateTreeNode(prev, data.id, children))
        }
      } else {
        selectFile(data.path)
      }
    }

    return (
      <div
        ref={dragHandle}
        style={style}
        className={`tree-node ${node.isSelected ? 'selected' : ''}`}
        onClick={handleClick}
      >
        <span className="mr-2 text-xs">
          {data.isDirectory ? (isExpanded ? '📂' : '📁') : getFileIcon(data.name)}
        </span>
        <span className="truncate text-sm">{data.name}</span>
      </div>
    )
  }

  if (!selectedWorkspace) {
    return (
      <div className="flex items-center justify-center h-full text-muted text-sm">
        Select a workspace to view files
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full text-muted text-sm">
        Loading files...
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-3 py-2 border-b border-default">
        <span className="text-xs text-muted">Files:</span>
        <span className="ml-1 text-sm">{selectedWorkspace.name}</span>
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-hidden">
        <Tree
          data={treeData}
          openByDefault={false}
          width="100%"
          height={600}
          indent={16}
          rowHeight={28}
          onSelect={handleSelect}
        >
          {Node}
        </Tree>
      </div>
    </div>
  )
}

// Helper to update a node in the tree
function updateTreeNode(tree: TreeNode[], id: string, children: TreeNode[]): TreeNode[] {
  return tree.map((node) => {
    if (node.id === id) {
      return { ...node, children }
    }
    if (node.children) {
      return { ...node, children: updateTreeNode(node.children, id, children) }
    }
    return node
  })
}

// Get file icon based on extension
function getFileIcon(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'ts':
    case 'tsx':
      return '🔷'
    case 'js':
    case 'jsx':
      return '🟨'
    case 'json':
      return '📋'
    case 'md':
      return '📝'
    case 'css':
    case 'scss':
      return '🎨'
    case 'html':
      return '🌐'
    case 'py':
      return '🐍'
    case 'yml':
    case 'yaml':
      return '⚙️'
    default:
      return '📄'
  }
}
