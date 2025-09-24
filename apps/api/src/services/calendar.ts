import { TimeSlot } from "@wellness/dto";

export interface CalendarEvent {
  id: string;
  summary: string;
  start: {
    dateTime: string;
    timeZone?: string;
  };
  end: {
    dateTime: string;
    timeZone?: string;
  };
  attendees?: Array<{
    email: string;
    displayName?: string;
    responseStatus: 'accepted' | 'declined' | 'tentative' | 'needsAction';
  }>;
  description?: string;
}

export interface GetAvailabilityArgs {
  preferredDate?: string;
  preferredProvider?: string;
  duration?: number; // in minutes, default 60
}

export interface RescheduleAppointmentArgs {
  eventId: string;
  newStartTime: string;
  newEndTime: string;
  reason?: string;
}

/**
 * Google Calendar API stub service
 * In production, this would integrate with actual Google Calendar API
 */
export class GoogleCalendarService {
  private apiKey: string;
  private calendarId: string;

  constructor(apiKey: string = 'stub-api-key', calendarId: string = 'primary') {
    this.apiKey = apiKey;
    this.calendarId = calendarId;
  }

  /**
   * Get available time slots by querying calendar events
   * This stubs the Google Calendar API free/busy endpoint
   */
  async getAvailability({ preferredDate, preferredProvider, duration = 60 }: GetAvailabilityArgs): Promise<TimeSlot[]> {
    console.log(`[CALENDAR] Fetching availability for date: ${preferredDate}, provider: ${preferredProvider}`);

    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 100));

    const providers = preferredProvider ? [preferredProvider] : ["Sarah", "Mike", "Jennifer"];
    const startDate = preferredDate ? new Date(preferredDate) : new Date();

    const slots: TimeSlot[] = [];

    // Generate slots for next 7 weekdays
    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      const day = new Date(startDate);
      day.setDate(day.getDate() + dayOffset);
      const weekday = day.getDay();

      // Skip weekends
      if (weekday === 0 || weekday === 6) continue;

      // Check if this day has any conflicting events
      const dayEvents = await this.getEventsForDay(day.toISOString().slice(0, 10));

      for (const provider of providers) {
        // Generate 3 fixed time blocks per day (deterministic)
        for (const hour of [9, 13, 15]) {
          const start = new Date(day);
          start.setHours(hour, 0, 0, 0);
          const end = new Date(start);
          end.setHours(hour + 1);

          // Check if this time slot conflicts with existing events
          const hasConflict = dayEvents.some(event => {
            const eventStart = new Date(event.start.dateTime);
            const eventEnd = new Date(event.end.dateTime);
            return (start < eventEnd && end > eventStart);
          });

          if (!hasConflict) {
            const id = `slot_${start.toISOString().slice(0, 10)}_${provider}_${hour}`;
            slots.push({
              id,
              startISO: start.toISOString(),
              endISO: end.toISOString(),
              provider
            });
          }
        }
      }
    }

    console.log(`[CALENDAR] Found ${slots.length} available slots`);
    return slots;
  }

  /**
   * Reschedule an existing appointment
   * This stubs the Google Calendar API update event endpoint
   */
  async rescheduleAppointment({ eventId, newStartTime, newEndTime, reason }: RescheduleAppointmentArgs): Promise<{ success: boolean; event?: CalendarEvent }> {
    console.log(`[CALENDAR] Rescheduling event ${eventId} to ${newStartTime} - ${newEndTime}`);

    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 200));

    // Simulate potential conflicts check
    const conflicts = await this.checkForConflicts(newStartTime, newEndTime);
    if (conflicts.length > 0) {
      console.log(`[CALENDAR] Rescheduling failed due to conflicts:`, conflicts);
      return { success: false };
    }

    // Mock successful rescheduling
    const updatedEvent: CalendarEvent = {
      id: eventId,
      summary: `Wellness Appointment - Rescheduled${reason ? ` (${reason})` : ''}`,
      start: {
        dateTime: newStartTime,
        timeZone: 'America/New_York'
      },
      end: {
        dateTime: newEndTime,
        timeZone: 'America/New_York'
      },
      attendees: [{
        email: 'patient@example.com',
        displayName: 'Patient',
        responseStatus: 'accepted'
      }],
      description: `Rescheduled appointment${reason ? `. Reason: ${reason}` : ''}`
    };

    console.log(`[CALENDAR] Successfully rescheduled event ${eventId}`);
    return { success: true, event: updatedEvent };
  }

  /**
   * Get events for a specific day
   * Private method to simulate existing calendar events
   */
  private async getEventsForDay(dateString: string): Promise<CalendarEvent[]> {
    // Simulate some existing appointments on certain days
    const mockEvents: Record<string, CalendarEvent[]> = {
      // Today has some conflicts
      [new Date().toISOString().slice(0, 10)]: [{
        id: 'existing_1',
        summary: 'Existing Appointment',
        start: { dateTime: `${dateString}T09:00:00-05:00` },
        end: { dateTime: `${dateString}T10:00:00-05:00` },
        attendees: []
      }],
      // Tomorrow has afternoon conflicts
      [new Date(Date.now() + 86400000).toISOString().slice(0, 10)]: [{
        id: 'existing_2',
        summary: 'Team Meeting',
        start: { dateTime: `${dateString}T13:00:00-05:00` },
        end: { dateTime: `${dateString}T14:00:00-05:00` },
        attendees: []
      }]
    };

    return mockEvents[dateString] || [];
  }

  /**
   * Check for scheduling conflicts
   * Private method to simulate conflict detection
   */
  private async checkForConflicts(startTime: string, endTime: string): Promise<CalendarEvent[]> {
    // Simulate occasional conflicts (5% chance)
    if (Math.random() < 0.05) {
      return [{
        id: 'conflict_1',
        summary: 'Conflicting Meeting',
        start: { dateTime: startTime },
        end: { dateTime: endTime },
        attendees: []
      }];
    }
    return [];
  }

  /**
   * Create a new calendar event
   * Additional method that might be useful for future features
   */
  async createEvent(event: Omit<CalendarEvent, 'id'>): Promise<CalendarEvent> {
    const newEvent: CalendarEvent = {
      ...event,
      id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };

    console.log(`[CALENDAR] Created new event: ${newEvent.id}`);
    return newEvent;
  }
}

// Export singleton instance for use throughout the app
export const calendarService = new GoogleCalendarService();
