/**
 * Provider failures, said in a way a person can act on.
 *
 * A provider that answers with an empty body leaves the SDK with nothing but the
 * status line, and the chat then shows `429 status code (no body)`. The status is
 * the whole answer in that case — a rate limit, a rejected key, a provider that
 * is down — so it is written out here instead. A response that does carry a
 * message is left alone: the provider's own words say more than any rule here.
 */

/** The OpenAI and Anthropic SDKs both word a bodiless response this way. */
const BARE_STATUS = /^(\d{3}) status code \(no body\)$/;

/** The request never reached the provider: no status, no body. Wording varies. */
const NO_RESPONSE =
  /^(\(no status code or body\)|Connection error\.?|Failed to fetch|Load failed|NetworkError.*)$/i;

const forStatus = (status: number): string => {
  switch (status) {
    case 400:
      return "The provider rejected the request and gave no reason.";
    case 401:
    case 403:
      return "The provider refused the API key. Check the key, or select another provider.";
    case 402:
      return "This account is out of credit with the provider.";
    case 404:
      return "The provider does not offer this model. Select another model.";
    case 408:
      return "The provider took too long to answer. Try again.";
    case 413:
      return "The conversation is too long for this model. Start a new chat.";
    case 429:
      return "The provider is rate limiting this key. Wait a moment, or select another model.";
    default:
      return status >= 500
        ? "The provider is unavailable. Try again in a moment."
        : `The provider answered ${status} and said nothing more.`;
  }
};

/**
 * The message the chat shows for a failed turn. Anything unrecognised passes
 * through, so a provider that explains itself is still read word for word.
 */
export function describeFailure(message: string | undefined): string | undefined {
  if (!message) return message;

  const status = BARE_STATUS.exec(message.trim());
  if (status) return forStatus(Number(status[1]));

  if (NO_RESPONSE.test(message.trim())) {
    return "Could not reach the provider. Check the network, and that the browser is allowed to call it.";
  }

  return message;
}
