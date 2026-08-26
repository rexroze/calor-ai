/**
 * VAPID key management for web-push.
 *
 * Keys MUST be set as env vars:
 *   VAPID_PUBLIC_KEY   – base64url-encoded public key
 *   VAPID_PRIVATE_KEY  – base64url-encoded private key
 *   VAPID_SUBJECT      – mailto: or https: contact for the push service
 *
 * On the server the keys are consumed by the `web-push` library; on the
 * client the public key is fetched from /api/push/vapid.
 */

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(
      `[push/keys] Missing required env var ${name}. ` +
        "Add VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, and VAPID_SUBJECT to your .env.local.",
    );
  }
  return v;
}

/**
 * Returns the VAPID details object expected by `web-push.setVapidDetails()`.
 * Throws if any of the three required env vars are missing.
 */
export function getVapidDetails() {
  return {
    publicKey: requireEnv("VAPID_PUBLIC_KEY"),
    privateKey: requireEnv("VAPID_PRIVATE_KEY"),
    subject: requireEnv("VAPID_SUBJECT"),
  };
}

/**
 * Returns only the public key (for the GET /api/push/vapid response).
 * Throws only if the public key is missing.
 */
export function getVapidPublicKey(): string {
  return requireEnv("VAPID_PUBLIC_KEY");
}
