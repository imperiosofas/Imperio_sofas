import assert from "node:assert/strict";
import test from "node:test";
import {
  lookupPostalCode,
  normalizePostalCode,
} from "../src/features/logistics/cep-lookup.mjs";

const validViaCep = {
  cep: "12081-670",
  logradouro: "Rua Agostinho Abifadel",
  bairro: "Terra Nova",
  localidade: "Taubaté",
  uf: "SP",
  ibge: "3554102",
};
const validIbge = {
  id: 3554102,
  nome: "Taubaté",
  microrregiao: { mesorregiao: { UF: { sigla: "SP" } } },
};

function mockFetch(payloads, responses = []) {
  const calls = [];
  return {
    calls,
    fetcher: async (url, options) => {
      calls.push({ url: String(url), options });
      const index = calls.length - 1;
      const response = responses[index];
      return (
        response ?? {
          ok: true,
          json: async () => payloads[index],
        }
      );
    },
  };
}

test("normalizes CEP formatting and rejects malformed values", () => {
  assert.equal(normalizePostalCode("12081-670"), "12081670");
  assert.equal(normalizePostalCode(" 12081-670 "), "12081670");
  assert.equal(normalizePostalCode("1208"), null);
  assert.equal(normalizePostalCode("12081-67A"), null);
  assert.equal(normalizePostalCode("A12081-670"), null);
  assert.equal(normalizePostalCode(null), null);
});

test("does not call providers for an invalid CEP", async () => {
  const mock = mockFetch([]);
  assert.deepEqual(await lookupPostalCode("12", mock.fetcher), {
    status: "invalid",
  });
  assert.equal(mock.calls.length, 0);
});

test("looks up CEP server-side and verifies the municipality with IBGE", async () => {
  const mock = mockFetch([validViaCep, validIbge]);
  assert.deepEqual(await lookupPostalCode("12081-670", mock.fetcher), {
    status: "found",
    postalCode: "12081670",
    municipalityId: "3554102",
    city: "Taubaté",
    state: "SP",
    street: "Rua Agostinho Abifadel",
    neighborhood: "Terra Nova",
  });
  assert.match(mock.calls[0].url, /viacep\.com\.br\/ws\/12081670\/json\/$/);
  assert.match(mock.calls[1].url, /localidades\/municipios\/3554102$/);
  assert.equal(mock.calls[0].options.next.revalidate, 86400);
  assert.equal(mock.calls[1].options.next.revalidate, 86400);
});

test("reports a valid but unknown postal code without enabling delivery", async () => {
  const mock = mockFetch([{ erro: true }]);
  assert.deepEqual(await lookupPostalCode("99999-999", mock.fetcher), {
    status: "not_found",
  });
  assert.equal(mock.calls.length, 1);
});

test("rejects a provider municipality that disagrees with the IBGE record", async () => {
  const mock = mockFetch([
    validViaCep,
    { ...validIbge, microrregiao: { mesorregiao: { UF: { sigla: "RJ" } } } },
  ]);
  assert.deepEqual(await lookupPostalCode("12081670", mock.fetcher), {
    status: "unavailable",
  });
});

test("treats provider errors, malformed data, and timeouts as unavailable", async () => {
  const badStatus = mockFetch([], [{ ok: false, json: async () => ({}) }]);
  assert.deepEqual(await lookupPostalCode("12081670", badStatus.fetcher), {
    status: "unavailable",
  });

  const badData = mockFetch([{ ...validViaCep, ibge: "bad" }]);
  assert.deepEqual(await lookupPostalCode("12081670", badData.fetcher), {
    status: "unavailable",
  });

  assert.deepEqual(
    await lookupPostalCode("12081670", async () => {
      throw new Error("timeout");
    }),
    { status: "unavailable" },
  );
});
