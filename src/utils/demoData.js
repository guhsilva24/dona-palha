/**
 * Carregador de dados de demonstração (Demo Data)
 */

import { uid } from './dom.js';
import { today, addDays } from './formatters.js';
import { TONES } from './constants.js';

export function getDemoState() {
  const t = today();
  const mkFlavor = (name, price, cost, stock, index) => ({
    id: uid(),
    name,
    price,
    cost,
    stock,
    tone: TONES[index % TONES.length]
  });

  const flavors = [
    mkFlavor('Tradicional', 6, 2.8, 18, 0),
    mkFlavor('Ninho com morango', 7, 3.4, 4, 1),
    mkFlavor('Doce de leite', 6.5, 3, 0, 2),
    mkFlavor('Maracujá', 7, 3.2, 12, 3)
  ];

  const ts = Date.now();
  const mkSale = (offset, flavorIndex, qty, client, paid, dueOffset = 0) => {
    const fl = flavors[flavorIndex];
    const date = addDays(t, offset);
    return {
      id: uid(),
      ts: ts + (offset * 1000),
      date,
      flavorId: fl.id,
      flavorName: fl.name,
      qty,
      price: fl.price,
      cost: fl.cost,
      client,
      phone: '',
      method: paid ? 'Pix' : 'Dinheiro',
      notes: '',
      paid,
      due: paid ? '' : addDays(t, dueOffset),
      paidAt: paid ? date : ''
    };
  };

  const sales = [
    mkSale(-6, 0, 6, 'Maria', true),
    mkSale(-5, 1, 4, '', true),
    mkSale(-3, 0, 10, 'Dona Célia', false, -1),
    mkSale(-2, 2, 5, 'Pedro', true),
    mkSale(-1, 3, 3, 'João do trabalho', false, 3),
    mkSale(0, 1, 2, '', true)
  ];

  const c1Id = uid();
  const c2Id = uid();
  const c3Id = uid();
  const c4Id = uid();

  const costs = [
    {
      id: c1Id,
      ts,
      item: 'Chocolate em barra',
      packageType: 'cx',
      packagesCount: 4,
      packageWeight: 400,
      unit: 'g',
      qty: 1600,
      total: 23.96,
      date: addDays(t, -7)
    },
    {
      id: c2Id,
      ts: ts + 1,
      item: 'Leite condensado',
      packageType: 'lata',
      packagesCount: 6,
      packageWeight: 395,
      unit: 'g',
      qty: 2370,
      total: 33.00,
      date: addDays(t, -6)
    },
    {
      id: c3Id,
      ts: ts + 2,
      item: 'Bolacha maisena',
      packageType: 'pct',
      packagesCount: 2,
      packageWeight: 400,
      unit: 'g',
      qty: 800,
      total: 9.00,
      date: addDays(t, -7)
    },
    {
      id: c4Id,
      ts: ts + 3,
      item: 'Caixinhas de embalagem',
      packageType: 'un',
      packagesCount: 100,
      packageWeight: null,
      unit: 'un',
      qty: 100,
      total: 35.00,
      date: addDays(t, -4)
    }
  ];

  const prodId = uid();
  const productions = [
    {
      id: prodId,
      batchNumber: 1,
      date: addDays(t, -3),
      flavorId: flavors[0].id,
      flavorName: flavors[0].name,
      qty: 255,
      batchCost: 12.98,
      unitCost: 0.051,
      sellingPrice: flavors[0].price,
      notes: 'Fornada 1',
      ingredients: [
        { costId: c1Id, item: 'Chocolate em barra', unit: 'g', qty: 349, unitCost: 0.015, total: 5.23 },
        { costId: c2Id, item: 'Leite condensado', unit: 'g', qty: 395, unitCost: 0.014, total: 5.50 },
        { costId: c3Id, item: 'Bolacha maisena', unit: 'g', qty: 200, unitCost: 0.011, total: 2.25 }
      ]
    }
  ];

  return {
    flavors,
    sales,
    costs,
    productions,
    stockMovements: [],
    settings: {
      defaultMargin: 50
    },
    demo: true,
    rev: Date.now()
  };
}

