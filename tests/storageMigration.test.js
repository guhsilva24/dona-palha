import { describe, it, expect, beforeEach } from 'vitest';
import { normalizeState, createEmptyState } from '../src/services/storageService.js';

describe('Migração e Preservação de Dados (storageService.js)', () => {
  it('cria estado vazio com coleções completas', () => {
    const empty = createEmptyState();
    expect(empty.flavors).toEqual([]);
    expect(empty.sales).toEqual([]);
    expect(empty.costs).toEqual([]);
    expect(empty.productions).toEqual([]);
    expect(empty.stockMovements).toEqual([]);
    expect(empty.demo).toBe(false);
  });

  it('normaliza dados legados preservando integralmente todas as propriedades existentes', () => {
    const legacyV1 = {
      flavors: [
        { id: 'fl-1', name: 'Tradicional', price: 6, cost: 2.8, stock: 18, tone: 'lav' },
        { id: 'fl-2', name: 'Ninho', price: 7, cost: 3.4, stock: 4, tone: 'peach' }
      ],
      sales: [
        {
          id: 'sl-1',
          date: '2026-11-01',
          flavorId: 'fl-1',
          flavorName: 'Tradicional',
          qty: 6,
          price: 6,
          cost: 2.8,
          client: 'Maria',
          phone: '11999998888',
          method: 'Pix',
          paid: true
        }
      ],
      costs: [
        { id: 'cs-1', item: 'Chocolate em barra', qty: 2, total: 52, date: '2026-10-31' }
      ],
      demo: true,
      rev: 123456
    };

    const normalized = normalizeState(legacyV1);

    expect(normalized.flavors.length).toBe(2);
    expect(normalized.flavors[0].name).toBe('Tradicional');
    expect(normalized.flavors[0].stock).toBe(18);

    expect(normalized.sales.length).toBe(1);
    expect(normalized.sales[0].client).toBe('Maria');
    expect(normalized.sales[0].qty).toBe(6);

    expect(normalized.costs.length).toBe(1);
    expect(normalized.costs[0].item).toBe('Chocolate em barra');
    expect(normalized.costs[0].total).toBe(52);

    expect(normalized.demo).toBe(true);
    expect(normalized.rev).toBe(123456);
  });

  it('trata graciosamente dados nulos ou corrompidos sem quebrar a aplicação', () => {
    const normalizedNull = normalizeState(null);
    expect(normalizedNull.flavors).toEqual([]);
    expect(normalizedNull.sales).toEqual([]);
    expect(normalizedNull.costs).toEqual([]);

    const normalizedPartial = normalizeState({ flavors: 'invalid' });
    expect(normalizedPartial.flavors).toEqual([]);
  });
});
