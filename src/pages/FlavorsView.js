/**
 * Página de Sabores (FlavorsView)
 * Organizada por sabor, com atalhos diretos de produção de fornada,
 * visualização de custo por palha, estoque e histórico de fornadas por sabor.
 */

import { formatMoney } from '../calculations/index.js';
import { LOW_STOCK_THRESHOLD } from '../utils/constants.js';
import { esc } from '../utils/formatters.js';
import { I } from '../utils/icons.js';

export function renderFlavorsView({ state, query = '', selectedFlavorFilter = 'todos' }) {
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
  let list = state.flavors.filter(f => !q || f.name.toLowerCase().includes(q));

  if (selectedFlavorFilter && selectedFlavorFilter !== 'todos') {
    list = list.filter(f => f.id === selectedFlavorFilter);
  }

  // Conta total vendido e produções por sabor
  const soldByFlavor = {};
  state.sales.forEach(s => {
    soldByFlavor[s.flavorId] = (soldByFlavor[s.flavorId] || 0) + (Number(s.qty) || 0);
  });

  const productionsByFlavor = {};
  (state.productions || []).forEach(p => {
    productionsByFlavor[p.flavorId] = (productionsByFlavor[p.flavorId] || 0) + 1;
  });

  html += `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;gap:8px;flex-wrap:wrap">
      <div class="sec-h" style="margin:0">
        <h2 style="font-size:17px">Sabores de Palha</h2>
      </div>
      <div style="display:flex;gap:8px">
        ${(state.productions || []).length > 0 ? `
          <button class="btn sm" type="button" data-act="viewProductionHistory">
            ${I('box')} Todas as Fornadas
          </button>
        ` : ''}
        <button class="btn sm primary" type="button" data-act="newFlavor">
          ${I('plus')} Novo Sabor
        </button>
      </div>
    </div>
  `;

  // Se houver mais de 1 sabor, exibe filtro por sabor
  if (state.flavors.length > 1) {
    html += `
      <div class="chips" style="margin-bottom:14px;overflow-x:auto;padding-bottom:2px">
        <button class="chip" type="button" data-act="filterFlavorView" data-fid="todos" aria-pressed="${selectedFlavorFilter === 'todos'}">
          Todos (${state.flavors.length})
        </button>
        ${state.flavors.map(f => `
          <button class="chip" type="button" data-act="filterFlavorView" data-fid="${f.id}" aria-pressed="${selectedFlavorFilter === f.id}">
            ${esc(f.name)}
          </button>
        `).join('')}
      </div>
    `;
  }

  if (!list.length) {
    html += `
      <div class="card empty" style="margin-top:14px">
        <b>${state.flavors.length ? 'Nenhum sabor encontrado' : 'Nenhum sabor cadastrado ainda'}</b>
        <p class="muted" style="margin:4px 0 12px;font-size:13px">
          ${state.flavors.length ? 'Tente outra busca ou limpe o filtro.' : 'Cadastre os sabores que você produz (Tradicional, Ninho com Nutella, etc.) e clique em Produzir para calcular o custo de cada um.'}
        </p>
        <button class="btn primary" type="button" data-act="newFlavor">${I('plus')} Cadastrar primeiro sabor</button>
      </div>
    `;
    return html;
  }

  list.forEach(f => {
    const cost = Number(f.cost) || 0;
    const price = Number(f.price) || 0;
    const profit = price - cost;
    const sold = soldByFlavor[f.id] || 0;
    const batchCount = productionsByFlavor[f.id] || 0;

    let stockPill = `<span class="pill good" style="font-weight:700">${f.stock} palhas prontas</span>`;
    if (f.stock <= 0) stockPill = `<span class="pill bad" style="font-weight:700">Sem estoque (0 un)</span>`;
    else if (f.stock <= LOW_STOCK_THRESHOLD) stockPill = `<span class="pill warn" style="font-weight:700">Estoque baixo: ${f.stock} un</span>`;

    html += `
      <article class="card fl tone-${f.tone || 'lav'}" style="margin-bottom:14px;padding:16px;border-radius:18px">
        <div class="fl-top" style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
          <span class="av lg" style="font-weight:700">${esc(f.name.charAt(0).toUpperCase())}</span>
          <div style="min-width:0;flex:1">
            <h3 style="margin:0;font-size:17px;font-weight:700">${esc(f.name)}</h3>
            <span class="fl-sub" style="font-size:12.5px;color:var(--muted)">
              ${sold} vendidas · ${batchCount} ${batchCount === 1 ? 'fornada feita' : 'fornadas feitas'}
            </span>
          </div>
          <button class="icon-btn" type="button" data-act="editFlavor" data-id="${f.id}" aria-label="Editar ${esc(f.name)}" title="Editar sabor">
            ${I('edit')}
          </button>
        </div>

        <dl class="kv3" style="margin-bottom:12px">
          <div>
            <dt>Preço de Venda</dt>
            <dd style="font-size:16px">${formatMoney(price)}</dd>
          </div>
          <div>
            <dt>Custo / Palha</dt>
            <dd style="font-size:16px;color:var(--brand)">${cost > 0 ? formatMoney(cost) : '—'}</dd>
          </div>
          <div>
            <dt>Lucro / Palha</dt>
            <dd style="font-size:16px" class="${profit >= 0 ? 'good' : 'bad'}">${cost > 0 ? formatMoney(profit) : '—'}</dd>
          </div>
        </dl>

        <div style="display:flex;justify-content:space-between;align-items:center;padding-top:10px;border-top:1px solid var(--line);gap:8px;flex-wrap:wrap">
          <div>${stockPill}</div>

          <div style="display:flex;gap:6px;align-items:center">
            <button class="btn sm" type="button" data-act="viewProductionHistory" data-id="${f.id}" title="Ver fornadas deste sabor">
              📋 Fornadas
            </button>
            <button class="btn sm" type="button" data-act="adjustStock" data-id="${f.id}" title="Perdas / Ajuste">
              Ajustar
            </button>
            <button class="btn sm primary" type="button" data-act="produce" data-id="${f.id}" style="font-weight:700">
              ${I('plus')} Produzir
            </button>
          </div>
        </div>
      </article>
    `;
  });

  return html;
}
