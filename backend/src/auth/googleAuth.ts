// Verifies Google Identity Services ID tokens sent from the frontend.
// Never trusts a client-asserted identity; validates the token's
// signature and audience against Google servers before extracting profile.
// Used by the /auth/google HTTP route.
import { OAuth2Client } from "google-auth-library";

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export interface GoogleProfile {
  googleId: string;
  email: string;
  name: string;
  avatarUrl?: string;
}

export async function verifyGoogleIdToken(idToken: string): Promise<GoogleProfile | null> {
  if (!process.env.GOOGLE_CLIENT_ID) {
    throw new Error("GOOGLE_CLIENT_ID not configured on backend");
  }
  const ticket = await client.verifyIdToken({
    idToken,
    audience: process.env.GOOGLE_CLIENT_ID,
  });
  const payload = ticket.getPayload();
  if (!payload || !payload.sub || !payload.email) return null;

  return {
    googleId: payload.sub,
    email: payload.email,
    name: payload.name ?? payload.email.split("@")[0],
    avatarUrl: payload.picture,
  };
}
