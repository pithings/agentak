import { describe, expect, it } from "vitest";

import { describeFailure, failureStatus } from "../../src/pi/errors.ts";

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

describe("failureStatus", () => {
  it("reads the status the sdk puts at the head of the message", () => {
    expect(failureStatus("401 status code (no body)")).toBe(401);
    expect(failureStatus('401 {"error":{"message":"Incorrect API key"}}')).toBe(401);
    expect(failureStatus("503 status code (no body)")).toBe(503);
  });

  it("reads nothing out of a message that names no status", () => {
    expect(failureStatus("Failed to fetch")).toBeUndefined();
    expect(failureStatus("200 tokens is over the limit")).toBeUndefined();
    expect(failureStatus(undefined)).toBeUndefined();
  });
});
