import { getCommunity } from './db';
import { getPetitionSpaceByToken } from './petition-spaces';
import { tmpFetchHoldersByToken, tmpGetPetitionStatus } from './tmp-petition';
import { normalizeAddr } from './utils';

export type UnitHolderStatus = {
  holds: boolean;
  units: number;
  source: 'cap_table' | 'petition_orders' | null;
};

export async function isPetitionLaunchedSpace(tokenAddress: string): Promise<boolean> {
  const community = await getCommunity(normalizeAddr(tokenAddress));
  if (community?.fromPetition) return true;
  const petition = await getPetitionSpaceByToken(tokenAddress);
  return !!petition;
}

export async function getPetitionUnitBalance(
  wallet: string,
  tokenAddress: string
): Promise<UnitHolderStatus> {
  const w = wallet.toLowerCase();
  const token = normalizeAddr(tokenAddress);

  const cap = await tmpFetchHoldersByToken(token);
  if (cap?.capTable?.holders?.length) {
    const row = cap.capTable.holders.find((h) => h.wallet.toLowerCase() === w);
    const units = row ? Number(row.units) || 0 : 0;
    return { holds: units > 0, units, source: 'cap_table' };
  }

  const petitionSpace = await getPetitionSpaceByToken(token);
  if (petitionSpace?.tmpPetitionId) {
    try {
      const status = await tmpGetPetitionStatus(petitionSpace.tmpPetitionId);
      const order = (status.petition.orders || []).find((o) => o.wallet.toLowerCase() === w);
      const units = order?.units || 0;
      return { holds: units > 0, units, source: 'petition_orders' };
    } catch {
      // fall through
    }
  }

  return { holds: false, units: 0, source: null };
}
