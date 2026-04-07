# SMTP Configuration Guide

Configure email sending for invitations, password resets, notifications, and alerts.

OpenCTEM supports two levels of SMTP configuration:

1. **System SMTP** — Global default for all tenants (environment variables)
2. **Per-Tenant SMTP** — Each tenant can override with their own SMTP server (via UI)

## System SMTP (Global Default)

Set these environment variables in your deployment:

```env
SMTP_ENABLED=true
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=noreply@yourcompany.com
SMTP_PASSWORD=your-app-password
SMTP_FROM=noreply@yourcompany.com
SMTP_FROM_NAME=OpenCTEM
SMTP_TLS=true
SMTP_BASE_URL=https://app.yourcompany.com
```

### Environment Variable Reference

| Variable | Required | Default | Description |
|---|---|---|---|
| `SMTP_ENABLED` | Yes | `false` | Enable email sending |
| `SMTP_HOST` | Yes | — | SMTP server hostname |
| `SMTP_PORT` | No | `587` | SMTP port (587 for STARTTLS, 465 for TLS, 25 for plain) |
| `SMTP_USER` | No | — | SMTP username (often same as from email) |
| `SMTP_PASSWORD` | No | — | SMTP password or app-specific password |
| `SMTP_FROM` | Yes | — | Sender email address |
| `SMTP_FROM_NAME` | No | `OpenCTEM` | Sender display name |
| `SMTP_TLS` | No | `true` | Use TLS/STARTTLS |
| `SMTP_SKIP_VERIFY` | No | `false` | Skip TLS certificate verification (dev only) |
| `SMTP_BASE_URL` | No | — | Frontend URL for email links (e.g., `https://app.yourcompany.com`) |

### Docker Compose Example

```yaml
# docker-compose.yml
services:
  api:
    environment:
      SMTP_ENABLED: "true"
      SMTP_HOST: smtp.gmail.com
      SMTP_PORT: "587"
      SMTP_USER: noreply@yourcompany.com
      SMTP_PASSWORD: ${SMTP_PASSWORD}
      SMTP_FROM: noreply@yourcompany.com
      SMTP_FROM_NAME: OpenCTEM
      SMTP_TLS: "true"
      SMTP_BASE_URL: https://app.yourcompany.com
```

### Kubernetes Example

```bash
kubectl create secret generic openctem-api-secrets \
  --namespace openctem \
  --from-literal=SMTP_ENABLED=true \
  --from-literal=SMTP_HOST=smtp.gmail.com \
  --from-literal=SMTP_PORT=587 \
  --from-literal=SMTP_USER=noreply@yourcompany.com \
  --from-literal=SMTP_PASSWORD=your-app-password \
  --from-literal=SMTP_FROM=noreply@yourcompany.com \
  --from-literal=SMTP_FROM_NAME=OpenCTEM \
  --from-literal=SMTP_BASE_URL=https://app.yourcompany.com
```

## Per-Tenant SMTP (Override via UI)

Each tenant can configure their own SMTP server. When configured, the tenant's emails (invitations, notifications) will be sent from their SMTP server instead of the system default.

### Step 1: Navigate to Settings

1. Login as tenant **Owner** or **Admin**
2. Click **Settings** in the sidebar
3. Click **Integrations**

### Step 2: Add Email Integration

1. Select the **Notifications** tab
2. Click **Add Integration**
3. Choose **Email** as the provider
4. Fill in the SMTP details:

| Field | Example | Description |
|---|---|---|
| **Name** | Company Email | Display name for this configuration |
| **SMTP Host** | smtp.gmail.com | Your SMTP server |
| **SMTP Port** | 587 | Usually 587 (STARTTLS) or 465 (TLS) |
| **SMTP User** | noreply@company.com | Authentication username |
| **SMTP Password** | app-password | Authentication password |
| **From Email** | noreply@company.com | Sender address shown to recipients |
| **From Name** | Security Team | Sender name shown to recipients |
| **TLS** | Enabled | Use encrypted connection |

5. Click **Save**
6. Click **Test Connection** to verify

### Step 3: Verify

Send a test invitation to confirm emails arrive from your SMTP server:

1. Go to **Settings** → **Users**
2. Click **Invite User**
3. Enter a test email address
4. Check inbox — email should come from your configured "From Email"

## SMTP Resolution Order

When sending an email, OpenCTEM checks in this order:

```
1. Does tenant have an active Email integration?
   └─ YES → Use tenant SMTP config
   └─ NO  → Continue...

2. Is system SMTP configured (SMTP_ENABLED=true)?
   └─ YES → Use system SMTP
   └─ NO  → Continue...

3. No SMTP available
   └─ Email skipped (logged as warning)
   └─ Invitation still created (user can accept via direct link)
```

## Emails Sent by OpenCTEM

| Email Type | When Sent | Required SMTP |
|---|---|---|
| **Invitation** | Admin invites user to team | Yes (or direct link) |
| **Email Verification** | User registers (if enabled) | Yes |
| **Password Reset** | User requests password reset | Yes |
| **Welcome** | User first login | Optional |
| **Notifications** | Finding alerts, scan results | Optional |
| **SLA Breach** | SLA deadline approaching/missed | Optional |

## Provider-Specific Setup

### Gmail

1. Enable 2-Factor Authentication on your Google account
2. Go to [App Passwords](https://myaccount.google.com/apppasswords)
3. Generate an app-specific password
4. Use these settings:

```
Host: smtp.gmail.com
Port: 587
User: your-email@gmail.com
Password: <app-password>
TLS: true
```

### Microsoft 365 / Outlook

```
Host: smtp.office365.com
Port: 587
User: your-email@company.com
Password: <password>
TLS: true
```

Note: May need to enable SMTP AUTH in Microsoft 365 admin center.

### Amazon SES

```
Host: email-smtp.us-east-1.amazonaws.com
Port: 587
User: <SMTP-username-from-SES>
Password: <SMTP-password-from-SES>
TLS: true
From: verified-sender@yourdomain.com
```

Note: Sender email must be verified in SES.

### Custom SMTP (Postfix, Sendgrid, Mailgun, etc.)

```
Host: <your-smtp-server>
Port: 587
User: <username>
Password: <password>
TLS: true
From: noreply@yourdomain.com
```

## Security

- **Passwords encrypted**: Per-tenant SMTP passwords are encrypted with AES-256-GCM at rest
- **Not in responses**: SMTP passwords are never returned in API responses
- **TLS recommended**: Always enable TLS in production
- **App passwords**: Use app-specific passwords instead of account passwords
- **Minimal permissions**: SMTP user should only have send permission

## Troubleshooting

### Emails not sending

1. Check API logs for SMTP errors:
   ```bash
   # Docker Compose
   docker compose logs api | grep -i "smtp\|email\|send"
   
   # Kubernetes
   kubectl logs deploy/openctem-api -n openctem | grep -i "smtp\|email"
   ```

2. Verify SMTP config:
   ```bash
   # Test SMTP connectivity
   openssl s_client -connect smtp.gmail.com:587 -starttls smtp
   ```

### "Email service not configured"

- Check `SMTP_ENABLED=true` is set
- Check `SMTP_HOST` and `SMTP_FROM` are not empty
- Restart API after changing environment variables

### "Authentication failed"

- Verify username and password
- For Gmail: use App Password, not account password
- For Microsoft 365: enable SMTP AUTH in admin center
- Check if 2FA requires app-specific password

### "Connection refused" or timeout

- Verify SMTP host and port
- Check firewall allows outbound port 587/465
- Try `SMTP_SKIP_VERIFY=true` temporarily to rule out TLS issues
- Check if your cloud provider blocks outbound SMTP (AWS blocks port 25)

### Per-tenant email not working

- Verify integration is **Active** (not disabled)
- Check integration has all required fields (host, port, from)
- Click **Test Connection** in integration settings
- Check API logs for decryption errors (may indicate `APP_ENCRYPTION_KEY` changed)

### Invitation works but no email

- Invitation is created successfully even without SMTP
- User can still accept via direct link
- Check if `SMTP_BASE_URL` is set (needed for invitation link generation)
