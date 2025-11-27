import { existsSync, readFileSync, writeFileSync, renameSync } from 'fs'
import { join, resolve } from 'path'
import { homedir } from 'os'
import { app } from 'electron'

/**
 * Get potential old store locations to migrate from
 */
function getOldStorePaths(): string[] {
  const paths: string[] = []

  // Check ~/.chorus/config.json (previous migration target)
  paths.push(join(homedir(), '.chorus', 'config.json'))

  const isDev = !app.isPackaged
  if (isDev) {
    // In dev, old store was in project root (chorus-data.json)
    paths.push(join(__dirname, '..', '..', '..', 'chorus-data.json'))
  }

  // Old electron-store default location
  paths.push(join(app.getPath('userData'), 'chorus-data.json'))

  return paths
}

/**
 * Get the new store location (cc-slack/.chorus/config.json)
 */
function getNewStorePath(): string {
  // In development, __dirname is chorus/out/main
  // We want cc-slack/.chorus/config.json
  return resolve(__dirname, '../../../.chorus/config.json')
}

/**
 * Migrate data from old locations to new project-local .chorus/ location if needed
 */
export function migrateIfNeeded(): void {
  const newPath = getNewStorePath()

  // Skip if new location already has data
  if (existsSync(newPath)) {
    console.log('[Migration] New config already exists at:', newPath)
    return
  }

  // Try each potential old location
  const oldPaths = getOldStorePaths()
  for (const oldPath of oldPaths) {
    if (!existsSync(oldPath)) {
      continue
    }

    try {
      console.log('[Migration] Migrating data from:', oldPath)
      console.log('[Migration] Migrating data to:', newPath)

      // Read old data
      const oldData = readFileSync(oldPath, 'utf-8')
      const parsed = JSON.parse(oldData)

      // Add new settings fields if they don't exist
      if (parsed.settings) {
        parsed.settings.chatSidebarCollapsed = parsed.settings.chatSidebarCollapsed ?? false
        parsed.settings.chatSidebarWidth = parsed.settings.chatSidebarWidth ?? 240
      }

      // Write to new location
      writeFileSync(newPath, JSON.stringify(parsed, null, 2), 'utf-8')
      console.log('[Migration] Data written to new location')

      // Rename old file to backup
      const backupPath = oldPath + '.backup'
      renameSync(oldPath, backupPath)
      console.log('[Migration] Old file renamed to:', backupPath)

      console.log('[Migration] Migration completed successfully')
      return // Stop after first successful migration
    } catch (error) {
      console.error('[Migration] Migration failed from', oldPath, ':', error)
      // Continue to try next location
    }
  }

  console.log('[Migration] No old data to migrate')
}
