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

export interface BeneficiaryInfo {
  wallet: string;
  xUsername: string | null;
  xUrl: string | null;
  profileImageUrl: string | null;
  walletUrl: string;
}

export interface PinnedPost {
  postId: string;
  pinnedAt: number;
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
  description: string;
  /** Bankr launch image (ipfs://…), stored at create time when available */
  imageUri?: string | null;
  /** Resolved HTTPS URL for UI — set by API responses, not persisted */
  imageUrl?: string | null;
  /** Beneficiary custom banner (https or ipfs://) */
  customBannerUrl?: string | null;
  /** When true and no custom banner, use DexScreener profile header */
  useDexBanner?: boolean;
  /** Resolved banner for UI — custom wins, then Dex if opted in */
  bannerUrl?: string | null;
  socialLinks?: SocialLinks;
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
