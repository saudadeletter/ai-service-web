export const catalogServices = {
  custom: "专属 AI 助手定制",
  subscription: "ChatGPT 订阅协助",
  both: "两项都想了解",
} as const;
export const catalogSorts = {
  newest: "最新套餐",
  "price-asc": "价格从低到高",
  "price-desc": "价格从高到低",
} as const;
export type CatalogParams = Record<string, string | string[] | undefined>;
export function catalogFilters(params: CatalogParams): {
  q: string;
  service: keyof typeof catalogServices | "";
  sort: keyof typeof catalogSorts;
  page: number;
} {
  const single = (key: string) =>
    typeof params[key] === "string" ? params[key] : "";
  const service = Object.hasOwn(catalogServices, single("service"))
    ? (single("service") as keyof typeof catalogServices)
    : "";
  const sort = Object.hasOwn(catalogSorts, single("sort"))
    ? (single("sort") as keyof typeof catalogSorts)
    : "newest";
  const requestedPage = Number(single("page"));
  return {
    q: single("q").trim().slice(0, 80),
    service,
    sort,
    page:
      Number.isSafeInteger(requestedPage) && requestedPage > 0
        ? Math.min(requestedPage, 10000)
        : 1,
  };
}
export function catalogHref(
  filters: ReturnType<typeof catalogFilters>,
  page: number,
) {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.service) params.set("service", filters.service);
  if (filters.sort !== "newest") params.set("sort", filters.sort);
  if (page > 1) params.set("page", String(page));
  return `/packages${params.size ? `?${params}` : ""}`;
}
export function packageConsultationHref(item: {
  name: string;
  service: string;
}) {
  const service =
    Object.entries(catalogServices).find(
      ([, label]) => label === item.service,
    )?.[0] || "custom";
  return `/custom?${new URLSearchParams({ service, package: item.name })}`;
}
