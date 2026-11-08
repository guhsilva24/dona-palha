/**
 * Módulo de Cálculos de Produção, Fornada e Precificação por Margem
 * Realiza cálculos proporcionais de ingredientes (com suporte a gramas, kg, ml, un),
 * custos de lote, rendimento e precificação por margem de lucro.
 */

import { toCents, addCents, subtractCents, multiplyCents, divideCents, fromCents } from './money.js';

/**
 * Normaliza o fator de conversão entre unidades compatíveis (ex: kg <-> g, L <-> ml)
 * @param {string} supplyUnit Unidade comprada (ex: 'g', 'kg', 'un', 'ml', 'l')
 * @param {string} usedUnit Unidade usada (ex: 'g', 'kg', 'un', 'ml', 'l')
 * @returns {number} Multiplicador de escala da unidade comprada para a unidade usada
 */
export function normalizeUnitRatio(supplyUnit = 'g', usedUnit = 'g') {
  const s = String(supplyUnit || 'g').trim().toLowerCase();
  const u = String(usedUnit || 'g').trim().toLowerCase();
  if (s === u) return 1;
  if (s === 'kg' && u === 'g') return 1000;
  if (s === 'g' && u === 'kg') return 0.001;
  if (s === 'l' && u === 'ml') return 1000;
  if (s === 'ml' && u === 'l') return 0.001;
  return 1;
}

/**
 * Calcula o custo unitário de um insumo comprado.
 * @param {number|string} totalCost Valor total pago na compra
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
 * Calcula o custo proporcional exato de um ingrediente utilizado na receita,
 * com suporte completo a unidades (gramas, kg, ml, un, etc.).
 *
 * Exemplo 1: Comprou 1000g por R$ 30,00 e usou 200g -> R$ 6,00.
 * Exemplo 2: Comprou 1kg por R$ 30,00 e usou 200g -> R$ 6,00.
 *
 * @param {Object} params
 * @param {number|string} params.supplyTotal Valor total pago no insumo
 * @param {number} params.supplyQty Quantidade total comprada
 * @param {string} [params.supplyUnit='g'] Unidade comprada ('g', 'kg', 'un', 'ml', 'l')
 * @param {number} params.usedQty Quantidade utilizada na receita
 * @param {string} [params.usedUnit] Unidade utilizada (se omitido, usa supplyUnit)
 * @returns {Object} { unitCostCents, lineCostCents, unitCost, lineCost, formattedRatio }
 */
export function calculateIngredientCost({
  supplyTotal,
  supplyQty,
  supplyUnit = 'g',
  usedQty,
  usedUnit = null
}) {
  const supplyTotalCents = toCents(supplyTotal);
  const supQty = Number(supplyQty) || 0;
  const used = Number(usedQty) || 0;
  const targetUsedUnit = usedUnit || supplyUnit;

  if (supQty <= 0 || used <= 0 || supplyTotalCents <= 0) {
    return {
      unitCostCents: 0,
      lineCostCents: 0,
      unitCost: 0,
      lineCost: 0
    };
  }

  // Fator de conversão (ex: 1 kg comprado = 1000g de base)
  const ratio = normalizeUnitRatio(supplyUnit, targetUsedUnit);
  const normalizedSupplyQty = supQty * ratio;

  // Custo por unidade em centavos: (supplyTotalCents * used) / normalizedSupplyQty
  const lineCostCents = Math.round((supplyTotalCents * used) / normalizedSupplyQty);
  const unitCostCents = Math.round(supplyTotalCents / normalizedSupplyQty);

  return {
    unitCostCents,
    lineCostCents,
    unitCost: fromCents(unitCostCents),
    lineCost: fromCents(lineCostCents)
  };
}

/**
 * Processa a lista completa de ingredientes de uma fornada.
 * @param {Array<Object>} ingredients Lista de ingredientes
 * @returns {Object} { items: Array, totalBatchCostCents, totalBatchCost }
 */
export function calculateBatchIngredients(ingredients = []) {
  let totalBatchCostCents = 0;
  const items = ingredients.map(ing => {
    const calc = calculateIngredientCost({
      supplyTotal: ing.supplyTotal ?? ing.total,
      supplyQty: ing.supplyQty ?? ing.qty,
      supplyUnit: ing.supplyUnit ?? ing.unit ?? 'g',
      usedQty: ing.usedQty,
      usedUnit: ing.usedUnit ?? ing.unit ?? 'g'
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
 * @param {number} params.batchCostCents Custo total da fornada em centavos
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

/**
 * Calcula o preço de venda sugerido a partir do custo e da margem de lucro desejada (%)
 * Fórmula de Margem Comercial: Preço = Custo / (1 - Margem/100)
 * @param {Object} params
 * @param {number|string} params.cost Custo unitário
 * @param {number} params.marginPercent Margem percentual (ex: 50 para 50%)
 * @returns {Object}
 */
export function calculatePriceFromMargin({ cost, marginPercent }) {
  const costCents = toCents(cost);
  const margin = Math.min(95, Math.max(0, parseFloat(String(marginPercent).replace(',', '.')) || 0));

  if (costCents <= 0) {
    return {
      suggestedPriceCents: 0,
      suggestedPrice: 0,
      profitCents: 0,
      profit: 0,
      marginPercent: margin,
      markupPercent: 0
    };
  }

  // Preço = costCents / (1 - (margin / 100))
  const factor = (100 - margin) / 100;
  const priceCents = Math.round(costCents / factor);
  const profitCents = priceCents - costCents;
  const markupPercent = costCents > 0 ? Math.round((profitCents / costCents) * 100) : 0;

  return {
    suggestedPriceCents: priceCents,
    suggestedPrice: fromCents(priceCents),
    profitCents,
    profit: fromCents(profitCents),
    marginPercent: margin,
    markupPercent
  };
}

/**
 * Calcula a margem de lucro (%) e markup a partir do preço e custo.
 * @param {Object} params
 * @param {number|string} params.cost
 * @param {number|string} params.price
 * @returns {Object}
 */
export function calculateMarginFromPrice({ cost, price }) {
  const costCents = toCents(cost);
  const priceCents = toCents(price);
  const profitCents = priceCents - costCents;

  const marginPercent = priceCents > 0
    ? Math.round((profitCents / priceCents) * 100)
    : 0;

  const markupPercent = costCents > 0
    ? Math.round((profitCents / costCents) * 100)
    : 0;

  return {
    profitCents,
    profit: fromCents(profitCents),
    marginPercent,
    markupPercent
  };
}
