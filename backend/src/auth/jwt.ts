// Signs and verifies session JWTs used for guest and Google logins.
// Tokens carry userId, username, and isGuest, and expire after 30 days.
// Falls back to a dev secret if JWT_SECRET is unset (set it in prod).
// Used by the /auth routes and any route that checks a bearer token.
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
