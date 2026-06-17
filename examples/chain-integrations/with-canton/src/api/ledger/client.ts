import createClient, { Client, type ClientOptions } from "openapi-fetch";
import type { paths } from "@generated/api/ledger/spec";

export type LedgerApiClient = Client<paths>;

export const createLedgerApiClient = (
  options: ClientOptions,
): LedgerApiClient => createClient<paths>(options);
