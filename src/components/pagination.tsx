'use client';

/** Server-paginated list footer. Every list in the console is paginated (§6.2). */
export const Pagination = ({
  page,
  limit,
  total,
  onPage,
}: {
  page: number;
  limit: number;
  total: number;
  onPage: (page: number) => void;
}) => {
  const lastPage = Math.max(1, Math.ceil(total / limit));
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(total, page * limit);

  return (
    <div className="flex items-center justify-between border-t px-4 py-2 text-sm">
      <p className="tabular text-muted-foreground">
        {from}–{to} of {total}
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          className="rounded-md border px-2 py-1 text-xs disabled:opacity-40"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
        >
          Previous
        </button>
        <button
          type="button"
          className="rounded-md border px-2 py-1 text-xs disabled:opacity-40"
          disabled={page >= lastPage}
          onClick={() => onPage(page + 1)}
          data-testid="pagination-next"
        >
          Next
        </button>
      </div>
    </div>
  );
};
