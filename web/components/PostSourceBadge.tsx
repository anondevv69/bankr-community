import type { PostSource } from '@/lib/types';
import { postSourceLabel, shouldShowPostSource } from '@/lib/post-source';

export function PostSourceBadge({ source }: { source?: PostSource | null }) {
  if (!shouldShowPostSource(source)) return null;

  const label = postSourceLabel(source);
  if (!label) return null;

  return (
    <div className="text-[11px] text-muted mt-2 pl-[52px]">{label}</div>
  );
}
