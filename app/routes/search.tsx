import { createRoute } from "honox/factory";

import { SearchPage } from "@/features/search/components/search-page";
import type { SearchResult } from "@/features/search/model/types";
import { searchAssets } from "@/features/search/server/service";

export default createRoute(async (context) => {
  const query = context.req.query("query")?.trim() ?? "";
  const pageValue = Number(context.req.query("page") ?? "1");
  const page = Number.isFinite(pageValue) && pageValue > 0 ? pageValue : 1;

  const result: SearchResult =
    query.length > 0
      ? await searchAssets(context.env, {
          query,
          page,
          pageSize: 20,
        })
      : {
          items: [],
          evidence: {
            items: [],
          },
          pagination: {
            page: 1,
            pageSize: 20,
            total: 0,
            totalPages: 0,
          },
        };

  return context.render(<SearchPage result={result} query={query} />);
});
