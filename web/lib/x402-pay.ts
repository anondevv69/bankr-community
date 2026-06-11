import { ChainIdToNetwork, PaymentRequirementsSchema } from 'x402/types';
import { createPaymentHeader, selectPaymentRequirements } from 'x402/client';
import type { Address } from 'viem';
import { toX402Signer } from '@/lib/x402-signer';

/** Matches bankr.x402.json price for the shared fund service ($1 USDC per request). */
export const SPACE_FUND_X402_MAX_USDC = 1;
const USDC_BASE_UNITS = BigInt(SPACE_FUND_X402_MAX_USDC * 1_000_000);

const CAIP_CHAIN_ID = /^eip155:(\d+)$/;

/** Bankr x402 v2 returns CAIP-2 networks (eip155:8453); x402 client expects short names (base). */
function normalizeX402Network(network: unknown): unknown {
  if (typeof network !== 'string') return network;
  const match = network.match(CAIP_CHAIN_ID);
  if (!match) return network;
  const chainId = Number(match[1]);
  return ChainIdToNetwork[chainId as keyof typeof ChainIdToNetwork] ?? network;
}

function normalizeAccepts(accepts: unknown[]): unknown[] {
  return accepts.map((item) => {
    if (!item || typeof item !== 'object') return item;
    const copy = { ...(item as Record<string, unknown>) };
    if ('network' in copy) {
      copy.network = normalizeX402Network(copy.network);
    }
    return copy;
  });
}

function formatPayError(data: unknown, status: number): string {
  if (data && typeof data === 'object' && 'error' in data && typeof (data as { error: unknown }).error === 'string') {
    return (data as { error: string }).error;
  }
  if (Array.isArray(data)) {
    const messages = data
      .map((item) => {
        if (item && typeof item === 'object' && 'message' in item) {
          return String((item as { message: unknown }).message);
        }
        return null;
      })
      .filter(Boolean);
    if (messages.length) return messages.join(' ');
  }
  return `Payment failed (${status})`;
}

type PayResult = {
  success?: boolean;
  raisedUsd?: number;
  goalUsd?: number;
  message?: string;
  error?: string;
};

async function proxyX402(
  tokenAddress: string,
  campaignId: string,
  amountUsd: number,
  xPayment?: string
): Promise<{ status: number; data: unknown }> {
  const res = await fetch(`/api/communities/${tokenAddress}/fundraising/x402`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ campaignId, amountUsd, xPayment }),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

export async function paySpaceFund(
  walletAddress: Address,
  tokenAddress: string,
  campaignId: string,
  amountUsd: number
): Promise<PayResult> {
  const { status, data } = await proxyX402(tokenAddress, campaignId, amountUsd);

  const body = data as {
    requiresPayment?: boolean;
    x402Version?: number;
    accepts?: unknown[];
    error?: string;
  };

  const isQuote = status === 402 || (status === 200 && body.requiresPayment);
  if (!isQuote) {
    if (status >= 400) {
      throw new Error(formatPayError(data, status));
    }
    return data as PayResult;
  }

  const { x402Version, accepts } = body;
  if (!Array.isArray(accepts) || accepts.length === 0) {
    throw new Error('No payment options returned by x402 endpoint');
  }

  let parsedPaymentRequirements;
  try {
    parsedPaymentRequirements = normalizeAccepts(accepts).map((x) =>
      PaymentRequirementsSchema.parse(x)
    );
  } catch (err) {
    throw new Error(
      err instanceof Error
        ? `Invalid x402 payment requirements: ${err.message}`
        : 'Invalid x402 payment requirements'
    );
  }

  const selected = selectPaymentRequirements(parsedPaymentRequirements, 'base', 'exact');

  if (BigInt(selected.maxAmountRequired) > USDC_BASE_UNITS) {
    throw new Error(`Payment amount exceeds maximum allowed ($${SPACE_FUND_X402_MAX_USDC} USDC)`);
  }

  const paymentHeader = await createPaymentHeader(
    toX402Signer(walletAddress),
    x402Version ?? 2,
    selected
  );

  const paid = await proxyX402(tokenAddress, campaignId, amountUsd, paymentHeader);
  if (paid.status >= 400) {
    throw new Error(formatPayError(paid.data, paid.status));
  }

  return paid.data as PayResult;
}

async function proxyAgentPoolX402(
  tokenAddress: string,
  skillId: string,
  amountUsd: number,
  xPayment?: string
): Promise<{ status: number; data: unknown }> {
  const res = await fetch(`/api/communities/${tokenAddress}/agent-pool/x402`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ skillId, amountUsd, xPayment }),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

/** Lane B — community agent pool; x402 pay-to is PLATFORM_AGENT_WALLET. */
export async function payAgentPoolFund(
  walletAddress: Address,
  tokenAddress: string,
  skillId: string,
  amountUsd: number
): Promise<PayResult> {
  const { status, data } = await proxyAgentPoolX402(tokenAddress, skillId, amountUsd);

  const body = data as {
    requiresPayment?: boolean;
    x402Version?: number;
    accepts?: unknown[];
    error?: string;
  };

  const isQuote = status === 402 || (status === 200 && body.requiresPayment);
  if (!isQuote) {
    if (status >= 400) {
      throw new Error(formatPayError(data, status));
    }
    return data as PayResult;
  }

  const { x402Version, accepts } = body;
  if (!Array.isArray(accepts) || accepts.length === 0) {
    throw new Error('No payment options returned by x402 endpoint');
  }

  let parsedPaymentRequirements;
  try {
    parsedPaymentRequirements = normalizeAccepts(accepts).map((x) =>
      PaymentRequirementsSchema.parse(x)
    );
  } catch (err) {
    throw new Error(
      err instanceof Error
        ? `Invalid x402 payment requirements: ${err.message}`
        : 'Invalid x402 payment requirements'
    );
  }

  const selected = selectPaymentRequirements(parsedPaymentRequirements, 'base', 'exact');

  if (BigInt(selected.maxAmountRequired) > USDC_BASE_UNITS) {
    throw new Error(`Payment amount exceeds maximum allowed ($${SPACE_FUND_X402_MAX_USDC} USDC)`);
  }

  const paymentHeader = await createPaymentHeader(
    toX402Signer(walletAddress),
    x402Version ?? 2,
    selected
  );

  const paid = await proxyAgentPoolX402(tokenAddress, skillId, amountUsd, paymentHeader);
  if (paid.status >= 400) {
    throw new Error(formatPayError(paid.data, paid.status));
  }

  return paid.data as PayResult;
}
