export interface Author {
  wallet: string;
  twitter: string | null;
  farcaster: string | null;
  profileImage: string | null;
}

export interface CustomSocialLink {
  title: string;
  url: string;
}

export type StandardSocialLinkKey = 'x' | 'website' | 'github' | 'telegram' | 'discord';

export interface SocialLinks {
  /** Token/community X account — separate from beneficiary personal X on Bankr */
  x?: string;
  website?: string;
  github?: string;
  telegram?: string;
  discord?: string;
  /** Additional labeled links (title + URL) beyond the standard fields */
  custom?: CustomSocialLink[];
}

export interface WalletAgentMeta {
  wallet?: string;
  isAgentWallet: boolean;
  agentId: string | null;
  agentType: string | null;
  agentLabel: string | null;
  platform?: string | null;
  source?: 'known-registry' | 'handle-heuristic' | 'bankr-resolve' | 'manual' | 'none';
  resolvedAt?: number;
}

export interface TrustedDelegateEntry {
  wallet: string;
  agent?: WalletAgentMeta | null;
}

export interface BeneficiaryInfo {
  wallet: string;
  xUsername: string | null;
  xUrl: string | null;
  profileImageUrl: string | null;
  walletUrl: string;
  agent?: WalletAgentMeta | null;
}

export interface PinnedPost {
  postId: string;
  pinnedAt: number;
}

export type FundraisingCampaignId = 'dex-profile' | 'dex-boost' | 'custom';

export interface FundraisingCampaign {
  id: FundraisingCampaignId;
  label: string;
  goalUsd: number;
  raisedUsd: number;
  enabled: boolean;
}

export interface FundraisingState {
  /** Set true only when beneficiary saves with at least one campaign enabled. */
  optedIn?: boolean;
  campaigns: FundraisingCampaign[];
}

/** Bankr Skills the community agent may run after Lane B x402 pool is matched. */
export type AgentPoolSkillId = 'qrcoin' | '0xwork';

/** Community-funded agent goal (x402 → platform agent wallet). */
export interface AgentPoolCampaign {
  skillId: AgentPoolSkillId;
  label: string;
  goalUsd: number;
  raisedUsd: number;
  enabled: boolean;
  /** Set when the platform worker reports skill execution. */
  executedAt?: number | null;
  executionNote?: string | null;
}

export interface AgentPoolState {
  optedIn?: boolean;
  campaigns: AgentPoolCampaign[];
}

export interface Community {
  tokenAddress: string;
  name: string;
  symbol: string;
  chain: string;
  founderWallet: string;
  ownerWallet: string;
  verified: boolean;
  verifiedAt: number | null;
  verifiedBy: string | null;
  /** After verify: fee recipient may grant deployer profile/pin/post access (not fundraising) */
  allowDeployerEdit?: boolean;
  /** After verify: fee recipient may grant profile/pin/post to trusted wallets (max 3) */
  trustedDelegates?: TrustedDelegateEntry[];
  /** Cached agent classification for fee recipient wallet */
  feeRecipientAgent?: WalletAgentMeta | null;
  /** Fee recipient opts in to Bankr Space platform agent (cross-space moderator) */
  usePlatformAgent?: boolean;
  /** Fee recipient authorizes platform agent to run skill-linked fundraisers when funded */
  platformAgentSkills?: boolean;
  /** Holder posts containing these phrases (case-insensitive) are rejected */
  blockedKeywords?: string[];
  description: string;
  /** Bankr launch image (ipfs://…), stored at create time when available */
  imageUri?: string | null;
  /** Resolved HTTPS URL for UI — set by API responses, not persisted */
  imageUrl?: string | null;
  /** Beneficiary custom icon (https or ipfs://) */
  customIconUrl?: string | null;
  /** Beneficiary custom banner (https or ipfs://) */
  customBannerUrl?: string | null;
  /** When true (default), use Bankr launch image when no custom icon */
  useBankrImage?: boolean;
  /** When true (default), use DexScreener icon when available */
  useDexIcon?: boolean;
  /** When true (default), use DexScreener header when no custom banner */
  useDexBanner?: boolean;
  /** When true (default), use Dex profile description until beneficiary edits */
  useDexDescription?: boolean;
  /** When true (default), merge Dex profile links into displayed socials */
  useDexLinks?: boolean;
  /** IPFS URIs pinned from Bankr/Dex sync */
  pinnedBankrIconUri?: string | null;
  pinnedDexIconUri?: string | null;
  pinnedDexBannerUri?: string | null;
  /** Last seen Dex CDN URLs (fallback when Pinata unavailable) */
  dexIconSrc?: string | null;
  dexBannerSrc?: string | null;
  dexDescription?: string | null;
  dexSocialLinks?: SocialLinks;
  profileSyncMeta?: {
    bankrIconSrc?: string | null;
    dexIconSrc?: string | null;
    dexBannerSrc?: string | null;
    syncedAt?: number;
  };
  /** Resolved banner for UI */
  bannerUrl?: string | null;
  /** Merged social links for display (Dex + manual) — API only, not persisted */
  displaySocialLinks?: SocialLinks;
  socialLinks?: SocialLinks;
  /** Optional USDC fundraise campaigns (Dex profile, boost, custom) */
  fundraising?: FundraisingState;
  /** Lane B — community x402 pool for platform agent skills (QRCoin, 0xWork) */
  agentPool?: AgentPoolState;
  /** @deprecated use pinnedPosts */
  pinnedPostId?: string | null;
  pinnedPosts?: PinnedPost[];
  postCount: number;
  memberCount: number;
  createdAt: number;
  launchTimestamp?: number;
}

export interface PostSource {
  client: 'web' | 'bankr-app' | 'agent' | 'api';
  trigger?: 'manual' | 'x-dm' | 'x-mention' | 'x-reply' | 'terminal' | 'autopilot';
  viaAgent?: boolean;
  agentId?: string;
  externalRef?: string;
}

export interface Post {
  id: string;
  wallet: string;
  author: Author;
  content: string;
  reactions: Record<string, string[]>;
  timestamp: number;
  balance?: number;
  source?: PostSource;
  /** Set when this is a direct reply to a top-level post (one level only). */
  parentPostId?: string | null;
}

export interface TokenLaunch {
  activityId: string;
  tokenAddress: string;
  tokenName: string;
  tokenSymbol: string;
  chain: string;
  timestamp: number;
  imageUri?: string | null;
  imageUrl?: string | null;
  feeRecipient?: {
    walletAddress?: string;
    xUsername?: string;
    xProfileImageUrl?: string;
  };
  deployer?: {
    walletAddress?: string;
    xUsername?: string;
    xProfileImageUrl?: string;
  };
}

export interface UserProfile extends Author {
  updatedAt?: number;
}

export interface TokenMarketStats {
  tokenAddress: string;
  chainId: string;
  found: boolean;
  marketCap: number | null;
  fdv: number | null;
  priceUsd: number | null;
  volume24h: number | null;
  priceChange24h: number | null;
  liquidityUsd: number | null;
  txns24h: { buys: number; sells: number } | null;
  dexUrl: string | null;
  bannerUrl: string | null;
  iconUrl: string | null;
  dexScreener: {
    enhancedInfoPaid: boolean;
    enhancedInfoStatus: string | null;
    boostActive: boolean;
  };
  fetchedAt: number;
}
