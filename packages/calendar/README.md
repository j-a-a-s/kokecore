# @kokecore/calendar

Enterprise calendar synchronization with Google Calendar, Microsoft Graph, and Apple Calendar.

## Features

- Google Calendar API integration
- Microsoft Graph integration
- Apple Calendar (CalDAV) integration
- OAuth2 authentication
- Bidirectional sync
- Conflict detection and resolution
- Recurring event expansion
- Timezone support
- Video conferencing (Zoom/Teams/Meet) hooks
- Sync queue system

## Installation

```bash
pnpm add @kokecore/calendar
```

## Usage

```typescript
import { CalendarService, CalendarProvider, CalendarEvent } from '@kokecore/calendar';

const calendar = new CalendarService();

calendar.registerIntegration({
  provider: CalendarProvider.GOOGLE,
  userId,
  organizationId,
  credentials: { accessToken, refreshToken, expiresAt },
  syncEnabled: true,
  syncDirection: 'BIDIRECTIONAL',
});

const result = await calendar.syncEvent(event);
```
