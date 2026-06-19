export interface User {
  id: string;
  createdAt: string;
  teslaAccessToken?: string;
  teslaRefreshToken?: string;
  teslaTokenExpiresAt?: string;
}

export interface Passkey {
  id: string;
  userId: string;
  credentialId: string;
  publicKey: string;
  counter: number;
  deviceType?: string;
  backedUp?: boolean;
  transports?: string;
  createdAt: string;
  lastUsedAt?: string;
}

export interface Challenge {
  id: string;
  challenge: string;
  userId?: string;
  expiresAt: string;
  ttl: number;
}
