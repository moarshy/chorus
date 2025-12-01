import { useState, useCallback, useEffect, useRef } from 'react'
import type { DirectoryEntry } from '../../types'
import { useFileTreeStore } from '../../stores/file-tree-store'

// ============================================
// TYPES
// ============================================

interface FileTreeNode {
  id: string
  name: string
  path: string
  isDirectory: boolean
  children?: FileTreeNode[]
  isLoading?: boolean
}

interface FileTreeProps {
  rootPath: string
  onFileSelect: (path: string) => void
  selectedPath: string | null
}

interface ContextMenuState {
  isOpen: boolean
  x: number
  y: number
  node: FileTreeNode | null
}

// ============================================
// SVG ICONS
// ============================================

const ChevronIcon = ({ expanded }: { expanded: boolean }) => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 12 12"
    fill="none"
    className={`transition-transform duration-150 ${expanded ? 'rotate-90' : ''}`}
  >
    <path
      d="M4.5 2.5L8 6L4.5 9.5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const FolderIcon = ({ open }: { open?: boolean }) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    {open ? (
      <>
        <path
          d="M1.5 4.5V3.5C1.5 2.94772 1.94772 2.5 2.5 2.5H5.37868C5.64424 2.5 5.89845 2.60536 6.08579 2.79289L7 3.70711C7.18753 3.89464 7.44174 4 7.70711 4H13.5C14.0523 4 14.5 4.44772 14.5 5V5.5"
          stroke="#dcb67a"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
        <path
          d="M2.5 13.5H13.5C14.0523 13.5 14.5 13.0523 14.5 12.5V6.5C14.5 5.94772 14.0523 5.5 13.5 5.5H2.5C1.94772 5.5 1.5 5.94772 1.5 6.5V12.5C1.5 13.0523 1.94772 13.5 2.5 13.5Z"
          fill="#dcb67a"
          fillOpacity="0.2"
          stroke="#dcb67a"
          strokeWidth="1.2"
        />
      </>
    ) : (
      <path
        d="M2.5 13.5H13.5C14.0523 13.5 14.5 13.0523 14.5 12.5V5C14.5 4.44772 14.0523 4 13.5 4H7.70711C7.44174 4 7.18753 3.89464 7 3.70711L6.08579 2.79289C5.89845 2.60536 5.64424 2.5 5.37868 2.5H2.5C1.94772 2.5 1.5 2.94772 1.5 3.5V12.5C1.5 13.0523 1.94772 13.5 2.5 13.5Z"
        fill="#dcb67a"
        fillOpacity="0.15"
        stroke="#dcb67a"
        strokeWidth="1.2"
      />
    )}
  </svg>
)

const TypeScriptIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <rect x="1" y="1" width="14" height="14" rx="2" fill="#3178c6" />
    <path d="M5 7.5H9M7 7.5V12" stroke="white" strokeWidth="1.3" strokeLinecap="round" />
    <path
      d="M10 9.5C10 8.67157 10.6716 8 11.5 8C12.3284 8 13 8.67157 13 9.5C13 10 12.7 10.3 12.3 10.5C12.7 10.7 13 11 13 11.5C13 12.3284 12.3284 13 11.5 13C10.6716 13 10 12.3284 10 11.5"
      stroke="white"
      strokeWidth="1.1"
      strokeLinecap="round"
    />
  </svg>
)

const JavaScriptIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <rect x="1" y="1" width="14" height="14" rx="2" fill="#f7df1e" />
    <path
      d="M6 8V11.5C6 12.3284 5.32843 13 4.5 13C3.67157 13 3 12.3284 3 11.5"
      stroke="#323330"
      strokeWidth="1.3"
      strokeLinecap="round"
    />
    <path
      d="M9 9.5C9 8.67157 9.67157 8 10.5 8C11.3284 8 12 8.67157 12 9.5C12 10 11.7 10.3 11.3 10.5C11.7 10.7 12 11 12 11.5C12 12.3284 11.3284 13 10.5 13C9.67157 13 9 12.3284 9 11.5"
      stroke="#323330"
      strokeWidth="1.1"
      strokeLinecap="round"
    />
  </svg>
)

const ReactIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <circle cx="8" cy="8" r="1.5" fill="#61dafb" />
    <ellipse cx="8" cy="8" rx="6.5" ry="2.5" stroke="#61dafb" strokeWidth="1" fill="none" />
    <ellipse cx="8" cy="8" rx="6.5" ry="2.5" stroke="#61dafb" strokeWidth="1" fill="none" transform="rotate(60 8 8)" />
    <ellipse cx="8" cy="8" rx="6.5" ry="2.5" stroke="#61dafb" strokeWidth="1" fill="none" transform="rotate(120 8 8)" />
  </svg>
)

const JsonIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <rect x="1" y="1" width="14" height="14" rx="2" fill="#cbcb41" fillOpacity="0.15" stroke="#cbcb41" strokeWidth="1" />
    <path d="M5 5C4 5 4 6 4 6.5V7.5C4 8 3.5 8 3 8C3.5 8 4 8 4 8.5V9.5C4 10 4 11 5 11" stroke="#cbcb41" strokeWidth="1.2" strokeLinecap="round" />
    <path d="M11 5C12 5 12 6 12 6.5V7.5C12 8 12.5 8 13 8C12.5 8 12 8 12 8.5V9.5C12 10 12 11 11 11" stroke="#cbcb41" strokeWidth="1.2" strokeLinecap="round" />
  </svg>
)

const MarkdownIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <rect x="1" y="3" width="14" height="10" rx="1.5" fill="#519aba" fillOpacity="0.15" stroke="#519aba" strokeWidth="1" />
    <path d="M3.5 10V6L5.5 8.5L7.5 6V10" stroke="#519aba" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M10 8.5L12 6.5V10L12 6.5L14 8.5" stroke="#519aba" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const CssIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <rect x="1" y="1" width="14" height="14" rx="2" fill="#563d7c" />
    <path
      d="M10 5H6C5.44772 5 5 5.44772 5 6V6C5 6.55228 5.44772 7 6 7H10C10.5523 7 11 7.44772 11 8V8C11 8.55228 10.5523 9 10 9H6C5.44772 9 5 9.44772 5 10V10C5 10.5523 5.44772 11 6 11H10"
      stroke="white"
      strokeWidth="1.3"
      strokeLinecap="round"
    />
  </svg>
)

const HtmlIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <rect x="1" y="1" width="14" height="14" rx="2" fill="#e44d26" />
    <path d="M4 5L6 8L4 11" stroke="white" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M12 5L10 8L12 11" stroke="white" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const PythonIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path d="M8 1C5 1 5 2.5 5 3.5V5H8.5V5.5H3.5C2 5.5 1 6.5 1 8.5C1 10.5 2 11.5 3.5 11.5H5V10C5 8.5 6 7.5 8 7.5H11C12 7.5 13 6.5 13 5.5V3.5C13 2 11 1 8 1Z" fill="#3776ab" />
    <path d="M8 15C11 15 11 13.5 11 12.5V11H7.5V10.5H12.5C14 10.5 15 9.5 15 7.5C15 5.5 14 4.5 12.5 4.5H11V6C11 7.5 10 8.5 8 8.5H5C4 8.5 3 9.5 3 10.5V12.5C3 14 5 15 8 15Z" fill="#ffd43b" />
    <circle cx="6.5" cy="3.5" r="0.75" fill="white" />
    <circle cx="9.5" cy="12.5" r="0.75" fill="white" />
  </svg>
)

const YamlIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <rect x="1" y="1" width="14" height="14" rx="2" fill="#cb171e" fillOpacity="0.15" stroke="#cb171e" strokeWidth="1" />
    <path d="M4 5L6 8V11" stroke="#cb171e" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M8 5L6 8" stroke="#cb171e" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M10 5V11" stroke="#cb171e" strokeWidth="1.2" strokeLinecap="round" />
    <path d="M12 5V11" stroke="#cb171e" strokeWidth="1.2" strokeLinecap="round" />
  </svg>
)

const GitIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path
      d="M14.7 7.3L8.7 1.3C8.3 0.9 7.7 0.9 7.3 1.3L5.7 2.9L7.7 4.9C8.1 4.8 8.6 4.8 9 5.1C9.4 5.5 9.5 6 9.3 6.5L11.2 8.4C11.7 8.2 12.3 8.3 12.6 8.7C13.1 9.2 13.1 9.9 12.6 10.4C12.1 10.9 11.4 10.9 10.9 10.4C10.5 10 10.4 9.4 10.7 8.9L8.9 7.1V11.1C9 11.2 9.2 11.3 9.3 11.5C9.8 12 9.8 12.7 9.3 13.2C8.8 13.7 8.1 13.7 7.6 13.2C7.1 12.7 7.1 12 7.6 11.5C7.7 11.4 7.9 11.2 8 11.1V7C7.9 6.9 7.7 6.8 7.6 6.6C7.2 6.2 7.1 5.6 7.3 5.1L5.4 3.2L1.3 7.3C0.9 7.7 0.9 8.3 1.3 8.7L7.3 14.7C7.7 15.1 8.3 15.1 8.7 14.7L14.7 8.7C15.1 8.3 15.1 7.7 14.7 7.3Z"
      fill="#f05032"
    />
  </svg>
)

const ImageIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <rect x="1.5" y="2.5" width="13" height="11" rx="1.5" fill="#a074c4" fillOpacity="0.15" stroke="#a074c4" strokeWidth="1" />
    <circle cx="5" cy="6" r="1.5" fill="#a074c4" />
    <path d="M2 11.5L5 8.5L7 10.5L10 7L14 11.5" stroke="#a074c4" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const LockIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <rect x="3" y="7" width="10" height="7" rx="1.5" fill="#848484" fillOpacity="0.2" stroke="#848484" strokeWidth="1" />
    <path d="M5 7V5C5 3.34315 6.34315 2 8 2C9.65685 2 11 3.34315 11 5V7" stroke="#848484" strokeWidth="1.2" strokeLinecap="round" />
    <circle cx="8" cy="10.5" r="1" fill="#848484" />
  </svg>
)

const DefaultFileIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path d="M3.5 1.5H9.5L12.5 4.5V14.5H3.5V1.5Z" fill="#848484" fillOpacity="0.1" stroke="#848484" strokeWidth="1" strokeLinejoin="round" />
    <path d="M9.5 1.5V4.5H12.5" stroke="#848484" strokeWidth="1" strokeLinejoin="round" />
  </svg>
)

// Context menu icons
const NewFileIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
    <path d="M3.75 1.5a.25.25 0 00-.25.25v11.5c0 .138.112.25.25.25h8.5a.25.25 0 00.25-.25V6H9.75A1.75 1.75 0 018 4.25V1.5H3.75zM9.5 1.5v2.75c0 .138.112.25.25.25h2.75l-3-3z" />
    <path d="M8 8a.75.75 0 01.75.75v1.5h1.5a.75.75 0 010 1.5h-1.5v1.5a.75.75 0 01-1.5 0v-1.5h-1.5a.75.75 0 010-1.5h1.5v-1.5A.75.75 0 018 8z" />
  </svg>
)

const NewFolderIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
    <path d="M1.75 2.5a.25.25 0 00-.25.25v10.5c0 .138.112.25.25.25h12.5a.25.25 0 00.25-.25v-8.5a.25.25 0 00-.25-.25H7.5c-.55 0-1.07-.26-1.4-.7l-.9-1.2a.25.25 0 00-.2-.1H1.75z" />
    <path d="M8 6a.75.75 0 01.75.75v2h2a.75.75 0 010 1.5h-2v2a.75.75 0 01-1.5 0v-2h-2a.75.75 0 010-1.5h2v-2A.75.75 0 018 6z" />
  </svg>
)

const RenameIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
    <path d="M11.013 1.427a1.75 1.75 0 012.474 0l1.086 1.086a1.75 1.75 0 010 2.474l-8.61 8.61c-.21.21-.47.364-.756.445l-3.251.93a.75.75 0 01-.927-.928l.929-3.25a1.75 1.75 0 01.445-.758l8.61-8.61zm1.414 1.06a.25.25 0 00-.354 0L10.811 3.75l1.439 1.44 1.263-1.263a.25.25 0 000-.354l-1.086-1.086zM11.189 6.25L9.75 4.81l-6.286 6.287a.25.25 0 00-.064.108l-.558 1.953 1.953-.558a.249.249 0 00.108-.064l6.286-6.286z" />
  </svg>
)

const DeleteIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
    <path d="M6.5 1.75a.25.25 0 01.25-.25h2.5a.25.25 0 01.25.25V3h-3V1.75zm4.5 0V3h2.25a.75.75 0 010 1.5H2.75a.75.75 0 010-1.5H5V1.75C5 .784 5.784 0 6.75 0h2.5C10.216 0 11 .784 11 1.75zM4.496 6.675a.75.75 0 10-1.492.15l.66 6.6A1.75 1.75 0 005.405 15h5.19a1.75 1.75 0 001.741-1.575l.66-6.6a.75.75 0 00-1.492-.15l-.66 6.6a.25.25 0 01-.249.225h-5.19a.25.25 0 01-.249-.225l-.66-6.6z" />
  </svg>
)

const CopyPathIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
    <path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 010 1.5h-1.5a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 00.25-.25v-1.5a.75.75 0 011.5 0v1.5A1.75 1.75 0 019.25 16h-7.5A1.75 1.75 0 010 14.25v-7.5z" />
    <path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0114.25 11h-7.5A1.75 1.75 0 015 9.25v-7.5zm1.75-.25a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 00.25-.25v-7.5a.25.25 0 00-.25-.25h-7.5z" />
  </svg>
)

const RefreshIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
    <path d="M8 3a5 5 0 104.546 2.914.75.75 0 011.366-.62A6.5 6.5 0 118 1.5v-1A.75.75 0 019.28.22l2.25 2.25a.75.75 0 010 1.06L9.28 5.78A.75.75 0 018 5.25v-2.25z" />
  </svg>
)

// ============================================
// FILE ICON RESOLVER
// ============================================

function getFileIcon(filename: string) {
  const ext = filename.split('.').pop()?.toLowerCase()
  const name = filename.toLowerCase()

  if (name === '.gitignore' || name === '.gitattributes') return <GitIcon />
  if (name === 'package.json' || name === 'package-lock.json') return <JsonIcon />
  if (name === 'tsconfig.json') return <TypeScriptIcon />
  if (name === '.env' || name.startsWith('.env.')) return <LockIcon />

  switch (ext) {
    case 'ts': return <TypeScriptIcon />
    case 'tsx': return <ReactIcon />
    case 'js': return <JavaScriptIcon />
    case 'jsx': return <ReactIcon />
    case 'json': return <JsonIcon />
    case 'md': case 'mdx': return <MarkdownIcon />
    case 'css': case 'scss': case 'sass': case 'less': return <CssIcon />
    case 'html': case 'htm': return <HtmlIcon />
    case 'py': case 'pyw': case 'pyx': return <PythonIcon />
    case 'yml': case 'yaml': return <YamlIcon />
    case 'png': case 'jpg': case 'jpeg': case 'gif': case 'svg': case 'webp': case 'ico': return <ImageIcon />
    case 'lock': return <LockIcon />
    default: return <DefaultFileIcon />
  }
}

// ============================================
// TREE NODE COMPONENT
// ============================================

interface TreeNodeProps {
  node: FileTreeNode
  depth: number
  expandedPaths: Set<string>
  selectedPath: string | null
  onToggle: (path: string) => void
  onSelect: (node: FileTreeNode) => void
  onContextMenu: (e: React.MouseEvent, node: FileTreeNode) => void
  loadChildren: (path: string) => Promise<FileTreeNode[]>
}

function TreeNode({
  node,
  depth,
  expandedPaths,
  selectedPath,
  onToggle,
  onSelect,
  onContextMenu,
  loadChildren
}: TreeNodeProps) {
  const [children, setChildren] = useState<FileTreeNode[]>(node.children || [])
  const [isLoading, setIsLoading] = useState(false)

  const isExpanded = expandedPaths.has(node.path)
  const isSelected = selectedPath === node.path

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation()

    if (node.isDirectory) {
      onToggle(node.path)

      // Load children if expanding and no children loaded
      if (!isExpanded && children.length === 0) {
        setIsLoading(true)
        const loadedChildren = await loadChildren(node.path)
        setChildren(loadedChildren)
        setIsLoading(false)
      }
    } else {
      onSelect(node)
    }
  }

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onContextMenu(e, node)
  }

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (node.isDirectory) {
      onToggle(node.path)
    } else {
      onSelect(node)
    }
  }

  return (
    <div>
      <div
        className={`
          flex items-center gap-1.5 py-1 pr-2 rounded-md cursor-pointer transition-colors
          ${isSelected ? 'bg-selected' : 'hover:bg-hover'}
        `}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
      >
        {/* Chevron for directories */}
        {node.isDirectory ? (
          <span className="flex-shrink-0 w-4 h-4 flex items-center justify-center text-muted">
            {isLoading ? (
              <span className="w-3 h-3 border-2 border-muted border-t-transparent rounded-full animate-spin" />
            ) : (
              <ChevronIcon expanded={isExpanded} />
            )}
          </span>
        ) : (
          <span className="flex-shrink-0 w-4" />
        )}

        {/* File/Folder icon */}
        <span className="flex-shrink-0">
          {node.isDirectory ? <FolderIcon open={isExpanded} /> : getFileIcon(node.name)}
        </span>

        {/* File name */}
        <span className={`truncate text-sm ${node.isDirectory ? 'font-medium' : ''}`}>
          {node.name}
        </span>
      </div>

      {/* Children */}
      {node.isDirectory && isExpanded && (
        <div>
          {children.map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              expandedPaths={expandedPaths}
              selectedPath={selectedPath}
              onToggle={onToggle}
              onSelect={onSelect}
              onContextMenu={onContextMenu}
              loadChildren={loadChildren}
            />
          ))}
          {children.length === 0 && !isLoading && (
            <div
              className="text-xs text-muted py-1"
              style={{ paddingLeft: `${(depth + 1) * 12 + 8}px` }}
            >
              Empty folder
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ============================================
// CONTEXT MENU COMPONENT
// ============================================

interface ContextMenuProps {
  state: ContextMenuState
  onClose: () => void
  onNewFile: () => void
  onNewFolder: () => void
  onRename: () => void
  onDelete: () => void
  onCopyPath: () => void
  onRefresh: () => void
}

function ContextMenu({ state, onClose, onNewFile, onNewFolder, onRename, onDelete, onCopyPath, onRefresh }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  if (!state.isOpen) return null

  const isFolder = state.node?.isDirectory

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-main border border-default rounded-lg shadow-xl py-1 min-w-44 overflow-hidden"
      style={{ left: state.x, top: state.y }}
    >
      <button
        onClick={onNewFile}
        className="w-full px-3 py-2 text-left text-sm text-secondary hover:bg-hover hover:text-primary flex items-center gap-2"
      >
        <NewFileIcon />
        New File
      </button>
      <button
        onClick={onNewFolder}
        className="w-full px-3 py-2 text-left text-sm text-secondary hover:bg-hover hover:text-primary flex items-center gap-2"
      >
        <NewFolderIcon />
        New Folder
      </button>
      <div className="h-px bg-border-default my-1" />
      <button
        onClick={onRename}
        className="w-full px-3 py-2 text-left text-sm text-secondary hover:bg-hover hover:text-primary flex items-center gap-2"
      >
        <RenameIcon />
        Rename
      </button>
      <button
        onClick={onDelete}
        className="w-full px-3 py-2 text-left text-sm text-secondary hover:bg-hover hover:text-primary flex items-center gap-2"
      >
        <DeleteIcon />
        Delete
      </button>
      <div className="h-px bg-border-default my-1" />
      <button
        onClick={onCopyPath}
        className="w-full px-3 py-2 text-left text-sm text-secondary hover:bg-hover hover:text-primary flex items-center gap-2"
      >
        <CopyPathIcon />
        Copy Path
      </button>
      {isFolder && (
        <button
          onClick={onRefresh}
          className="w-full px-3 py-2 text-left text-sm text-secondary hover:bg-hover hover:text-primary flex items-center gap-2"
        >
          <RefreshIcon />
          Refresh
        </button>
      )}
    </div>
  )
}

// ============================================
// MAIN FILE TREE COMPONENT
// ============================================

// Input dialog state
interface InputDialogState {
  isOpen: boolean
  type: 'rename' | 'newFile' | 'newFolder'
  initialValue: string
  targetPath: string  // For rename: the file path; for new: the parent directory
}

// Delete confirmation state
interface DeleteConfirmState {
  isOpen: boolean
  path: string
  name: string
  isDirectory: boolean
}

export function FileTree({ rootPath, onFileSelect, selectedPath }: FileTreeProps) {
  const [rootNodes, setRootNodes] = useState<FileTreeNode[]>([])
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(true)
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    isOpen: false,
    x: 0,
    y: 0,
    node: null
  })

  // Get refresh trigger from store
  const refreshVersion = useFileTreeStore((state) => state.refreshVersion)
  const triggerRefresh = useFileTreeStore((state) => state.triggerRefresh)

  // Input dialog state
  const [inputDialog, setInputDialog] = useState<InputDialogState>({
    isOpen: false,
    type: 'newFile',
    initialValue: '',
    targetPath: ''
  })
  const [inputValue, setInputValue] = useState('')

  // Delete confirmation state
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirmState | null>(null)

  // Load directory contents
  const loadDirectory = useCallback(async (path: string): Promise<FileTreeNode[]> => {
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
    } catch {
      // Silently fail - return empty array
    }
    return []
  }, [])

  // Load root directory (also refreshes when refreshVersion changes)
  useEffect(() => {
    setIsLoading(true)
    setExpandedPaths(new Set()) // Collapse all on refresh
    loadDirectory(rootPath).then((nodes) => {
      setRootNodes(nodes)
      setIsLoading(false)
    })
  }, [rootPath, loadDirectory, refreshVersion])

  // Toggle folder expanded state
  const handleToggle = (path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev)
      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
      }
      return next
    })
  }

  // Handle file selection
  const handleSelect = (node: FileTreeNode) => {
    if (!node.isDirectory) {
      onFileSelect(node.path)
    }
  }

  // Handle context menu
  const handleContextMenu = (e: React.MouseEvent, node: FileTreeNode) => {
    setContextMenu({
      isOpen: true,
      x: Math.min(e.clientX, window.innerWidth - 200),
      y: Math.min(e.clientY, window.innerHeight - 250),
      node
    })
  }

  const closeContextMenu = () => {
    setContextMenu((prev) => ({ ...prev, isOpen: false }))
  }

  // Context menu actions
  const handleNewFile = () => {
    if (!contextMenu.node) return
    const targetDir = contextMenu.node.isDirectory ? contextMenu.node.path : contextMenu.node.path.substring(0, contextMenu.node.path.lastIndexOf('/'))
    setInputDialog({
      isOpen: true,
      type: 'newFile',
      initialValue: '',
      targetPath: targetDir
    })
    setInputValue('')
    closeContextMenu()
  }

  const handleNewFolder = () => {
    if (!contextMenu.node) return
    const targetDir = contextMenu.node.isDirectory ? contextMenu.node.path : contextMenu.node.path.substring(0, contextMenu.node.path.lastIndexOf('/'))
    setInputDialog({
      isOpen: true,
      type: 'newFolder',
      initialValue: '',
      targetPath: targetDir
    })
    setInputValue('')
    closeContextMenu()
  }

  const handleRename = () => {
    if (!contextMenu.node) return
    setInputDialog({
      isOpen: true,
      type: 'rename',
      initialValue: contextMenu.node.name,
      targetPath: contextMenu.node.path
    })
    setInputValue(contextMenu.node.name)
    closeContextMenu()
  }

  const handleDelete = () => {
    if (!contextMenu.node) return
    setDeleteConfirm({
      isOpen: true,
      path: contextMenu.node.path,
      name: contextMenu.node.name,
      isDirectory: contextMenu.node.isDirectory
    })
    closeContextMenu()
  }

  // Handle input dialog submit
  const handleInputSubmit = async () => {
    if (!inputValue.trim()) return

    const { type, targetPath } = inputDialog

    try {
      let success = false
      if (type === 'rename') {
        const parentDir = targetPath.substring(0, targetPath.lastIndexOf('/'))
        const newPath = `${parentDir}/${inputValue}`
        const result = await window.api.fs.rename(targetPath, newPath)
        success = result.success
      } else if (type === 'newFile') {
        const newPath = `${targetPath}/${inputValue}`
        const result = await window.api.fs.createFile(newPath)
        success = result.success
      } else if (type === 'newFolder') {
        const newPath = `${targetPath}/${inputValue}`
        const result = await window.api.fs.createDirectory(newPath)
        success = result.success
      }

      if (success) {
        triggerRefresh() // Reload entire tree
      }
    } catch (error) {
      console.error('File operation failed:', error)
    }

    setInputDialog({ ...inputDialog, isOpen: false })
    setInputValue('')
  }

  // Handle delete confirmation
  const handleDeleteConfirm = async () => {
    if (!deleteConfirm) return

    try {
      const result = await window.api.fs.delete(deleteConfirm.path)
      if (result.success) {
        triggerRefresh() // Reload entire tree
      } else {
        console.error('Delete failed:', result.error)
      }
    } catch (error) {
      console.error('Delete failed:', error)
    }

    setDeleteConfirm(null)
  }


  const handleCopyPath = async () => {
    if (contextMenu.node) {
      await navigator.clipboard.writeText(contextMenu.node.path)
    }
    closeContextMenu()
  }

  const handleRefresh = () => {
    triggerRefresh()
    closeContextMenu()
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="w-5 h-5 border-2 border-muted border-t-accent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="py-1">
      {rootNodes.map((node) => (
        <TreeNode
          key={node.path}
          node={node}
          depth={0}
          expandedPaths={expandedPaths}
          selectedPath={selectedPath}
          onToggle={handleToggle}
          onSelect={handleSelect}
          onContextMenu={handleContextMenu}
          loadChildren={loadDirectory}
        />
      ))}

      <ContextMenu
        state={contextMenu}
        onClose={closeContextMenu}
        onNewFile={handleNewFile}
        onNewFolder={handleNewFolder}
        onRename={handleRename}
        onDelete={handleDelete}
        onCopyPath={handleCopyPath}
        onRefresh={handleRefresh}
      />

      {/* Input Dialog for New File/Folder/Rename - VS Code style */}
      {inputDialog.isOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-start justify-center pt-[15%] z-50">
          <div className="bg-surface border border-default rounded shadow-lg w-[400px]">
            <div className="p-4 space-y-3">
              <p className="text-primary text-sm">
                {inputDialog.type === 'rename' ? 'Enter new name' :
                 inputDialog.type === 'newFile' ? 'Enter file name' : 'Enter folder name'}
              </p>
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleInputSubmit()
                  if (e.key === 'Escape') setInputDialog({ ...inputDialog, isOpen: false })
                }}
                placeholder={inputDialog.type === 'rename' ? inputDialog.initialValue :
                            inputDialog.type === 'newFile' ? 'filename.txt' : 'folder-name'}
                className="w-full px-3 py-2 bg-input border border-default rounded text-primary placeholder-muted text-sm focus:outline-none focus:border-accent"
                autoFocus
              />
            </div>
            <div className="px-4 pb-3 flex justify-end gap-2">
              <button
                onClick={() => setInputDialog({ ...inputDialog, isOpen: false })}
                className="px-3 py-1.5 text-sm rounded border border-default hover:bg-hover text-secondary transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleInputSubmit}
                disabled={!inputValue.trim()}
                className="px-3 py-1.5 text-sm rounded bg-accent hover:bg-accent/80 text-white transition-colors disabled:opacity-50"
              >
                {inputDialog.type === 'rename' ? 'Rename' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog - VS Code style */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-start justify-center pt-[15%] z-50">
          <div className="bg-surface border border-default rounded shadow-lg w-[400px]">
            <div className="p-4">
              <p className="text-primary text-sm">
                Delete {deleteConfirm.isDirectory ? 'folder' : 'file'} <span className="font-mono text-secondary">{deleteConfirm.name}</span>?
                {deleteConfirm.isDirectory && <span className="text-muted"> (and all contents)</span>}
              </p>
            </div>
            <div className="px-4 pb-3 flex justify-end gap-2">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-3 py-1.5 text-sm rounded border border-default hover:bg-hover text-secondary transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="px-3 py-1.5 text-sm rounded bg-red-600 hover:bg-red-700 text-white transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
