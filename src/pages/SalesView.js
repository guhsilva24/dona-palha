/**
 * Página de Vendas (SalesView)
 */

import {
  formatMoney,
  calculateOverallSalesStats
} from '../calculations/index.js';
import {
  dayLabel,
  shortDate,
  getDueInfo,
  esc
} from '../utils/formatters.js';
import { I } from '../utils/icons.js';

export function renderSalesView({ state, filter = 'todas', query = '' }) {
  const stats = calculateOverallSalesStats(state.sales);
  const pendingCount = stats.pendingCount;
  const paidCount = stats.paidCount;

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

  // Barra de Totais
  html += `
    <div class="card sumbar">
      <div><span>Faturamento</span><b>${formatMoney(stats.fat)}</b></div>
      <div><span>Recebido</span><b>${formatMoney(stats.rec)}</b></div>
      <div><span>A receber</span><b>${formatMoney(stats.pen)}</b></div>
    </div>
  `;

  // Chips de Filtro
  const chips = [
    { id: 'todas', label: `Todas (${state.sales.length})` },
    { id: 'pagas', label: `Pagas (${paidCount})` },
    { id: 'pendentes', label: `A receber (${pendingCount})` }
  ];

  html += `
    <div class="chips" style="margin-top:14px">
      ${chips.map(c => `
        <button class="chip" type="button" data-act="filterSales" data-v="${c.id}" aria-pressed="${filter === c.id}">
          ${c.label}
        </button>
      `).join('')}
    </div>
  `;

  // Filtragem
  let list = state.sales.slice().sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.ts || 0) - (a.ts || 0));

  const q = query.trim().toLowerCase();
  if (q) {
    list = list.filter(s =>
      ((s.flavorName || '') + ' ' + (s.client || '') + ' ' + (s.phone || '')).toLowerCase().includes(q)
    );
  }

  if (filter === 'pagas') {
    list = list.filter(s => s.paid);
  } else if (filter === 'pendentes') {
    list = list.filter(s => !s.paid).sort((a, b) => (a.due || '').localeCompare(b.due || ''));
  }

  if (!list.length) {
    html += `
      <div class="card empty">
        <b>${state.sales.length ? 'Nenhuma venda encontrada' : 'Nenhuma venda ainda'}</b>
        ${state.sales.length ? 'Tente outra busca ou outro filtro.' : 'Registre sua primeira venda tocando no botão abaixo.'}
        <br>
        <button class="btn primary" type="button" data-act="openSale">${I('plus')} Nova venda</button>
      </div>
    `;
    return html;
  }

  // Exibição para 'pendentes'
  if (filter === 'pendentes') {
    html += `
      <div class="list" style="margin-top:8px">
        ${list.map(s => {
          const totalVal = s.qty * s.price;
          const due = getDueInfo(s.due);
          return `
            <div class="row-wrap">
              <button class="row" type="button" data-act="saleDetail" data-id="${s.id}">
                <span class="datechip">
                  <small>${shortDate(s.due).split('/')[1] || ''}</small>
                  <b>${shortDate(s.due).split('/')[0]}</b>
                  <span>venc.</span>
                </span>
                <span class="row-m">
                  <span class="row-t">${esc(s.client || s.flavorName)}</span>
                  <span class="row-s">${s.qty}× ${esc(s.flavorName)} · falta receber ${formatMoney(totalVal)}${s.method ? ' · ' + esc(s.method) : ''}</span>
                </span>
                <span class="row-r">
                  <span class="pill ${due.c}">${due.t}</span>
                </span>
              </button>
              <button class="chk" type="button" data-act="quickMarkPaid" data-id="${s.id}" aria-label="Marcar como pago">
                ${I('check')}
              </button>
            </div>
          `;
        }).join('')}
      </div>
    `;
    return html;
  }

  // Agrupamento por dia para 'todas' e 'pagas'
  const groups = [];
  let currentGroup = null;

  list.forEach(s => {
    if (!currentGroup || currentGroup.date !== s.date) {
      currentGroup = { date: s.date, items: [] };
      groups.push(currentGroup);
    }
    currentGroup.items.push(s);
  });

  groups.forEach(g => {
    html += `
      <h3 class="day">${esc(dayLabel(g.date))}</h3>
      <div class="list">
        ${g.items.map(s => {
          const totalVal = s.qty * s.price;
          const flavor = state.flavors.find(f => f.id === s.flavorId);
          const tone = flavor ? flavor.tone : 'lav';

          let pill = '<span class="pill good">Pago</span>';
          if (!s.paid) {
            const due = getDueInfo(s.due);
            pill = `<span class="pill ${due.c}">${due.t}</span>`;
          }

          return `
            <button class="row tone-${tone}" type="button" data-act="saleDetail" data-id="${s.id}">
              <span class="av">${esc((s.flavorName || '?').charAt(0).toUpperCase())}</span>
              <span class="row-m">
                <span class="row-t">${s.qty}× ${esc(s.flavorName)}</span>
                <span class="row-s">
                  ${s.client ? esc(s.client) + ' · ' : ''}${formatMoney(s.price)} cada${s.method ? ' · ' + esc(s.method) : ''}
                </span>
              </span>
              <span class="row-r">
                <b>${formatMoney(totalVal)}</b>
                ${pill}
              </span>
            </button>
          `;
        }).join('')}
      </div>
    `;
  });

  return html;
}
