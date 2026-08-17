/**
 * A platform authenticator, faked well enough to answer a PRF.
 *
 * The one property the real thing has that matters here is that the same
 * credential answers the same salt with the same bytes, and answers nothing
 * anybody else can reproduce. HMAC over a secret that never leaves this object
 * is exactly that, so a test can seal with it, throw the vault away, and check
 * that unlocking reads the value back.
 *
 * What it does not fake is the dialog. A refusal is a `NotAllowedError`, which
 * is what a browser throws when the person dismisses one.
 */

export interface FakeAuthenticator {
  /** Answer the next ceremony with a refusal, exactly as a dismissed dialog does. */
  refuse(): void;
  /** Take it back: the person clicks again and this time they confirm. */
  allow(): void;
  /** Forget every credential — a passkey deleted from the device's own list. */
  wipe(): void;
  /** How many times the dialog was opened. */
  ceremonies(): number;
  restore(): void;
}

export interface FakeAuthenticatorOptions {
  /** Whether the authenticator carries `hmac-secret` at all. */
  prf?: boolean;
  /** Whether it answers the salt at creation, as newer browsers do. */
  atCreate?: boolean;
  /** Whether the browser answers `getClientCapabilities()`. */
  capabilities?: boolean;
}

const define = (name: string, value: unknown) => {
  Object.defineProperty(globalThis, name, { configurable: true, value, writable: true });
};

const defineOn = (target: object, name: string, value: unknown) => {
  Object.defineProperty(target, name, { configurable: true, value, writable: true });
};

/** The chip's own secret. One per authenticator, never handed out. */
const deviceSecret = () => globalThis.crypto.getRandomValues(new Uint8Array(32));

export function fakeAuthenticator(options: FakeAuthenticatorOptions = {}): FakeAuthenticator {
  const { atCreate = false, capabilities = true, prf = true } = options;
  const held = {
    credentials: globalThis.navigator.credentials as unknown,
    publicKeyCredential: globalThis.PublicKeyCredential as unknown,
  };

  let secret = deviceSecret();
  let known = new Set<string>();
  let refusing = false;
  let count = 0;

  const asBytes = (source: BufferSource): Uint8Array =>
    source instanceof ArrayBuffer ? new Uint8Array(source) : new Uint8Array(source.buffer);

  const name = (id: BufferSource) => [...asBytes(id)].join(",");

  /** The credential's answer to a salt: this device's, and nobody else's. */
  const evaluate = async (id: Uint8Array, salt: BufferSource): Promise<ArrayBuffer> => {
    const key = await globalThis.crypto.subtle.importKey(
      "raw",
      secret,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const message = new Uint8Array([...id, ...asBytes(salt)]);
    return globalThis.crypto.subtle.sign("HMAC", key, message);
  };

  const ceremony = () => {
    count += 1;
    if (refusing) throw new DOMException("The operation was refused.", "NotAllowedError");
  };

  const credentials = {
    async create(request: CredentialCreationOptions) {
      ceremony();
      const id = globalThis.crypto.getRandomValues(new Uint8Array(16));
      known.add(name(id));
      const salt = request.publicKey?.extensions?.prf?.eval?.first;
      const results = prf && atCreate && salt ? { first: await evaluate(id, salt) } : undefined;
      return {
        rawId: id.buffer,
        getClientExtensionResults: () => ({ prf: { enabled: prf, results } }),
      };
    },

    async get(request: CredentialRequestOptions) {
      ceremony();
      const allowed = request.publicKey?.allowCredentials?.[0]?.id;
      const salt = request.publicKey?.extensions?.prf?.eval?.first;
      if (!allowed || !known.has(name(allowed))) {
        throw new DOMException("No such credential.", "NotAllowedError");
      }
      const results = prf && salt ? { first: await evaluate(asBytes(allowed), salt) } : undefined;
      return { rawId: allowed, getClientExtensionResults: () => ({ prf: { results } }) };
    },
  };

  defineOn(globalThis.navigator, "credentials", credentials);
  define("PublicKeyCredential", {
    getClientCapabilities: capabilities
      ? async () => ({ "extension:prf": prf, userVerifyingPlatformAuthenticator: true })
      : undefined,
    isUserVerifyingPlatformAuthenticatorAvailable: async () => true,
  });

  return {
    allow: () => {
      refusing = false;
    },
    ceremonies: () => count,
    refuse: () => {
      refusing = true;
    },
    restore() {
      defineOn(globalThis.navigator, "credentials", held.credentials);
      define("PublicKeyCredential", held.publicKeyCredential);
    },
    wipe() {
      known = new Set();
      secret = deviceSecret();
    },
  };
}
