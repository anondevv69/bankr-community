const BANKR_API = 'https://api.bankr.bot';

export function getPlatformAgentBankrApiKey(): string | null {
  const key =
    process.env.PLATFORM_AGENT_BANKR_API_KEY?.trim() ||
    process.env.BANKR_API_KEY?.trim();
  return key || null;
}

type AgentJobResponse = {
  jobId?: string;
  id?: string;
  status?: string;
  result?: string;
  output?: string;
  error?: string;
  message?: string;
};

function jobIdFrom(data: AgentJobResponse): string | null {
  const id = data.jobId || data.id;
  return id ? String(id) : null;
}

function jobText(data: AgentJobResponse): string {
  return String(data.result || data.output || data.message || '');
}

export async function submitBankrAgentPrompt(prompt: string): Promise<string> {
  const apiKey = getPlatformAgentBankrApiKey();
  if (!apiKey) {
    throw new Error('PLATFORM_AGENT_BANKR_API_KEY (or BANKR_API_KEY) not configured');
  }

  const res = await fetch(`${BANKR_API}/agent/prompt`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey,
    },
    body: JSON.stringify({ prompt }),
  });

  const data = (await res.json().catch(() => ({}))) as AgentJobResponse & {
    error?: string;
  };

  if (!res.ok) {
    throw new Error(data.error || `Bankr agent prompt failed (${res.status})`);
  }

  const jobId = jobIdFrom(data);
  if (!jobId) {
    throw new Error('Bankr agent prompt returned no jobId');
  }

  return jobId;
}

export async function pollBankrAgentJob(
  jobId: string,
  options?: { maxAttempts?: number; delayMs?: number }
): Promise<{ status: string; text: string }> {
  const apiKey = getPlatformAgentBankrApiKey();
  if (!apiKey) {
    throw new Error('PLATFORM_AGENT_BANKR_API_KEY (or BANKR_API_KEY) not configured');
  }

  const maxAttempts = options?.maxAttempts ?? 45;
  const delayMs = options?.delayMs ?? 2000;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const res = await fetch(`${BANKR_API}/agent/job/${encodeURIComponent(jobId)}`, {
      headers: { 'X-API-Key': apiKey },
      cache: 'no-store',
    });

    const data = (await res.json().catch(() => ({}))) as AgentJobResponse;
    if (!res.ok) {
      throw new Error(data.error || `Bankr job poll failed (${res.status})`);
    }

    const status = String(data.status || 'unknown').toLowerCase();
    const text = jobText(data);

    if (status === 'completed' || status === 'complete' || status === 'succeeded') {
      return { status, text };
    }
    if (status === 'failed' || status === 'cancelled' || status === 'canceled') {
      throw new Error(text || `Bankr agent job ${status}`);
    }

    await new Promise((r) => setTimeout(r, delayMs));
  }

  throw new Error(`Bankr agent job timed out (${jobId})`);
}

export async function runBankrAgentPrompt(prompt: string): Promise<string> {
  const jobId = await submitBankrAgentPrompt(prompt);
  const result = await pollBankrAgentJob(jobId);
  return result.text;
}
