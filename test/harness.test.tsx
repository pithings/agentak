import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { act, cleanup, fireEvent, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it } from "vitest";

import { AgentChat } from "../src/agent-chat.tsx";
import type { ChatSession, ChatSnapshot } from "../src/session.ts";

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
  it("drives the whole surface with five members and no provider", () => {
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

/** Every package an entry reaches through the source, following relative paths. */
function packagesFrom(entry: string): Set<string> {
  const packages = new Set<string>();
  const seen = new Set<string>();
  const queue = [resolve(SRC, entry)];

  while (queue.length > 0) {
    const file = queue.pop() as string;
    if (seen.has(file)) continue;
    seen.add(file);

    for (const spec of importsOf(file)) {
      const local = spec.startsWith(".") ? resolve(dirname(file), spec) : undefined;
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

/** The three framework wrappers. Surface entries, like the root. */
const WRAPPERS = ["preact/index.tsx", "react/index.ts", "vue/index.ts"];

/**
 * What the seam is for. The surface must not reach the loop, and the loop must
 * stay reachable from the entry that promises it — a split that only holds by
 * accident is one an import puts back.
 */
describe("the pi seam", () => {
  it("keeps pi out of the surface entries", () => {
    // The wrappers included: `session` is required on every one of them, so a
    // host names its own harness and `agentak/pi` stays the one import that
    // puts the loop in a bundle.
    for (const entry of ["index.ts", "components/index.ts", "agent-chat.tsx", ...WRAPPERS]) {
      expect(pi(packagesFrom(entry))).toEqual([]);
    }
  });

  it("keeps pi in the entry that promises it", () => {
    expect(pi(packagesFrom("pi/index.ts")).length).toBeGreaterThan(0);
  });
});

const hosts = (packages: Set<string>) =>
  [...packages].filter((name) => name === "react" || name === "vue");

/**
 * The other seam. A wrapper names one host framework; every other entry names
 * none — an optional peer that leaks into the shared modules is a peer nobody
 * opted into.
 */
describe("the host frameworks", () => {
  it("keeps each one inside its own wrapper", () => {
    expect(hosts(packagesFrom("index.ts"))).toEqual([]);
    expect(hosts(packagesFrom("pi/index.ts"))).toEqual([]);
    expect(hosts(packagesFrom("preact/index.tsx"))).toEqual([]);
    expect(hosts(packagesFrom("react/index.ts"))).toEqual(["react"]);
    expect(hosts(packagesFrom("vue/index.ts"))).toEqual(["vue"]);
  });
});
