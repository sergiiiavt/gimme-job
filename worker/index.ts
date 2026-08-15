/** Cloudflare Worker entry point with tenant auth and per-user email forwarding. */
import coreWorker from "./core";
import { handleForwardedEmail } from "./email-forwarding";
import { createMultiUserBoundary } from "./multi-user-boundary";

const httpWorker = createMultiUserBoundary(coreWorker);
const worker = {
  fetch: httpWorker.fetch,
  email: handleForwardedEmail,
};

export default worker;
