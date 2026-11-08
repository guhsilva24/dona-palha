/**
 * Módulo de Cálculos de Estoque e Custo Médio Ponderado
 * Controla movimentações, prevenção de estoque negativo e valorização de inventário.
 */

import { toCents, fromCents, multiplyCents, divideCents, addCents } from './money.js';

export const MOVEMENT_TYPES = {
  PRODUCTION_IN: 'production_in',
  SALE_OUT: 'sale_out',
  SALE_CANCEL_IN: 'sale_cancel_in',
  LOSS: 'loss',
  ADJUSTMENT_IN: 'adjustment_in',
  ADJUSTMENT_OUT: 'adjustment_out'
};

/**
 * Calcula o novo custo médio ponderado após uma nova fornada de produção.
 * Fórmula: Custo Médio = ((Estoque Antigo * Custo Antigo) + Custo da Nova Fornada) / (Estoque Antigo + Unidades Produzidas)
 *
 * @param {Object} params
 * @param {number} params.currentStock Estoque atual antes da produção (unidades)
 * @param {number|string} params.currentCost Custo unitário atual (em decimal ou centavos)
 * @param {number} params.producedUnits Quantidade de unidades produzidas na nova fornada
 * @param {number|string} params.batchCost Custo total dos ingredientes da nova fornada
 * @returns {Object} { newStock, newAvgCostCents, newAvgCost, previousCostCents }
 */
export function calculateWeightedAverageCost({ currentStock = 0, currentCost = 0, producedUnits = 0, batchCost = 0 }) {
  const stock = Math.max(0, parseInt(currentStock, 10) || 0);
  const units = Math.max(0, parseInt(producedUnits, 10) || 0);
  const costCents = toCents(currentCost);
  const newBatchCostCents = toCents(batchCost);

  const newStock = stock + units;

  if (newStock <= 0) {
    return {
      newStock: 0,
      newAvgCostCents: 0,
      newAvgCost: 0,
      previousCostCents: costCents
    };
  }

  // Se não havia estoque anterior, o custo médio é exatamente o custo unitário da nova fornada
  if (stock === 0) {
    const unitCostCents = units > 0 ? divideCents(newBatchCostCents, units) : 0;
    return {
      newStock,
      newAvgCostCents: unitCostCents,
      newAvgCost: fromCents(unitCostCents),
      previousCostCents: costCents
    };
  }

  // Se não foi produzida nenhuma unidade nova, mantém o custo atual
  if (units === 0) {
    return {
      newStock: stock,
      newAvgCostCents: costCents,
      newAvgCost: fromCents(costCents),
      previousCostCents: costCents
    };
  }

  const existingInventoryValuationCents = multiplyCents(costCents, stock);
  const totalValuationCents = addCents(existingInventoryValuationCents, newBatchCostCents);
  const newAvgCostCents = divideCents(totalValuationCents, newStock);

  return {
    newStock,
    newAvgCostCents,
    newAvgCost: fromCents(newAvgCostCents),
    previousCostCents: costCents
  };
}

/**
 * Valida se é seguro realizar uma movimentação de estoque sem torná-lo negativo.
 * @param {Object} params
 * @param {number} params.currentStock
 * @param {number} params.delta Quantidade a alterar (positivo para entrada, negativo para saída)
 * @param {string} params.type Tipo da movimentação
 * @returns {Object} { valid: boolean, error?: string, projectedStock: number }
 */
export function validateStockMovement({ currentStock, delta, type }) {
  const current = parseInt(currentStock, 10) || 0;
  const change = parseInt(delta, 10);

  if (Number.isNaN(change)) {
    return { valid: false, error: 'Quantidade de movimentação inválida.', projectedStock: current };
  }

  const projectedStock = current + change;

  if (projectedStock < 0) {
    return {
      valid: false,
      error: `Estoque insuficiente: há ${current} un disponível(is), mas a operação requer ${Math.abs(change)} un.`,
      projectedStock: current
    };
  }

  return { valid: true, projectedStock };
}

/**
 * Calcula o valor total do estoque somando todos os sabores.
 * @param {Array<Object>} flavors Lista de sabores com { stock, cost }
 * @returns {Object} { totalUnits, totalValueCents, totalValue }
 */
export function calculateInventoryValuation(flavors = []) {
  let totalUnits = 0;
  let totalValueCents = 0;

  flavors.forEach(f => {
    const stock = Math.max(0, parseInt(f.stock, 10) || 0);
    const costCents = toCents(f.cost);
    totalUnits += stock;
    totalValueCents = addCents(totalValueCents, multiplyCents(costCents, stock));
  });

  return {
    totalUnits,
    totalValueCents,
    totalValue: fromCents(totalValueCents)
  };
}

/**
 * Retorna se o sabor possui estoque baixo ou zerado para alertas visuais
 * @param {number} stock
 * @param {number} threshold Limiar de alerta (padrão 5)
 * @returns {'out_of_stock'|'low_stock'|'normal'}
 */
export function getStockStatus(stock, threshold = 5) {
  const s = parseInt(stock, 10) || 0;
  if (s <= 0) return 'out_of_stock';
  if (s <= threshold) return 'low_stock';
  return 'normal';
}
