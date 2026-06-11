const OXWORK_API = 'https://api.0xwork.org';

export type OxWorkTask = {
  id: number;
  chain_task_id: number | null;
  poster_address: string;
  description: string;
  category: string;
  bounty_amount: string;
  status: string;
  created_at: string;
  title: string | null;
  poster_agent_name: string | null;
  application_count: number;
  attempt_count: number;
  hire_type: string;
  require_approval: number;
};

export type OxWorkTasksResponse = {
  tasks: OxWorkTask[];
  total: number;
  posterWallet: string;
  symbol: string;
  spaceUrl: string;
};

function matchesSpace(task: OxWorkTask, symbol: string, tokenAddress: string): boolean {
  const hay = `${task.title || ''} ${task.description}`.toLowerCase();
  const sym = symbol.toLowerCase().replace(/^\$/, '');
  const token = tokenAddress.toLowerCase();
  return (
    hay.includes(sym) ||
    hay.includes(token) ||
    hay.includes(`$${sym}`) ||
    hay.includes(`bankr.space/community/${token}`)
  );
}

export async function fetchOxWorkTasksForSpace(options: {
  posterWallets: string[];
  symbol: string;
  tokenAddress: string;
}): Promise<OxWorkTasksResponse> {
  const posters = [
    ...new Set(
      options.posterWallets
        .map((w) => w.trim().toLowerCase())
        .filter((w) => w.startsWith('0x') && w.length === 42)
    ),
  ];
  const primaryPoster = posters[0] || '';
  const spaceUrl = `https://bankr.space/community/${options.tokenAddress.toLowerCase()}`;

  const tasksById = new Map<number, OxWorkTask>();

  for (const poster of posters) {
    try {
      const res = await fetch(
        `${OXWORK_API}/tasks?poster=${encodeURIComponent(poster)}&status=open&limit=50`,
        { next: { revalidate: 60 } }
      );
      if (!res.ok) continue;
      const data = (await res.json()) as { tasks?: OxWorkTask[] };
      for (const task of data.tasks || []) {
        if (
          task.poster_address?.toLowerCase() === poster ||
          matchesSpace(task, options.symbol, options.tokenAddress)
        ) {
          tasksById.set(task.id, task);
        }
      }
    } catch {
      // try next poster
    }
  }

  const tasks = [...tasksById.values()].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return {
    tasks,
    total: tasks.length,
    posterWallet: primaryPoster,
    symbol: options.symbol,
    spaceUrl,
  };
}

export function oxWorkTaskUrl(taskId: number): string {
  return `https://0xwork.org/tasks/${taskId}`;
}
