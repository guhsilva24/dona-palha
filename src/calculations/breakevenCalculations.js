/**
 * Módulo de Cálculo de Ponto de Equilíbrio (Break-even Point)
 * Determina quantas palhas precisam ser vendidas para cobrir os custos cadastrados.
 */

import { toCents, fromCents, subtractCents, divideCents } from './money.js';

/**
 * Calcula o ponto de equilíbrio operacional.
 * Aceita tanto valores em centavos diretos (totalExpensesCents / totalRevenueCents)
 * quanto valores decimais (totalExpenses / totalRevenue).
 *
 * @param {Object} params
 * @param {number} [params.totalExpensesCents] Total de gastos em compras (em centavos inteiros)
 * @param {number|string} [params.totalExpenses] Total de gastos em compras (em decimal ou formatado)
 * @param {number} [params.totalRevenueCents] Faturamento total realizado (em centavos inteiros)
 * @param {number|string} [params.totalRevenue] Faturamento total realizado (em decimal ou formatado)
 * @param {number} [params.totalUnitsSold=0] Unidades vendidas no histórico
 * @param {Array<Object>} [params.flavors=[]] Sabores cadastrados (caso nenhuma venda tenha ocorrido ainda)
 * @returns {Object}
 */
export function calculateBreakevenPoint({
  totalExpensesCents,
  totalExpenses,
  totalRevenueCents,
  totalRevenue,
  totalUnitsSold = 0,
  flavors = []
}) {
  const gastosCents = totalExpensesCents != null
    ? Math.max(0, parseInt(totalExpensesCents, 10) || 0)
    : toCents(totalExpenses);

  const fatCents = totalRevenueCents != null
    ? Math.max(0, parseInt(totalRevenueCents, 10) || 0)
    : toCents(totalRevenue);

  const unitsSold = Math.max(0, parseInt(totalUnitsSold, 10) || 0);

  let avgPriceCents = 0;
  if (unitsSold > 0 && fatCents > 0) {
    avgPriceCents = divideCents(fatCents, unitsSold);
  } else if (flavors.length > 0) {
    const sumFlavorsCents = flavors.reduce((acc, f) => acc + toCents(f.price), 0);
    avgPriceCents = divideCents(sumFlavorsCents, flavors.length);
  }

  const faltaCents = Math.max(0, subtractCents(gastosCents, fatCents));
  const avgPrice = fromCents(avgPriceCents);

  let unitsNeeded = 0;
  if (faltaCents > 0 && avgPriceCents > 0) {
    unitsNeeded = Math.ceil(faltaCents / avgPriceCents);
  }

  const percentage = gastosCents > 0
    ? Math.min(100, Math.round((fatCents / gastosCents) * 100))
    : 0;

  return {
    gastosCents,
    gastos: fromCents(gastosCents),
    fatCents,
    fat: fromCents(fatCents),
    avgPriceCents,
    avgPrice,
    faltaCents,
    falta: fromCents(faltaCents),
    unitsNeeded,
    percentage,
    isCovered: faltaCents === 0 && gastosCents > 0
  };
}
