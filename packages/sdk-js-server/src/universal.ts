import { fetch as xFetch } from "cross-fetch";

// This is useful for mocking fetch in tests.
const fetch = xFetch;

export { fetch };
