import type { PostSource } from '@/lib/types';

const CLIENTS = new Set(['web', 'bankr-app', 'agent', 'api']);

const TRIGGERS = new Set([
  'manual',
  'x-dm',
  'x-mention',
  'x-reply',
  'terminal',
  'autopilot',
]);

export function normalizePostClient(value: unknown): PostSource['client'] | null {
  const v = String(value || '')
    .trim()
    .toLowerCase();
  if (CLIENTS.has(v)) return v as PostSource['client'];
  return null;
}

export function normalizePostTrigger(value: unknown): PostSource['trigger'] | null {
  const v = String(value || '')
    .trim()
    .toLowerCase();
  if (TRIGGERS.has(v)) return v as PostSource['trigger'];
  return null;
}

export function parsePostSource(
  req: Request,
  body: Record<string, unknown>
): PostSource | undefined {
  const raw = body.source;
  const fromBody =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : null;

  const client =
    normalizePostClient(fromBody?.client) ||
    normalizePostClient(req.headers.get('x-client'));

  const trigger =
    normalizePostTrigger(fromBody?.trigger) ||
    normalizePostTrigger(req.headers.get('x-post-trigger'));

  const agentId = String(fromBody?.agentId || req.headers.get('x-agent-id') || '')
    .trim()
    .slice(0, 64);
  const externalRef = String(
    fromBody?.externalRef || req.headers.get('x-external-ref') || ''
  )
    .trim()
    .slice(0, 128);

  const viaAgentRaw = fromBody?.viaAgent;
  const viaAgent =
    viaAgentRaw === true ||
    viaAgentRaw === 'true' ||
    client === 'agent' ||
    !!agentId;

  if (!client && !trigger && !agentId && !externalRef && viaAgentRaw == null) {
    return undefined;
  }

  const resolvedClient = client || (viaAgent ? 'agent' : 'api');
  const resolvedTrigger =
    trigger || (resolvedClient === 'agent' ? 'autopilot' : 'manual');

  const source: PostSource = {
    client: resolvedClient,
    trigger: resolvedTrigger,
    viaAgent,
  };

  if (agentId) source.agentId = agentId;
  if (externalRef) source.externalRef = externalRef;

  return source;
}

export function postSourceLabel(source: PostSource | undefined | null): string | null {
  if (!source) return null;

  const agent = source.agentId ? `@${source.agentId.replace(/^@/, '')}` : 'agent';

  if (source.client === 'web' && source.trigger === 'manual' && !source.viaAgent) {
    return 'Posted on bankr.space';
  }
  if (source.client === 'bankr-app' && source.trigger === 'manual') {
    return 'Posted via Bankr app';
  }

  switch (source.trigger) {
    case 'x-dm':
      return source.viaAgent ? `Posted via ${agent} · X DM` : 'Posted via X DM';
    case 'x-mention':
      return source.viaAgent ? `Posted via ${agent} · X mention` : 'Posted via X mention';
    case 'x-reply':
      return source.viaAgent ? `Posted via ${agent} · X reply` : 'Posted via X reply';
    case 'terminal':
      return source.viaAgent ? `Posted via ${agent} · terminal` : 'Posted via terminal';
    case 'autopilot':
      return source.viaAgent ? `Posted via ${agent}` : 'Posted via agent';
    case 'manual':
      if (source.client === 'agent') return `Posted via ${agent}`;
      if (source.client === 'api') return 'Posted via API';
      return null;
    default:
      return source.viaAgent ? `Posted via ${agent}` : 'Posted via API';
  }
}

export function shouldShowPostSource(source: PostSource | undefined | null): boolean {
  if (!source) return false;
  if (source.client === 'web' && source.trigger === 'manual' && !source.viaAgent) {
    return false;
  }
  return !!postSourceLabel(source);
}
