import styles from "./route-loading.module.css";

type RouteLoadingKind = "category" | "product" | "admin-product";

const labels: Record<RouteLoadingKind, string> = {
  category: "Carregando coleção",
  product: "Carregando produto",
  "admin-product": "Carregando produto no painel",
};

function Block({ className = "" }: { className?: string }) {
  return <span className={`${styles.block} ${className}`} aria-hidden="true" />;
}

function CategoryLoading() {
  return (
    <>
      <div className={styles.categoryHeading}>
        <Block className={styles.kicker} />
        <Block className={styles.title} />
        <Block className={styles.description} />
      </div>
      <div className={styles.toolbar} aria-hidden="true">
        <Block className={styles.search} />
        <Block className={styles.control} />
        <Block className={styles.control} />
      </div>
      <div className={styles.productGrid} aria-hidden="true">
        {[0, 1, 2, 3, 4, 5].map((item) => (
          <div className={styles.productCard} key={item}>
            <Block className={styles.productImage} />
            <Block className={styles.productLine} />
            <Block className={styles.productLineShort} />
          </div>
        ))}
      </div>
    </>
  );
}

function ProductLoading() {
  return (
    <div className={styles.productDetail} aria-hidden="true">
      <Block className={styles.gallery} />
      <div className={styles.productInfo}>
        <Block className={styles.kicker} />
        <Block className={styles.title} />
        <Block className={styles.description} />
        <Block className={styles.price} />
        <Block className={styles.control} />
        <Block className={styles.button} />
      </div>
    </div>
  );
}

function AdminProductLoading() {
  return (
    <div className={styles.adminPanel} aria-hidden="true">
      <Block className={styles.kicker} />
      <Block className={styles.title} />
      <div className={styles.adminFields}>
        {[0, 1, 2, 3].map((item) => (
          <Block className={styles.adminField} key={item} />
        ))}
      </div>
      <Block className={styles.adminImage} />
    </div>
  );
}

export function RouteLoading({ kind }: { kind: RouteLoadingKind }) {
  return (
    <div className={styles.page} aria-busy="true" aria-live="polite">
      <span className={styles.srOnly} role="status">
        {labels[kind]}
      </span>
      {kind === "category" ? <CategoryLoading /> : null}
      {kind === "product" ? <ProductLoading /> : null}
      {kind === "admin-product" ? <AdminProductLoading /> : null}
    </div>
  );
}
