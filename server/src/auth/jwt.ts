import { SignJWT, jwtVerify } from 'jose';

const ACCESS_TTL = '30d';

export interface TokenClaims {
  sub: string; // user id
}

export async function signAccessToken(secret: string, userId: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setIssuer('kilibik')
    .setExpirationTime(ACCESS_TTL)
    .sign(new TextEncoder().encode(secret));
}

export async function verifyAccessToken(secret: string, token: string): Promise<TokenClaims | null> {
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), { issuer: 'kilibik' });
    if (!payload.sub) return null;
    return { sub: payload.sub };
  } catch {
    return null;
  }
}
