const response = await http.fetch('https://api.bankr.bot/token-launches');
const data = response;
const launches = data.launches || [];

const existing = (await appKV.get('token_launches')) || [];
const existingIds = new Set(existing.map((l) => l.activityId));

let newCount = 0;
for (const launch of launches) {
  if (!existingIds.has(launch.activityId)) {
    existing.unshift(launch);
    existingIds.add(launch.activityId);
    newCount++;
  }
}

const sorted = existing.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

await appKV.set('token_launches', sorted);
await appKV.set('meta.syncUpdatedAt', Date.now());

return {
  ok: true,
  totalLaunches: sorted.length,
  newLaunches: newCount,
  refreshedAt: new Date().toISOString(),
};
