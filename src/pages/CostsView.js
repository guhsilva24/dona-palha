/**
 * Página de Custos e Insumos (CostsView)
 * Exibe o total gasto com compras de produtos no mercado e insumos disponíveis para produção.
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

  // Total gasto só com compras de insumos
  const totalSpent = state.costs.reduce((acc, c) => acc + (Number(c.total) || 0), 0);

  html += `
    <div class="card sumbar" style="grid-template-columns:1.2fr 1fr;gap:12px;margin-bottom:14px">
      <div>
        <span>Gasto só com produtos</span>
        <b style="font-size:22px;color:var(--brand)">${formatMoney(totalSpent)}</b>
        <small class="muted" style="font-size:11.5px;display:block;margin-top:2px">
          total pago nas compras de insumos
        </small>
      </div>
      <div>
        <span>Itens em estoque</span>
        <b style="font-size:20px">${state.costs.length}</b>
        <small class="muted" style="font-size:11.5px;display:block;margin-top:2px">
          ${state.costs.length === 1 ? 'produto cadastrado' : 'produtos cadastrados'}
        </small>
      </div>
    </div>

    <!-- GUIA RÁPIDO PARA PESSOA LEIGA -->
    <div class="card" style="padding:12px 14px;background:var(--brand-soft);border:1px solid var(--line);border-radius:14px;margin-bottom:16px">
      <div style="display:flex;align-items:flex-start;gap:10px">
        <span style="font-size:18px;line-height:1">🛒</span>
        <div style="font-size:12.5px;color:var(--ink);line-height:1.4">
          <b>Como funciona:</b> Cadastre aqui tudo o que você compra no mercado. Quando for para a cozinha fazer suas palhas, vá na aba <b>Sabores</b> e clique em <b>🧁 Produzir</b> para colocar quanto usou e calcular o custo de cada palha!
        </div>
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
        <b>${state.costs.length ? 'Nenhum produto encontrado' : 'Nenhuma compra registrada'}</b>
        <p class="muted" style="margin:4px 0 12px;font-size:13px">
          ${state.costs.length ? 'Tente outra busca.' : 'Chegou do mercado? Cadastre aqui o que você comprou (chocolate, leite condensado, bolacha maisena, embalagens).'}
        </p>
        <button class="btn primary" type="button" data-act="newCost">${I('plus')} Cadastrar compra</button>
      </div>
    `;
    return html;
  }

  html += `
    <div class="sec-h" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
      <h2>Produtos Comprados</h2>
      <button class="btn sm primary" type="button" data-act="newCost">${I('plus')} Adicionar compra</button>
    </div>
    <div class="list">
      ${list.map(c => {
        const u = c.unit || (c.item?.toLowerCase().includes('embal') ? 'un' : 'g');
        const unitCost = c.qty > 0 ? (c.total / c.qty) : 0;
        const count = c.packagesCount || 1;
        const weight = c.packageWeight;
        const unitPrice = count > 0 ? (c.total / count) : c.total;

        let descCompra = '';
        if (c.packageType === 'un' || u === 'un') {
          descCompra = `${c.qty} un compradas · ${formatMoney(unitPrice)} cada`;
        } else if (weight > 0 && count > 0) {
          descCompra = `${count} ${esc(c.packageType || 'cx')} de ${weight}g (${c.qty}g total) · ${formatMoney(unitPrice)} cada`;
        } else {
          descCompra = `${c.qty} ${esc(u)} comprados`;
        }

        return `
          <button class="row tone-sky" type="button" data-act="editCost" data-id="${c.id}" style="padding:14px 16px">
            <span class="av">${I('receipt')}</span>
            <span class="row-m">
              <span class="row-t" style="font-size:15px;font-weight:700">${esc(c.item)}</span>
              <span class="row-s" style="margin-top:3px;font-size:12.5px">
                ${descCompra} · ${shortDate(c.date)}
              </span>
            </span>
            <span class="row-r" style="text-align:right">
              <b style="font-size:16px;color:var(--brand);display:block">${formatMoney(c.total)}</b>
              <span class="row-s" style="font-size:11.5px;color:var(--muted)">
                ${u === 'g' ? `R$ ${unitCost.toFixed(4).replace('.', ',')}/g` : `${formatMoney(unitCost)}/un`}
              </span>
            </span>
          </button>
        `;
      }).join('')}
    </div>
  `;

  return html;
}
