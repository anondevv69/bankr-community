'use client';

import { useCallback, useEffect, useState } from 'react';
import { Header, Footer } from '@/components/Header';
import { useEmbeddedBankr } from '@/components/EmbeddedBankrProvider';
import { useAppWallet } from '@/hooks/useAppWallet';
import { CommunityCard } from '@/components/CommunityCard';
import { PetitionCard } from '@/components/PetitionCard';
import { CreateCommunity } from '@/components/CreateCommunity';
import { isNativeSpaceCommunity } from '@/lib/featured-community';
import { isSiteAdminWallet } from '@/lib/site-admin';
import { apiFetch } from '@/lib/wagmi';
import type { Community, PetitionSpace, TokenMarketStats } from '@/lib/types';

type SpaceFilter = 'all' | 'petition' | 'verified' | 'unverified';

const SPACE_FILTERS: Array<{ id: SpaceFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'petition', label: 'Petition' },
  { id: 'verified', label: 'Verified' },
  { id: 'unverified', label: 'Unverified' },
];

export default function HomePage() {
  const [communities, setCommunities] = useState<Community[]>([]);
  const [petitions, setPetitions] = useState<PetitionSpace[]>([]);
  const [markets, setMarkets] = useState<Record<string, TokenMarketStats>>({});
  const [syncAt, setSyncAt] = useState<number | null>(null);
  const [filter, setFilter] = useState('');
  const [spaceFilter, setSpaceFilter] = useState<SpaceFilter>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingAddress, setDeletingAddress] = useState<string | null>(null);
  const embed = useEmbeddedBankr();
  const { address, isConnected } = useAppWallet();
  const isSiteAdmin = isConnected && isSiteAdminWallet(address);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [commRes, petRes] = await Promise.all([
        fetch('/api/communities'),
        fetch('/api/petitions'),
      ]);
      const data = await commRes.json();
      const petData = petRes.ok ? await petRes.json() : { petitions: [] };
      if (!commRes.ok) throw new Error(data.error || 'Failed to load');
      setCommunities(data.communities || []);
      setPetitions(petData.petitions || []);
      setSyncAt(data.syncUpdatedAt || null);

      const list: Community[] = data.communities || [];
      if (list.length > 0) {
        const addresses = list.map((c) => c.tokenAddress).join(',');
        fetch(`/api/market?addresses=${addresses}`)
          .then((marketRes) => marketRes.json())
          .then((marketData) => setMarkets(marketData.markets || {}))
          .catch(() => setMarkets({}));
      } else {
        setMarkets({});
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load spaces');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleDeleteSpace(tokenAddress: string) {
    if (!address || !isSiteAdminWallet(address)) return;
    const community = communities.find(
      (c) => c.tokenAddress.toLowerCase() === tokenAddress.toLowerCase()
    );
    if (!community) return;
    if (
      !window.confirm(
        `Delete the $${community.symbol} space and all its posts? This cannot be undone.`
      )
    ) {
      return;
    }
    setDeletingAddress(tokenAddress);
    try {
      await apiFetch(`/api/communities/${tokenAddress}`, {
        method: 'DELETE',
        wallet: address,
      });
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setDeletingAddress(null);
    }
  }

  const matchesSearch = (text: string, symbol: string, extra?: string) => {
    if (!filter.trim()) return true;
    const q = filter.toLowerCase().replace(/\s+/g, '');
    return (
      text.toLowerCase().replace(/\s+/g, '').includes(q) ||
      symbol.toLowerCase().includes(q) ||
      (extra?.toLowerCase().includes(q) ?? false)
    );
  };

  const matchesCommunityTab = (c: Community) => {
    if (spaceFilter === 'verified') return c.verified;
    if (spaceFilter === 'unverified') return !c.verified;
    if (spaceFilter === 'petition') return false;
    return true;
  };

  const openPetitions = petitions.filter(
    (p) => p.phase === 'petition' || p.phase === 'finalizing'
  );

  const filteredPetitions = openPetitions.filter((p) =>
    matchesSearch(p.tokenName, p.tokenSymbol, p.tmpPetitionId)
  );

  const featured = communities.find((c) => isNativeSpaceCommunity(c.tokenAddress));
  const featuredVisible =
    spaceFilter !== 'petition' && !!featured && matchesSearch(featured.name, featured.symbol, featured.tokenAddress);

  const tabFiltered = communities.filter(
    (c) =>
      matchesSearch(c.name, c.symbol, c.tokenAddress) && matchesCommunityTab(c)
  );

  const withoutFeatured = tabFiltered.filter(
    (c) => !isNativeSpaceCommunity(c.tokenAddress)
  );

  const displayList =
    featuredVisible && featured
      ? [featured, ...withoutFeatured]
      : tabFiltered;

  const showPetitions = spaceFilter === 'petition';
  const showCommunities = spaceFilter !== 'petition';
  const gridEmpty =
    (showCommunities ? displayList.length : 0) + (showPetitions ? filteredPetitions.length : 0) ===
    0;

  return (
    <div className={`max-w-[1100px] mx-auto px-5 pb-16 ${embed.isEmbedded ? 'pt-4' : ''}`}>
      <Header syncUpdatedAt={syncAt} />

      <section>
        <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
          <div>
            <div className="text-lg font-semibold">Spaces</div>
            <div className="text-sm text-muted">Browse token spaces and pre-launch petitions</div>
          </div>
          <CreateCommunity communities={communities} onCreated={load} />
        </div>

        <input
          className="w-full px-4 py-3 bg-surface border border-border rounded-xl text-sm mb-4"
          placeholder="Search spaces by name, ticker, or contract…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />

        <div className="flex flex-wrap gap-1 p-1 bg-surface-2 border border-border rounded-xl mb-5 w-fit">
          {SPACE_FILTERS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSpaceFilter(item.id)}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                spaceFilter === item.id
                  ? 'bg-surface text-text shadow-sm border border-border'
                  : 'text-muted hover:text-text'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-muted text-sm">Loading spaces…</p>
        ) : error ? (
          <div className="text-red-400 text-sm p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
            {error}
          </div>
        ) : gridEmpty ? (
          <p className="text-muted text-sm p-8 text-center border border-dashed border-border rounded-xl">
            {spaceFilter === 'petition'
              ? 'No open petitions — click Create Space → Petition to start one.'
              : communities.length === 0 && openPetitions.length === 0
                ? 'No spaces yet. Click Create Space to start a token space or petition.'
                : 'No spaces match your search or filter.'}
          </p>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
            {showPetitions
              ? filteredPetitions.map((p) => <PetitionCard key={p.tmpPetitionId} petition={p} />)
              : null}
            {showCommunities
              ? displayList.map((c) => (
                  <CommunityCard
                    key={c.tokenAddress}
                    community={c}
                    market={markets[c.tokenAddress.toLowerCase()] || null}
                    featured={isNativeSpaceCommunity(c.tokenAddress)}
                    canDelete={isSiteAdmin}
                    onDelete={handleDeleteSpace}
                    deleting={deletingAddress === c.tokenAddress}
                  />
                ))
              : null}
          </div>
        )}
      </section>

      <Footer />
    </div>
  );
}
