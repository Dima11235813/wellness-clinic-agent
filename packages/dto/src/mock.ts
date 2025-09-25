import { TimeSlot, UserAppointment } from './index';

// Mock data for development - messages are now handled by LangChain types
// The frontend converts LangChain messages to display format
// LangChain-like serialized messages (backend-ish)
export const MOCK_MESSAGE_DATA = [
  {
    id: 'm1',
    role: 'assistant',
    content: "Hello! I'm your UND Wellness Center assistant. I can help you reschedule appointments or answer questions about our policies. How can I help you today?",
    additional_kwargs: { at: new Date().toISOString() }
  },
  {
    id: 'm2',
    role: 'user',
    content: 'I need to reschedule my appointment with Dr. Smith this Thursday',
    additional_kwargs: { at: new Date().toISOString() }
  },
  {
    id: 'm3',
    role: 'assistant',
    content: "I'd be happy to help you reschedule your appointment with Dr. Smith. Let me check available times in the next two weeks.",
    additional_kwargs: { at: new Date().toISOString() }
  }
];

// Display-friendly chat messages (frontend-ish)
export const MOCK_CHAT_MESSAGES = [
  { id: 'm1', role: 'assistant', text: "Hello! I'm your UND Wellness Center assistant. I can help you reschedule appointments or answer questions about our policies. How can I help you today?", at: new Date().toISOString() },
  { id: 'm2', role: 'user', text: 'I need to reschedule my appointment with Dr. Smith this Thursday', at: new Date().toISOString() },
  { id: 'm3', role: 'assistant', text: "I'd be happy to help you reschedule your appointment with Dr. Smith. Let me check available times in the next two weeks.", at: new Date().toISOString() }
];

// --- Mock appointment and availability generation helpers ---

/**
 * Create a default mock user appointment. Defaults to tomorrow at 9:00 AM local time.
 */
export function createMockUserAppointment(provider: string = 'Dr. Smith', startHourLocal: number = 9, durationMinutes: number = 30): UserAppointment {
  const now = new Date();
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, startHourLocal, 0, 0, 0);
  const end = new Date(tomorrow.getTime() + durationMinutes * 60 * 1000);
  return {
    id: 'appt_' + tomorrow.getTime(),
    startISO: tomorrow.toISOString(),
    endISO: end.toISOString(),
    provider
  };
}

/**
 * Generate up to 5 available time slots starting two days after a given appointment.
 * We purposely keep availability small: at most 2 per day, across consecutive days,
 * until we reach a maximum of 5 total.
 */
export function generateMockAvailability(appt: UserAppointment, maxTotal: number = 5, maxPerDay: number = 3): TimeSlot[] {
  const startBase = new Date(new Date(appt.startISO).getTime());
  startBase.setDate(startBase.getDate() + 2); // two days after appointment

  const results: TimeSlot[] = [];
  const slotDurationMinutes = 30;
  let dayOffset = 0;
  let idCounter = 1;

  while (results.length < maxTotal && dayOffset < 10) {
    const date = new Date(startBase.getFullYear(), startBase.getMonth(), startBase.getDate() + dayOffset, 0, 0, 0, 0);

    // choose 1-3 random hour choices per day in a reasonable clinic window (8am-4pm)
    const windowStart = 8; // 8 AM
    const windowEnd = 16; // 4 PM
    const desiredCount = Math.max(1, Math.min(maxPerDay, 1 + Math.floor(Math.random() * 3))); // 1..3
    const hours: number[] = [];
    const attempts = 8; // try a few hours to pick from
    for (let i = 0; i < attempts && hours.length < desiredCount; i++) {
      const h = windowStart + Math.floor(Math.random() * (windowEnd - windowStart));
      if (!hours.includes(h)) hours.push(h);
    }
    hours.sort((a, b) => a - b);

    for (const h of hours) {
      if (results.length >= maxTotal) break;
      const start = new Date(date.getFullYear(), date.getMonth(), date.getDate(), h, Math.random() < 0.5 ? 0 : 30, 0, 0);
      const end = new Date(start.getTime() + slotDurationMinutes * 60 * 1000);
      results.push({
        id: `s${idCounter++}`,
        startISO: start.toISOString(),
        endISO: end.toISOString(),
        provider: appt.provider
      });
    }

    dayOffset += 1;
  }

  // ensure chronological order and limit to maxTotal
  return results
    .sort((a, b) => new Date(a.startISO).getTime() - new Date(b.startISO).getTime())
    .slice(0, maxTotal);
}

// Default exports used by the web app demo
export const MOCK_USER_APPOINTMENT: UserAppointment = createMockUserAppointment();
export const MOCK_AVAILABLE_SLOTS: TimeSlot[] = generateMockAvailability(MOCK_USER_APPOINTMENT);

export const MOCK_POLICY_SUGGESTIONS: string[] = [
  'What are the membership cancellation rules?',
  'Can I bring guests to the facility?',
  'What are the hours of operation?',
  'What safety equipment is required?',
  'How do I report facility issues?'
];


