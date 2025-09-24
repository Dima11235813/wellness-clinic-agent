import { TimeSlot } from './index';

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

export const MOCK_AVAILABLE_SLOTS: TimeSlot[] = [
  { id: 's1', startISO: new Date(Date.now() + 1 * 60 * 60 * 1000).toISOString(), endISO: new Date(Date.now() + 1.5 * 60 * 60 * 1000).toISOString(), provider: 'Dr. Smith' },
  { id: 's2', startISO: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), endISO: new Date(Date.now() + 2.5 * 60 * 60 * 1000).toISOString(), provider: 'Dr. Smith' },
  { id: 's3', startISO: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(), endISO: new Date(Date.now() + 3.5 * 60 * 60 * 1000).toISOString(), provider: 'Dr. Smith' },
  { id: 's4', startISO: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(), endISO: new Date(Date.now() + 4.5 * 60 * 60 * 1000).toISOString(), provider: 'Dr. Smith' },
  { id: 's5', startISO: new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString(), endISO: new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString(), provider: 'Dr. Smith' }
];

export const MOCK_POLICY_SUGGESTIONS: string[] = [
  'What are the membership cancellation rules?',
  'Can I bring guests to the facility?',
  'What are the hours of operation?',
  'What safety equipment is required?',
  'How do I report facility issues?'
];


