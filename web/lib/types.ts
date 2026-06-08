export interface Author {
  wallet: string;
  twitter: string | null;
  farcaster: string | null;
  profileImage: string | null;
}

export interface SocialLinks {
  /** Token/community X account — separate from any admin personal account */
  x?: string;
  /** Beneficiary or community wallet shown on profile */
  wallet?: string;
  github?: string;
  telegram?: string;
  discord?: string;
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
  socialLinks?: SocialLinks;
  /** @deprecated use pinnedPosts */
  pinnedPostId?: string | null;
  pinnedPosts?: PinnedPost[];
  postCount: number;
  memberCount: number;
  createdAt: number;
  launchTimestamp?: number;
}

export interface Post {
  id: string;
  wallet: string;
  author: Author;
  content: string;
  reactions: Record<string, string[]>;
  timestamp: number;
  balance?: number;
}

export interface TokenLaunch {
  activityId: string;
  tokenAddress: string;
  tokenName: string;
  tokenSymbol: string;
  chain: string;
  timestamp: number;
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
