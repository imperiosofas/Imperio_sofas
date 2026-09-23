import type {
  CatalogCategory,
  CatalogProduct,
  CatalogRepository,
} from "./types";

const categories: CatalogCategory[] = [
  {
    slug: "sofas",
    name: "Sofás",
    description: "Modelos selecionados para diferentes salas e momentos.",
  },
];

const draftProducts: [string, string, number][] = [
  ["belize", "Sofá Belize", 2200],
  ["berlim", "Sofá Berlim", 2500],
  ["dallas", "Sofá Dallas", 2900],
  ["ferrari", "Sofá Ferrari", 2200],
  ["maximo", "Sofá Máximo", 2300],
];

const products: CatalogProduct[] = draftProducts.map(
  ([slug, name, widthMm]) => ({
    id: `draft-${slug}`,
    slug: `sofa-${slug}`,
    name,
    categorySlug: "sofas",
    description: "Produto importado como rascunho para revisão comercial.",
    widthMm: Number(widthMm),
    status: "draft",
    priceCents: null,
    sellableUnits: 0,
    media: [],
  }),
);

export const localCatalogRepository: CatalogRepository = {
  async listCategories() {
    return categories;
  },
  async listProducts() {
    return products;
  },
  async getProductBySlug(slug) {
    return products.find((product) => product.slug === slug) ?? null;
  },
};
