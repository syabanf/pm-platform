// The typed backend client. Types are generated from the OpenAPI spec the
// backend serves — run `npm run api:types` after any spec change.
export { api, login, logout, getSessionToken, setSessionToken } from "./client";
export type { paths, components, operations } from "./schema";
