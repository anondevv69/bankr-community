const SITE = 'https://bankr.space';

const caller = ctx.caller || {};
const wallet = caller.walletAddress ? String(caller.walletAddress).toLowerCase() : '';
if (!wallet) {
  return { ok: false, error: 'Sign in with Bankr required' };
}

const rawPath = String(args.path || '').trim();
if (!rawPath.startsWith('/api/')) {
  return { ok: false, error: 'path must start with /api/' };
}

const method = String(args.method || 'POST').toUpperCase();
const body = args.body;

const headers = {
  'x-wallet-address': wallet,
  'Content-Type': 'application/json',
  'x-client': args.client ? String(args.client).toLowerCase() : 'bankr-app',
};

if (args.trigger) headers['x-post-trigger'] = String(args.trigger);
if (args.agentId) headers['x-agent-id'] = String(args.agentId);
if (args.externalRef) headers['x-external-ref'] = String(args.externalRef);

try {
  const data = await http.fetch(SITE + rawPath, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return { ok: true, data };
} catch (err) {
  log('apiWrite failed', rawPath, err);
  return {
    ok: false,
    error: err && err.message ? String(err.message) : 'Request failed',
  };
}
