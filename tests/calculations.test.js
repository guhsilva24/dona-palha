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
  calculateBreakevenPoint,
  calculatePriceFromMargin,
  calculateMarginFromPrice,
  calculateCostPerProduct
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

  it('calcula o custo por produto e proporção com base em quantidade usada e rendimento (ex: 1 cx de 400g usada 350g em 25 palhas)', () => {
    const res = calculateCostPerProduct({
      supplyTotal: 20.00,
      packageWeight: 400,
      packagesCount: 1,
      usedQty: 350,
      recipeYield: 25
    });

    expect(res.totalPurchased).toBe(400); // 400g compradas
    expect(res.costPerUnitCents).toBe(5); // R$ 0,05 por grama (20,00 / 400)
    expect(res.usedCostCents).toBe(1750); // R$ 17,50 usados na receita (350 * 0,05)
    expect(res.usedCost).toBe(17.50);
    expect(res.costPerProductCents).toBe(70); // R$ 0,70 por produto (17,50 / 25)
    expect(res.costPerProduct).toBe(0.70);
    expect(res.remainingQty).toBe(50); // Sobram 50g
    expect(res.remainingCostCents).toBe(250); // Sobram R$ 2,50
  });

  it('calcula o exemplo real do usuário: 4 caixas de 400g por R$ 5,99 cada (R$ 23,96), usou 349g em fornada de 255 palhas', () => {
    // 4 cx de 400g = 1600g comprados por R$ 23,96
    const chocIng = calculateIngredientCost({
      supplyTotal: 23.96,
      supplyQty: 1600,
      packageWeight: 400,
      packagesCount: 4,
      usedQty: 349
    });

    expect(chocIng.totalSupplyGrams).toBe(1600);
    expect(chocIng.lineCostCents).toBe(523); // (2396 * 349) / 1600 = 522.62 -> 523 centavos = R$ 5,23
    expect(chocIng.lineCost).toBe(5.23);

    // Soma com leite condensado (R$ 5,50) e bolacha maisena (R$ 2,25) = R$ 12,98 (1298 centavos)
    const summary = calculateBatchSummary({
      batchCostCents: 1298,
      batchUnits: 255,
      sellingPrice: 3.50
    });

    expect(summary.batchUnits).toBe(255);
    expect(summary.batchCost).toBe(12.98);
    expect(summary.unitCostCents).toBe(5); // ~ 5 centavos por palha (R$ 0,051)
    expect(summary.projectedRevenueCents).toBe(89250); // 255 * 3,50 = R$ 892,50
    expect(summary.projectedProfitCents).toBe(87952); // R$ 892,50 - R$ 12,98 = R$ 879,52
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

describe('Módulo de Precificação por Margem (%) e Gramas de Insumos', () => {
  it('calcula o preço sugerido com base na margem de lucro desejada (%)', () => {
    // Custo: R$ 2,50 por palha. Margem desejada: 50%.
    // Preço = 2,50 / (1 - 0.5) = R$ 5,00. Lucro = R$ 2,50.
    const pricing50 = calculatePriceFromMargin({ cost: 2.50, marginPercent: 50 });
    expect(pricing50.suggestedPriceCents).toBe(500);
    expect(pricing50.suggestedPrice).toBe(5);
    expect(pricing50.profitCents).toBe(250);
    expect(pricing50.markupPercent).toBe(100);

    // Custo: R$ 3,00. Margem desejada: 60%.
    // Preço = 3,00 / (1 - 0.6) = R$ 7,50.
    const pricing60 = calculatePriceFromMargin({ cost: 3.00, marginPercent: 60 });
    expect(pricing60.suggestedPriceCents).toBe(750);
    expect(pricing60.suggestedPrice).toBe(7.5);
  });

  it('calcula a margem percentual real a partir do preço e custo', () => {
    // Preço: R$ 6,00. Custo: R$ 3,00 -> Lucro: R$ 3,00 (50% de margem)
    const margin = calculateMarginFromPrice({ cost: 3.00, price: 6.00 });
    expect(margin.marginPercent).toBe(50);
    expect(margin.markupPercent).toBe(100);
    expect(margin.profitCents).toBe(300);
  });

  it('calcula proporção em gramas mesmo quando comprado em kg', () => {
    // Comprou 1 kg de chocolate por R$ 35,00 e usou 200 g na receita
    const ingCalc = calculateIngredientCost({
      supplyTotal: 35.00,
      supplyQty: 1,
      supplyUnit: 'kg',
      usedQty: 200,
      usedUnit: 'g'
    });
    // 35 / 1000 = 0.035 * 200 = R$ 7,00 (700 centavos)
    expect(ingCalc.lineCostCents).toBe(700);
    expect(ingCalc.lineCost).toBe(7);
  });
});

