import {
  CalendarProvider,
  EventStatus,
  CalendarEvent,
  RecurrenceRule,
  CalendarService,
  ConflictDetectionService,
  RecurringEventService,
  EventMapper,
  CalendarOAuthService,
  SyncQueueService,
  VideoConferencingService,
  GoogleCalendarService,
  MicrosoftGraphService,
} from './index';

function createEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: 'event-1',
    provider: CalendarProvider.GOOGLE,
    title: 'Test Event',
    startTime: new Date('2024-01-15T10:00:00Z'),
    endTime: new Date('2024-01-15T11:00:00Z'),
    allDay: false,
    status: EventStatus.CONFIRMED,
    ...overrides,
  };
}

describe('CalendarService', () => {
  const service = new CalendarService();

  it('initializes all sub-services', () => {
    expect(service.getSyncService()).toBeDefined();
    expect(service.getConflictService()).toBeDefined();
    expect(service.getRecurringService()).toBeDefined();
    expect(service.getVideoService()).toBeDefined();
    expect(service.getQueueService()).toBeDefined();
  });

  it('detects conflicts between events', () => {
    const events = [
      createEvent({
        id: 'a',
        startTime: new Date('2024-01-15T10:00:00Z'),
        endTime: new Date('2024-01-15T11:00:00Z'),
      }),
      createEvent({
        id: 'b',
        startTime: new Date('2024-01-15T10:30:00Z'),
        endTime: new Date('2024-01-15T11:30:00Z'),
      }),
    ];
    const conflicts = service.detectConflicts(events);
    expect(conflicts.length).toBeGreaterThan(0);
    expect(conflicts[0].type).toBe('TIME_OVERLAP');
  });

  it('expands recurring events', () => {
    const event = createEvent({
      recurrence: { frequency: 'DAILY', interval: 1, count: 3 },
    });
    const instances = service.expandRecurringEvents(
      event,
      new Date('2024-01-14T00:00:00Z'),
      new Date('2024-01-20T00:00:00Z')
    );
    expect(instances).toHaveLength(3);
    expect(instances[1].startTime.getDate()).toBe(16);
  });

  it('returns OAuth authorization URLs', () => {
    expect(service.getAuthorizationUrl(CalendarProvider.GOOGLE, 'https://app/callback')).toContain(
      'google'
    );
    expect(
      service.getAuthorizationUrl(CalendarProvider.MICROSOFT, 'https://app/callback')
    ).toContain('microsoft');
  });

  it('creates video conferences', async () => {
    const conference = await service.createVideoConference(createEvent(), 'ZOOM');
    expect(conference.provider).toBe('ZOOM');
    expect(conference.meetingUrl).toBeDefined();
  });

  it('adds and processes sync jobs', async () => {
    const id = await service.addSyncJob({
      integrationId: 'int-1',
      type: 'SYNC',
      priority: 'NORMAL',
      scheduledAt: new Date(),
      maxAttempts: 3,
    });
    expect(typeof id).toBe('string');
    await service.processSyncQueue();
    expect(service.getQueueService().getQueueStatus().pending).toBe(0);
  });
});

describe('ConflictDetectionService', () => {
  const service = new ConflictDetectionService();

  it('detects overlapping events', () => {
    const events = [
      createEvent({
        id: 'a',
        startTime: new Date('2024-01-15T10:00:00Z'),
        endTime: new Date('2024-01-15T11:00:00Z'),
      }),
      createEvent({
        id: 'b',
        startTime: new Date('2024-01-15T10:30:00Z'),
        endTime: new Date('2024-01-15T11:30:00Z'),
      }),
      createEvent({
        id: 'c',
        startTime: new Date('2024-01-15T12:00:00Z'),
        endTime: new Date('2024-01-15T13:00:00Z'),
      }),
    ];
    const conflicts = service.detectTimeOverlap(events);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].type).toBe('TIME_OVERLAP');
  });

  it('detects duplicate events', () => {
    const events = [createEvent({ id: 'a' }), createEvent({ id: 'b' })];
    const conflicts = service.detectDuplicates(events);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].type).toBe('DUPLICATE');
  });

  it('detects version mismatches', () => {
    const local = createEvent({ id: 'a', title: 'Local' });
    const remote = createEvent({ id: 'a', title: 'Remote' });
    const conflict = service.detectVersionMismatch(local, remote);
    expect(conflict).not.toBeNull();
    expect(conflict?.type).toBe('VERSION_MISMATCH');
  });
});

describe('RecurringEventService', () => {
  const service = new RecurringEventService();

  it('returns the original event when no recurrence', () => {
    const event = createEvent();
    const instances = service.expandRecurringEvent(
      event,
      new Date('2024-01-01T00:00:00Z'),
      new Date('2024-01-31T00:00:00Z')
    );
    expect(instances).toHaveLength(1);
    expect(instances[0].id).toBe('event-1');
  });

  it('generates weekly recurring instances', () => {
    const event = createEvent({
      recurrence: { frequency: 'WEEKLY', interval: 1, count: 2 },
    });
    const instances = service.expandRecurringEvent(
      event,
      new Date('2024-01-01T00:00:00Z'),
      new Date('2024-02-28T00:00:00Z')
    );
    expect(instances).toHaveLength(2);
    const diffMs = instances[1].startTime.getTime() - instances[0].startTime.getTime();
    expect(diffMs).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it('generates a recurrence string', () => {
    const rule: RecurrenceRule = { frequency: 'DAILY', interval: 2 };
    expect(service.generateRecurrenceString(rule)).toBe('FREQ=DAILY;INTERVAL=2');
  });
});

describe('EventMapper', () => {
  const mapper = new EventMapper();

  it('maps to Google Calendar format', () => {
    const event = createEvent({ timezone: 'America/Santiago' });
    const google = mapper.toGoogleFormat(event);
    expect(google.summary).toBe('Test Event');
    expect(google.start.dateTime).toBe(event.startTime.toISOString());
    expect(google.start.timeZone).toBe('America/Santiago');
  });

  it('maps from Google Calendar format', () => {
    const google = {
      id: 'g-1',
      summary: 'Google Event',
      description: 'Desc',
      location: 'Office',
      start: { dateTime: '2024-01-15T10:00:00Z', timeZone: 'UTC' },
      end: { dateTime: '2024-01-15T11:00:00Z', timeZone: 'UTC' },
    };
    const event = mapper.fromGoogleFormat(google);
    expect(event.provider).toBe(CalendarProvider.GOOGLE);
    expect(event.title).toBe('Google Event');
    expect(event.allDay).toBe(false);
  });

  it('maps to Microsoft Graph format', () => {
    const event = createEvent();
    const ms = mapper.toMicrosoftFormat(event);
    expect(ms.subject).toBe('Test Event');
    expect(ms.start.dateTime).toBe(event.startTime.toISOString());
  });

  it('maps from Microsoft Graph format', () => {
    const ms = {
      id: 'm-1',
      subject: 'Teams Event',
      body: { content: 'Description' },
      location: { displayName: 'Office' },
      start: { dateTime: '2024-01-15T10:00:00Z', timeZone: 'UTC' },
      end: { dateTime: '2024-01-15T11:00:00Z', timeZone: 'UTC' },
    };
    const event = mapper.fromMicrosoftFormat(ms);
    expect(event.provider).toBe(CalendarProvider.MICROSOFT);
    expect(event.title).toBe('Teams Event');
  });
});

describe('CalendarOAuthService', () => {
  const service = new CalendarOAuthService();

  it('returns provider-specific authorization URLs', () => {
    expect(service.getAuthorizationUrl(CalendarProvider.GOOGLE, 'https://app/cb')).toContain(
      'google'
    );
    expect(service.getAuthorizationUrl(CalendarProvider.MICROSOFT, 'https://app/cb')).toContain(
      'microsoft'
    );
    expect(service.getAuthorizationUrl(CalendarProvider.APPLE, 'https://app/cb')).toContain(
      'appleid'
    );
  });

  it('exchanges code for tokens', async () => {
    const tokens = await service.exchangeCodeForTokens(
      CalendarProvider.GOOGLE,
      'code',
      'https://app/cb'
    );
    expect(tokens.accessToken).toBeDefined();
    expect(tokens.expiresAt).toBeInstanceOf(Date);
  });
});

describe('SyncQueueService', () => {
  const service = new SyncQueueService();

  it('adds jobs and reports status', async () => {
    const id = await service.addJob({
      integrationId: 'int-1',
      type: 'SYNC',
      priority: 'HIGH',
      scheduledAt: new Date(),
      maxAttempts: 3,
    });
    expect(typeof id).toBe('string');
    expect(service.getQueueStatus().pending).toBe(1);
  });

  it('processes jobs', async () => {
    await service.addJob({
      integrationId: 'int-1',
      type: 'CREATE',
      priority: 'NORMAL',
      scheduledAt: new Date(),
      maxAttempts: 3,
    });
    await service.processQueue();
    expect(service.getQueueStatus().pending).toBe(0);
    expect(service.getQueueStatus().failed).toBe(0);
  });
});

describe('VideoConferencingService', () => {
  const service = new VideoConferencingService();

  it('creates meetings for each provider', async () => {
    const event = createEvent();
    const zoom = await service.createMeeting(event, 'ZOOM');
    expect(zoom.provider).toBe('ZOOM');
    expect(zoom.meetingUrl).toContain('zoom');

    const teams = await service.createMeeting(event, 'TEAMS');
    expect(teams.provider).toBe('TEAMS');

    const meet = await service.createMeeting(event, 'MEET');
    expect(meet.provider).toBe('MEET');
  });
});

describe('Provider services', () => {
  it('GoogleCalendarService sync returns external id', async () => {
    const service = new GoogleCalendarService({
      provider: CalendarProvider.GOOGLE,
      userId: 'u1',
      organizationId: 'o1',
      credentials: { accessToken: 'tok' },
      syncEnabled: true,
      syncDirection: 'BIDIRECTIONAL',
    });
    const id = await service.syncEvent(createEvent());
    expect(id).toMatch(/^google_/);
  });

  it('MicrosoftGraphService sync returns external id', async () => {
    const service = new MicrosoftGraphService({
      provider: CalendarProvider.MICROSOFT,
      userId: 'u1',
      organizationId: 'o1',
      credentials: { accessToken: 'tok' },
      syncEnabled: true,
      syncDirection: 'BIDIRECTIONAL',
    });
    const id = await service.syncEvent(createEvent());
    expect(id).toMatch(/^microsoft_/);
  });
});
