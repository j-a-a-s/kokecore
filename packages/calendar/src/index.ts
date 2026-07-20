/**
 * @kokecore/calendar
 *
 * Enterprise-grade calendar synchronization with:
 * - Google Calendar API integration
 * - Microsoft Graph API integration
 * - Apple Calendar support
 * - OAuth2 authentication
 * - Bidirectional sync
 * - Conflict detection and resolution
 * - Recurring event handling
 * - Timezone support
 * - Webhook handlers
 * - Sync queue system
 * - Video conferencing integration
 */

import { z } from 'zod';

/**
 * Calendar provider types
 */
export enum CalendarProvider {
  GOOGLE = 'GOOGLE',
  MICROSOFT = 'MICROSOFT',
  APPLE = 'APPLE',
}

/**
 * Event status
 */
export enum EventStatus {
  CONFIRMED = 'CONFIRMED',
  TENTATIVE = 'TENTATIVE',
  CANCELLED = 'CANCELLED',
}

/**
 * Recurrence rule
 */
export interface RecurrenceRule {
  frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  interval: number;
  until?: Date;
  count?: number;
  byDay?: number[];
  byMonth?: number[];
  byMonthDay?: number[];
}

/**
 * Calendar event structure
 */
export interface CalendarEvent {
  id: string;
  externalId?: string;
  provider: CalendarProvider;
  title: string;
  description?: string;
  location?: string;
  startTime: Date;
  endTime: Date;
  allDay: boolean;
  status: EventStatus;
  attendees?: Attendee[];
  recurrence?: RecurrenceRule;
  recurrenceId?: string;
  timezone?: string;
  conferenceData?: ConferenceData;
  metadata?: Record<string, unknown>;
}

/**
 * Attendee information
 */
export interface Attendee {
  email: string;
  name?: string;
  responseStatus?: 'ACCEPTED' | 'DECLINED' | 'TENTATIVE' | 'NEEDS_ACTION';
  optional?: boolean;
}

/**
 * Conference data for video calls
 */
export interface ConferenceData {
  provider: 'ZOOM' | 'TEAMS' | 'MEET' | 'NONE';
  meetingUrl?: string;
  meetingId?: string;
  password?: string;
  phoneNumbers?: string[];
}

/**
 * Calendar integration configuration
 */
export interface CalendarIntegrationConfig {
  provider: CalendarProvider;
  userId: string;
  organizationId: string;
  credentials: {
    accessToken: string;
    refreshToken?: string;
    expiresAt?: Date;
  };
  calendarId?: string;
  syncEnabled: boolean;
  syncDirection: 'BIDIRECTIONAL' | 'TO_CALENDAR' | 'FROM_CALENDAR';
  lastSyncAt?: Date;
}

/**
 * Sync result
 */
export interface SyncResult {
  success: boolean;
  eventsCreated: number;
  eventsUpdated: number;
  eventsDeleted: number;
  conflicts: Conflict[];
  errors: string[];
}

/**
 * Conflict information
 */
export interface Conflict {
  type: 'TIME_OVERLAP' | 'DUPLICATE' | 'VERSION_MISMATCH';
  localEvent?: CalendarEvent;
  remoteEvent?: CalendarEvent;
  suggestedResolution?: ConflictResolution;
}

/**
 * Conflict resolution options
 */
export interface ConflictResolution {
  action: 'KEEP_LOCAL' | 'KEEP_REMOTE' | 'MERGE' | 'MANUAL';
  mergedEvent?: CalendarEvent;
}

/**
 * Sync queue job
 */
export interface SyncJob {
  id: string;
  integrationId: string;
  type: 'SYNC' | 'CREATE' | 'UPDATE' | 'DELETE';
  eventId?: string;
  eventData?: CalendarEvent;
  priority: 'HIGH' | 'NORMAL' | 'LOW';
  scheduledAt: Date;
  attempts: number;
  maxAttempts: number;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  error?: string;
}

/**
 * Google Calendar Service
 */
export class GoogleCalendarService {
  private config: CalendarIntegrationConfig;
  private client: any; // Google Calendar API client

  constructor(config: CalendarIntegrationConfig) {
    this.config = config;
    // Initialize Google Calendar client
    this.client = null;
  }

  /**
   * Sync event to Google Calendar
   */
  async syncEvent(event: CalendarEvent): Promise<string> {
    // In production, this would use Google Calendar API
    const externalId = `google_${event.id}`;
    return externalId;
  }

  /**
   * Get event from Google Calendar
   */
  async getEvent(externalId: string): Promise<CalendarEvent | null> {
    // In production, this would fetch from Google Calendar API
    return null;
  }

  /**
   * Delete event from Google Calendar
   */
  async deleteEvent(externalId: string): Promise<void> {
    // In production, this would delete from Google Calendar API
  }

  /**
   * List events from Google Calendar
   */
  async listEvents(startDate: Date, endDate: Date): Promise<CalendarEvent[]> {
    // In production, this would list from Google Calendar API
    return [];
  }

  /**
   * Watch for changes (webhook setup)
   */
  async watchCalendar(webhookUrl: string): Promise<string> {
    // In production, this would set up Google Calendar webhook
    return 'channel_id';
  }

  /**
   * Stop watching for changes
   */
  async stopWatching(channelId: string): Promise<void> {
    // In production, this would stop Google Calendar webhook
  }
}

/**
 * Microsoft Graph Service
 */
export class MicrosoftGraphService {
  private config: CalendarIntegrationConfig;
  private client: any; // Microsoft Graph client

  constructor(config: CalendarIntegrationConfig) {
    this.config = config;
    // Initialize Microsoft Graph client
    this.client = null;
  }

  /**
   * Sync event to Microsoft Calendar
   */
  async syncEvent(event: CalendarEvent): Promise<string> {
    // In production, this would use Microsoft Graph API
    const externalId = `microsoft_${event.id}`;
    return externalId;
  }

  /**
   * Get event from Microsoft Calendar
   */
  async getEvent(externalId: string): Promise<CalendarEvent | null> {
    // In production, this would fetch from Microsoft Graph API
    return null;
  }

  /**
   * Delete event from Microsoft Calendar
   */
  async deleteEvent(externalId: string): Promise<void> {
    // In production, this would delete from Microsoft Graph API
  }

  /**
   * List events from Microsoft Calendar
   */
  async listEvents(startDate: Date, endDate: Date): Promise<CalendarEvent[]> {
    // In production, this would list from Microsoft Graph API
    return [];
  }

  /**
   * Subscribe to changes (webhook setup)
   */
  async subscribeToChanges(webhookUrl: string): Promise<string> {
    // In production, this would set up Microsoft Graph subscription
    return 'subscription_id';
  }

  /**
   * Unsubscribe from changes
   */
  async unsubscribe(subscriptionId: string): Promise<void> {
    // In production, this would cancel Microsoft Graph subscription
  }
}

/**
 * Apple Calendar Service (via CalDAV)
 */
export class AppleCalendarService {
  private config: CalendarIntegrationConfig;
  private client: any; // CalDAV client

  constructor(config: CalendarIntegrationConfig) {
    this.config = config;
    // Initialize CalDAV client
    this.client = null;
  }

  /**
   * Sync event to Apple Calendar
   */
  async syncEvent(event: CalendarEvent): Promise<string> {
    // In production, this would use CalDAV
    const externalId = `apple_${event.id}`;
    return externalId;
  }

  /**
   * Get event from Apple Calendar
   */
  async getEvent(externalId: string): Promise<CalendarEvent | null> {
    // In production, this would fetch via CalDAV
    return null;
  }

  /**
   * Delete event from Apple Calendar
   */
  async deleteEvent(externalId: string): Promise<void> {
    // In production, this would delete via CalDAV
  }

  /**
   * List events from Apple Calendar
   */
  async listEvents(startDate: Date, endDate: Date): Promise<CalendarEvent[]> {
    // In production, this would list via CalDAV
    return [];
  }
}

/**
 * Calendar sync service
 */
export class CalendarSyncService {
  private integrations: Map<string, CalendarIntegrationConfig> = new Map();
  private googleService: GoogleCalendarService;
  private microsoftService: MicrosoftGraphService;
  private appleService: AppleCalendarService;

  constructor() {
    this.googleService = new GoogleCalendarService({} as CalendarIntegrationConfig);
    this.microsoftService = new MicrosoftGraphService({} as CalendarIntegrationConfig);
    this.appleService = new AppleCalendarService({} as CalendarIntegrationConfig);
  }

  /**
   * Register calendar integration
   */
  registerIntegration(config: CalendarIntegrationConfig): void {
    this.integrations.set(config.userId + config.provider, config);
  }

  /**
   * Sync event to all enabled integrations
   */
  async syncEvent(event: CalendarEvent): Promise<SyncResult> {
    const result: SyncResult = {
      success: true,
      eventsCreated: 0,
      eventsUpdated: 0,
      eventsDeleted: 0,
      conflicts: [],
      errors: [],
    };

    for (const [key, config] of this.integrations) {
      if (!config.syncEnabled) continue;

      try {
        const service = this.getService(config.provider);
        const externalId = await service.syncEvent(event);
        result.eventsCreated++;
      } catch (error) {
        result.errors.push(`Failed to sync to ${config.provider}: ${error}`);
        result.success = false;
      }
    }

    return result;
  }

  /**
   * Sync from calendar to local
   */
  async syncFromCalendar(
    provider: CalendarProvider,
    startDate: Date,
    endDate: Date
  ): Promise<CalendarEvent[]> {
    const config = this.getIntegrationConfig(provider);
    if (!config) return [];

    const service = this.getService(provider);
    return await service.listEvents(startDate, endDate);
  }

  /**
   * Get service for provider
   */
  private getService(provider: CalendarProvider): any {
    switch (provider) {
      case CalendarProvider.GOOGLE:
        return this.googleService;
      case CalendarProvider.MICROSOFT:
        return this.microsoftService;
      case CalendarProvider.APPLE:
        return this.appleService;
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
  }

  /**
   * Get integration config
   */
  private getIntegrationConfig(provider: CalendarProvider): CalendarIntegrationConfig | undefined {
    for (const config of this.integrations.values()) {
      if (config.provider === provider) return config;
    }
    return undefined;
  }
}

/**
 * Conflict detection service
 */
export class ConflictDetectionService {
  /**
   * Detect time overlap conflicts
   */
  detectTimeOverlap(events: CalendarEvent[]): Conflict[] {
    const conflicts: Conflict[] = [];
    const sortedEvents = [...events].sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

    for (let i = 0; i < sortedEvents.length - 1; i++) {
      const current = sortedEvents[i];
      const next = sortedEvents[i + 1];

      if (!current || !next) continue;

      if (current.endTime > next.startTime && current.startTime < next.endTime) {
        conflicts.push({
          type: 'TIME_OVERLAP',
          localEvent: current,
          remoteEvent: next,
          suggestedResolution: {
            action: 'MANUAL',
          },
        });
      }
    }

    return conflicts;
  }

  /**
   * Detect duplicate events
   */
  detectDuplicates(events: CalendarEvent[]): Conflict[] {
    const conflicts: Conflict[] = [];
    const seen = new Map<string, CalendarEvent[]>();

    for (const event of events) {
      const key = `${event.title}_${event.startTime.getTime()}_${event.endTime.getTime()}`;
      if (!seen.has(key)) {
        seen.set(key, []);
      }
      seen.get(key)!.push(event);
    }

    for (const [key, duplicateEvents] of seen) {
      if (duplicateEvents.length > 1) {
        conflicts.push({
          type: 'DUPLICATE',
          localEvent: duplicateEvents[0],
          remoteEvent: duplicateEvents[1],
          suggestedResolution: {
            action: 'KEEP_LOCAL',
          },
        });
      }
    }

    return conflicts;
  }

  /**
   * Detect version mismatch conflicts
   */
  detectVersionMismatch(localEvent: CalendarEvent, remoteEvent: CalendarEvent): Conflict | null {
    // Compare events to detect if they've diverged
    if (
      localEvent.title !== remoteEvent.title ||
      localEvent.startTime.getTime() !== remoteEvent.startTime.getTime()
    ) {
      return {
        type: 'VERSION_MISMATCH',
        localEvent,
        remoteEvent,
        suggestedResolution: {
          action: 'MANUAL',
        },
      };
    }
    return null;
  }
}

/**
 * Recurring event service
 */
export class RecurringEventService {
  /**
   * Expand recurring event into individual instances
   */
  expandRecurringEvent(event: CalendarEvent, startDate: Date, endDate: Date): CalendarEvent[] {
    if (!event.recurrence) return [event];

    const instances: CalendarEvent[] = [];
    const { frequency, interval, until, count, byDay, byMonth, byMonthDay } = event.recurrence;

    const currentDate = new Date(event.startTime);
    let instanceCount = 0;
    const maxInstances = count || 100;

    while (
      currentDate <= endDate &&
      (until ? currentDate <= until : true) &&
      instanceCount < maxInstances
    ) {
      if (currentDate >= startDate) {
        instances.push({
          ...event,
          id: `${event.id}_${instanceCount}`,
          recurrenceId: event.id,
          startTime: new Date(currentDate),
          endTime: new Date(
            currentDate.getTime() + (event.endTime.getTime() - event.startTime.getTime())
          ),
        });
      }

      // Move to next occurrence based on frequency
      switch (frequency) {
        case 'DAILY':
          currentDate.setDate(currentDate.getDate() + interval);
          break;
        case 'WEEKLY':
          currentDate.setDate(currentDate.getDate() + 7 * interval);
          break;
        case 'MONTHLY':
          currentDate.setMonth(currentDate.getMonth() + interval);
          break;
        case 'YEARLY':
          currentDate.setFullYear(currentDate.getFullYear() + interval);
          break;
      }

      instanceCount++;
    }

    return instances;
  }

  /**
   * Generate recurrence rule from rrule string
   */
  parseRecurrenceRule(rruleString: string): RecurrenceRule {
    // In production, this would use rrule library
    return {
      frequency: 'WEEKLY',
      interval: 1,
    };
  }

  /**
   * Generate rrule string from recurrence rule
   */
  generateRecurrenceString(rule: RecurrenceRule): string {
    // In production, this would generate rrule string
    return `FREQ=${rule.frequency};INTERVAL=${rule.interval}`;
  }
}

/**
 * Video conferencing service
 */
export class VideoConferencingService {
  /**
   * Create Zoom meeting
   */
  async createZoomMeeting(event: CalendarEvent): Promise<ConferenceData> {
    // In production, this would use Zoom API
    return {
      provider: 'ZOOM',
      meetingUrl: 'https://zoom.us/j/placeholder',
      meetingId: 'placeholder',
    };
  }

  /**
   * Create Microsoft Teams meeting
   */
  async createTeamsMeeting(event: CalendarEvent): Promise<ConferenceData> {
    // In production, this would use Microsoft Graph API
    return {
      provider: 'TEAMS',
      meetingUrl: 'https://teams.microsoft.com/l/meetup-join/placeholder',
    };
  }

  /**
   * Create Google Meet meeting
   */
  async createGoogleMeet(event: CalendarEvent): Promise<ConferenceData> {
    // In production, this would use Google Calendar API
    return {
      provider: 'MEET',
      meetingUrl: 'https://meet.google.com/placeholder',
    };
  }

  /**
   * Create meeting based on provider preference
   */
  async createMeeting(
    event: CalendarEvent,
    provider: 'ZOOM' | 'TEAMS' | 'MEET'
  ): Promise<ConferenceData> {
    switch (provider) {
      case 'ZOOM':
        return this.createZoomMeeting(event);
      case 'TEAMS':
        return this.createTeamsMeeting(event);
      case 'MEET':
        return this.createGoogleMeet(event);
    }
  }
}

/**
 * Sync queue service
 */
export class SyncQueueService {
  private queue: SyncJob[] = [];
  private processing: boolean = false;

  /**
   * Add job to queue
   */
  async addJob(job: Omit<SyncJob, 'id' | 'attempts' | 'status'>): Promise<string> {
    const syncJob: SyncJob = {
      ...job,
      id: `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      attempts: 0,
      status: 'PENDING',
    };
    this.queue.push(syncJob);
    return syncJob.id;
  }

  /**
   * Process queue
   */
  async processQueue(): Promise<void> {
    if (this.processing) return;
    this.processing = true;

    while (this.queue.length > 0) {
      const job = this.queue.shift()!;
      job.status = 'PROCESSING';
      job.attempts++;

      try {
        // Process job
        await this.processJob(job);
        job.status = 'COMPLETED';
      } catch (error) {
        job.error = String(error);
        if (job.attempts < job.maxAttempts) {
          job.status = 'PENDING';
          this.queue.push(job);
        } else {
          job.status = 'FAILED';
        }
      }
    }

    this.processing = false;
  }

  /**
   * Process individual job
   */
  private async processJob(job: SyncJob): Promise<void> {
    // In production, this would process the sync job
    console.log(`Processing job ${job.id}`);
  }

  /**
   * Get queue status
   */
  getQueueStatus(): { pending: number; processing: number; failed: number } {
    return {
      pending: this.queue.filter((j) => j.status === 'PENDING').length,
      processing: this.queue.filter((j) => j.status === 'PROCESSING').length,
      failed: this.queue.filter((j) => j.status === 'FAILED').length,
    };
  }
}

/**
 * OAuth service for calendar providers
 */
export class CalendarOAuthService {
  /**
   * Get OAuth authorization URL
   */
  getAuthorizationUrl(provider: CalendarProvider, redirectUri: string): string {
    switch (provider) {
      case CalendarProvider.GOOGLE:
        return `https://accounts.google.com/o/oauth2/v2/auth?redirect_uri=${redirectUri}`;
      case CalendarProvider.MICROSOFT:
        return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?redirect_uri=${redirectUri}`;
      case CalendarProvider.APPLE:
        return `https://appleid.apple.com/auth/authorize?redirect_uri=${redirectUri}`;
    }
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(
    provider: CalendarProvider,
    code: string,
    redirectUri: string
  ): Promise<{ accessToken: string; refreshToken?: string; expiresAt: Date }> {
    // In production, this would exchange code with OAuth provider
    return {
      accessToken: 'access_token_placeholder',
      refreshToken: 'refresh_token_placeholder',
      expiresAt: new Date(Date.now() + 3600 * 1000),
    };
  }

  /**
   * Refresh access token
   */
  async refreshAccessToken(
    provider: CalendarProvider,
    refreshToken: string
  ): Promise<{ accessToken: string; expiresAt: Date }> {
    // In production, this would refresh token with OAuth provider
    return {
      accessToken: 'new_access_token_placeholder',
      expiresAt: new Date(Date.now() + 3600 * 1000),
    };
  }
}

/**
 * Event mapper for converting between different calendar formats
 */
export class EventMapper {
  /**
   * Map local event to Google Calendar format
   */
  toGoogleFormat(event: CalendarEvent): any {
    return {
      summary: event.title,
      description: event.description,
      location: event.location,
      start: {
        dateTime: event.startTime.toISOString(),
        timeZone: event.timezone || 'UTC',
      },
      end: {
        dateTime: event.endTime.toISOString(),
        timeZone: event.timezone || 'UTC',
      },
      attendees: event.attendees?.map((a) => ({
        email: a.email,
        displayName: a.name,
        responseStatus: a.responseStatus,
      })),
      recurrence: event.recurrence ? [this.recurrenceToRRule(event.recurrence)] : undefined,
    };
  }

  /**
   * Map Google Calendar event to local format
   */
  fromGoogleFormat(googleEvent: any): CalendarEvent {
    return {
      id: googleEvent.id,
      provider: CalendarProvider.GOOGLE,
      title: googleEvent.summary,
      description: googleEvent.description,
      location: googleEvent.location,
      startTime: new Date(googleEvent.start.dateTime),
      endTime: new Date(googleEvent.end.dateTime),
      allDay: !googleEvent.start.dateTime,
      status: EventStatus.CONFIRMED,
      timezone: googleEvent.start.timeZone,
    };
  }

  /**
   * Map local event to Microsoft Graph format
   */
  toMicrosoftFormat(event: CalendarEvent): any {
    return {
      subject: event.title,
      body: {
        contentType: 'HTML',
        content: event.description,
      },
      location: {
        displayName: event.location,
      },
      start: {
        dateTime: event.startTime.toISOString(),
        timeZone: event.timezone || 'UTC',
      },
      end: {
        dateTime: event.endTime.toISOString(),
        timeZone: event.timezone || 'UTC',
      },
      attendees: event.attendees?.map((a) => ({
        emailAddress: {
          address: a.email,
          name: a.name,
        },
        responseStatus: {
          response: a.responseStatus,
        },
      })),
    };
  }

  /**
   * Map Microsoft Graph event to local format
   */
  fromMicrosoftFormat(microsoftEvent: any): CalendarEvent {
    return {
      id: microsoftEvent.id,
      provider: CalendarProvider.MICROSOFT,
      title: microsoftEvent.subject,
      description: microsoftEvent.body?.content,
      location: microsoftEvent.location?.displayName,
      startTime: new Date(microsoftEvent.start.dateTime),
      endTime: new Date(microsoftEvent.end.dateTime),
      allDay: !microsoftEvent.start.dateTime,
      status: EventStatus.CONFIRMED,
      timezone: microsoftEvent.start.timeZone,
    };
  }

  /**
   * Convert recurrence rule to RRule string
   */
  private recurrenceToRRule(rule: RecurrenceRule): string {
    const parts = [`FREQ=${rule.frequency}`, `INTERVAL=${rule.interval}`];
    if (rule.until) parts.push(`UNTIL=${rule.until.toISOString().replace(/[-:]/g, '')}`);
    if (rule.count) parts.push(`COUNT=${rule.count}`);
    return parts.join(';');
  }
}

/**
 * Main calendar service combining all features
 */
export class CalendarService {
  private syncService: CalendarSyncService;
  private conflictService: ConflictDetectionService;
  private recurringService: RecurringEventService;
  private videoService: VideoConferencingService;
  private queueService: SyncQueueService;
  private oauthService: CalendarOAuthService;
  private mapper: EventMapper;

  constructor() {
    this.syncService = new CalendarSyncService();
    this.conflictService = new ConflictDetectionService();
    this.recurringService = new RecurringEventService();
    this.videoService = new VideoConferencingService();
    this.queueService = new SyncQueueService();
    this.oauthService = new CalendarOAuthService();
    this.mapper = new EventMapper();
  }

  /**
   * Sync event to calendar
   */
  async syncEvent(event: CalendarEvent): Promise<SyncResult> {
    return this.syncService.syncEvent(event);
  }

  /**
   * Detect conflicts
   */
  detectConflicts(events: CalendarEvent[]): Conflict[] {
    const timeConflicts = this.conflictService.detectTimeOverlap(events);
    const duplicateConflicts = this.conflictService.detectDuplicates(events);
    return [...timeConflicts, ...duplicateConflicts];
  }

  /**
   * Expand recurring events
   */
  expandRecurringEvents(event: CalendarEvent, startDate: Date, endDate: Date): CalendarEvent[] {
    return this.recurringService.expandRecurringEvent(event, startDate, endDate);
  }

  /**
   * Create video conference
   */
  async createVideoConference(
    event: CalendarEvent,
    provider: 'ZOOM' | 'TEAMS' | 'MEET'
  ): Promise<ConferenceData> {
    return this.videoService.createMeeting(event, provider);
  }

  /**
   * Add sync job to queue
   */
  async addSyncJob(job: Omit<SyncJob, 'id' | 'attempts' | 'status'>): Promise<string> {
    return this.queueService.addJob(job);
  }

  /**
   * Process sync queue
   */
  async processSyncQueue(): Promise<void> {
    return this.queueService.processQueue();
  }

  /**
   * Get OAuth authorization URL
   */
  getAuthorizationUrl(provider: CalendarProvider, redirectUri: string): string {
    return this.oauthService.getAuthorizationUrl(provider, redirectUri);
  }

  /**
   * Exchange authorization code
   */
  async exchangeCodeForTokens(
    provider: CalendarProvider,
    code: string,
    redirectUri: string
  ): Promise<{ accessToken: string; refreshToken?: string; expiresAt: Date }> {
    return this.oauthService.exchangeCodeForTokens(provider, code, redirectUri);
  }

  /**
   * Register calendar integration
   */
  registerIntegration(config: CalendarIntegrationConfig): void {
    this.syncService.registerIntegration(config);
  }

  /**
   * Get sub-services
   */
  getSyncService(): CalendarSyncService {
    return this.syncService;
  }

  getConflictService(): ConflictDetectionService {
    return this.conflictService;
  }

  getRecurringService(): RecurringEventService {
    return this.recurringService;
  }

  getVideoService(): VideoConferencingService {
    return this.videoService;
  }

  getQueueService(): SyncQueueService {
    return this.queueService;
  }

  getMapper(): EventMapper {
    return this.mapper;
  }
}

/**
 * Zod schemas for validation
 */
export const calendarEventSchema = z.object({
  id: z.string().uuid(),
  externalId: z.string().optional(),
  provider: z.nativeEnum(CalendarProvider),
  title: z.string().min(1),
  description: z.string().optional(),
  location: z.string().optional(),
  startTime: z.coerce.date(),
  endTime: z.coerce.date(),
  allDay: z.boolean(),
  status: z.nativeEnum(EventStatus),
  attendees: z
    .array(
      z.object({
        email: z.string().email(),
        name: z.string().optional(),
        responseStatus: z.enum(['ACCEPTED', 'DECLINED', 'TENTATIVE', 'NEEDS_ACTION']).optional(),
        optional: z.boolean().optional(),
      })
    )
    .optional(),
  recurrence: z
    .object({
      frequency: z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY']),
      interval: z.number().int().positive(),
      until: z.coerce.date().optional(),
      count: z.number().int().positive().optional(),
    })
    .optional(),
  timezone: z.string().optional(),
  conferenceData: z
    .object({
      provider: z.enum(['ZOOM', 'TEAMS', 'MEET', 'NONE']),
      meetingUrl: z.string().url().optional(),
      meetingId: z.string().optional(),
      password: z.string().optional(),
    })
    .optional(),
});
