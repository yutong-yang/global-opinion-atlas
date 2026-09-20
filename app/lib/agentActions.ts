export type AgentActionType = 'country' | 'source' | 'hour' | 'sentiment';

export interface AgentAction {
  type: AgentActionType;
  label: string;
  value: string | number;
}

export interface AgentEntity {
  type: AgentActionType;
  label: string;
  value: string | number;
}

export type TextSegment =
  | {kind: 'text'; text: string}
  | {kind: 'ref'; entity: AgentEntity};

const MARKER_RE = /【定位:([^:】]+):([^】]*)】/g;
const TYPE_MAP: Record<string, AgentActionType> = {
  国家: 'country',
  媒体: 'source',
  小时: 'hour',
  情感: 'sentiment',
};

export function parseMarkers(text: string, entities: AgentEntity[]): {text: string; actions: AgentAction[]} {
  const actions: AgentAction[] = [];
  for (const match of text.matchAll(MARKER_RE)) {
    const type = TYPE_MAP[match[1]];
    const raw = match[2].trim();
    if (!type || !raw) continue;
    if (type === 'hour') {
      const hour = Number(raw);
      if (Number.isInteger(hour) && hour >= 0 && hour <= 23) {
        actions.push({type, label: raw, value: hour});
      }
      continue;
    }
    const entity = entities.find((e) => e.type === type && e.label === raw);
    if (entity) actions.push({type, label: entity.label, value: entity.value});
  }
  return {text: text.replace(/【定位:[^】]*】/g, ''), actions};
}

export function matchEntities(text: string, entities: AgentEntity[]): TextSegment[] {
  if (!text) return [];
  const sorted = [...entities].sort((a, b) => b.label.length - a.label.length);
  const segments: TextSegment[] = [];
  let buffer = '';
  let i = 0;
  while (i < text.length) {
    const hit = sorted.find((e) => text.startsWith(e.label, i));
    if (hit) {
      if (buffer) {
        segments.push({kind: 'text', text: buffer});
        buffer = '';
      }
      segments.push({kind: 'ref', entity: hit});
      i += hit.label.length;
    } else {
      buffer += text[i];
      i += 1;
    }
  }
  if (buffer) segments.push({kind: 'text', text: buffer});
  return segments;
}
