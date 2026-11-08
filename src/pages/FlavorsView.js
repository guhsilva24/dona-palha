/**
 * Página de Sabores (FlavorsView)
 * Exibe sabores, margens de lucro, atalhos de produção e histórico de lotes.
 */

import { formatMoney } from '../calculations/index.js';
import { LOW_STOCK_THRESHOLD } from '../utils/constants.js';
import { esc } from '../utils/formatters.js';
import { I } from '../utils/icons.js';

export function renderFlavorsView({ state, query = '' }) {
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

  const q = query.trim().toLowerCase();
  const list = state.flavors.filter(f => !q || f.name.toLowerCase().includes(q));

  if (!list.length) {
    html += `
      <div class="card empty">
        <b>${state.flavors.length ? 'Nenhum sabor encontrado' : 'Nenhum sabor cadastrado'}</b>
        ${state.flavors.length ? 'Tente outra busca.' : 'Cadastre cada sabor com preço de venda, custo por unidade e estoque.'}
        <br>
        <button class="btn primary" type="button" data-act="newFlavor">${I('plus')} Novo sabor</button>
      </div>
    `;
    return html;
  }

  // Atalho para ver histórico de todas as fornadas
  if ((state.productions || []).length > 0) {
    html += `
      <div style="display:flex;justify-content:flex-end;margin-bottom:10px">
        <button class="link" type="button" data-act="viewProductionHistory">
          ${I('box')} Ver histórico de todas as fornadas
        </button>
      </div>
    `;
  }

  // Conta total vendido por sabor
  const soldByFlavor = {};
  state.sales.forEach(s => {
    soldByFlavor[s.flavorId] = (soldByFlavor[s.flavorId] || 0) + (Number(s.qty) || 0);
  });

  list.forEach(f => {
    const lu = f.price - f.cost;
    const sold = soldByFlavor[f.id] || 0;
    const margin = f.price > 0 ? Math.round(((f.price - f.cost) / f.price) * 100) : 0;

    let stockPill = `<span class="pill good">${f.stock} un em estoque</span>`;
    if (f.stock <= 0) stockPill = `<span class="pill bad">Sem estoque</span>`;
    else if (f.stock <= LOW_STOCK_THRESHOLD) stockPill = `<span class="pill warn">Baixo · ${f.stock} un</span>`;

    html += `
      <article class="card fl tone-${f.tone || 'lav'}">
        <div class="fl-top">
          <span class="av lg">${esc(f.name.charAt(0).toUpperCase())}</span>
          <div style="min-width:0">
            <h3>${esc(f.name)}</h3>
            <span class="fl-sub">${sold} un vendidas${f.price > 0 ? ' · margem de ' + margin + '%' : ''}</span>
          </div>
          <button class="icon-btn" type="button" data-act="editFlavor" data-id="${f.id}" aria-label="Editar ${esc(f.name)}">
            ${I('edit')}
          </button>
        </div>

        <dl class="kv3">
          <div><dt>Preço de venda</dt><dd>${formatMoney(f.price)}</dd></div>
          <div><dt>Custo por un.</dt><dd>${formatMoney(f.cost)}</dd></div>
          <div><dt>Lucro por un.</dt><dd class="${lu >= 0 ? 'good' : 'bad'}">${formatMoney(lu)}</dd></div>
        </dl>

        <div class="fl-stock">
          ${stockPill}
          <div style="display:flex;gap:6px">
            <button class="btn sm" type="button" data-act="adjustStock" data-id="${f.id}" title="Ajuste / Perdas">
              Ajustar
            </button>
            <button class="btn sm" type="button" data-act="viewProductionHistory" data-id="${f.id}" title="Fornadas anteriores">
              Fornadas
            </button>
            <button class="btn sm primary" type="button" data-act="produce" data-id="${f.id}">
              ${I('plus')} Produzir
            </button>
          </div>
        </div>
      </article>
    `;
  });

  return html;
}
