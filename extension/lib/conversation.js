import { MAX_CONVERSATION_MESSAGES } from './constants.js';

export class ConversationHistory {
  constructor() {
    this._messages = [];
  }

  get messages() { return this._messages; }

  addUserMessage(text, images = null) {
    this._messages.push({ role: 'user', textContent: text, images: images || undefined });
    this._trim();
  }

  addAssistantMessage(text) {
    this._messages.push({ role: 'assistant', textContent: text });
    this._trim();
  }

  get messagesForApi() {
    return this._messages.map((m, i) => {
      if (m.role === 'user' && m.images?.length) {
        const isLastUser = !this._messages.slice(i + 1).some(
          msg => msg.role === 'user' && msg.images?.length
        );
        if (isLastUser) {
          const content = [];
          for (const img of m.images) {
            content.push({ type: 'text', text: img.label });
            content.push({
              type: 'image',
              source: { type: 'base64', media_type: 'image/jpeg', data: img.base64 },
            });
          }
          content.push({ type: 'text', text: m.textContent || '' });
          return { role: m.role, content };
        }
      }
      return { role: m.role, content: m.textContent || '' };
    });
  }

  clear() { this._messages = []; }

  _trim() {
    while (this._messages.length > MAX_CONVERSATION_MESSAGES) {
      this._messages.shift();
    }
  }
}

export function parsePointTag(response) {
  const match = response.match(/\[POINT:(?:none|(\d+)\s*,\s*(\d+)(?::([^\]]+))?)\]\s*$/);
  if (!match) return { text: response.trim(), x: -1, y: -1, label: null };
  const text = response.slice(0, match.index).trim();
  if (!match[1]) return { text, x: -1, y: -1, label: null };
  return {
    text,
    x: parseInt(match[1]),
    y: parseInt(match[2]),
    label: match[3]?.trim() || null,
  };
}

/**
 * Parse [POINT:id:label] from Claude's response (element ID based, no comma).
 * Returns { id, label } or null.
 */
export function parseElementPointTag(response) {
  // Match [POINT:id:label] where id is a number with no comma (distinguishes from x,y)
  const match = response.match(/\[POINT:(\d+):([^\]]+)\]\s*$/);
  if (!match) return null;
  const id = parseInt(match[1]);
  const label = match[2].trim();
  // Distinguish from coordinate format: if the "label" part contains a comma and digits, it's x,y format
  if (/^\d+\s*,/.test(match[2])) return null;
  return { id, label };
}

export function stripPointTags(response) {
  return response.replace(/\[POINT:[^\]]*\]/g, '').trim();
}
