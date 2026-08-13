import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { act, cleanup, fireEvent, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AgentChat } from "@/agent-chat";
import { AgentChatElement, defineAgentChat } from "@/element";
import type { ChatSession, ChatSnapshot } from "@/session";

afterEach(cleanup);

/** The surface with no harness behind it: a transcript, and the calls it made. */
function fakeSession(): ChatSession & { sent: string[]; say(text: string): void } {
  const listeners = new Set<() => void>();
  const sent: string[] = [];
  let snapshot: ChatSnapshot = { isStreaming: false, messages: [] };

  return {
    sent,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    snapshot: () => snapshot,
    send(text) {
      sent.push(text);
    },
    stop() {},
    reset() {
      snapshot = { isStreaming: false, messages: [] };
      for (const listener of listeners) listener();
    },
    /** A new snapshot, the way a harness reports one: fresh object, then notify. */
    say(text) {
      snapshot = {
        isStreaming: false,
        messages: [
          ...(snapshot.messages ?? []),
          {
            id: `m${snapshot.messages?.length ?? 0}`,
            parts: [{ kind: "text", text }],
            role: "assistant",
          },
        ],
      };
      for (const listener of listeners) listener();
    },
  };
}

describe("a session that is not pi", () => {
  it("drives the whole surface with six members and no provider", () => {
    const session = fakeSession();
    render(<AgentChat session={session} />);

    act(() => session.say("Two plans."));
    expect(screen.getByText("Two plans.")).toBeTruthy();

    const textarea = screen.getByRole("textbox");
    fireEvent.input(textarea, { target: { value: "what is this page?" } });
    fireEvent.keyDown(textarea, { key: "Enter" });
    expect(session.sent).toEqual(["what is this page?"]);
  });

  it("leaves out what it does not answer", () => {
    const session = fakeSession();
    render(<AgentChat session={session} />);

    // No `providers`, so the picker is the model list alone — and no
    // `selectProvider`, so nothing offers to change one.
    expect(screen.queryByText("Search providers…")).toBeNull();
  });
});

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), "../src");
const CANDIDATES = ["", ".ts", ".tsx", "/index.ts", "/index.tsx"];

/** Runtime imports of one module. `import type` and `export type` are erased. */
function importsOf(file: string): string[] {
  const source = readFileSync(file, "utf8");
  const found: string[] = [];
  for (const [, clause, spec] of source.matchAll(
    /(?:^|\n)\s*(?:import|export)\s+([^;]*?)from\s*["']([^"']+)["']/g,
  )) {
    if (!/^\s*type\s/.test(clause)) found.push(spec);
  }
  for (const [, spec] of source.matchAll(/(?:^|\n)\s*import\s*["']([^"']+)["']/g)) found.push(spec);
  return found;
}

/** Every package an entry reaches through the source, following `@/` and `./`. */
function packagesFrom(entry: string): Set<string> {
  const packages = new Set<string>();
  const seen = new Set<string>();
  const queue = [resolve(SRC, entry)];

  while (queue.length > 0) {
    const file = queue.pop() as string;
    if (seen.has(file)) continue;
    seen.add(file);

    for (const spec of importsOf(file)) {
      const local = spec.startsWith("@/")
        ? resolve(SRC, spec.slice(2))
        : spec.startsWith(".")
          ? resolve(dirname(file), spec)
          : undefined;
      if (!local) {
        packages.add(spec);
        continue;
      }
      const resolved = CANDIDATES.map((suffix) => local + suffix).find((path) => {
        try {
          readFileSync(path);
          return true;
        } catch {
          return false;
        }
      });
      if (resolved) queue.push(resolved);
    }
  }

  return packages;
}

const pi = (packages: Set<string>) =>
  [...packages].filter((name) => name.startsWith("@earendil-works/"));

/**
 * What the seam is for. The surface must not reach the loop, and the loop must
 * stay reachable from the entry that promises it — a split that only holds by
 * accident is one an import puts back.
 */
describe("the pi seam", () => {
  it("keeps pi out of the surface entries", () => {
    expect(pi(packagesFrom("index.ts"))).toEqual([]);
    expect(pi(packagesFrom("components/index.ts"))).toEqual([]);
    expect(pi(packagesFrom("agent-chat.tsx"))).toEqual([]);
    expect(pi(packagesFrom("element.tsx"))).toEqual([]);
  });

  it("keeps pi in the entries that promise it", () => {
    expect(pi(packagesFrom("agent/index.ts")).length).toBeGreaterThan(0);
    // `agentak/element` is the one entry that binds the tag to a loop.
    expect(pi(packagesFrom("register.ts")).length).toBeGreaterThan(0);
  });
});

describe("<agent-chat> over a host session", () => {
  it("takes one from the property, and leaves it to the host to end", () => {
    const session = fakeSession();
    let disposed = 0;
    session.dispose = () => (disposed += 1);

    defineAgentChat({ session: () => fakeSession(), tag: "host-chat" });
    const element = document.createElement("host-chat") as AgentChatElement;
    element.session = session;
    // Two acts: the mount flushes the effect that subscribes, and only then can
    // the session's own notify reach the surface.
    act(() => document.body.append(element));
    act(() => session.say("Two plans."));

    expect(element.session).toBe(session);
    expect(element.shadowRoot?.textContent).toContain("Two plans.");

    element.remove();
    expect(disposed).toBe(0);
  });

  it("disposes the one it made itself", () => {
    let disposed = 0;
    defineAgentChat({
      session: () => {
        const session = fakeSession();
        session.dispose = () => (disposed += 1);
        return session;
      },
      tag: "owned-chat",
    });

    const element = document.createElement("owned-chat");
    document.body.append(element);
    element.remove();
    expect(disposed).toBe(1);
  });
});

describe("a tag registered without one", () => {
  it("says so instead of painting nothing", () => {
    // A reaction callback cannot throw at its caller, so this is the loudest a
    // misregistered tag gets. `defineAgentChat` is what makes it unreachable.
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    customElements.define("bare-chat", class extends AgentChatElement {});
    document.body.append(document.createElement("bare-chat"));

    expect(errors).toHaveBeenCalledWith(expect.stringContaining("has no session"));
    errors.mockRestore();
  });
});
