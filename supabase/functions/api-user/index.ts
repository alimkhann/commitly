import { handleApiRequest } from "../_shared/api-core.ts";

Deno.serve((req) => handleApiRequest(req, "user"));
