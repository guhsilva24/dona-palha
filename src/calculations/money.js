/**
 * Módulo de precisão monetária (Cálculo em centavos inteiros)
 * Evita imprecisões de ponto flutuante do JavaScript (IEEE 754)
 */

export const BRL_FORMATTER = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

/**
 * Converte qualquer representação de valor (número ou string brasileira) para centavos inteiros.
 * Ex: 6.5 -> 650; "6,50" -> 650; "1.250,45" -> 125045
 * @param {number|string} val
 * @returns {number} Centavos inteiros
 */
export function toCents(val) {
  if (val == null || val === '') return 0;
  if (typeof val === 'number') {
    if (!Number.isFinite(val)) return 0;
    return Math.round(val * 100);
  }
  let s = String(val).trim().replace(/[^\d.,-]/g, '');
  if (!s) return 0;
  const isNegative = s.startsWith('-');
  if (isNegative) s = s.slice(1);

  if (s.includes(',')) {
    // Formato brasileiro: 1.250,50
    s = s.replace(/\./g, '').replace(',', '.');
  }
  const n = parseFloat(s);
  if (!Number.isFinite(n)) return 0;
  const cents = Math.round(n * 100);
  return isNegative ? -cents : cents;
}

/**
 * Converte centavos inteiros para número decimal.
 * Ex: 650 -> 6.5
 * @param {number} cents
 * @returns {number}
 */
export function fromCents(cents) {
  if (!Number.isFinite(cents)) return 0;
  return cents / 100;
}

/**
 * Formata centavos inteiros como moeda Real (R$ 0,00).
 * @param {number} cents
 * @returns {string}
 */
export function formatCents(cents) {
  return BRL_FORMATTER.format(fromCents(cents));
}

/**
 * Formata valor decimal ou número para BRL.
 * @param {number} val
 * @returns {string}
 */
export function formatMoney(val) {
  return formatCents(toCents(val));
}

/**
 * Formata centavos para preenchimento de input HTML com formato pt-BR (ex: 650 -> "6,50")
 * @param {number} cents
 * @returns {string}
 */
export function centsToInput(cents) {
  return (fromCents(cents)).toFixed(2).replace('.', ',');
}

/**
 * Formata decimal para preenchimento de input HTML com formato pt-BR (ex: 6.5 -> "6,50")
 * @param {number} val
 * @returns {string}
 */
export function moneyToInput(val) {
  return centsToInput(toCents(val));
}

/**
 * Soma lista de centavos com precisão exata.
 * @param  {...number} centsList
 * @returns {number}
 */
export function addCents(...centsList) {
  return centsList.reduce((acc, c) => acc + (Number(c) || 0), 0);
}

/**
 * Subtrai centavos: a - b
 * @param {number} a
 * @param {number} b
 * @returns {number}
 */
export function subtractCents(a, b) {
  return (Number(a) || 0) - (Number(b) || 0);
}

/**
 * Multiplica centavos por uma quantidade/fator com arredondamento seguro.
 * @param {number} cents
 * @param {number} factor
 * @returns {number}
 */
export function multiplyCents(cents, factor) {
  if (!cents || !factor) return 0;
  return Math.round(cents * factor);
}

/**
 * Divide centavos por um divisor com arredondamento seguro.
 * @param {number} cents
 * @param {number} divisor
 * @returns {number}
 */
export function divideCents(cents, divisor) {
  if (!divisor || divisor === 0) return 0;
  return Math.round(cents / divisor);
}

