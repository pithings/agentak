import type { StreamFn } from "@earendil-works/pi-agent-core";
import type { AssistantMessage, StopReason } from "@earendil-works/pi-ai";
import { createAssistantMessageEventStream } from "@earendil-works/pi-ai";
import { cleanup, render, waitFor } from "@testing-library/preact";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { AgentChat } from "../../src/agent-chat.tsx";
import { createPiSession, type PiSessionOptions } from "../../src/pi/session.ts";
import { memoryStorage } from "../../src/pi/storage.ts";

const turn = (content: AssistantMessage["content"], stopReason: StopReason): AssistantMessage => ({
  role: "assistant",
  content,
  api: "openai-completions",
  provider: "llm7",
  model: "gemini-3.1-flash-lite",
  usage: {
    input: 10,
    output: 5,
    cacheRead: 0,
    cacheWrite: 0,
    totalTokens: 15,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
  },
  stopReason,
  timestamp: 0,
});

/** Replays one prepared message per request, so no provider is involved. */
const scripted = (script: AssistantMessage[]): StreamFn => {
  let index = 0;
  return () => {
    const message = script[Math.min(index, script.length - 1)];
    index += 1;
    const stream = createAssistantMessageEventStream();
    stream.push({ type: "start", partial: { ...message, content: [] } });
    stream.push({ type: "done", reason: message.stopReason as "stop" | "toolUse", message });
    stream.end(message);
    return stream;
  };
};

/** A provider that refuses — the sdk's own wording for a bodiless answer. */
const refusing =
  (status: number): StreamFn =>
  () => {
    throw new Error(`${status} status code (no body)`);
  };

const answer = turn([{ type: "text", text: "Two plans." }], "stop");
const named = turn([{ type: "text", text: "Plans on this page" }], "stop");

/** LLM7 is free and its catalog is written into the bundle, so nothing is fetched. */
const FREE = "llm7";
const MODEL = "gemini-3.1-flash-lite";

/** One that takes a key, and whose catalog is an import rather than a fetch. */
const KEYED = "openai";

/** The same, and its catalog carries a reasoning model beside a plain one. */
const THINKS = "ovhcloud";
const REASONING_MODEL = "gpt-oss-20b";
const OTHER_REASONING_MODEL = "gpt-oss-120b";
const PLAIN_MODEL = "Qwen3-Coder-30B-A3B-Instruct";

afterEach(cleanup);

/**
 * One store per test, shared by the sessions in it: what a session picks is
 * there for the next one, and no test opens on what another left.
 */
let storage = memoryStorage();
beforeEach(() => {
  storage = memoryStorage();
});
const piSession = (options: PiSessionOptions = {}) => createPiSession({ storage, ...options });

describe("createPiSession", () => {
  it("holds the first message until a provider can answer, then sends it", async () => {
    const session = piSession({ streamFn: scripted([answer]) });

    // Nothing is chosen on a fresh session, so the message waits and the picker
    // is the question.
    session.send("what is this page?");
    expect(session.snapshot().messages).toHaveLength(0);
    expect(session.snapshot().pickerOpen).toBe(true);

    session.selectProvider?.(FREE);
    await waitFor(() => expect(session.snapshot().models?.length).toBeGreaterThan(0));
    // A provider chosen for the first time picks no model, so the message is
    // still waiting.
    expect(session.snapshot().messages).toHaveLength(0);

    session.selectModel?.(MODEL);
    await waitFor(() => expect(session.snapshot().messages).toHaveLength(2));
    expect(session.snapshot().modelId).toBe(MODEL);
    expect(session.snapshot().title).toBe("what is this page?");
  });

  it("opens on the model this browser last used with the provider", async () => {
    piSession({ provider: FREE, streamFn: scripted([answer]) }).selectModel?.(MODEL);

    const session = piSession({ provider: FREE, streamFn: scripted([answer]) });
    await waitFor(() => expect(session.snapshot().modelId).toBe(MODEL));

    session.send("what is this page?");
    await waitFor(() => expect(session.snapshot().messages).toHaveLength(2));
  });

  it("asks the model to name the conversation, once, when a host opts in", async () => {
    piSession({ provider: FREE, streamFn: scripted([answer]) }).selectModel?.(MODEL);

    const session = piSession({
      generateTitle: true,
      provider: FREE,
      streamFn: scripted([answer, named]),
    });
    await waitFor(() => expect(session.snapshot().modelId).toBe(MODEL));

    session.send("what is this page?");
    await waitFor(() => expect(session.snapshot().title).toBe("Plans on this page"));
  });

  it("offers a thinking level only where the model has one", async () => {
    const session = piSession({ provider: THINKS, streamFn: scripted([answer]) });
    await waitFor(() => expect(session.snapshot().models?.length).toBeGreaterThan(0));

    session.selectModel?.(REASONING_MODEL);
    expect(session.snapshot().thinkingLevels).toContain("medium");
    // A model chosen to reason reasons: nothing is stored for this one, so it
    // starts in the middle rather than off.
    expect(session.snapshot().thinkingLevel).toBe("medium");

    // Nothing to choose from, so the picker shows no level at all.
    session.selectModel?.(PLAIN_MODEL);
    expect(session.snapshot().thinkingLevels).toEqual(["off"]);
  });

  it("keeps the thinking level per model, and drops one the next model refuses", async () => {
    const first = piSession({ provider: THINKS, streamFn: scripted([answer]) });
    await waitFor(() => expect(first.snapshot().models?.length).toBeGreaterThan(0));
    first.selectModel?.(REASONING_MODEL);
    first.setThinkingLevel?.("high");
    expect(first.snapshot().thinkingLevel).toBe("high");

    // A model that cannot reason must not be asked to: the level goes with it.
    first.selectModel?.(PLAIN_MODEL);
    expect(first.snapshot().thinkingLevel).toBe("off");

    // A reasoning model this browser has not run takes the level last chosen by
    // hand, rather than the default one.
    first.selectModel?.(OTHER_REASONING_MODEL);
    expect(first.snapshot().thinkingLevel).toBe("high");

    const next = piSession({ provider: THINKS, streamFn: scripted([answer]) });
    await waitFor(() => expect(next.snapshot().models?.length).toBeGreaterThan(0));
    next.selectModel?.(REASONING_MODEL);
    expect(next.snapshot().thinkingLevel).toBe("high");
  });

  it("notifies subscribers and keeps the snapshot until it changes", async () => {
    const session = piSession({ provider: FREE, streamFn: scripted([answer]) });
    let events = 0;
    session.subscribe(() => (events += 1));

    const first = session.snapshot();
    expect(session.snapshot()).toBe(first);

    session.setPickerOpen?.(true);
    expect(events).toBe(1);
    expect(session.snapshot()).not.toBe(first);
    expect(session.snapshot().pickerOpen).toBe(true);
  });

  it("opens the settings page when the provider refuses the request", async () => {
    const session = piSession({ provider: FREE, streamFn: refusing(401) });
    await waitFor(() => expect(session.snapshot().models?.length).toBeGreaterThan(0));
    session.selectModel?.(MODEL);
    expect(session.snapshot().pickerOpen).toBe(false);

    // The key, the model and the provider are all on that page, and the error
    // row stays above the composer while it is up.
    session.send("what is this page?");
    await waitFor(() => expect(session.snapshot().error).toMatch(/API key/));
    expect(session.snapshot().pickerOpen).toBe(true);

    // Theirs to close again: the same failure does not open it a second time.
    session.setPickerOpen?.(false);
    expect(session.snapshot().pickerOpen).toBe(false);
  });

  it("keeps the transcript up when the provider is only rate limiting", async () => {
    const session = piSession({ provider: FREE, streamFn: refusing(429) });
    await waitFor(() => expect(session.snapshot().models?.length).toBeGreaterThan(0));
    session.selectModel?.(MODEL);

    session.send("what is this page?");
    await waitFor(() => expect(session.snapshot().error).toMatch(/rate limiting/));
    // Waiting is the answer to a 429, and nothing on the settings page is —
    // taking the transcript away would only lose their place.
    expect(session.snapshot().pickerOpen).toBe(false);
  });

  it("takes a key back out, and steps off the provider it was running", async () => {
    const session = piSession({ streamFn: scripted([answer]) });
    const keyed = () => session.snapshot().providers?.find((entry) => entry.id === KEYED);

    session.saveKey?.(KEYED, "sk-live");
    session.selectProvider?.(KEYED);
    await waitFor(() => expect(session.snapshot().models?.length).toBeGreaterThan(0));
    expect(keyed()?.hasKey).toBe(true);
    expect(storage.get(`api-key:${KEYED}`)).toBe("sk-live");

    session.forgetKey?.(KEYED);
    // Nothing is left to answer with, so the provider is one to set up again
    // rather than one that fails the next turn.
    expect(keyed()?.hasKey).toBe(false);
    expect(session.snapshot().providerId).toBeUndefined();
    expect(session.snapshot().models).toHaveLength(0);
    expect(storage.get(`api-key:${KEYED}`)).toBeFalsy();

    // And the store it went from is the one the next session opens on.
    const next = piSession({ provider: KEYED, streamFn: scripted([answer]) });
    expect(next.snapshot().providerId).toBeUndefined();
  });

  it("leaves the page shut when the provider itself is down", async () => {
    const session = piSession({ provider: FREE, streamFn: refusing(503) });
    await waitFor(() => expect(session.snapshot().models?.length).toBeGreaterThan(0));
    session.selectModel?.(MODEL);

    session.send("what is this page?");
    await waitFor(() => expect(session.snapshot().error).toMatch(/unavailable/));
    expect(session.snapshot().pickerOpen).toBe(false);
  });
});

describe("a pi session that keeps its own conversations", () => {
  /** A session on the free provider with its model already chosen. */
  const ready = async () => {
    const session = piSession({ history: true, provider: FREE, streamFn: scripted([answer]) });
    await waitFor(() => expect(session.snapshot().models?.length).toBeGreaterThan(0));
    session.selectModel?.(MODEL);
    return session;
  };

  it("stores nothing, and lists nothing, unless a host asks", async () => {
    const session = piSession({ provider: FREE, streamFn: scripted([answer]) });
    await waitFor(() => expect(session.snapshot().models?.length).toBeGreaterThan(0));
    session.selectModel?.(MODEL);

    session.send("what is this page?");
    await waitFor(() => expect(session.snapshot().messages).toHaveLength(2));

    // No list is what takes the history button off the header.
    expect(session.snapshot().history).toBeUndefined();
    expect(session.snapshot().conversationId).toBeUndefined();
  });

  it("keeps a conversation, files it away on a reset, and opens it again in place", async () => {
    const session = await ready();

    session.send("what is this page?");
    await waitFor(() => expect(session.snapshot().history?.length).toBe(1));
    const first = session.snapshot().history?.[0];
    expect(first?.title).toBe("what is this page?");
    expect(session.snapshot().conversationId).toBe(first?.id);

    // A new conversation does not lose the one it replaces.
    session.reset();
    expect(session.snapshot().messages).toHaveLength(0);
    expect(session.snapshot().conversationId).not.toBe(first?.id);

    session.send("and the tools?");
    await waitFor(() => expect(session.snapshot().history?.length).toBe(2));
    // Newest first.
    expect(session.snapshot().history?.[0].title).toBe("and the tools?");

    // The session replaces its own state: the same session, another transcript.
    session.openConversation?.(first?.id ?? "");
    await waitFor(() => expect(session.snapshot().title).toBe("what is this page?"));
    expect(session.snapshot().messages).toHaveLength(2);
    expect(session.snapshot().conversationId).toBe(first?.id);
    expect(session.snapshot().modelId).toBe(MODEL);
  });

  it("drops one, and leaves an empty chat where the live one is dropped", async () => {
    const session = await ready();

    session.send("what is this page?");
    await waitFor(() => expect(session.snapshot().history?.length).toBe(1));
    const live = session.snapshot().conversationId ?? "";

    session.forgetConversation?.(live);
    await waitFor(() => expect(session.snapshot().messages).toHaveLength(0));
    expect(session.snapshot().history).toHaveLength(0);
    expect(session.snapshot().conversationId).not.toBe(live);
  });

  it("opens on a new conversation, and lists the stored one all the same", async () => {
    const first = await ready();
    first.send("what is this page?");
    await waitFor(() => expect(first.snapshot().history?.length).toBe(1));
    const id = first.snapshot().conversationId;
    first.dispose();

    // The same store, a new session: an empty chat, with the one before it on
    // the history page.
    const next = piSession({ history: true, provider: FREE, streamFn: scripted([answer]) });
    expect(next.snapshot().messages).toHaveLength(0);
    expect(next.snapshot().conversationId).not.toBe(id);
    expect(next.snapshot().history?.[0]?.id).toBe(id);

    // And it is one click away, with the model it ran under.
    next.openConversation?.(id ?? "");
    await waitFor(() => expect(next.snapshot().messages).toHaveLength(2));
    expect(next.snapshot().conversationId).toBe(id);
    await waitFor(() => expect(next.snapshot().modelId).toBe(MODEL));
  });

  it("forks from a user message into a conversation of its own", async () => {
    const session = await ready();

    session.send("what is this page?");
    await waitFor(() => expect(session.snapshot().messages).toHaveLength(2));
    session.send("and the tools?");
    await waitFor(() => expect(session.snapshot().messages).toHaveLength(4));
    const whole = session.snapshot().conversationId ?? "";

    // Back to just before the second question: the answer to the first is the
    // end of the fork, and the question itself is the surface's to say again.
    session.fork?.("u2");
    await waitFor(() => expect(session.snapshot().messages).toHaveLength(2));
    const branch = session.snapshot().conversationId;
    expect(branch).not.toBe(whole);
    // Under the same model, and beside the conversation it came from rather
    // than over it.
    expect(session.snapshot().modelId).toBe(MODEL);
    await waitFor(() => expect(session.snapshot().history).toHaveLength(2));

    session.openConversation?.(whole);
    await waitFor(() => expect(session.snapshot().messages).toHaveLength(4));
  });

  it("runs a message again in place, dropping what it said before", async () => {
    const session = await ready();

    session.send("what is this page?");
    await waitFor(() => expect(session.snapshot().messages).toHaveLength(2));
    session.send("and the tools?");
    await waitFor(() => expect(session.snapshot().messages).toHaveLength(4));
    const live = session.snapshot().conversationId;

    // The second question, asked again: the answer it got is replaced rather
    // than joined, so the transcript is the same length as before.
    session.retryFrom?.("u2");
    await waitFor(() => expect(session.snapshot().messages).toHaveLength(4));
    // The same conversation throughout — this is the branch nobody keeps.
    expect(session.snapshot().conversationId).toBe(live);
    await waitFor(() => expect(session.snapshot().history).toHaveLength(1));

    const said = session.snapshot().messages[2].parts[0];
    expect(said.kind === "text" && said.text).toBe("and the tools?");
  });

  it("rewinds from nothing but a user message", async () => {
    const session = await ready();

    session.send("what is this page?");
    await waitFor(() => expect(session.snapshot().messages).toHaveLength(2));
    const live = session.snapshot().conversationId;

    // An answer, a message that is gone, and an id from another harness.
    for (const id of ["a1", "u40", ""]) {
      session.fork?.(id);
      session.retryFrom?.(id);
    }
    expect(session.snapshot().messages).toHaveLength(2);
    expect(session.snapshot().conversationId).toBe(live);
  });

  it("replaces its state on a snapshot a host holds itself", async () => {
    const session = await ready();
    session.send("what is this page?");
    await waitFor(() => expect(session.snapshot().messages).toHaveLength(2));

    const held = session.save();
    session.reset();
    expect(session.snapshot().messages).toHaveLength(0);

    session.restore(held);
    await waitFor(() => expect(session.snapshot().messages).toHaveLength(2));
    expect(session.snapshot().title).toBe("what is this page?");
  });
});

describe("AgentChat over a pi session", () => {
  it("keeps the session's own generateTitle when the host declares none", async () => {
    piSession({ provider: FREE, streamFn: scripted([answer]) }).selectModel?.(MODEL);

    const session = piSession({
      generateTitle: true,
      provider: FREE,
      streamFn: scripted([answer, named]),
    });
    // The element passes a boolean either way; a preact host may pass nothing,
    // and nothing must not turn the session's own choice off.
    render(<AgentChat session={session} />);
    await waitFor(() => expect(session.snapshot().modelId).toBe(MODEL));

    session.send("what is this page?");
    await waitFor(() => expect(session.snapshot().title).toBe("Plans on this page"));
  });
});
