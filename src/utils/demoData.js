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

  const costs = [
    { id: uid(), ts, item: 'Chocolate em barra', qty: 2, total: 52, date: addDays(t, -7) },
    { id: uid(), ts: ts + 1, item: 'Biscoito maisena', qty: 6, total: 21, date: addDays(t, -7) },
    { id: uid(), ts: ts + 2, item: 'Leite condensado', qty: 10, total: 68, date: addDays(t, -6) },
    { id: uid(), ts: ts + 3, item: 'Caixinhas de embalagem', qty: 50, total: 35, date: addDays(t, -4) }
  ];

  return {
    flavors,
    sales,
    costs,
    productions: [],
    stockMovements: [],
    demo: true,
    rev: Date.now()
  };
}

