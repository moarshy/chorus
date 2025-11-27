# Module 8: Building & Packaging

Distributing your Electron app for production.

---

## What We Learned

- **Build pipeline** - TypeScript compile + Vite bundle + electron-builder package
- **Platform targets** - macOS (.dmg), Windows (.exe), Linux (.AppImage, .deb)
- **Configuration** - electron-builder.yml for packaging settings
- **Code signing** - Basics of signing apps (required for distribution)
- **Auto-updates** - Built-in support via blockmap files

---

## Build Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            BUILD PIPELINE                                    │
│                                                                              │
│  Source Code          TypeScript         Vite Bundle        Electron-Builder │
│  ============         ==========         ==========         ================ │
│                                                                              │
│  src/main/*.ts   ──►  tsc compile   ──►  out/main/         ──►  .dmg        │
│  src/preload/*.ts──►  (type check)  ──►  out/preload/      ──►  .exe        │
│  src/renderer/*  ──►                ──►  out/renderer/     ──►  .AppImage   │
│                                                                              │
│  bun run build      bun run build:mac    bun run build:win                  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Build Commands

| Command | Output | Description |
|---------|--------|-------------|
| `bun run build` | `out/` | Compile TypeScript + bundle with Vite |
| `bun run build:mac` | `dist/*.dmg` | Package for macOS |
| `bun run build:win` | `dist/*.exe` | Package for Windows |
| `bun run build:linux` | `dist/*.AppImage` | Package for Linux |
| `bun run build:unpack` | `dist/mac-arm64/` | Unpacked app (debugging) |

---

## Output Files

After running `bun run build:mac`:

```
dist/
├── chorus-1.0.0.dmg              # macOS installer (drag to Applications)
├── chorus-1.0.0.dmg.blockmap     # Delta update optimization
├── chorus-1.0.0-arm64-mac.zip    # Direct app bundle
├── chorus-1.0.0-arm64-mac.zip.blockmap
├── latest-mac.yml                # Auto-update metadata
├── builder-debug.yml             # Build debug info
└── mac-arm64/                    # Unpacked .app bundle
    └── chorus.app/
```

---

## Configuration

### electron-builder.yml

```yaml
# App identification
appId: com.electron.app
productName: chorus

# Build resources
directories:
  buildResources: build

# Files to exclude from bundle
files:
  - '!**/.vscode/*'
  - '!src/*'
  - '!{.eslintcache,eslint.config.mjs}'
  - '!{tsconfig.json,tsconfig.node.json}'

# Native modules that can't be packed
asarUnpack:
  - resources/**

# Platform-specific settings
mac:
  entitlementsInherit: build/entitlements.mac.plist
  notarize: false  # Set to true for distribution
  extendInfo:
    - NSDocumentsFolderUsageDescription: Access to Documents folder.

win:
  executableName: chorus

linux:
  target:
    - AppImage
    - deb
    - snap
  category: Utility

# Installer settings
dmg:
  artifactName: ${name}-${version}.${ext}

nsis:  # Windows installer
  artifactName: ${name}-${version}-setup.${ext}
  shortcutName: ${productName}
  createDesktopShortcut: always

# Auto-updates
publish:
  provider: generic
  url: https://example.com/auto-updates
```

---

## Code Signing

### Why Sign Your App?

| Without Signing | With Signing |
|-----------------|--------------|
| macOS shows "unidentified developer" warning | Opens normally |
| Windows shows SmartScreen warning | Trusted by Windows |
| Cannot distribute via App Store | App Store ready |
| Users must manually bypass security | Professional experience |

### macOS Signing

```bash
# Check for signing identity
security find-identity -v -p codesigning

# Build with signing (requires Apple Developer account)
CSC_LINK=/path/to/cert.p12 CSC_KEY_PASSWORD=xxx bun run build:mac
```

### Notarization (macOS 10.15+)

For distribution outside the App Store:

```yaml
# electron-builder.yml
mac:
  notarize:
    teamId: YOUR_TEAM_ID
```

```bash
# Set credentials
export APPLE_ID=your@apple.id
export APPLE_APP_SPECIFIC_PASSWORD=xxxx-xxxx-xxxx-xxxx
export APPLE_TEAM_ID=YOUR_TEAM_ID
```

---

## Auto-Updates

### How It Works

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            AUTO-UPDATE FLOW                                  │
│                                                                              │
│  App Startup                                                                │
│      │                                                                      │
│      ▼                                                                      │
│  Check latest-mac.yml on server                                             │
│      │                                                                      │
│      ▼                                                                      │
│  Compare version with current                                               │
│      │                                                                      │
│      ▼ (if newer)                                                           │
│  Download .zip using blockmap (delta update)                                │
│      │                                                                      │
│      ▼                                                                      │
│  Verify signature                                                           │
│      │                                                                      │
│      ▼                                                                      │
│  Install on next restart                                                    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### latest-mac.yml Example

```yaml
version: 1.0.0
files:
  - url: chorus-1.0.0-arm64-mac.zip
    sha512: abc123...
    size: 145678901
path: chorus-1.0.0-arm64-mac.zip
sha512: abc123...
releaseDate: '2024-01-01T00:00:00.000Z'
```

### Implementing Auto-Update

```typescript
// src/main/index.ts
import { autoUpdater } from 'electron-updater'

app.whenReady().then(() => {
  // Check for updates on startup
  autoUpdater.checkForUpdatesAndNotify()

  // Check periodically (every 4 hours)
  setInterval(() => {
    autoUpdater.checkForUpdatesAndNotify()
  }, 4 * 60 * 60 * 1000)
})

// Handle update events
autoUpdater.on('update-available', () => {
  // Notify user
})

autoUpdater.on('update-downloaded', () => {
  // Ask user to restart
  autoUpdater.quitAndInstall()
})
```

---

## Build Size Optimization

### Current Size: ~144 MB DMG

Why so large?
- Electron includes Chromium (~100 MB)
- Node.js runtime (~30 MB)
- Your app code (~10 MB)

### Optimization Tips

1. **Exclude dev dependencies** (automatic)
2. **Use native modules carefully** - they add size
3. **Compress resources** - images, fonts
4. **Consider @electron/asar** for source encryption

---

## Platform-Specific Notes

### macOS

```yaml
mac:
  # Architectures
  target:
    - target: default
      arch:
        - x64      # Intel Macs
        - arm64    # Apple Silicon
        - universal  # Both (larger file)

  # Required permissions
  entitlementsInherit: build/entitlements.mac.plist
```

### Windows

```yaml
win:
  # Code signing
  certificateFile: path/to/cert.pfx
  certificatePassword: xxx

  # Targets
  target:
    - nsis      # Standard installer
    - portable  # No install needed
```

### Linux

```yaml
linux:
  target:
    - AppImage  # Universal, no install
    - deb       # Debian/Ubuntu
    - rpm       # Fedora/RHEL
    - snap      # Snap Store
```

---

## Testing the Build

```bash
# 1. Build unpacked version (faster iteration)
bun run build:unpack

# 2. Run directly
open dist/mac-arm64/chorus.app

# 3. Or build full DMG
bun run build:mac

# 4. Install from DMG
open dist/chorus-1.0.0.dmg
# Drag to Applications
```

---

## Common Issues

### "App is damaged" (macOS)

```bash
# Remove quarantine attribute
xattr -cr /Applications/chorus.app
```

### Build fails with native module errors

```bash
# Rebuild native modules
npm rebuild
# or
electron-builder install-app-deps
```

### Large bundle size

```bash
# Analyze bundle
npx electron-builder --mac --dir
ls -la dist/mac-arm64/chorus.app/Contents/Resources/app.asar
```

---

## Distribution Checklist

- [ ] Update version in `package.json`
- [ ] Build for all target platforms
- [ ] Sign the app (macOS/Windows)
- [ ] Notarize (macOS)
- [ ] Test installation on clean machine
- [ ] Upload to distribution server
- [ ] Update `latest-*.yml` for auto-updates
- [ ] Create GitHub release (optional)

---

## For Chorus

You can now:
- Build a distributable macOS app
- Share `dist/chorus-1.0.0.dmg` with users
- Users can drag-and-drop to install
- Set up auto-updates for future releases

To test: Open `dist/chorus-1.0.0.dmg` and drag Chorus to Applications!
