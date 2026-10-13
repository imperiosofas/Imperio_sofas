import Link from "next/link";
import { ArrowLeft, Save } from "lucide-react";
import { removeProductImage } from "./actions";
import type { AdminCategory, AdminProduct } from "./catalog-data";
import { VariantEditor, type VariantDraft } from "./VariantEditor";
import { ProductSubmitButton } from "./ProductSubmitButton";
import { ProductDetailsForm } from "./ProductDetailsForm";
import { ProductImageUpload } from "./ProductImageUpload";
import styles from "./admin.module.css";

function statusName(status: AdminProduct["status"]) {
  return status === "active"
    ? "Publicado"
    : status === "archived"
      ? "Arquivado"
      : "Rascunho";
}

function errorMessage(error?: string) {
  if (error === "validation")
    return "Confira os campos obrigatórios e tente novamente.";
  if (error === "publish")
    return "Para publicar, ative a categoria, mantenha ao menos uma variação vendável, estoque disponível e uma imagem com descrição.";
  if (error === "publishRequirements")
    return "Publicação bloqueada: ative a categoria e confira uma variação ativa com SKU, preço e estoque disponível.";
  if (error === "publishMedia")
    return "Publicação bloqueada: envie ao menos uma imagem e preencha o texto alternativo.";
  if (error === "permission")
    return "Sua sessão não tem permissão para alterar este produto. Entre novamente com a conta administradora.";
  if (error === "duplicate")
    return "Não foi possível salvar: já existe um produto ou SKU com esse identificador.";
  if (error === "image")
    return "Não foi possível salvar a imagem. Use JPG, PNG ou WebP de até 10 MB e preencha o texto alternativo.";
  if (error === "save")
    return "Não foi possível salvar. Verifique se o SKU ou endereço já está em uso.";
  if (error === "lastImage")
    return "Um produto publicado precisa manter ao menos uma imagem. Adicione outra imagem ou tire o produto da loja antes de remover esta.";
  return undefined;
}

export function ProductEditor({
  product,
  categories,
  error,
  saved,
  imageSaved,
  imageRemoved,
  signedMedia,
}: {
  product: AdminProduct | null;
  categories: AdminCategory[];
  error?: string;
  saved?: boolean;
  imageSaved?: boolean;
  imageRemoved?: boolean;
  signedMedia?: { id: string; url: string; alt: string }[];
}) {
  const variants: VariantDraft[] =
    product?.product_variants.map((variant) => ({
      id: variant.id,
      sku: variant.sku ?? "",
      fabric: variant.fabric ?? "",
      color: variant.color ?? "",
      widthMm: variant.width_mm,
      depthMm: variant.depth_mm,
      heightMm: variant.height_mm,
      priceCents: variant.price_cents,
      onHand: variant.inventory?.on_hand ?? 0,
      lowStockThreshold: variant.inventory?.low_stock_threshold ?? 0,
      isActive: variant.is_active,
    })) ?? [];
  const message = errorMessage(error);
  const selectedCategory = categories.find(
    (category) => category.id === product?.category_id,
  );
  const hasSellableVariant = Boolean(
    product?.product_variants.some(
      (variant) =>
        Boolean(variant.sku?.trim()) &&
        (variant.price_cents ?? 0) > 0 &&
        (variant.inventory?.on_hand ?? 0) > (variant.inventory?.reserved ?? 0),
    ),
  );
  const hasDescribedImage = Boolean(
    product?.product_media.some((media) => media.alt_text.trim().length > 0),
  );
  const publicationChecks = [
    {
      label: "Categoria ativa",
      ready: selectedCategory?.is_active ?? false,
    },
    {
      label: "Variação com SKU, preço e estoque disponível",
      ready: hasSellableVariant,
    },
    { label: "Imagem com texto alternativo", ready: hasDescribedImage },
  ];
  const canPublish =
    product !== null && publicationChecks.every((check) => check.ready);

  return (
    <div>
      <Link href="/admin/produtos" className={styles.backLink}>
        <ArrowLeft size={16} /> Voltar aos produtos
      </Link>
      <div className={styles.pageHeading}>
        <div>
          <p className={styles.kicker}>CATÁLOGO / PRODUTOS</p>
          <h1>{product ? "Editar produto" : "Novo produto"}</h1>
          <p>
            Cadastre as informações que formam a ficha comercial e operacional
            do item.
          </p>
        </div>
        {product && (
          <span
            className={`${styles.status} ${styles[`status_${product.status}`]}`}
          >
            {statusName(product.status)}
          </span>
        )}
      </div>
      {message && (
        <p className={styles.alert} role="alert">
          {message}
        </p>
      )}
      {saved && (
        <p className={styles.success} role="status">
          Alterações salvas.
        </p>
      )}
      {imageSaved && (
        <p className={styles.success} role="status">
          Imagem enviada e otimizada.
        </p>
      )}
      {imageRemoved && (
        <p className={styles.success} role="status">
          Imagem removida.
        </p>
      )}
      {categories.length === 0 ? (
        <section className={styles.emptyCategory}>
          <h2>Comece criando uma categoria</h2>
          <p>
            Produtos precisam pertencer a uma coleção. A categoria pode começar
            como rascunho e ser ativada depois.
          </p>
          <Link
            href="/admin/produtos#nova-categoria"
            className={styles.primaryButton}
          >
            Criar categoria
          </Link>
        </section>
      ) : (
        <ProductDetailsForm>
          {product && <input type="hidden" name="id" value={product.id} />}
          <input
            type="hidden"
            name="currentStatus"
            value={product?.status ?? "draft"}
          />
          <div className={styles.editorLayout}>
            <div className={styles.editorMain}>
              <section className={styles.panel}>
                <div className={styles.panelHeading}>
                  <span>01</span>
                  <div>
                    <h2>Identificação</h2>
                    <p>O nome e a descrição exibidos na loja.</p>
                  </div>
                </div>
                <div className={styles.formGrid}>
                  <label className={`${styles.field} ${styles.spanTwo}`}>
                    <span>Nome do produto</span>
                    <input
                      name="name"
                      defaultValue={product?.name ?? ""}
                      required
                      maxLength={180}
                      placeholder="Ex.: Sofá retrátil de 3 lugares"
                    />
                  </label>
                  <label className={`${styles.field} ${styles.spanTwo}`}>
                    <span>Endereço do produto</span>
                    <div className={styles.slugInput}>
                      <span>/produto/</span>
                      <input
                        name="slug"
                        defaultValue={product?.slug ?? ""}
                        required
                        pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                        maxLength={180}
                        placeholder="sofa-retratil-3-lugares"
                      />
                    </div>
                  </label>
                  <label className={`${styles.field} ${styles.spanTwo}`}>
                    <span>Descrição</span>
                    <textarea
                      name="description"
                      defaultValue={product?.description ?? ""}
                      rows={5}
                      maxLength={10000}
                      placeholder="Descreva materiais, conforto, uso e diferenciais confirmados do produto."
                    />
                  </label>
                  <label className={`${styles.field} ${styles.spanTwo}`}>
                    <span>Categoria</span>
                    <select
                      name="categoryId"
                      defaultValue={product?.category_id ?? ""}
                      required
                    >
                      <option value="" disabled>
                        Selecione uma categoria
                      </option>
                      {categories.map((category) => (
                        <option value={category.id} key={category.id}>
                          {category.name}
                          {category.is_active ? "" : " — inativa"}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className={`${styles.checkField} ${styles.spanTwo}`}>
                    <input
                      type="checkbox"
                      name="freeShipping"
                      defaultChecked={product?.free_shipping ?? false}
                    />
                    <span>
                      <strong>Frete grátis</strong>
                      <small>
                        O benefício só será aplicado quando as regras de entrega
                        forem configuradas.
                      </small>
                    </span>
                  </label>
                </div>
              </section>

              <section className={styles.panel}>
                <div className={styles.panelHeading}>
                  <span>02</span>
                  <div>
                    <h2>Variações e estoque</h2>
                    <p>
                      SKU, preço e disponibilidade para cada configuração do
                      produto.
                    </p>
                  </div>
                </div>
                <VariantEditor initial={variants} />
              </section>
            </div>
            <aside className={styles.editorAside}>
              <section className={styles.panel}>
                <p className={styles.kicker}>PUBLICAÇÃO</p>
                <h2>{product ? statusName(product.status) : "Rascunho"}</h2>
                <p className={styles.asideCopy}>
                  Publicar exige uma categoria ativa, uma variação com SKU,
                  preço e estoque disponível, além de imagem com texto
                  alternativo. Dimensões são opcionais.
                </p>
                <ul className={styles.publicationChecks}>
                  {publicationChecks.map((check) => (
                    <li key={check.label} data-ready={check.ready}>
                      <span aria-hidden="true">{check.ready ? "✓" : "•"}</span>
                      {check.label}
                      {!check.ready && product === null && (
                        <span className="sr-only"> — pendente</span>
                      )}
                    </li>
                  ))}
                </ul>
                <div className={styles.actionStack}>
                  <ProductSubmitButton
                    className={styles.primaryButton}
                    name="intent"
                    value="save"
                    pendingLabel="Salvando…"
                  >
                    <Save size={16} />{" "}
                    {product
                      ? "Salvar alterações"
                      : "Salvar rascunho e adicionar imagens"}
                  </ProductSubmitButton>
                  {product && (
                    <ProductSubmitButton
                      className={styles.publishButton}
                      name="intent"
                      value="publish"
                      pendingLabel="Publicando…"
                      blocked={!canPublish}
                    >
                      Publicar na loja
                    </ProductSubmitButton>
                  )}
                  {product && !hasDescribedImage && (
                    <a className={styles.imageShortcut} href="#imagens">
                      Adicionar imagem e descrição ↓
                    </a>
                  )}
                  {!product && (
                    <a className={styles.imageShortcut} href="#imagens">
                      Ver etapa de imagens ↓
                    </a>
                  )}
                  {product?.status === "active" && (
                    <ProductSubmitButton
                      className={styles.secondaryButton}
                      name="intent"
                      value="unpublish"
                      pendingLabel="Retirando da loja…"
                    >
                      Tirar da loja
                    </ProductSubmitButton>
                  )}
                  {product && product.status !== "archived" && (
                    <ProductSubmitButton
                      className={styles.textButton}
                      name="intent"
                      value="archive"
                      pendingLabel="Arquivando…"
                    >
                      Arquivar produto
                    </ProductSubmitButton>
                  )}
                </div>
              </section>
            </aside>
          </div>
        </ProductDetailsForm>
      )}
      {categories.length > 0 && (
        <section
          id="imagens"
          className={`${styles.panel} ${styles.imagePanel}`}
        >
          <div className={styles.panelHeading}>
            <span>03</span>
            <div>
              <h2>Imagens</h2>
              <p>
                {product
                  ? "Arquivos privados; só imagens de produtos publicados ficam acessíveis na loja."
                  : "A seção de imagens fica disponível depois que o rascunho é salvo."}
              </p>
            </div>
          </div>
          {product ? (
            <div className={styles.mediaGrid}>
              {signedMedia?.map((media) => (
                <article className={styles.mediaItem} key={media.id}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={media.url} alt={media.alt} />
                  <div>
                    <p>{media.alt}</p>
                    <form action={removeProductImage}>
                      <input
                        type="hidden"
                        name="productId"
                        value={product.id}
                      />
                      <input type="hidden" name="mediaId" value={media.id} />
                      <button type="submit" className={styles.textButton}>
                        Remover imagem
                      </button>
                    </form>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className={styles.imageLocked}>
              Primeiro preencha os dados e salve o rascunho. Você voltará a esta
              seção para selecionar a imagem e escrever o texto alternativo.
            </p>
          )}
          {product && <ProductImageUpload productId={product.id} />}
        </section>
      )}
    </div>
  );
}
