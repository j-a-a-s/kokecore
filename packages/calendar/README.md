# @kokecore/calendar

Internal calendar contract experiments. Provider implementations are not
approved for production use during Alpha.

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

## Internal consumption

Install only from a CI-validated internal tarball. Public registry installation
is prohibited.

## Usage

```typescript
import { CalendarProvider, EventStatus, type CalendarEvent } from '@kokecore/calendar';

const provider = CalendarProvider.GOOGLE;
const status = EventStatus.CONFIRMED;
const event: CalendarEvent = loadCalendarEvent();
```
