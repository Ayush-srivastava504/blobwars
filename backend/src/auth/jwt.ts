import jwt from "jsonwebtoken";

const SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const EXPIRES_IN = "30d";

export interface SessionTokenPayload {
  userId: string;
  username: string;
  isGuest: boolean;
}

export function signSessionToken(payload: SessionTokenPayload): string {
  return jwt.sign(payload, SECRET, { expiresIn: EXPIRES_IN });
}

export function verifySessionToken(token: string): SessionTokenPayload | null {
  try {
    return jwt.verify(token, SECRET) as SessionTokenPayload;
  } catch {
    return null;
  }
}
