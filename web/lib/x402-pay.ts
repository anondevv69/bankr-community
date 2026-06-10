import { ChainIdToNetwork, PaymentRequirementsSchema } from 'x402/types';
import { createPaymentHeader, selectPaymentRequirements } from 'x402/client';
import type { Address } from 'viem';
import { toX402Signer } from '@/lib/x402-signer';

/** Matches bankr.x402.json price for space-fund ($1 USDC per request). */
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

export async function paySpaceFundUrl(walletAddress: Address, fundUrl: string) {
  const response = await fetch(fundUrl);
  if (response.status !== 402) {
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(formatPayError(data, response.status));
    }
    return data as {
      success?: boolean;
      raisedUsd?: number;
      goalUsd?: number;
      message?: string;
      error?: string;
    };
  }

  const body = await response.json();
  const { x402Version, accepts } = body as { x402Version?: number; accepts?: unknown[] };
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

  const paidResponse = await fetch(fundUrl, {
    headers: {
      'X-PAYMENT': paymentHeader,
      'Access-Control-Expose-Headers': 'X-PAYMENT-RESPONSE',
    },
  });

  const data = await paidResponse.json().catch(() => ({}));
  if (!paidResponse.ok) {
    throw new Error(formatPayError(data, paidResponse.status));
  }

  return data as {
    success?: boolean;
    raisedUsd?: number;
    goalUsd?: number;
    message?: string;
    error?: string;
  };
}
