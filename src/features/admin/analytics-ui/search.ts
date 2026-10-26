type SearchParams = Record<string, string | string[] | undefined>;

const uuidPattern = /^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i;

export function categoryIdFromSearch(searchParams: SearchParams) {
  const value = searchParams.categoryId;
  return typeof value === "string" && uuidPattern.test(value) ? value : null;
}
