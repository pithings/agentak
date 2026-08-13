import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryHistory, createRouter } from "vue-router";

import App from "../src/app.vue";
import { ENTRIES, neighbours } from "../src/catalog";
import { chat, openChat } from "../src/chat-store";
import { routes } from "../src/router";

/** The page, at a path, with every preview island mounted. */
async function open(path: string) {
  const router = createRouter({ history: createMemoryHistory(), routes });
  await router.push(path);
  await router.isReady();

  const wrapper = mount(App, { global: { plugins: [router] } });
  await flushPromises();

  return wrapper;
}

const sidebarLinks = (wrapper: Awaited<ReturnType<typeof open>>) =>
  wrapper.findAll('aside a[href^="/c/"]').map((link) => link.text());

// The page opens with the box up. These mount it closed, on the chooser, so no
// test starts a surface it never asked for.
const closed = () => {
  chat.open = false;
  chat.mounted = false;
  chat.mode = "choose";
};

beforeEach(closed);
afterEach(closed);

describe("the page", () => {
  it("browses every component from the sidebar, and shows the grid", async () => {
    const wrapper = await open("/");

    expect(sidebarLinks(wrapper)).toEqual(ENTRIES.map((entry) => entry.name));
    expect(wrapper.findAll("main article")).toHaveLength(ENTRIES.length);

    wrapper.unmount();
  });

  it("filters the sidebar and the grid from the query", async () => {
    const wrapper = await open("/?q=card");

    const names = ENTRIES.filter((entry) => entry.name.includes("card")).map((e) => e.name);
    expect(names.length).toBeGreaterThan(1);
    expect(sidebarLinks(wrapper)).toEqual(names);
    expect(wrapper.findAll("main article")).toHaveLength(names.length);

    wrapper.unmount();
  });

  it("opens one component on its own page, with a pager", async () => {
    const wrapper = await open("/c/tool");

    expect(wrapper.find("main h1").text()).toBe("tool");
    expect(wrapper.findAll("main article")).toHaveLength(1);
    // The pager crosses a section boundary: `tool` ends the chat surface.
    const { next, prev } = neighbours("tool");
    expect(wrapper.findAll("main nav").at(-1)?.text()).toBe(`← ${prev?.name}${next?.name} →`);

    wrapper.unmount();
  });

  it("says so when the name is not a component", async () => {
    const wrapper = await open("/c/nope");

    expect(wrapper.find("main").text()).toContain("No component called");

    wrapper.unmount();
  });

  it("opens the chatbox from the launcher, on the chooser", async () => {
    const wrapper = await open("/");

    expect(wrapper.find('[aria-label="Assistant"]').exists()).toBe(false);

    await wrapper.find('[aria-label="Open the assistant"]').trigger("click");
    expect(chat.open).toBe(true);

    const box = wrapper.find('[aria-label="Assistant"]');
    expect(box.exists()).toBe(true);
    expect(box.text()).toContain("Live agent");
    expect(box.text()).toContain("Demo");

    wrapper.unmount();
  });

  it("mounts the demo surface once it is chosen, and goes back", async () => {
    openChat();
    const wrapper = await open("/");

    const chosen = wrapper
      .findAll('[aria-label="Assistant"] button')
      .find((button) => button.text().startsWith("Demo"))!;
    await chosen.trigger("click");
    expect(chat.mode).toBe("demo");
    expect(wrapper.find('[aria-label="Assistant"]').text()).not.toContain("Live agent");

    await wrapper.find('[aria-label="Assistant"] button').trigger("click"); // Switch.
    expect(chat.mode).toBe("choose");

    wrapper.unmount();
  });

  it("minimises the chatbox on Escape, unless a panel used the key", async () => {
    openChat();
    const wrapper = await open("/");

    const escape = () =>
      document.body.dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: "Escape" }),
      );

    // A popover inside the box closes on Escape and marks the key handled.
    const consume = (event: Event) => event.preventDefault();
    document.addEventListener("keydown", consume, true);
    escape();
    expect(chat.open).toBe(true);

    document.removeEventListener("keydown", consume, true);
    escape();
    expect(chat.open).toBe(false);

    wrapper.unmount();
  });

  it("opens the box with the page, on the chooser", async () => {
    vi.resetModules();
    const fresh = await import("../src/chat-store");

    expect(fresh.chat.open).toBe(true);
    expect(fresh.chat.mounted).toBe(true);
    expect(fresh.chat.mode).toBe("choose");
  });
});
