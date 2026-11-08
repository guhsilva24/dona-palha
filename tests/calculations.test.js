import { describe, it, expect } from 'vitest';
import {
  toCents,
  fromCents,
  formatMoney,
  centsToInput,
  addCents,
  subtractCents,
  multiplyCents,
  divideCents,
  calculateIngredientCost,
  calculateBatchIngredients,
  calculateBatchSummary,
  calculateWeightedAverageCost,
  validateStockMovement,
  calculateInventoryValuation,
  calculateSaleItem,
  calculateOverallSalesStats,
  calculatePeriodSalesStats,
  calculateMonthlyResult,
  calculateBreakevenPoint
} from '../src/calculations/index.js';

describe('Módulo de Dinheiro e Precisão em Centavos (money.js)', () => {
  it('converte números decimais e strings BRL para centavos inteiros com precisão', () => {
    expect(toCents(6.50)).toBe(650);
    expect(toCents('6,50')).toBe(650);
    expect(toCents('R$ 1.250,90')).toBe(125090);
    expect(toCents('0,01')).toBe(1);
    expect(toCents(0)).toBe(0);
    expect(toCents(null)).toBe(0);
    expect(toCents(-15.75)).toBe(-1575);
  });

  it('evita erros clássicos de arredondamento IEEE 754 (ex: 0.1 + 0.2)', () => {
    const sumCents = addCents(toCents(0.1), toCents(0.2));
    expect(sumCents).toBe(30);
    expect(fromCents(sumCents)).toBe(0.3);
  });

  it('formata valores monetários em formato pt-BR', () => {
    expect(formatMoney(6.5)).toMatch(/R\$\s*6,50/);
    expect(centsToInput(650)).toBe('6,50');
  });

  it('operações básicas de centavos', () => {
    expect(addCents(100, 250, 50)).toBe(400);
    expect(subtractCents(500, 150)).toBe(350);
    expect(multiplyCents(100, 2.5)).toBe(250);
    expect(divideCents(100, 3)).toBe(33);
    expect(divideCents(100, 0)).toBe(0);
  });
});

describe('Módulo de Produção e Fornada (productionCalculations.js)', () => {
  it('calcula o custo proporcional exato de ingrediente utilizado', () => {
    // Comprou 1000g por R$ 30,00 e usou 200g -> R$ 6,00 (600 centavos)
    const res = calculateIngredientCost({
      supplyTotal: 30,
      supplyQty: 1000,
      usedQty: 200
    });
    expect(res.lineCostCents).toBe(600);
    expect(res.lineCost).toBe(6);
  });

  it('processa múltiplos ingredientes e totaliza a fornada', () => {
    const ingredients = [
      { supplyTotal: 50, supplyQty: 2, usedQty: 1 }, // 25.00
      { supplyTotal: 20, supplyQty: 5, usedQty: 2 }, // 8.00
      { supplyTotal: 10, supplyQty: 10, usedQty: 5 } // 5.00
    ];
    const batch = calculateBatchIngredients(ingredients);
    expect(batch.totalBatchCostCents).toBe(3800); // 38.00
    expect(batch.totalBatchCost).toBe(38);
    expect(batch.items.length).toBe(3);
  });

  it('calcula o resumo da fornada: custo por unidade, rendimento, lucro e faturamento previsto', () => {
    // Custo fornada: R$ 80,00 (8000 centavos)
    // Rendimento: 40 palhas
    // Preço de venda: R$ 6,00 (600 centavos)
    const summary = calculateBatchSummary({
      batchCostCents: 8000,
      batchUnits: 40,
      sellingPrice: 6.00
    });

    expect(summary.unitCostCents).toBe(200); // R$ 2,00 por palha
    expect(summary.unitCost).toBe(2);
    expect(summary.unitProfitCents).toBe(400); // R$ 4,00 de lucro por palha
    expect(summary.unitProfit).toBe(4);
    expect(summary.profitMarginPercent).toBe(67); // 4 / 6 ~= 66.67% -> 67%
    expect(summary.projectedRevenueCents).toBe(24000); // R$ 240,00 faturamento previsto
    expect(summary.projectedProfitCents).toBe(16000); // R$ 160,00 lucro previsto
  });
});

describe('Módulo de Estoque e Custo Médio Ponderado (inventoryCalculations.js)', () => {
  it('calcula o novo custo médio ponderado quando há estoque prévio', () => {
    // Estoque anterior: 10 unidades com custo médio de R$ 2,00 (200 centavos) = R$ 20,00
    // Nova fornada: 30 unidades custando R$ 100,00 total (10000 centavos)
    // Total estoque: 40 unidades. Custo total: 20 + 100 = 120,00
    // Novo custo médio: 120 / 40 = R$ 3,00 (300 centavos)
    const result = calculateWeightedAverageCost({
      currentStock: 10,
      currentCost: 2.00,
      producedUnits: 30,
      batchCost: 100.00
    });

    expect(result.newStock).toBe(40);
    expect(result.newAvgCostCents).toBe(300);
    expect(result.newAvgCost).toBe(3);
  });

  it('atribui custo direto da fornada quando estoque anterior era zero', () => {
    const result = calculateWeightedAverageCost({
      currentStock: 0,
      currentCost: 0,
      producedUnits: 25,
      batchCost: 75.00
    });

    expect(result.newStock).toBe(25);
    expect(result.newAvgCostCents).toBe(300); // 75 / 25 = 3.00
  });

  it('impede estoque negativo em movimentações de saída', () => {
    const check1 = validateStockMovement({ currentStock: 5, delta: -3, type: 'sale_out' });
    expect(check1.valid).toBe(true);
    expect(check1.projectedStock).toBe(2);

    const check2 = validateStockMovement({ currentStock: 5, delta: -6, type: 'sale_out' });
    expect(check2.valid).toBe(false);
    expect(check2.error).toContain('Estoque insuficiente');
  });

  it('calcula a valorização total do estoque', () => {
    const flavors = [
      { stock: 10, cost: 2.50 }, // 25.00
      { stock: 5, cost: 3.00 }   // 15.00
    ];
    const val = calculateInventoryValuation(flavors);
    expect(val.totalUnits).toBe(15);
    expect(val.totalValueCents).toBe(4000); // R$ 40,00
    expect(val.totalValue).toBe(40);
  });
});

describe('Módulo de Vendas e Períodos (salesCalculations.js)', () => {
  it('preserva custos históricos em cada item vendido', () => {
    const item = calculateSaleItem({ qty: 4, price: 6.50, cost: 2.50 });
    expect(item.totalRevenueCents).toBe(2600); // 4 * 6.50 = 26.00
    expect(item.totalCostCents).toBe(1000);    // 4 * 2.50 = 10.00
    expect(item.totalProfitCents).toBe(1600);  // 26 - 10 = 16.00
    expect(item.unitProfitCents).toBe(400);    // 4.00
  });

  it('agrega estatísticas globais acumuladas separando pagas e a receber', () => {
    const sales = [
      { qty: 2, price: 6.00, cost: 2.00, paid: true },  // 12.00 fat, 8.00 luc
      { qty: 3, price: 7.00, cost: 3.00, paid: false }, // 21.00 fat, 12.00 luc
    ];
    const stats = calculateOverallSalesStats(sales);
    expect(stats.fatCents).toBe(3300); // 33.00
    expect(stats.lucCents).toBe(2000); // 20.00
    expect(stats.recCents).toBe(1200); // 12.00 pago
    expect(stats.penCents).toBe(2100); // 21.00 pendente
    expect(stats.un).toBe(5);
    expect(stats.paidCount).toBe(1);
    expect(stats.pendingCount).toBe(1);
  });

  it('calcula estatísticas de período com filtros de data', () => {
    const sales = [
      { date: '2026-11-01', qty: 2, price: 5, cost: 2, paid: true },
      { date: '2026-11-05', qty: 4, price: 6, cost: 2, paid: false },
      { date: '2026-11-10', qty: 10, price: 6, cost: 2, paid: true }
    ];
    const period = calculatePeriodSalesStats(sales, '2026-11-01', '2026-11-06');
    expect(period.n).toBe(2);
    expect(period.un).toBe(6);
    expect(period.fatCents).toBe(3400); // 10.00 + 24.00 = 34.00
    expect(period.paidVCents).toBe(1000);
    expect(period.penVCents).toBe(2400);
  });

  it('calcula o resultado financeiro mensal (Faturamento - Compras)', () => {
    const sales = [
      { date: '2026-11-02', qty: 10, price: 6.00, cost: 2.00 }, // fat 60.00, luc 40.00
      { date: '2026-10-15', qty: 5, price: 6.00, cost: 2.00 }
    ];
    const costs = [
      { date: '2026-11-01', total: 45.00 }, // compras no mês
      { date: '2026-10-20', total: 100.00 }
    ];

    const result = calculateMonthlyResult({ sales, costs, yearMonth: '2026-11' });
    expect(result.fatCents).toBe(6000);
    expect(result.gastosCents).toBe(4500);
    expect(result.resCents).toBe(1500); // No azul em R$ 15,00
    expect(result.isPositive).toBe(true);
  });
});

describe('Módulo de Ponto de Equilíbrio (breakevenCalculations.js)', () => {
  it('determina quantas palhas faltam para cobrir os gastos', () => {
    // Gastos: R$ 100,00 (10000 centavos)
    // Faturamento até agora: R$ 40,00 (4000 centavos)
    // Preço médio: R$ 6,00
    const be = calculateBreakevenPoint({
      totalExpensesCents: 10000,
      totalRevenueCents: 4000,
      totalUnitsSold: 8, // 40 / 8 = 5.00 avg price
      flavors: []
    });

    expect(be.faltaCents).toBe(6000); // R$ 60,00
    expect(be.avgPrice).toBe(5);
    expect(be.unitsNeeded).toBe(12); // 60 / 5 = 12 palhas
    expect(be.percentage).toBe(40);
    expect(be.isCovered).toBe(false);
  });

  it('reconhece quando os gastos já foram 100% cobertos', () => {
    const be = calculateBreakevenPoint({
      totalExpensesCents: 10000,
      totalRevenueCents: 15000,
      totalUnitsSold: 25,
      flavors: []
    });

    expect(be.faltaCents).toBe(0);
    expect(be.unitsNeeded).toBe(0);
    expect(be.isCovered).toBe(true);
  });
});
