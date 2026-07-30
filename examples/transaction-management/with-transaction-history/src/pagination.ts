import type { v1PageInfo, v1Pagination } from "@turnkey/sdk-types";

type PaginatedResponse<T> = {
  transactions: T[];
  pageInfo?: v1PageInfo;
};

type PaginateOptions<T> = {
  fetchPage: (
    paginationOptions?: v1Pagination,
  ) => Promise<PaginatedResponse<T>>;
  formatTransaction: (transaction: T) => Record<string, string>;
  label: string;
  limit?: string;
  maxPages?: number;
};

export async function paginateTransactionHistory<T>({
  fetchPage,
  formatTransaction,
  label,
  limit = "5",
  maxPages = 3,
}: PaginateOptions<T>): Promise<void> {
  let after: string | undefined;

  for (let page = 1; page <= maxPages; page++) {
    const { transactions, pageInfo } = await fetchPage({
      limit,
      ...(after ? { after } : {}),
    });

    if (!transactions.length) {
      console.log(`\nNo transactions on page ${page}.`);
      return;
    }

    console.log(
      `\n${label} — page ${page} (${transactions.length} transaction${transactions.length === 1 ? "" : "s"}):\n`,
    );
    console.table(transactions.map(formatTransaction));

    if (!pageInfo?.hasNextPage || !pageInfo.endCursor) {
      return;
    }

    after = pageInfo.endCursor;
  }
}
