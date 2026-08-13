/**
 * Where a browser page keeps the keys and the model choice.
 *
 * One key per provider, so switching back to one already set up asks nothing.
 * `localStorage` throws rather than returns null in a sandboxed frame, and a
 * host page may deny it outright, so every access is guarded and a failure
 * means "nothing stored".
 */
const PREFIX = "agentak:";

const read = (name: string): string | undefined => {
  try {
    return globalThis.localStorage?.getItem(PREFIX + name) ?? undefined;
  } catch {
    return undefined; // storage is denied here
  }
};

const write = (name: string, value: string) => {
  try {
    globalThis.localStorage?.setItem(PREFIX + name, value);
  } catch {
    // Nothing to do: the value lives for this session only.
  }
};

export const storedApiKey = (provider: string) => read(`api-key:${provider}`);
export const storeApiKey = (provider: string, key: string) => write(`api-key:${provider}`, key);

export const storedProviderId = () => read("provider");
export const storeProviderId = (id: string) => write("provider", id);

export const storedModelId = (provider: string) => read(`model:${provider}`);
export const storeModelId = (provider: string, id: string) => write(`model:${provider}`, id);
