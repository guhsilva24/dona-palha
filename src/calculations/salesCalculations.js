/**
 * Módulo de Cálculos de Vendas e Resultados Financeiros
 * Garante preservação histórica de custos e precisão com centavos inteiros.
 */

import { toCents, fromCents, multiplyCents, subtractCents, addCents, divideCents } from './money.js';

/**
 * Calcula os valores de uma venda individual mantendo os custos históricos.
 * @param {Object} params
 * @param {number} params.qty Quantidade vendida
 * @param {number|string} params.price Preço unitário praticado na venda
 * @param {number|string} params.cost Custo unitário histórico no momento da venda
 * @returns {Object}
 */
export function calculateSaleItem({ qty, price, cost }) {
  const q = Math.max(0, parseInt(qty, 10) || 0);
  const priceCents = toCents(price);
  const costCents = toCents(cost);

  const totalRevenueCents = multiplyCents(priceCents, q);
  const totalCostCents = multiplyCents(costCents, q);
  const unitProfitCents = subtractCents(priceCents, costCents);
  const totalProfitCents = subtractCents(totalRevenueCents, totalCostCents);
  const profitMargin = totalRevenueCents > 0 ? (totalProfitCents / totalRevenueCents) : 0;

  return {
    qty: q,
    unitPriceCents: priceCents,
    unitPrice: fromCents(priceCents),
    unitCostCents: costCents,
    unitCost: fromCents(costCents),
    totalRevenueCents,
    totalRevenue: fromCents(totalRevenueCents),
    totalCostCents,
    totalCost: fromCents(totalCostCents),
    unitProfitCents,
    unitProfit: fromCents(unitProfitCents),
    totalProfitCents,
    totalProfit: fromCents(totalProfitCents),
    profitMargin,
    profitMarginPercent: Math.round(profitMargin * 100)
  };
}

/**
 * Calcula estatísticas globais acumuladas de vendas.
 * @param {Array<Object>} sales Lista de vendas
 * @returns {Object} { fat, luc, rec, pen, un, margem, totalCount, paidCount, pendingCount }
 */
export function calculateOverallSalesStats(sales = []) {
  let fatCents = 0;
  let lucCents = 0;
  let recCents = 0;
  let penCents = 0;
  let totalUnits = 0;
  let paidCount = 0;
  let pendingCount = 0;

  sales.forEach(s => {
    const calc = calculateSaleItem({ qty: s.qty, price: s.price, cost: s.cost });
    fatCents = addCents(fatCents, calc.totalRevenueCents);
    lucCents = addCents(lucCents, calc.totalProfitCents);
    totalUnits += calc.qty;

    if (s.paid) {
      recCents = addCents(recCents, calc.totalRevenueCents);
      paidCount++;
    } else {
      penCents = addCents(penCents, calc.totalRevenueCents);
      pendingCount++;
    }
  });

  const margin = fatCents > 0 ? (lucCents / fatCents) : 0;

  return {
    fatCents,
    fat: fromCents(fatCents),
    lucCents,
    luc: fromCents(lucCents),
    recCents,
    rec: fromCents(recCents),
    penCents,
    pen: fromCents(penCents),
    un: totalUnits,
    margem: margin,
    margemPercent: Math.round(margin * 100),
    totalCount: sales.length,
    paidCount,
    pendingCount
  };
}

/**
 * Filtra e calcula estatísticas de vendas dentro de um intervalo de datas [startDate, endDate].
 * Formato das datas: YYYY-MM-DD
 * @param {Array<Object>} sales
 * @param {string} startDate
 * @param {string} endDate
 * @returns {Object}
 */
export function calculatePeriodSalesStats(sales = [], startDate, endDate) {
  const filtered = sales.filter(s => {
    if (!s.date) return false;
    return s.date >= startDate && s.date <= endDate;
  });

  let fatCents = 0;
  let custoCents = 0;
  let lucCents = 0;
  let paidVCents = 0;
  let penVCents = 0;
  let paidN = 0;
  let penN = 0;
  let totalUnits = 0;

  filtered.forEach(s => {
    const calc = calculateSaleItem({ qty: s.qty, price: s.price, cost: s.cost });
    fatCents = addCents(fatCents, calc.totalRevenueCents);
    custoCents = addCents(custoCents, calc.totalCostCents);
    lucCents = addCents(lucCents, calc.totalProfitCents);
    totalUnits += calc.qty;

    if (s.paid) {
      paidN++;
      paidVCents = addCents(paidVCents, calc.totalRevenueCents);
    } else {
      penN++;
      penVCents = addCents(penVCents, calc.totalRevenueCents);
    }
  });

  const margin = fatCents > 0 ? (lucCents / fatCents) : 0;

  return {
    startDate,
    endDate,
    n: filtered.length,
    un: totalUnits,
    fatCents,
    fat: fromCents(fatCents),
    custoCents,
    custo: fromCents(custoCents),
    lucCents,
    luc: fromCents(lucCents),
    paidN,
    paidVCents,
    paidV: fromCents(paidVCents),
    penN,
    penVCents,
    penV: fromCents(penVCents),
    margem: margin,
    margemPercent: Math.round(margin * 100),
    list: filtered
  };
}

/**
 * Agrupa o desempenho de vendas por sabor para um determinado período.
 * @param {Array<Object>} salesList Lista filtrada de vendas do período
 * @param {Array<Object>} flavors Lista de sabores cadastrados
 * @returns {Map<string, Object>} Mapa de saborId -> { un, custoCents, lucCents, fatCents, ... }
 */
export function aggregateSalesByFlavor(salesList = [], flavors = []) {
  const map = new Map();

  flavors.forEach(f => {
    map.set(f.id, {
      flavorId: f.id,
      flavorName: f.name,
      un: 0,
      custoCents: 0,
      lucCents: 0,
      fatCents: 0
    });
  });

  salesList.forEach(s => {
    let entry = map.get(s.flavorId);
    if (!entry) {
      entry = {
        flavorId: s.flavorId,
        flavorName: s.flavorName || 'Outro',
        un: 0,
        custoCents: 0,
        lucCents: 0,
        fatCents: 0
      };
      map.set(s.flavorId, entry);
    }

    const calc = calculateSaleItem({ qty: s.qty, price: s.price, cost: s.cost });
    entry.un += calc.qty;
    entry.custoCents = addCents(entry.custoCents, calc.totalCostCents);
    entry.lucCents = addCents(entry.lucCents, calc.totalProfitCents);
    entry.fatCents = addCents(entry.fatCents, calc.totalRevenueCents);
  });

  // Converte centavos para valores legíveis
  const result = {};
  for (const [key, val] of map.entries()) {
    result[key] = {
      ...val,
      custo: fromCents(val.custoCents),
      luc: fromCents(val.lucCents),
      fat: fromCents(val.fatCents)
    };
  }
  return result;
}

/**
 * Calcula o resultado financeiro mensal completo (Faturamento vs Gastos com compras).
 * @param {Object} params
 * @param {Array<Object>} params.sales Lista de todas as vendas
 * @param {Array<Object>} params.costs Lista de todos os custos/compras
 * @param {string} params.yearMonth Formato 'YYYY-MM'
 * @returns {Object}
 */
export function calculateMonthlyResult({ sales = [], costs = [], yearMonth }) {
  let fatCents = 0;
  let lucCents = 0;
  let gastosCents = 0;

  sales.forEach(s => {
    if (s.date && s.date.slice(0, 7) === yearMonth) {
      const calc = calculateSaleItem({ qty: s.qty, price: s.price, cost: s.cost });
      fatCents = addCents(fatCents, calc.totalRevenueCents);
      lucCents = addCents(lucCents, calc.totalProfitCents);
    }
  });

  costs.forEach(c => {
    if (c.date && c.date.slice(0, 7) === yearMonth) {
      gastosCents = addCents(gastosCents, toCents(c.total));
    }
  });

  const resCents = subtractCents(fatCents, gastosCents);

  return {
    yearMonth,
    fatCents,
    fat: fromCents(fatCents),
    lucCents,
    luc: fromCents(lucCents),
    gastosCents,
    gastos: fromCents(gastosCents),
    resCents,
    res: fromCents(resCents),
    isPositive: resCents >= 0
  };
}
