/** Cloudflare Worker entry point with a trusted multi-user authentication boundary. */
import coreWorker from "./core";
import { createMultiUserBoundary } from "./multi-user-boundary";

export default createMultiUserBoundary(coreWorker);
