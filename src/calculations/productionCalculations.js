/**
 * Módulo de Cálculos de Produção e Fornada
 * Realiza cálculos proporcionais de ingredientes, custos de lote, rendimento e projeções.
 */

import { toCents, addCents, subtractCents, multiplyCents, divideCents, fromCents } from './money.js';

/**
 * Calcula o custo unitário de um insumo comprado.
 * @param {number|string} totalCost Valor total pago na compra (em decimal ou centavos)
 * @param {number} totalQty Quantidade total comprada
 * @returns {number} Custo unitário em centavos
 */
export function calculateSupplyUnitCost(totalCost, totalQty) {
  const totalCents = typeof totalCost === 'number' && Number.isInteger(totalCost) && totalCost > 500 && !String(totalCost).includes('.')
    ? totalCost
    : toCents(totalCost);
  const qty = Number(totalQty) || 0;
  if (qty <= 0) return 0;
  return divideCents(totalCents, qty);
}

/**
 * Calcula o custo proporcional de um ingrediente utilizado na receita.
 * Ex: Comprou 1000g por R$ 30,00 e usou 200g -> R$ 6,00.
 * @param {Object} params
 * @param {number|string} params.supplyTotal Valor total da compra do insumo
 * @param {number} params.supplyQty Quantidade total comprada do insumo
 * @param {number} params.usedQty Quantidade utilizada na fornada
 * @returns {Object} { unitCostCents, lineCostCents, unitCost, lineCost }
 */
export function calculateIngredientCost({ supplyTotal, supplyQty, usedQty }) {
  const supplyTotalCents = toCents(supplyTotal);
  const supQty = Number(supplyQty) || 0;
  const used = Number(usedQty) || 0;

  if (supQty <= 0 || used <= 0 || supplyTotalCents <= 0) {
    return {
      unitCostCents: 0,
      lineCostCents: 0,
      unitCost: 0,
      lineCost: 0
    };
  }

  // Preço unitário em centavos por fração de unidade comprada
  // Usamos proporção exata: (supplyTotalCents * used) / supQty
  const lineCostCents = Math.round((supplyTotalCents * used) / supQty);
  const unitCostCents = Math.round(supplyTotalCents / supQty);

  return {
    unitCostCents,
    lineCostCents,
    unitCost: fromCents(unitCostCents),
    lineCost: fromCents(lineCostCents)
  };
}

/**
 * Processa a lista completa de ingredientes de uma fornada.
 * @param {Array<Object>} ingredients Lista de { supplyTotal, supplyQty, usedQty, name }
 * @returns {Object} { items: Array, totalBatchCostCents, totalBatchCost }
 */
export function calculateBatchIngredients(ingredients = []) {
  let totalBatchCostCents = 0;
  const items = ingredients.map(ing => {
    const calc = calculateIngredientCost({
      supplyTotal: ing.supplyTotal ?? ing.total,
      supplyQty: ing.supplyQty ?? ing.qty,
      usedQty: ing.usedQty
    });
    totalBatchCostCents = addCents(totalBatchCostCents, calc.lineCostCents);
    return {
      ...ing,
      unitCostCents: calc.unitCostCents,
      lineCostCents: calc.lineCostCents,
      unitCost: calc.unitCost,
      lineCost: calc.lineCost
    };
  });

  return {
    items,
    totalBatchCostCents,
    totalBatchCost: fromCents(totalBatchCostCents)
  };
}

/**
 * Realiza o cálculo completo de viabilidade da fornada (Produção)
 * @param {Object} params
 * @param {number} params.batchCostCents Custo total da fornada em centavos (ou calculado a partir de ingredientes)
 * @param {number} params.batchUnits Rendimento (unidades de palha produzidas)
 * @param {number|string} params.sellingPrice Preço de venda unitário cadastrado
 * @returns {Object}
 */
export function calculateBatchSummary({ batchCostCents, batchUnits, sellingPrice }) {
  const units = Math.max(0, parseInt(batchUnits, 10) || 0);
  const costCents = Math.max(0, parseInt(batchCostCents, 10) || 0);
  const priceCents = toCents(sellingPrice);

  const unitCostCents = units > 0 ? divideCents(costCents, units) : 0;
  const unitProfitCents = subtractCents(priceCents, unitCostCents);
  const profitMargin = priceCents > 0 ? (unitProfitCents / priceCents) : 0;
  const profitMarginPercent = Math.round(profitMargin * 100);

  const projectedRevenueCents = multiplyCents(priceCents, units);
  const projectedProfitCents = subtractCents(projectedRevenueCents, costCents);

  return {
    batchUnits: units,
    batchCostCents: costCents,
    batchCost: fromCents(costCents),
    unitCostCents,
    unitCost: fromCents(unitCostCents),
    sellingPriceCents: priceCents,
    sellingPrice: fromCents(priceCents),
    unitProfitCents,
    unitProfit: fromCents(unitProfitCents),
    profitMargin,
    profitMarginPercent,
    projectedRevenueCents,
    projectedRevenue: fromCents(projectedRevenueCents),
    projectedProfitCents,
    projectedProfit: fromCents(projectedProfitCents)
  };
}
