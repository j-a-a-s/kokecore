import {
  CalendarProvider,
  EventStatus,
  CalendarEvent,
  RecurrenceRule,
  CalendarService,
  CalendarSyncService,
  ConflictDetectionService,
  RecurringEventService,
  EventMapper,
  CalendarOAuthService,
  SyncQueueService,
  VideoConferencingService,
  GoogleCalendarService,
  MicrosoftGraphService,
  AppleCalendarService,
  calendarEventSchema,
  type CalendarIntegrationConfig,
} from './index';
import * as publicApi from './public';

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

  it('registers integrations, syncs events, and exchanges OAuth codes', async () => {
    service.registerIntegration({
      provider: CalendarProvider.GOOGLE,
      userId: 'user-calendar-service',
      organizationId: 'org-1',
      credentials: { accessToken: 'test-only-token' },
      syncEnabled: true,
      syncDirection: 'BIDIRECTIONAL',
    });
    expect((await service.syncEvent(createEvent())).eventsCreated).toBeGreaterThan(0);
    expect(
      await service.exchangeCodeForTokens(
        CalendarProvider.GOOGLE,
        'code',
        'https://app.example.com/callback'
      )
    ).toMatchObject({ accessToken: 'access_token_placeholder' });
    expect(service.getMapper()).toBeInstanceOf(EventMapper);
  });
});

describe('CalendarSyncService', () => {
  function integration(
    provider: CalendarProvider,
    overrides: Partial<CalendarIntegrationConfig> = {}
  ): CalendarIntegrationConfig {
    return {
      provider,
      userId: `user-${provider}`,
      organizationId: 'org-1',
      credentials: { accessToken: 'test-only-token' },
      syncEnabled: true,
      syncDirection: 'BIDIRECTIONAL',
      ...overrides,
    };
  }

  it('syncs enabled providers and skips disabled integrations', async () => {
    const service = new CalendarSyncService();
    service.registerIntegration(integration(CalendarProvider.GOOGLE));
    service.registerIntegration(integration(CalendarProvider.MICROSOFT));
    service.registerIntegration(integration(CalendarProvider.APPLE));
    service.registerIntegration(
      integration(CalendarProvider.GOOGLE, { userId: 'disabled', syncEnabled: false })
    );
    const result = await service.syncEvent(createEvent());
    expect(result).toMatchObject({ success: true, eventsCreated: 3 });
  });

  it('captures unsupported-provider errors', async () => {
    const service = new CalendarSyncService();
    service.registerIntegration(integration('UNSUPPORTED' as CalendarProvider));
    const result = await service.syncEvent(createEvent());
    expect(result.success).toBe(false);
    expect(result.errors[0]).toContain('Unsupported provider');
  });

  it('syncs from registered calendars and returns empty for missing providers', async () => {
    const service = new CalendarSyncService();
    expect(
      await service.syncFromCalendar(
        CalendarProvider.GOOGLE,
        new Date('2024-01-01'),
        new Date('2024-01-02')
      )
    ).toEqual([]);
    service.registerIntegration(integration(CalendarProvider.GOOGLE));
    expect(
      await service.syncFromCalendar(
        CalendarProvider.GOOGLE,
        new Date('2024-01-01'),
        new Date('2024-01-02')
      )
    ).toEqual([]);
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

  it('returns no conflicts for distinct, equivalent events', () => {
    const first = createEvent({ id: 'first' });
    const second = createEvent({
      id: 'second',
      title: 'Different',
      startTime: new Date('2024-01-16T10:00:00Z'),
      endTime: new Date('2024-01-16T11:00:00Z'),
    });
    expect(service.detectTimeOverlap([first, second])).toEqual([]);
    expect(service.detectDuplicates([first, second])).toEqual([]);
    expect(service.detectVersionMismatch(first, { ...first })).toBeNull();
    expect(
      service.detectVersionMismatch(first, {
        ...first,
        startTime: new Date('2024-01-15T10:01:00Z'),
      })
    ).not.toBeNull();
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

  it.each(['DAILY', 'MONTHLY', 'YEARLY'] as const)('expands %s recurrence', (frequency) => {
    const event = createEvent({ recurrence: { frequency, interval: 1, count: 2 } });
    const instances = service.expandRecurringEvent(
      event,
      new Date('2024-01-15T00:00:00Z'),
      new Date('2026-01-01T00:00:00Z')
    );
    expect(instances).toHaveLength(2);
  });

  it('honors start, end, until, and the default count', () => {
    const event = createEvent({
      recurrence: {
        frequency: 'DAILY',
        interval: 1,
        until: new Date('2024-01-17T10:00:00Z'),
      },
    });
    const instances = service.expandRecurringEvent(
      event,
      new Date('2024-01-16T00:00:00Z'),
      new Date('2025-01-01T00:00:00Z')
    );
    expect(instances).toHaveLength(2);
    expect(service.parseRecurrenceRule('FREQ=WEEKLY')).toEqual({
      frequency: 'WEEKLY',
      interval: 1,
    });
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

  it('maps attendees, defaults timezone, and emits recurrence details', () => {
    const event = createEvent({
      attendees: [{ email: 'person@example.com', name: 'Person', responseStatus: 'ACCEPTED' }],
      recurrence: {
        frequency: 'WEEKLY',
        interval: 2,
        until: new Date('2024-02-01T00:00:00Z'),
        count: 3,
      },
    });
    const google = mapper.toGoogleFormat(event);
    expect(google.start.timeZone).toBe('UTC');
    expect(google.attendees).toHaveLength(1);
    expect(google.recurrence[0]).toContain('UNTIL=');
    expect(google.recurrence[0]).toContain('COUNT=3');

    const microsoft = mapper.toMicrosoftFormat(event);
    expect(microsoft.start.timeZone).toBe('UTC');
    expect(microsoft.attendees[0].emailAddress.address).toBe('person@example.com');
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

  it('marks provider events without dateTime as all-day', () => {
    const google = mapper.fromGoogleFormat({
      id: 'all-day-google',
      summary: 'All day',
      start: { dateTime: '', timeZone: 'UTC' },
      end: { dateTime: '2024-01-16T00:00:00Z' },
    });
    const microsoft = mapper.fromMicrosoftFormat({
      id: 'all-day-ms',
      subject: 'All day',
      start: { dateTime: '', timeZone: 'UTC' },
      end: { dateTime: '2024-01-16T00:00:00Z' },
    });
    expect(google.allDay).toBe(true);
    expect(microsoft.allDay).toBe(true);
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

  it('refreshes access tokens', async () => {
    const tokens = await service.refreshAccessToken(CalendarProvider.APPLE, 'refresh-token');
    expect(tokens.accessToken).toBe('new_access_token_placeholder');
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

  it('returns immediately while already processing and exercises retry failure paths', async () => {
    const busy = new SyncQueueService();
    (busy as unknown as { processing: boolean }).processing = true;
    await expect(busy.processQueue()).resolves.toBeUndefined();

    const failing = new SyncQueueService();
    (
      failing as unknown as {
        processJob: (job: unknown) => Promise<void>;
      }
    ).processJob = jest.fn().mockRejectedValue(new Error('provider failure'));
    await failing.addJob({
      integrationId: 'int-failing',
      type: 'SYNC',
      priority: 'LOW',
      scheduledAt: new Date(),
      maxAttempts: 2,
    });
    await expect(failing.processQueue()).resolves.toBeUndefined();
    expect(failing.getQueueStatus()).toEqual({ pending: 0, processing: 0, failed: 0 });
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
  const config: CalendarIntegrationConfig = {
    provider: CalendarProvider.GOOGLE,
    userId: 'u1',
    organizationId: 'o1',
    credentials: { accessToken: 'test-only-token' },
    syncEnabled: true,
    syncDirection: 'BIDIRECTIONAL',
  };

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

  it('exercises Google provider placeholder methods', async () => {
    const service = new GoogleCalendarService(config);
    expect(await service.getEvent('external')).toBeNull();
    await expect(service.deleteEvent('external')).resolves.toBeUndefined();
    await expect(service.listEvents(new Date(), new Date())).resolves.toEqual([]);
    await expect(service.watchCalendar('https://hooks.example.com/google')).resolves.toBe(
      'channel_id'
    );
    await expect(service.stopWatching('channel')).resolves.toBeUndefined();
  });

  it('exercises Microsoft provider placeholder methods', async () => {
    const service = new MicrosoftGraphService({ ...config, provider: CalendarProvider.MICROSOFT });
    expect(await service.getEvent('external')).toBeNull();
    await expect(service.deleteEvent('external')).resolves.toBeUndefined();
    await expect(service.listEvents(new Date(), new Date())).resolves.toEqual([]);
    await expect(service.subscribeToChanges('https://hooks.example.com/microsoft')).resolves.toBe(
      'subscription_id'
    );
    await expect(service.unsubscribe('subscription')).resolves.toBeUndefined();
  });

  it('exercises Apple provider placeholder methods', async () => {
    const service = new AppleCalendarService({ ...config, provider: CalendarProvider.APPLE });
    expect(await service.syncEvent(createEvent())).toBe('apple_event-1');
    expect(await service.getEvent('external')).toBeNull();
    await expect(service.deleteEvent('external')).resolves.toBeUndefined();
    await expect(service.listEvents(new Date(), new Date())).resolves.toEqual([]);
  });
});

describe('Calendar event schema', () => {
  it('parses complete events and rejects invalid contracts', () => {
    const parsed = calendarEventSchema.parse({
      ...createEvent({ id: '00000000-0000-4000-8000-000000000000' }),
      attendees: [{ email: 'person@example.com', optional: true }],
      recurrence: { frequency: 'DAILY', interval: 1, count: 2 },
      conferenceData: { provider: 'MEET', meetingUrl: 'https://meet.example.com/room' },
    });
    expect(parsed.startTime).toBeInstanceOf(Date);
    expect(calendarEventSchema.safeParse({ ...parsed, title: '' }).success).toBe(false);
    expect(calendarEventSchema.safeParse({ ...parsed, id: 'invalid' }).success).toBe(false);
  });
});

describe('Public API', () => {
  it('resolves every runtime export from the package entry point', () => {
    for (const key of Object.keys(publicApi) as Array<keyof typeof publicApi>) {
      expect(publicApi[key]).toBeDefined();
    }
    expect(publicApi.CalendarProvider).toBe(CalendarProvider);
  });
});
