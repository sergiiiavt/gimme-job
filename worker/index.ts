/** Cloudflare Worker entry point with tenant auth and per-user email forwarding. */
import coreWorker from "./core";
import { handleForwardedEmail } from "./email-forwarding";
import { createMultiUserBoundary } from "./multi-user-boundary";

const httpWorker = createMultiUserBoundary(coreWorker);

export default {
  fetch: httpWorker.fetch,
  email: handleForwardedEmail,
};
