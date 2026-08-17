// Docs: @docs/4.agents/2.pi-agent/6.storage-and-api-keys.md
/**
 * The device's own authenticator, as a source of one key.
 *
 * WebAuthn's `prf` extension is the whole of it: an authenticator that carries
 * `hmac-secret` — a TPM, a Secure Enclave, Windows Hello — answers a salt with
 * 32 bytes it alone can produce, and produces the same 32 bytes for the same
 * salt every time. That is a key that never existed in the browser's storage and
 * never leaves the chip: it is asked for, with the person's finger or face in
 * front of it, and it is gone again when the tab closes.
 *
 * So nothing here is stored but a credential id and a salt, neither of them
 * secret. The bytes are run through HKDF into an AES-GCM key, non-extractable
 * like the device key beside it, and `secret.ts` seals with it exactly as it
 * seals with the other one.
 *
 * Two things this cannot do. It cannot be asked without a gesture — Chrome wants
 * a transient activation for `get()`, which is why the chat unlocks on a click
 * and never on a load. And it cannot be recovered: a passkey the person deletes
 * takes the keys sealed under it with it, which is what re-typing a key is for.
 */

/** What the browser lists the credential under, where a host names nothing. */
const DEFAULT_NAME = "Agentak keys";

/**
 * Bound into the derivation, so the same authenticator answering the same salt
 * gives this and nothing else. A second use of the same passkey would carry its
 * own `info` and get a key of its own.
 */
const INFO = "agentak:secret-key:v1";

const CHALLENGE_BYTES = 32;
const SALT_BYTES = 32;
const USER_BYTES = 16;

/** A minute is what an OS dialog is worth: past that, nobody is at the machine. */
const TIMEOUT = 60_000;

/** The credential this browser derives with. Neither field is a secret. */
export interface PasskeyRecord {
  /** Which credential to ask. Stored, because the passkey need not be discoverable. */
  credentialId: Uint8Array<ArrayBuffer>;
  /** What it is asked. One salt, one key — see `INFO` above. */
  salt: Uint8Array<ArrayBuffer>;
}

export interface PasskeyOptions {
  /** What the browser and the OS call it in their own lists of passkeys. */
  name?: string;
}

const random = (length: number) => globalThis.crypto.getRandomValues(new Uint8Array(length));

/**
 * Whether this browser can hold a key in its own hardware.
 *
 * `getClientCapabilities()` is the only answer worth trusting — it names the
 * extension, which is the part that matters and the part that lagged the
 * authenticator by years. Where the browser is too old to answer that, a
 * user-verifying platform authenticator is taken as a maybe: the setup itself
 * checks `prf.enabled` before anything is sealed, so a wrong maybe costs one
 * dialog rather than a lost key.
 */
export async function passkeySupported(): Promise<boolean> {
  const api = globalThis.PublicKeyCredential;
  if (!api || !globalThis.navigator?.credentials) return false;
  try {
    const capabilities = await api.getClientCapabilities?.();
    if (capabilities) return capabilities["extension:prf"] === true;
    return await api.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false; // an api that throws is one this browser does not really have
  }
}

/**
 * The 32 bytes as a key. HKDF rather than the bytes themselves, because a PRF
 * output is input material and not a key: `INFO` binds what comes out to this
 * one use of this one credential.
 */
async function toKey(material: BufferSource): Promise<CryptoKey> {
  const input = await globalThis.crypto.subtle.importKey("raw", material, "HKDF", false, [
    "deriveKey",
  ]);
  return globalThis.crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: new Uint8Array(),
      info: new TextEncoder().encode(INFO),
    },
    input,
    { name: "AES-GCM", length: 256 },
    false, // the key this browser holds is one nothing exports
    ["encrypt", "decrypt"],
  );
}

const prfResult = (credential: PublicKeyCredential): BufferSource | undefined =>
  credential.getClientExtensionResults().prf?.results?.first;

/**
 * Register a passkey for this origin and derive the key it stands for.
 *
 * The credential is asked to be the platform's own and to verify the person,
 * which is what puts the derivation behind a finger rather than behind a tab. It
 * is not asked to be discoverable: nobody signs in with it, so the id is kept
 * here and handed back on every ask, and no resident slot is spent on a device
 * that counts them.
 *
 * Newer browsers answer the salt at creation and older ones only at assertion,
 * so both are tried, in that order. The second lands on the same click as the
 * first in every browser that has been tried; where an activation has gone, the
 * caller is told and the person clicks unlock once more.
 */
export async function createPasskey(
  options: PasskeyOptions = {},
): Promise<{ record: PasskeyRecord; key: CryptoKey }> {
  const name = options.name ?? DEFAULT_NAME;
  const salt = random(SALT_BYTES);

  const credential = (await globalThis.navigator.credentials.create({
    publicKey: {
      attestation: "none", // nobody is verifying this credential, only using it
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        residentKey: "discouraged",
        userVerification: "required",
      },
      challenge: random(CHALLENGE_BYTES),
      // The salt is evaluated here where the browser allows it. An empty object
      // is the ask that turns the extension on at all.
      extensions: { prf: { eval: { first: salt } } },
      pubKeyCredParams: [
        { alg: -7, type: "public-key" }, // ES256
        { alg: -257, type: "public-key" }, // RS256, for authenticators without EC
      ],
      rp: { name },
      timeout: TIMEOUT,
      user: { displayName: name, id: random(USER_BYTES), name },
    },
  })) as PublicKeyCredential | null;

  if (!credential) throw new Error("No passkey was created.");

  const record: PasskeyRecord = { credentialId: new Uint8Array(credential.rawId), salt };
  const extensions = credential.getClientExtensionResults();
  // An authenticator without `hmac-secret` registers happily and answers no
  // salt. Saying so here is the difference between a person told this device
  // cannot do it and a person whose keys will not open tomorrow.
  if (extensions.prf?.enabled === false) {
    throw new Error("This device cannot hold a key of its own.");
  }

  const first = prfResult(credential);
  if (first) return { key: await toKey(first), record };
  return { key: await derivePasskey(record), record };
}

/**
 * Ask the authenticator for the key again. This is the ceremony: the OS dialog,
 * the finger, and 32 bytes back.
 *
 * It needs a transient user activation, so it is called from a click and never
 * from a load. A person who dismisses the dialog gets a `NotAllowedError`, which
 * is a refusal and not a failure — the caller leaves the keys locked and the
 * chat where it is.
 */
export async function derivePasskey(record: PasskeyRecord): Promise<CryptoKey> {
  const assertion = (await globalThis.navigator.credentials.get({
    publicKey: {
      allowCredentials: [{ id: record.credentialId, type: "public-key" }],
      challenge: random(CHALLENGE_BYTES),
      extensions: { prf: { eval: { first: record.salt } } },
      timeout: TIMEOUT,
      userVerification: "required",
    },
  })) as PublicKeyCredential | null;

  const first = assertion ? prfResult(assertion) : undefined;
  if (!first) throw new Error("This device did not answer with a key.");
  return toKey(first);
}

/**
 * What went wrong, worded for the person who clicked.
 *
 * A dismissed dialog is the common one and it is not a failure — it is an
 * answer, and the words say so rather than reporting an exception nobody asked
 * for. The rest keep their own message: a browser that refuses for its own
 * reason says why better than a guess would.
 */
export function passkeyFailure(error: unknown): string {
  const name = error instanceof DOMException ? error.name : "";
  if (name === "NotAllowedError") return "This device did not confirm it.";
  if (name === "InvalidStateError") return "This device already holds a passkey for these keys.";
  if (name === "NotSupportedError" || name === "SecurityError") {
    return "This browser cannot hold a key of its own here.";
  }
  return error instanceof Error ? error.message : "Something went wrong.";
}
