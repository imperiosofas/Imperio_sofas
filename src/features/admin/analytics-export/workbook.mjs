import ExcelJS from "exceljs";
import sharp from "sharp";

const COLORS = {
  ink: "FF11191D",
  gold: "FFD9B24C",
  cream: "FFF5F0E5",
  muted: "FF69747A",
  green: "FFE5F2E9",
  greenInk: "FF17603A",
  amber: "FFFFF0CC",
  amberInk: "FF815A00",
  red: "FFFCE4E1",
  redInk: "FF9E2E22",
  white: "FFFFFFFF",
  border: "FFE2DED5",
};

const CURRENCY_FORMAT = "[$R$-pt-BR] #,##0.00";
const INTEGER_FORMAT = "#,##0;[Red]-#,##0;–";
const MAX_CHART_CATEGORIES = 12;

export function safeXlsxValue(value) {
  if (typeof value !== "string") return value;
  return /^[=+\-@\t\r]/u.test(value) ? `'${value}` : value;
}

function styleHeader(row) {
  row.height = 28;
  row.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: COLORS.ink },
    };
    cell.font = { bold: true, color: { argb: COLORS.white }, size: 10 };
    cell.alignment = { vertical: "middle", wrapText: true };
    cell.border = { bottom: { style: "thin", color: { argb: COLORS.gold } } };
  });
}

function styleTotal(row) {
  row.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: COLORS.cream },
    };
    cell.font = { bold: true, color: { argb: COLORS.ink } };
    cell.border = { top: { style: "thin", color: { argb: COLORS.border } } };
  });
}

function prepareSheet(workbook, name, headers, widths) {
  const sheet = workbook.addWorksheet(name, {
    properties: { defaultRowHeight: 20 },
    views: [
      { state: "frozen", ySplit: 1, topLeftCell: "A2", activeCell: "A2" },
    ],
  });
  const header = sheet.addRow(headers);
  styleHeader(header);
  widths.forEach((width, index) => {
    sheet.getColumn(index + 1).width = width;
  });
  return sheet;
}

function setFilter(sheet, columnCount, lastDataRow) {
  const end = Math.max(1, lastDataRow);
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: end, column: columnCount },
  };
}

function writeSafeRow(sheet, values) {
  return sheet.addRow(values.map(safeXlsxValue));
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function chartRows(categories, valueKey) {
  const sorted = [...categories].sort(
    (left, right) => right[valueKey] - left[valueKey],
  );
  if (sorted.length <= MAX_CHART_CATEGORIES) {
    return sorted.map((item) => ({
      label: item.category_name,
      value: item[valueKey],
    }));
  }
  const visible = sorted.slice(0, MAX_CHART_CATEGORIES - 1).map((item) => ({
    label: item.category_name,
    value: item[valueKey],
  }));
  visible.push({
    label: "Demais categorias",
    value: sorted
      .slice(MAX_CHART_CATEGORIES - 1)
      .reduce((sum, item) => sum + item[valueKey], 0),
  });
  return visible;
}

function horizontalBarsSvg(title, entries, valueLabel) {
  const width = 1000;
  const height = 560;
  const left = 310;
  const right = 80;
  const top = 112;
  const rowHeight =
    entries.length > 0 ? Math.min(34, 390 / entries.length) : 34;
  const maxValue = Math.max(1, ...entries.map((entry) => entry.value));
  const barMax = width - left - right;
  const rows = entries.length
    ? entries
        .map((entry, index) => {
          const y = top + index * rowHeight;
          const barWidth = Math.max(0, (entry.value / maxValue) * barMax);
          const label = escapeXml(entry.label.slice(0, 34));
          const value = new Intl.NumberFormat("pt-BR").format(entry.value);
          return `<text x="${left - 18}" y="${y + 22}" text-anchor="end" class="label">${label}</text><rect x="${left}" y="${y}" width="${barMax}" height="20" rx="10" fill="#f1eee7"/><rect x="${left}" y="${y}" width="${barWidth.toFixed(2)}" height="20" rx="10" fill="#d9b24c"/><text x="${Math.min(left + barWidth + 12, width - 70)}" y="${y + 16}" class="value">${escapeXml(value)}</text>`;
        })
        .join("")
    : `<text x="${left}" y="${top + 24}" class="empty">Ainda sem dados de categoria.</text>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" rx="24" fill="#fffdf8"/><text x="52" y="55" class="title">${escapeXml(title)}</text><text x="52" y="84" class="subtitle">${escapeXml(valueLabel)} · valores do snapshot real</text>${rows}<style>.title{font:700 28px Arial,sans-serif;fill:#11191d}.subtitle{font:16px Arial,sans-serif;fill:#69747a}.label{font:16px Arial,sans-serif;fill:#283237}.value{font:700 15px Arial,sans-serif;fill:#11191d}.empty{font:18px Arial,sans-serif;fill:#69747a}</style></svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

function flattenVariants(products) {
  return products.flatMap((product) =>
    product.product_variants.map((variant) => {
      const onHand = variant.inventory?.on_hand ?? null;
      const reserved = variant.inventory?.reserved ?? null;
      const available =
        onHand === null || reserved === null ? null : onHand - reserved;
      const threshold = variant.inventory?.low_stock_threshold ?? null;
      let stockStatus = "Sem controle de estoque";
      if (!variant.is_active) stockStatus = "Variante inativa";
      else if (available !== null && available <= 0)
        stockStatus = "Indisponível";
      else if (
        available !== null &&
        threshold !== null &&
        available <= threshold
      )
        stockStatus = "Últimas unidades";
      else if (available !== null) stockStatus = "Disponível";

      return {
        product,
        variant,
        onHand,
        reserved,
        available,
        threshold,
        stockStatus,
      };
    }),
  );
}

function applyTableBodyStyle(sheet, startRow, endRow, numericColumns = []) {
  for (let rowIndex = startRow; rowIndex <= endRow; rowIndex += 1) {
    const row = sheet.getRow(rowIndex);
    if (rowIndex % 2 === 0) {
      row.eachCell((cell) => {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFFFFEFB" },
        };
      });
    }
    row.eachCell((cell) => {
      cell.alignment = { vertical: "middle", wrapText: true };
      cell.border = {
        bottom: { style: "hair", color: { argb: COLORS.border } },
      };
    });
    for (const column of numericColumns) {
      row.getCell(column).alignment = {
        horizontal: "right",
        vertical: "middle",
      };
    }
  }
}

async function buildSummary(
  workbook,
  snapshot,
  products,
  variants,
  categoryFilter,
) {
  const sheet = prepareSheet(
    workbook,
    "Resumo",
    ["Indicador", "Valor"],
    [36, 27, 4, 18, 18, 18, 18, 18, 18, 18, 18, 18, 18, 18],
  );
  const rows = [
    ["Produtos no catálogo", snapshot.summary.products_total],
    ["Produtos ativos", snapshot.summary.active_products],
    ["Rascunhos", snapshot.summary.draft_products],
    ["Arquivados", snapshot.summary.archived_products],
    ["Categorias", snapshot.summary.categories_total],
    ["Variantes ativas", snapshot.summary.active_variants],
    ["Variantes com estoque baixo", snapshot.summary.low_stock_variants],
    ["Variantes indisponíveis", snapshot.summary.out_of_stock_variants],
    ["Unidades disponíveis", snapshot.summary.available_units_total],
    ["Vendas e pedidos", "Disponível após ativação de pedidos"],
  ];
  rows.forEach((row) => writeSafeRow(sheet, row));
  sheet.getColumn(2).numFmt = INTEGER_FORMAT;
  for (let row = 2; row <= 10; row += 1) {
    sheet.getCell(row, 2).numFmt = INTEGER_FORMAT;
  }
  sheet.getCell(11, 2).alignment = { wrapText: true, vertical: "middle" };
  sheet.getRow(11).height = 34;
  applyTableBodyStyle(sheet, 2, 11, [2]);
  setFilter(sheet, 2, 11);

  writeSafeRow(sheet, [
    "Escopo exportado",
    categoryFilter ?? "Todas as categorias",
  ]);
  sheet.getCell(12, 1).font = { bold: true };
  sheet.getCell(12, 2).alignment = { wrapText: true };
  sheet.mergeCells("B12:N12");
  writeSafeRow(sheet, ["Produtos carregados", products.length]);
  writeSafeRow(sheet, ["Variantes carregadas", variants.length]);
  sheet.getCell(13, 2).numFmt = INTEGER_FORMAT;
  sheet.getCell(14, 2).numFmt = INTEGER_FORMAT;

  const categoryChart = await horizontalBarsSvg(
    "Produtos por categoria",
    chartRows(snapshot.categories, "product_count"),
    "Produtos",
  );
  const inventoryChart = await horizontalBarsSvg(
    "Unidades disponíveis por categoria",
    chartRows(snapshot.categories, "available_units"),
    "Unidades disponíveis",
  );
  const firstImage = workbook.addImage({
    buffer: categoryChart,
    extension: "png",
  });
  const secondImage = workbook.addImage({
    buffer: inventoryChart,
    extension: "png",
  });
  sheet.addImage(firstImage, {
    tl: { col: 0, row: 16 },
    ext: { width: 660, height: 370 },
  });
  sheet.addImage(secondImage, {
    tl: { col: 7, row: 16 },
    ext: { width: 660, height: 370 },
  });
  return sheet;
}

function buildProductsSheet(workbook, products, variants) {
  const sheet = prepareSheet(
    workbook,
    "Produtos",
    [
      "Produto",
      "Slug",
      "Categoria",
      "Status",
      "SKU",
      "Variante ativa",
      "Cor",
      "Tecido",
      "Preço (R$)",
      "Largura (mm)",
      "Profundidade (mm)",
      "Altura (mm)",
    ],
    [30, 28, 24, 15, 24, 16, 20, 24, 18, 17, 21, 17],
  );
  const rows = [];
  for (const product of products) {
    const productVariants = product.product_variants;
    if (productVariants.length === 0) {
      rows.push([
        product.name,
        product.slug,
        product.categories?.name ?? "Sem categoria",
        product.status,
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
      ]);
      continue;
    }
    for (const variant of productVariants) {
      rows.push([
        product.name,
        product.slug,
        product.categories?.name ?? "Sem categoria",
        product.status,
        variant.sku ?? "",
        variant.is_active ? "Sim" : "Não",
        variant.color ?? "",
        variant.fabric ?? "",
        variant.price_cents === null ? "" : variant.price_cents / 100,
        variant.width_mm ?? "",
        variant.depth_mm ?? "",
        variant.height_mm ?? "",
      ]);
    }
  }
  rows.forEach((row) => writeSafeRow(sheet, row));
  const dataEnd = rows.length + 1;
  applyTableBodyStyle(sheet, 2, dataEnd, [9, 10, 11, 12]);
  for (let index = 2; index <= dataEnd; index += 1) {
    sheet.getCell(index, 9).numFmt = CURRENCY_FORMAT;
    for (const column of [10, 11, 12]) {
      sheet.getCell(index, column).numFmt = INTEGER_FORMAT;
    }
  }
  setFilter(sheet, 12, dataEnd);
  const total = sheet.addRow([
    "Totais",
    "Produtos únicos",
    products.length,
    "Variantes exportadas",
    variants.length,
  ]);
  styleTotal(total);
  total.getCell(3).numFmt = INTEGER_FORMAT;
  total.getCell(5).numFmt = INTEGER_FORMAT;
  return sheet;
}

function buildInventorySheet(workbook, variants) {
  const sheet = prepareSheet(
    workbook,
    "Estoque",
    [
      "Produto",
      "Categoria",
      "SKU",
      "Cor",
      "Tecido",
      "Em mãos",
      "Reservadas",
      "Disponíveis",
      "Limite baixo",
      "Situação",
    ],
    [30, 24, 24, 20, 24, 15, 15, 15, 17, 24],
  );
  for (const entry of variants) {
    writeSafeRow(sheet, [
      entry.product.name,
      entry.product.categories?.name ?? "Sem categoria",
      entry.variant.sku ?? "",
      entry.variant.color ?? "",
      entry.variant.fabric ?? "",
      entry.onHand ?? "",
      entry.reserved ?? "",
      entry.available ?? "",
      entry.threshold ?? "",
      entry.stockStatus,
    ]);
  }
  const dataEnd = variants.length + 1;
  applyTableBodyStyle(sheet, 2, dataEnd, [6, 7, 8, 9]);
  for (let index = 0; index < variants.length; index += 1) {
    const entry = variants[index];
    const row = sheet.getRow(index + 2);
    const statusCell = row.getCell(10);
    if (entry.stockStatus === "Últimas unidades") {
      statusCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: COLORS.amber },
      };
      statusCell.font = { bold: true, color: { argb: COLORS.amberInk } };
    } else if (entry.stockStatus === "Indisponível") {
      statusCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: COLORS.red },
      };
      statusCell.font = { bold: true, color: { argb: COLORS.redInk } };
    } else if (entry.stockStatus === "Disponível") {
      statusCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: COLORS.green },
      };
      statusCell.font = { color: { argb: COLORS.greenInk } };
    }
  }
  for (let row = 2; row <= dataEnd; row += 1) {
    for (const column of [6, 7, 8, 9]) {
      sheet.getCell(row, column).numFmt = INTEGER_FORMAT;
    }
  }
  setFilter(sheet, 10, dataEnd);
  if (variants.length > 0) {
    sheet.addConditionalFormatting({
      ref: `H2:H${dataEnd}`,
      rules: [
        {
          type: "dataBar",
          cfvo: [{ type: "min" }, { type: "max" }],
          color: "FFD9B24C",
          showValue: true,
        },
      ],
    });
  }
  const onHandTotal = variants.reduce(
    (sum, item) => sum + (item.onHand ?? 0),
    0,
  );
  const reservedTotal = variants.reduce(
    (sum, item) => sum + (item.reserved ?? 0),
    0,
  );
  const availableTotal = variants.reduce(
    (sum, item) => sum + (item.available ?? 0),
    0,
  );
  const total = sheet.addRow([
    "Totais",
    "",
    "",
    "",
    "",
    onHandTotal,
    reservedTotal,
    availableTotal,
    "",
    "Unidades agregadas",
  ]);
  styleTotal(total);
  for (const column of [6, 7, 8]) total.getCell(column).numFmt = INTEGER_FORMAT;
  return sheet;
}

function buildCategoriesSheet(workbook, snapshot) {
  const sheet = prepareSheet(
    workbook,
    "Categorias",
    [
      "Categoria",
      "Produtos",
      "Variantes",
      "Variantes em estoque",
      "Estoque baixo",
      "Indisponíveis",
      "Unidades disponíveis",
    ],
    [30, 16, 16, 22, 18, 18, 24],
  );
  for (const category of snapshot.categories) {
    writeSafeRow(sheet, [
      category.category_name,
      category.product_count,
      category.variants_total,
      category.variants_in_stock,
      category.low_stock_variants,
      category.out_of_stock_variants,
      category.available_units,
    ]);
  }
  const dataEnd = snapshot.categories.length + 1;
  applyTableBodyStyle(sheet, 2, dataEnd, [2, 3, 4, 5, 6, 7]);
  for (let row = 2; row <= dataEnd; row += 1) {
    for (let column = 2; column <= 7; column += 1) {
      sheet.getCell(row, column).numFmt = INTEGER_FORMAT;
    }
  }
  setFilter(sheet, 7, dataEnd);
  const totals = Array.from({ length: 6 }, (_, index) =>
    snapshot.categories.reduce((sum, category) => {
      const key = [
        "product_count",
        "variants_total",
        "variants_in_stock",
        "low_stock_variants",
        "out_of_stock_variants",
        "available_units",
      ][index];
      return sum + category[key];
    }, 0),
  );
  const total = sheet.addRow(["Totais", ...totals]);
  styleTotal(total);
  for (let column = 2; column <= 7; column += 1) {
    total.getCell(column).numFmt = INTEGER_FORMAT;
  }
  return sheet;
}

function buildBehaviorSheet(workbook) {
  const sheet = prepareSheet(
    workbook,
    "Comportamento",
    ["Indicador", "Estado", "Observação"],
    [35, 40, 75],
  );
  const rows = [
    [
      "Visualizações de produto",
      "Ainda sem dados",
      "A coleta de eventos de comportamento não está incluída neste snapshot.",
    ],
    [
      "Busca e filtros",
      "Ainda sem dados",
      "Nenhuma série de eventos é simulada neste relatório.",
    ],
    [
      "Interações com produto",
      "Ainda sem dados",
      "A instrumentação analítica correspondente fica para a fase futura.",
    ],
    [
      "Vendas e pedidos",
      "Disponível após ativação de pedidos",
      "O fluxo de pedidos ainda não foi ativado.",
    ],
  ];
  rows.forEach((row) => writeSafeRow(sheet, row));
  for (let row = 2; row <= rows.length + 1; row += 1) {
    sheet.getRow(row).height = 34;
    sheet.getRow(row).eachCell((cell) => {
      cell.alignment = { vertical: "middle", wrapText: true };
    });
  }
  setFilter(sheet, 3, rows.length + 1);
  return sheet;
}

function buildMethodologySheet(
  workbook,
  snapshot,
  products,
  variants,
  categoryFilter,
) {
  const sheet = prepareSheet(
    workbook,
    "Metodologia",
    ["Tópico", "Descrição"],
    [34, 110],
  );
  const rows = [
    ["Gerado em (UTC)", new Date(snapshot.snapshot_at)],
    ["Filtro de categoria", categoryFilter ?? "Todas as categorias"],
    ["Produtos incluídos", products.length],
    ["Variantes incluídas", variants.length],
    [
      "Fonte dos indicadores",
      "Snapshot administrativo validado pelo serviço getAdminAnalyticsSnapshot.",
    ],
    [
      "Fonte do catálogo",
      "RPC administrativo paginado; página de 100 produtos, sem consulta ao banco no navegador.",
    ],
    [
      "Consistência temporal",
      "O timestamp do snapshot aplica-se aos indicadores do resumo. Produtos e estoque são lidos separadamente pelas páginas da RPC e podem refletir momentos diferentes se houver alterações administrativas concorrentes; este relatório não representa uma transação única.",
    ],
    [
      "Unidades disponíveis",
      "Calculadas como estoque em mãos menos unidades reservadas.",
    ],
    [
      "Estoque baixo",
      "Variante ativa com unidades disponíveis menores ou iguais ao limite baixo cadastrado.",
    ],
    [
      "Limite seguro",
      "Até 2.000 produtos, 20 páginas e 20.000 variantes; acima do limite a exportação é recusada sem arquivo parcial.",
    ],
    [
      "Privacidade",
      "Exportação administrativa. Não inclui dados pessoais, IDs de cliente, URLs assinadas ou caminhos de mídia.",
    ],
    [
      "Eventos",
      "Ainda sem dados. Este arquivo não inventa contagens nem séries temporais.",
    ],
    ["Vendas e pedidos", "Disponível após ativação de pedidos."],
    [
      "Fase 2 de Analytics",
      "Planejar instrumentação de eventos, séries temporais e métricas de funil após a ativação de pedidos. Esta fase não está implementada aqui; não há histórico, previsão ou valores simulados.",
    ],
  ];
  rows.forEach((row) => writeSafeRow(sheet, row));
  sheet.getCell(2, 1).alignment = { vertical: "middle", wrapText: true };
  sheet.getCell(2, 2).numFmt = 'dd/mm/yyyy hh:mm "UTC"';
  for (let row = 2; row <= rows.length + 1; row += 1) {
    sheet.getRow(row).height = [8, 11, 15].includes(row) ? 76 : 34;
    sheet.getRow(row).eachCell((cell) => {
      cell.alignment = { vertical: "middle", wrapText: true };
    });
  }
  for (const row of [4, 5]) sheet.getCell(row, 2).numFmt = INTEGER_FORMAT;
  setFilter(sheet, 2, rows.length + 1);
  return sheet;
}

/**
 * Builds the complete report in memory. Inputs are backend data only; no I/O,
 * current-time reads, remote calls or generated files are used by this helper.
 */
export async function buildAnalyticsWorkbookBuffer(
  snapshot,
  products,
  categoryFilter = null,
) {
  const variants = flattenVariants(products);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Império Sofás";
  workbook.lastModifiedBy = "Império Sofás";
  workbook.subject = "Snapshot administrativo de catálogo e estoque";
  workbook.title = "Relatório de analytics administrativo";
  workbook.company = "Império Sofás";
  workbook.created = new Date(snapshot.snapshot_at);
  workbook.modified = new Date(snapshot.snapshot_at);
  workbook.calcProperties.fullCalcOnLoad = false;

  await buildSummary(workbook, snapshot, products, variants, categoryFilter);
  buildProductsSheet(workbook, products, variants);
  buildInventorySheet(workbook, variants);
  buildCategoriesSheet(workbook, snapshot);
  buildBehaviorSheet(workbook);
  buildMethodologySheet(workbook, snapshot, products, variants, categoryFilter);

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
