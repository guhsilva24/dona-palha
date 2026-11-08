/**
 * Página de Custos e Insumos (CostsView)
 * Exibe custos com unidade de medida e preço por grama/unidade.
 */

import { formatMoney } from '../calculations/index.js';
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

  html += `
    <div class="card sumbar" style="grid-template-columns:repeat(2,minmax(0,1fr))">
      <div><span>Total gasto</span><b>${formatMoney(totalSpent)}</b></div>
      <div><span>Compras registradas</span><b>${state.costs.length}</b></div>
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
        ${state.costs.length ? 'Tente outra busca.' : 'Anote o que você compra (chocolate, biscoito, leite condensado, embalagens) com a unidade e gramas.'}
        <br>
        <button class="btn primary" type="button" data-act="newCost">${I('plus')} Novo custo</button>
      </div>
    `;
    return html;
  }

  html += `
    <h3 class="day">Itens comprados</h3>
    <div class="list">
      ${list.map(c => {
        const u = c.unit || (c.item?.toLowerCase().includes('embal') ? 'un' : 'g');
        const unitCost = c.qty > 0 ? c.total / c.qty : 0;
        let desc = `${c.qty} ${esc(u)}`;
        if (c.packagesCount && c.packageWeight) {
          desc = `${c.packagesCount} ${esc(c.packageType || 'cx')} de ${c.packageWeight}g (${c.qty}g total)`;
        }
        return `
          <button class="row tone-sky" type="button" data-act="editCost" data-id="${c.id}">
            <span class="av">${I('receipt')}</span>
            <span class="row-m">
              <span class="row-t">${esc(c.item)}</span>
              <span class="row-s">${desc} · ${formatMoney(c.total)} · ${shortDate(c.date)}</span>
            </span>
            <span class="row-r">
              <b>${formatMoney(unitCost)}</b>
              <span class="row-s">${u === 'g' ? 'por grama' : 'por ' + esc(u)}</span>
            </span>
          </button>
        `;
      }).join('')}
    </div>
  `;

  return html;
}
