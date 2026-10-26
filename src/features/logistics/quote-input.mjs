import { z } from "zod";

const supplierMode = z
  .object({
    supplierCode: z.enum(["VALE", "MUNDIAL"]),
    mode: z.enum(["pickup", "delivery"]),
    pickupLocationId: z.string().uuid().nullable(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.mode === "pickup" && !value.pickupLocationId) {
      context.addIssue({
        code: "custom",
        path: ["pickupLocationId"],
        message: "Escolha um local de retirada.",
      });
    }
    if (value.mode === "delivery" && value.pickupLocationId) {
      context.addIssue({
        code: "custom",
        path: ["pickupLocationId"],
        message: "Entrega não aceita local de retirada.",
      });
    }
    if (value.supplierCode === "MUNDIAL" && value.mode === "pickup") {
      context.addIssue({
        code: "custom",
        path: ["mode"],
        message: "Este fornecedor não oferece retirada.",
      });
    }
  });

const address = z
  .object({
    postalCode: z.string().regex(/^\d{5}-?\d{3}$/),
    floor: z
      .number()
      .int()
      .nonnegative()
      .refine(
        Number.isSafeInteger,
        "Informe um andar dentro do intervalo seguro.",
      ),
    number: z.string().trim().min(1).max(80),
    complement: z.string().trim().max(120),
  })
  .strict();

export const quoteRequestSchema = z
  .object({
    requestId: z.string().uuid(),
    supplierModes: z.array(supplierMode).min(1).max(2),
    address: address.optional(),
  })
  .strict()
  .superRefine((value, context) => {
    const supplierCodes = value.supplierModes.map(
      (group) => group.supplierCode,
    );
    if (new Set(supplierCodes).size !== supplierCodes.length) {
      context.addIssue({
        code: "custom",
        path: ["supplierModes"],
        message: "Há fornecedores duplicados.",
      });
    }

    const needsAddress = value.supplierModes.some(
      (group) => group.mode === "delivery",
    );
    if (needsAddress && !value.address) {
      context.addIssue({
        code: "custom",
        path: ["address"],
        message: "Informe o endereço para solicitar a cotação.",
      });
    }
    if (!needsAddress && value.address) {
      context.addIssue({
        code: "custom",
        path: ["address"],
        message: "Retirada não utiliza endereço de entrega.",
      });
    }
  });

export const logisticsQuoteIdSchema = z.string().uuid();
export const logisticsQuoteResponseSchema = z
  .object({
    quoteId: logisticsQuoteIdSchema,
    accept: z.boolean(),
  })
  .strict();
