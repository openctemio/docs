---
layout: default
title: Account Settings
parent: UI Features
grand_parent: UI Documentation
nav_order: 3
---

# Account Settings

User account management feature for profile, security, preferences, and activity tracking.

## Overview

The Account Settings feature provides users with a centralized location to manage their personal account information. It is accessible via the profile dropdown in the navigation header.

### Features

| Tab | Description |
|-----|-------------|
| **Profile** | Avatar, name, email, phone, bio |
| **Security** | Password management, 2FA, active sessions |
| **Preferences** | Theme, language, timezone, notifications |
| **Activity** | Login history, security events log |

## Navigation

Access account settings via:
1. Click profile avatar in top-right header
2. Select "Profile", "Security", or "Preferences" from dropdown

Routes:
- `/account` - Profile (default)
- `/account/security` - Security settings
- `/account/preferences` - User preferences
- `/account/activity` - Activity log

## Architecture

### File Structure

```
ui/src/features/account/
├── api/
│   ├── use-profile.ts        # Profile CRUD hooks
│   ├── use-security.ts       # Password, 2FA hooks
│   ├── use-sessions.ts       # Session management
│   ├── use-preferences.ts    # User preferences
│   └── index.ts
├── types/
│   └── account.types.ts      # Type definitions
└── index.ts

ui/src/app/(dashboard)/account/
├── layout.tsx                # Tab navigation layout
├── page.tsx                  # Profile page
├── security/page.tsx         # Security page
├── preferences/page.tsx      # Preferences page
└── activity/page.tsx         # Activity log page
```

### Type Definitions

#### User Profile

```typescript
interface UserProfile {
  id: string
  email: string
  name: string
  avatar_url?: string
  phone?: string
  bio?: string
  created_at: string
  updated_at: string
  email_verified: boolean
  auth_provider: 'local' | 'google' | 'github' | 'microsoft' | 'saml' | 'oidc'
}
```

#### Session

```typescript
interface Session {
  id: string
  device: string
  browser: string
  os: string
  ip_address: string
  location?: string
  created_at: string
  last_active_at: string
  is_current: boolean
}
```

#### User Preferences

```typescript
interface UserPreferences {
  theme: 'light' | 'dark' | 'system'
  language: string
  timezone: string
  date_format: string
  time_format: '12h' | '24h'
  email_notifications: EmailNotificationPreferences
  desktop_notifications: boolean
}

interface EmailNotificationPreferences {
  security_alerts: boolean
  weekly_digest: boolean
  scan_completed: boolean
  new_findings: boolean
  team_updates: boolean
}
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/users/me` | GET | Get current user profile |
| `/api/v1/users/me` | PUT | Update profile |
| `/api/v1/users/me/avatar` | PUT | Upload avatar |
| `/api/v1/users/me/avatar` | DELETE | Remove avatar |
| `/api/v1/users/me/change-password` | POST | Change password |
| `/api/v1/users/me/2fa` | GET | Get 2FA status |
| `/api/v1/users/me/2fa/setup` | POST | Start 2FA setup |
| `/api/v1/users/me/2fa/verify` | POST | Verify and enable 2FA |
| `/api/v1/users/me/2fa` | DELETE | Disable 2FA |
| `/api/v1/users/me/sessions` | GET | List active sessions |
| `/api/v1/users/me/sessions/{id}` | DELETE | Revoke session |
| `/api/v1/users/me/sessions` | DELETE | Revoke all other sessions |
| `/api/v1/users/me/preferences` | GET | Get preferences |
| `/api/v1/users/me/preferences` | PUT | Update preferences |

## React Hooks

### Profile

```typescript
import { useProfile, useUpdateProfile, useUpdateAvatar } from '@/features/account'

// Fetch profile
const { profile, isLoading, mutate } = useProfile()

// Update profile
const { updateProfile, isUpdating } = useUpdateProfile()
await updateProfile({ name: 'New Name' })

// Avatar management
const { updateAvatar, removeAvatar } = useUpdateAvatar()
await updateAvatar('data:image/jpeg;base64,...')
```

### Security

```typescript
import { useChangePassword, useTwoFactorStatus, useSessions } from '@/features/account'

// Change password (local auth only)
const { changePassword, isChanging } = useChangePassword()
await changePassword({
  current_password: 'old',
  new_password: 'new',
  confirm_password: 'new'
})

// 2FA status
const { status } = useTwoFactorStatus()

// Active sessions
const { sessions, mutate } = useSessions()
```

### Sessions

```typescript
import { useRevokeSession, useRevokeAllSessions } from '@/features/account'

// Revoke specific session
const { revokeSession } = useRevokeSession()
await revokeSession('session-id')

// Revoke all except current
const { revokeAllSessions } = useRevokeAllSessions()
await revokeAllSessions()
```

### Preferences

```typescript
import { usePreferences, useUpdatePreferences } from '@/features/account'

// Get preferences
const { preferences, isLoading } = usePreferences()

// Update preferences
const { updatePreferences, isUpdating } = useUpdatePreferences()
await updatePreferences({
  theme: 'dark',
  language: 'vi',
  timezone: 'Asia/Ho_Chi_Minh'
})
```

## Page Features

### Profile Page

- **Avatar**: Upload, preview, and remove
- **Personal Info**: Name, phone, bio (editable)
- **Email**: Display with verification status (read-only for SSO)
- **Account Info**: ID, auth provider, creation date

### Security Page

- **Password**: Change password form (hidden for SSO users)
- **Two-Factor Auth**: Status indicator, setup/disable buttons
- **Sessions**: List with current session highlighted, revoke buttons

### Preferences Page

- **Theme**: Light/Dark/System with immediate preview
- **Localization**: Language, timezone, date/time format
- **Notifications**:
  - Desktop push notifications toggle
  - Email preferences per category (security, digest, scans, findings, team)
- **Reset**: Restore default preferences

### Activity Page

- **Event Log**: Paginated list with filters
- **Event Types**: Login, logout, password change, 2FA, session revoke
- **Details**: IP address, location, timestamp, device info

## Constants

```typescript
import {
  SUPPORTED_LANGUAGES,
  SUPPORTED_TIMEZONES,
  DATE_FORMATS,
  ACTIVITY_EVENT_LABELS
} from '@/features/account'
```

### Supported Languages

| Code | Label |
|------|-------|
| en | English |
| vi | Tiếng Việt |
| ja | 日本語 |
| ko | 한국어 |
| zh | 中文 |

### Supported Timezones

- UTC
- Asia/Ho_Chi_Minh (UTC+7)
- Asia/Tokyo (UTC+9)
- Asia/Singapore (UTC+8)
- America/New_York (UTC-5)
- Europe/London (UTC+0)
- ... and more

## SSO Integration

For users authenticated via SSO providers (Google, GitHub, Microsoft, SAML, OIDC):

1. **Email**: Read-only, managed by identity provider
2. **Password**: Hidden, shows message to manage via provider
3. **2FA**: May be managed by identity provider

Check auth provider:
```typescript
const { profile } = useProfile()
const isLocalAuth = profile?.auth_provider === 'local'
```

## Best Practices

### Avatar Upload

```typescript
// Resize image before upload (max 200x200)
const handleUpload = (file: File) => {
  const img = new Image()
  const canvas = document.createElement('canvas')
  // ... resize logic
  const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
  await updateAvatar(dataUrl)
}
```

### Theme Sync

```typescript
import { useTheme } from 'next-themes'

// Sync with next-themes for immediate effect
const handleThemeChange = (theme: string) => {
  setFormData({ ...formData, theme })
  setTheme(theme) // Apply immediately
  await updatePreferences({ theme })
}
```

### Error Handling

```typescript
try {
  await changePassword(form)
  toast.success('Password changed')
} catch (err) {
  const message = err instanceof Error ? err.message : 'Failed'
  toast.error(message)
}
```

## Related Documentation

- [Authentication](./auth/README.md) - Auth flows and providers
- [Access Control](./ACCESS_CONTROL.md) - Permissions system
- [API Integration Guide](../guides/API_INTEGRATION.md) - API client usage

---

*Last Updated: 2026-01-24*
