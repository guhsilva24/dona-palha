/**
 * Página Visão Geral (GeneralView)
 * Custo por produto, margens, resultado mensal e ponto de equilíbrio.
 */

import {
  formatMoney,
  calculatePeriodSalesStats,
  calculateMonthlyResult,
  calculateBreakevenPoint,
  aggregateSalesByFlavor
} from '../calculations/index.js';
import {
  PERIOD_OPTIONS,
  MONTH_NAMES_LONG,
  LOW_STOCK_THRESHOLD
} from '../utils/constants.js';
import {
  parseDateParts,
  unidades,
  esc
} from '../utils/formatters.js';
import { I } from '../utils/icons.js';
import { getDatesForPeriod } from './HomeView.js';

export function renderGeneralView({ state, period, customFrom, customTo, selectedMonth, query = '', periodLabel }) {
  const [startRange, endRange] = getDatesForPeriod(period, customFrom, customTo);
  const pStats = calculatePeriodSalesStats(state.sales, startRange, endRange);
  const flavorAgg = aggregateSalesByFlavor(pStats.list, state.flavors);
  const mStats = calculateMonthlyResult({
    sales: state.sales,
    costs: state.costs,
    yearMonth: selectedMonth
  });

  const totalCostsSpent = state.costs.reduce((acc, c) => acc + (Number(c.total) || 0), 0);
  const bePoint = calculateBreakevenPoint({
    totalExpenses: totalCostsSpent,
    totalRevenue: pStats.fat,
    totalUnitsSold: pStats.un,
    flavors: state.flavors
  });

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

  // Barra de Período
  html += `
    <div class="pbar">
      <span class="plabel">Período</span>
      <div class="chips">
        ${PERIOD_OPTIONS.map(opt => `
          <button class="chip" type="button" data-act="setPeriod" data-v="${opt.id}" aria-pressed="${period === opt.id}">
            ${opt.label}
          </button>
        `).join('')}
      </div>
    </div>
  `;

  if (period === 'custom') {
    html += `
      <div class="grid2 prange">
        <div class="field">
          <label for="p-from">De</label>
          <input id="p-from" type="date" value="${esc(customFrom)}">
        </div>
        <div class="field">
          <label for="p-to">Até</label>
          <input id="p-to" type="date" value="${esc(customTo)}">
        </div>
      </div>
    `;
  } else {
    html += `<p class="pnote">${esc(periodLabel)}</p>`;
  }

  // KPIs
  html += `
    <div class="stats">
      <div class="card stat tone-lav">
        <div class="stat-h"><span class="ic">${I('bars')}</span>Faturamento</div>
        <div class="stat-n">${formatMoney(pStats.fat)}</div>
        <div class="stat-s">${pStats.n} ${pStats.n === 1 ? 'venda' : 'vendas'}</div>
      </div>

      <div class="card stat tone-rose">
        <div class="stat-h"><span class="ic">${I('receipt')}</span>Custo total</div>
        <div class="stat-n">${formatMoney(pStats.custo)}</div>
        <div class="stat-s">das palhas vendidas</div>
      </div>

      <div class="card stat tone-mint">
        <div class="stat-h"><span class="ic">${I('trend')}</span>Lucro</div>
        <div class="stat-n">${formatMoney(pStats.luc)}</div>
        <div class="stat-s">Margem de ${pStats.margemPercent}%</div>
      </div>

      <div class="card stat tone-sky">
        <div class="stat-h"><span class="ic">${I('layers')}</span>Palhas vendidas</div>
        <div class="stat-n">${unidades(pStats.un)}</div>
        <div class="stat-s">${pStats.un > 0 ? 'Preço médio ' + formatMoney(pStats.fat / pStats.un) : 'no período'}</div>
      </div>
    </div>
  `;

  // Custo por produto
  html += `<div class="sec-h"><h2>Custo por produto</h2></div>`;

  const q = query.trim().toLowerCase();
  const flavorsList = state.flavors.filter(f => !q || f.name.toLowerCase().includes(q));

  if (!flavorsList.length) {
    html += `
      <div class="card empty">
        <b>${state.flavors.length ? 'Nenhum sabor encontrado' : 'Nenhum sabor cadastrado'}</b>
        ${state.flavors.length ? 'Tente outra busca.' : 'Cadastre seus sabores para ver o custo de cada produto.'}
      </div>
    `;
  } else {
    flavorsList.forEach(f => {
      const agg = flavorAgg[f.id] || { un: 0, custo: 0, luc: 0 };
      const lu = f.price - f.cost;

      let stockPill = `<span class="pill good">${f.stock} un em estoque</span>`;
      if (f.stock <= 0) stockPill = `<span class="pill bad">Sem estoque</span>`;
      else if (f.stock <= LOW_STOCK_THRESHOLD) stockPill = `<span class="pill warn">Baixo · ${f.stock} un</span>`;

      html += `
        <article class="card fl tone-${f.tone || 'lav'}">
          <div class="fl-top">
            <span class="av lg">${esc(f.name.charAt(0).toUpperCase())}</span>
            <div style="min-width:0">
              <h3>${esc(f.name)}</h3>
              <span class="fl-sub">Estoque: ${f.stock} un</span>
            </div>
            ${stockPill}
          </div>
          <dl class="kv3">
            <div><dt>Custo por un.</dt><dd>${formatMoney(f.cost)}</dd></div>
            <div><dt>Preço de venda</dt><dd>${formatMoney(f.price)}</dd></div>
            <div><dt>Lucro por un.</dt><dd class="${lu >= 0 ? 'good' : 'bad'}">${formatMoney(lu)}</dd></div>
            <div><dt>Vendidas</dt><dd>${agg.un} un</dd></div>
            <div><dt>Custo total</dt><dd>${formatMoney(agg.custo)}</dd></div>
            <div><dt>Lucro no período</dt><dd class="${agg.luc >= 0 ? 'good' : 'bad'}">${formatMoney(agg.luc)}</dd></div>
          </dl>
        </article>
      `;
    });
  }

  // Resultado do mês
  const pDate = parseDateParts(`${selectedMonth}-01`);
  const currentMonth = new Date().toISOString().slice(0, 7);
  const isCur = selectedMonth === currentMonth;

  let pill = '<span class="pill">Sem movimento</span>';
  if (mStats.fat > 0 || mStats.gastos > 0) {
    pill = mStats.isPositive ? '<span class="pill good">No azul</span>' : '<span class="pill bad">No vermelho</span>';
  }

  html += `
    <div class="sec-h">
      <h2>Resultado do mês</h2>
      <div class="mnav">
        <button class="icon-btn" type="button" data-act="mprev" aria-label="Mês anterior">${I('chevl')}</button>
        <button class="icon-btn" type="button" data-act="mnext" aria-label="Próximo mês" ${isCur ? 'disabled' : ''}>${I('chev')}</button>
      </div>
    </div>
    <div class="card mcard">
      <div class="mcard-h">
        <b>${MONTH_NAMES_LONG[pDate.m - 1]} de ${pDate.y}</b>
        ${pill}
      </div>
      <dl class="eq">
        <div><dt>Faturamento das vendas</dt><dd>${formatMoney(mStats.fat)}</dd></div>
        <div><dt>Compras e custos</dt><dd>− ${formatMoney(mStats.gastos)}</dd></div>
        <div class="res">
          <dt>Resultado</dt>
          <dd class="${mStats.isPositive ? 'pos' : 'neg'}">${formatMoney(mStats.res)}</dd>
        </div>
        <div><dt>Lucro nas vendas (preço − custo)</dt><dd>${formatMoney(mStats.luc)}</dd></div>
      </dl>
    </div>
  `;

  // Ponto de equilíbrio
  html += `
    <div class="sec-h"><h2>Ponto de equilíbrio</h2></div>
    <div class="card mcard">
  `;

  if (bePoint.gastos <= 0) {
    html += `
      <p>Registre o que você comprou na aba Custos e o sistema mostra quantas palhas faltam para cobrir esses gastos.</p>
    `;
  } else if (bePoint.isCovered) {
    html += `
      <b class="big pos">Gastos cobertos</b>
      <div class="bar done"><i style="width:100%"></i></div>
      <p>Você faturou <b>${formatMoney(bePoint.fat)}</b> e gastou <b>${formatMoney(bePoint.gastos)}</b> em compras. Sobraram <b>${formatMoney(bePoint.fat - bePoint.gastos)}</b>.</p>
    `;
  } else {
    html += `
      <b class="big">${bePoint.avgPrice > 0 ? `Faltam cerca de ${bePoint.unitsNeeded} ${bePoint.unitsNeeded === 1 ? 'palha' : 'palhas'}` : `Faltam ${formatMoney(bePoint.falta)}`}</b>
      <div class="bar"><i style="width:${bePoint.percentage}%"></i></div>
      <p>Você gastou <b>${formatMoney(bePoint.gastos)}</b> e faturou <b>${formatMoney(bePoint.fat)}</b>. Faltam <b>${formatMoney(bePoint.falta)}</b>${bePoint.avgPrice > 0 ? `, ao preço médio de <b>${formatMoney(bePoint.avgPrice)}</b> por palha` : ''}.</p>
    `;
  }

  html += `</div>`;
  return html;
}
