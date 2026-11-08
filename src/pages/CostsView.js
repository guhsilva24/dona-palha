/**
 * Página de Custos e Insumos (CostsView)
 * Exibe custos com quantidade usada e cálculo automático do custo por produto.
 */

import { formatMoney, calculateCostPerProduct } from '../calculations/index.js';
import { shortDate, esc } from '../utils/formatters.js';
import { I } from '../utils/icons.js';

export function renderCostsView({ state, query = '' }) {
  let html = '';

  if (state.demo) {
    html += `
      <div class="card note" style="margin:0 0 18px">
        ${I('info')}
        <div>
          <b>Dados de exemplo.</b>
          <button class="link" type="button" data-act="clearDemo">Apagar tudo e começar do zero</button>
        </div>
      </div>
    `;
  }

  const totalSpent = state.costs.reduce((acc, c) => acc + (Number(c.total) || 0), 0);

  // Calcula a soma de custo por produto de todos os insumos cadastrados
  const totalCostPerProduct = state.costs.reduce((acc, c) => {
    if (c.costPerProduct != null && Number(c.costPerProduct) > 0) {
      return acc + Number(c.costPerProduct);
    }
    const res = calculateCostPerProduct({
      supplyTotal: c.total,
      supplyQty: c.qty,
      supplyUnit: c.unit,
      packageWeight: c.packageWeight,
      packagesCount: c.packagesCount,
      usedQty: c.usedQty || c.qty,
      recipeYield: c.recipeYield || 25
    });
    return acc + res.costPerProduct;
  }, 0);

  html += `
    <div class="card sumbar" style="grid-template-columns:1fr 1fr;gap:12px;margin-bottom:18px">
      <div>
        <span>Total gasto em insumos</span>
        <b>${formatMoney(totalSpent)}</b>
        <small class="muted" style="font-size:11.5px;display:block;margin-top:2px">
          ${state.costs.length} ${state.costs.length === 1 ? 'insumo cadastrado' : 'insumos cadastrados'}
        </small>
      </div>
      <div style="background:var(--brand-soft);border-radius:10px;padding:8px 12px">
        <span style="color:var(--brand-dark);font-weight:600">Custo somado por palha</span>
        <b style="color:var(--brand);font-size:20px;display:block;margin:2px 0">${formatMoney(totalCostPerProduct)}</b>
        <small class="muted" style="font-size:11px;display:block">soma dos insumos por unidade</small>
      </div>
    </div>
  `;

  const q = query.trim().toLowerCase();
  const list = state.costs
    .slice()
    .sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.ts || 0) - (a.ts || 0))
    .filter(c => !q || c.item.toLowerCase().includes(q));

  if (!list.length) {
    html += `
      <div class="card empty" style="margin-top:14px">
        <b>${state.costs.length ? 'Nenhum item encontrado' : 'Nenhum custo registrado'}</b>
        <p class="muted" style="margin:4px 0 12px;font-size:13px">
          ${state.costs.length ? 'Tente outra busca.' : 'Cadastre o que você compra (chocolate, leite condensado, biscoito, embalagens) informando quanto você usa para ver o custo exato por produto.'}
        </p>
        <button class="btn primary" type="button" data-act="newCost">${I('plus')} Cadastrar primeiro insumo</button>
      </div>
    `;
    return html;
  }

  html += `
    <div class="sec-h">
      <h2>Insumos e Custo por Produto</h2>
    </div>
    <div class="list">
      ${list.map(c => {
        const u = c.unit || (c.item?.toLowerCase().includes('embal') ? 'un' : 'g');
        const calcRes = calculateCostPerProduct({
          supplyTotal: c.total,
          supplyQty: c.qty,
          supplyUnit: u,
          packageWeight: c.packageWeight,
          packagesCount: c.packagesCount,
          usedQty: c.usedQty || (c.unit === 'un' ? 25 : (c.packageWeight ? Math.min(c.packageWeight, 350) : 350)),
          recipeYield: c.recipeYield || 25
        });

        const productCost = c.costPerProduct != null ? Number(c.costPerProduct) : calcRes.costPerProduct;
        const usedCost = c.usedCost != null ? Number(c.usedCost) : calcRes.usedCost;
        const usedQty = c.usedQty != null ? Number(c.usedQty) : (c.unit === 'un' ? 25 : (c.packageWeight ? Math.min(c.packageWeight, 350) : 350));
        const yieldCount = c.recipeYield || 25;

        let descCompra = `${c.qty} ${esc(u)}`;
        if (c.packagesCount && c.packageWeight) {
          descCompra = `${c.packagesCount} ${esc(c.packageType || 'cx')} de ${c.packageWeight}g (${c.qty}g total)`;
        } else if (c.packageType === 'un' || u === 'un') {
          descCompra = `${c.qty} unidades`;
        }

        return `
          <button class="row tone-sky" type="button" data-act="editCost" data-id="${c.id}" style="align-items:flex-start;padding:14px 16px">
            <span class="av" style="margin-top:2px">${I('receipt')}</span>
            <span class="row-m">
              <span class="row-t" style="font-size:15px;font-weight:700">${esc(c.item)}</span>
              <span class="row-s" style="margin-top:3px;font-size:12.5px">
                Compra: ${descCompra} · ${formatMoney(c.total)}
              </span>
              <span class="row-s" style="margin-top:4px;color:var(--brand-dark);font-weight:600;font-size:12px;display:flex;align-items:center;gap:4px">
                ${I('check')} Usa <b>${usedQty}${esc(u)}</b> em receita de <b>${yieldCount} palhas</b>
              </span>
            </span>
            <span class="row-r" style="text-align:right">
              <b style="font-size:17.5px;color:var(--brand);display:block;line-height:1.2">${formatMoney(productCost)}</b>
              <span class="row-s" style="font-weight:700;color:var(--ink);font-size:12px">por produto</span>
              <small style="color:var(--muted);font-size:11px;margin-top:2px;display:block">
                ${formatMoney(usedCost)} na receita
              </small>
            </span>
          </button>
        `;
      }).join('')}
    </div>
  `;

  return html;
}
