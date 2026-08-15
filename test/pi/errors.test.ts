import { describe, expect, it } from "vitest";

import { describeFailure } from "../../src/pi/errors.ts";

describe("describeFailure", () => {
  it("names what a bodiless status means", () => {
    expect(describeFailure("429 status code (no body)")).toMatch(/rate limiting/);
    expect(describeFailure("401 status code (no body)")).toMatch(/API key/);
    expect(describeFailure("503 status code (no body)")).toMatch(/unavailable/);
    expect(describeFailure("418 status code (no body)")).toMatch(/answered 418/);
  });

  it("names a request that never reached the provider", () => {
    expect(describeFailure("Failed to fetch")).toMatch(/Could not reach/);
    expect(describeFailure("Connection error.")).toMatch(/Could not reach/);
    expect(describeFailure("(no status code or body)")).toMatch(/Could not reach/);
  });

  it("keeps a message the provider wrote itself", () => {
    const message = "429 Rate limit reached for gpt-oss-20b, retry in 4s";
    expect(describeFailure(message)).toBe(message);
    expect(describeFailure(undefined)).toBeUndefined();
  });
});
