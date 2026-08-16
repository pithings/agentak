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

  it("takes the sentence back out of a body the sdk stringified", () => {
    // What the gateway answers a refused key with, as the sdk words it.
    expect(
      describeFailure(
        '401 {"error":{"message":"Authentication failed. Check that your Vercel credential is valid.","type":"authentication_error"}}',
      ),
    ).toBe("Authentication failed. Check that your Vercel credential is valid.");

    expect(describeFailure('403 {"message":"Your account is not allowed this model"}')).toBe(
      "Your account is not allowed this model",
    );
    expect(describeFailure('500 {"error":"upstream unavailable"}')).toBe("upstream unavailable");

    // A body that carries no sentence leaves the status as the whole answer.
    expect(describeFailure('402 {"error":{"code":"insufficient_funds"}}')).toMatch(/out of credit/);
    expect(describeFailure("429 {not json")).toBe("429 {not json");
  });

  it("says what to do about a rate limit the provider only named", () => {
    expect(describeFailure('429 {"error":{"message":"Rate limit exceeded"}}')).toBe(
      "Rate limit exceeded. Wait a moment, or select another model.",
    );
    // A provider that gives its own wait keeps it, and is not told twice.
    expect(describeFailure('429 {"error":{"message":"Too many requests, retry in 4s."}}')).toBe(
      "Too many requests, retry in 4s.",
    );
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
