export type ParsedWorkBriefLine = {
  description: string;
  bountyUsd: number;
  category: string;
};

/** Parse `Share $SYMBOL on X — $5 — Social` style lines. */
export function parseWorkBriefLine(line: string): ParsedWorkBriefLine | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  const parts = trimmed.split(/\s*[—–-]\s*/);
  if (parts.length >= 3) {
    const bountyPart = parts[parts.length - 2].trim();
    const category = parts[parts.length - 1].trim();
    const description = parts.slice(0, -2).join(' — ').trim();
    const bountyMatch = bountyPart.match(/^\$?(\d+(?:\.\d+)?)/);
    const bountyUsd = bountyMatch ? Number(bountyMatch[1]) : NaN;
    if (description && Number.isFinite(bountyUsd) && bountyUsd > 0 && category) {
      return { description, bountyUsd, category };
    }
  }

  return null;
}

export function parseWorkBrief(text: string | null | undefined): ParsedWorkBriefLine[] {
  if (!text?.trim()) return [];
  return text
    .split('\n')
    .map(parseWorkBriefLine)
    .filter((line): line is ParsedWorkBriefLine => line != null);
}

export function applySymbolToBrief(
  text: string,
  symbol: string,
  tokenAddress: string
): string {
  const sym = symbol.replace(/^\$/, '');
  const spaceUrl = `https://www.bankr.space/community/${tokenAddress.toLowerCase()}`;
  let out = text
    .replace(/\$SYMBOL/gi, `$${sym}`)
    .replace(/\$SPACE/gi, `$${sym}`)
    .replace(/\{symbol\}/gi, `$${sym}`);
  if (!out.includes(spaceUrl)) out = `${out} ${spaceUrl}`;
  return out;
}

export function buildOxWorkAgentPrompt(options: {
  symbol: string;
  tokenAddress: string;
  workBrief: string | null;
  goalUsd: number;
}): string {
  const lines = parseWorkBrief(options.workBrief || '');
  const sym = options.symbol.replace(/^\$/, '');
  const spaceUrl = `https://www.bankr.space/community/${options.tokenAddress.toLowerCase()}`;

  if (lines.length) {
    const tasks = lines
      .map((line) => {
        const desc = applySymbolToBrief(line.description, sym, options.tokenAddress);
        return `- ${desc} — $${line.bountyUsd} USDC — ${line.category}`;
      })
      .join('\n');

    return [
      'Use the 0xwork skill on the platform agent wallet.',
      `Post these 0xWork bounties for $${sym} (one task per line):`,
      tasks,
      `Space: ${spaceUrl}`,
      'Return each created task id and 0xwork.org link.',
    ].join('\n');
  }

  const bounty = Math.max(1, Math.round(options.goalUsd));
  return [
    'Use the 0xwork skill on the platform agent wallet.',
    `Post one 0xWork Social bounty: Share $${sym} on X with screenshot — $${bounty} USDC.`,
    `Space: ${spaceUrl}`,
    'Return the task id and 0xwork.org link.',
  ].join('\n');
}

export function buildQrcoinAgentPrompt(options: {
  symbol: string;
  tokenAddress: string;
}): string {
  const sym = options.symbol.replace(/^\$/, '');
  const spaceUrl = `https://www.bankr.space/community/${options.tokenAddress.toLowerCase()}`;
  return [
    'Use the qrcoin skill on the platform agent wallet.',
    `Place a QRCoin bid listing for $${sym} with URL ${spaceUrl}.`,
    'Return transaction hash and bid details.',
  ].join('\n');
}

/** Extract 0xWork task id from Bankr agent job output. */
export function extractOxWorkTaskId(text: string): number | null {
  const patterns = [
    /0xwork\.org\/tasks\/(\d+)/i,
    /task\s*#?\s*(\d+)/i,
    /taskId["']?\s*[:=]\s*(\d+)/i,
    /"id"\s*:\s*(\d+)/,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      const id = Number(match[1]);
      if (Number.isFinite(id) && id > 0) return id;
    }
  }
  return null;
}

export function extractTxHash(text: string): string | null {
  const match = text.match(/0x[a-fA-F0-9]{64}/);
  return match?.[0] ?? null;
}
