/**
 * Página Início (HomeView)
 * Painel executivo com KPIs, período selecionável, estoque e valores a receber.
 */

import {
  formatMoney,
  calculatePeriodSalesStats,
  calculateOverallSalesStats,
  calculateInventoryValuation
} from '../calculations/index.js';
import {
  PERIOD_OPTIONS,
  LOW_STOCK_THRESHOLD
} from '../utils/constants.js';
import {
  shortDate,
  dayLabel,
  getDueInfo,
  unidades,
  esc
} from '../utils/formatters.js';
import { I } from '../utils/icons.js';

export function renderHomeView({ state, period, customFrom, customTo, periodLabel }) {
  const [startRange, endRange] = getDatesForPeriod(period, customFrom, customTo);
  const pStats = calculatePeriodSalesStats(state.sales, startRange, endRange);
  const allStats = calculateOverallSalesStats(state.sales);
  const invVal = calculateInventoryValuation(state.flavors);

  const pendingSales = state.sales
    .filter(s => !s.paid)
    .sort((a, b) => (a.due || '').localeCompare(b.due || ''));

  let html = '';

  if (state.demo) {
    html += `
      <div class="card note" style="margin:0 0 18px">
        ${I('info')}
        <div>
          <b>Dados de exemplo.</b> Eles servem só para você ver o app funcionando.
          <button class="link" type="button" data-act="clearDemo">Apagar tudo e começar do zero</button>
        </div>
      </div>
    `;
  }

  if (!state.flavors.length) {
    html += `
      <section class="card onboard" style="margin-bottom:18px">
        <h2>Vamos começar</h2>
        <p>Cadastre seus sabores de palha italiana com preço e custo. Depois é só registrar cada venda.</p>
        <div class="actions">
          <button class="btn primary" type="button" data-act="newFlavor">${I('plus')} Cadastrar sabor</button>
          <button class="btn" type="button" data-act="demo">Ver com exemplo</button>
        </div>
      </section>
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
        <div class="stat-s">Recebido ${formatMoney(pStats.paidV)}</div>
      </div>

      <div class="card stat tone-mint">
        <div class="stat-h"><span class="ic">${I('trend')}</span>Lucro</div>
        <div class="stat-n">${formatMoney(pStats.luc)}</div>
        <div class="stat-s">Margem de ${pStats.margemPercent}%</div>
      </div>

      <div class="card stat tone-peach">
        <div class="stat-h"><span class="ic">${I('bag')}</span>Vendas realizadas</div>
        <div class="stat-n">${pStats.n}</div>
        <div class="stat-s">${pStats.n === 1 ? '1 venda no período' : `${pStats.n} vendas no período`}</div>
      </div>

      <div class="card stat tone-sky">
        <div class="stat-h"><span class="ic">${I('layers')}</span>Palhas vendidas</div>
        <div class="stat-n">${unidades(pStats.un)}</div>
        <div class="stat-s">no período</div>
      </div>

      <div class="card stat tone-rose">
        <div class="stat-h"><span class="ic">${I('receipt')}</span>Custo total</div>
        <div class="stat-n">${formatMoney(pStats.custo)}</div>
        <div class="stat-s">das palhas vendidas</div>
      </div>

      <div class="card stat tone-sun">
        <div class="stat-h"><span class="ic">${I('box')}</span>Estoque disponível</div>
        <div class="stat-n">${unidades(invVal.totalUnits)}</div>
        <div class="stat-s">Custo em estoque ${formatMoney(invVal.totalValue)}</div>
      </div>

      <div class="card stat tone-mint">
        <div class="stat-h"><span class="ic">${I('check')}</span>Vendas pagas</div>
        <div class="stat-n">${pStats.paidN}</div>
        <div class="stat-s">${formatMoney(pStats.paidV)} recebidos</div>
      </div>

      <div class="card stat tone-peach">
        <div class="stat-h"><span class="ic">${I('clock')}</span>Vendas pendentes</div>
        <div class="stat-n">${pStats.penN}</div>
        <div class="stat-s">${formatMoney(pStats.penV)} no período</div>
      </div>

      <div class="card stat wide tone-rose">
        <div>
          <div class="stat-h"><span class="ic">${I('dollar')}</span>Valores a receber</div>
          <div class="stat-n">${formatMoney(allStats.pen)}</div>
          <div class="stat-s">
            ${pendingSales.length ? `${pendingSales.length} ${pendingSales.length === 1 ? 'venda aguardando' : 'vendas aguardando'} pagamento` : 'Nenhuma venda aguardando pagamento'}
          </div>
        </div>
        ${pendingSales.length ? '<button class="btn sm" type="button" data-act="goPending">Ver</button>' : ''}
      </div>
    </div>
  `;

  // Estoque atual por sabor
  html += `
    <div class="sec-h">
      <h2>Estoque atual por sabor</h2>
      <button class="link" type="button" data-act="produce">Produzir</button>
    </div>
  `;

  if (!state.flavors.length) {
    html += `
      <div class="card empty">
        <b>Nenhum sabor cadastrado</b>
        Cadastre seus sabores para acompanhar o estoque de cada um.
      </div>
    `;
  } else {
    const maxStock = Math.max(...state.flavors.map(f => f.stock), 1);
    html += `
      <div class="list">
        ${state.flavors.map(f => {
          let pill = `<span class="pill good">${f.stock} un em estoque</span>`;
          if (f.stock <= 0) pill = `<span class="pill bad">Sem estoque</span>`;
          else if (f.stock <= LOW_STOCK_THRESHOLD) pill = `<span class="pill warn">Baixo · ${f.stock} un</span>`;

          const pct = Math.min(100, Math.round((f.stock / maxStock) * 100));

          return `
            <button class="row tone-${f.tone || 'lav'}" type="button" data-act="editFlavor" data-id="${f.id}">
              <span class="av">${esc(f.name.charAt(0).toUpperCase())}</span>
              <span class="row-m">
                <span class="row-t">${esc(f.name)}</span>
                <span class="row-s">Preço ${formatMoney(f.price)} · custo ${formatMoney(f.cost)}</span>
                <span class="sbar"><i style="width:${pct}%"></i></span>
              </span>
              <span class="row-r">${pill}</span>
            </button>
          `;
        }).join('')}
      </div>
    `;
  }

  // Acesso Rápido
  html += `
    <div class="sec-h"><h2>Acesso rápido</h2></div>
    <div class="grid3">
      <button class="tile tone-lav" type="button" data-act="openSale">
        <span class="ic">${I('plus')}</span>
        <span class="tt"><b>Nova venda</b><small><span>Registrar</span>${I('chev')}</small></span>
      </button>

      <a class="tile tone-peach" href="#vendas">
        <span class="ic">${I('bag')}</span>
        <span class="tt"><b>Vendas</b><small><span>Histórico</span>${I('chev')}</small></span>
      </a>

      <a class="tile tone-sky" href="#geral">
        <span class="ic">${I('grid')}</span>
        <span class="tt"><b>Visão geral</b><small><span>Lucro e custos</span>${I('chev')}</small></span>
      </a>

      <a class="tile tone-mint" href="#sabores">
        <span class="ic">${I('layers')}</span>
        <span class="tt"><b>Sabores</b><small><span>Preço e estoque</span>${I('chev')}</small></span>
      </a>

      <a class="tile tone-rose" href="#custos">
        <span class="ic">${I('receipt')}</span>
        <span class="tt"><b>Custos</b><small><span>Gastos e insumos</span>${I('chev')}</small></span>
      </a>

      <button class="tile tone-sun" type="button" data-act="produce">
        <span class="ic">${I('box')}</span>
        <span class="tt"><b>Produzir</b><small><span>Repor estoque</span>${I('chev')}</small></span>
      </button>
    </div>
  `;

  // Falta receber
  html += `
    <div class="sec-h">
      <h2>Falta receber</h2>
      ${pendingSales.length > 3 ? '<button class="link" type="button" data-act="goPending">Ver todas</button>' : ''}
    </div>
  `;

  if (pendingSales.length) {
    html += `
      <div class="list">
        ${pendingSales.slice(0, 3).map(s => {
          const due = getDueInfo(s.due);
          const totalVal = s.qty * s.price;
          return `
            <div class="row-wrap">
              <button class="row" type="button" data-act="saleDetail" data-id="${s.id}">
                <span class="datechip">
                  <small>${shortDate(s.due).split('/')[1] ? shortDate(s.due).split('/')[1] : ''}</small>
                  <b>${shortDate(s.due).split('/')[0]}</b>
                  <span>venc.</span>
                </span>
                <span class="row-m">
                  <span class="row-t">${esc(s.client || s.flavorName)}</span>
                  <span class="row-s">${s.qty}× ${esc(s.flavorName)} · falta ${formatMoney(totalVal)}${s.method ? ' · ' + esc(s.method) : ''}</span>
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
  } else {
    html += `
      <div class="card empty">
        <b>Nada pendente</b>
        Quando alguém for pagar depois, a venda aparece aqui com a data combinada.
      </div>
    `;
  }

  return html;
}

export function getDatesForPeriod(period, customFrom, customTo) {
  const t = new Date().toISOString().slice(0, 10);
  if (period === 'hoje') return [t, t];
  if (period === '7d') {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return [d.toISOString().slice(0, 10), t];
  }
  if (period === 'mes') {
    const y = t.slice(0, 4);
    const m = t.slice(5, 7);
    const lastDay = new Date(Number(y), Number(m), 0).getDate();
    return [`${y}-${m}-01`, `${y}-${m}-${String(lastDay).padStart(2, '0')}`];
  }
  const a = customFrom || t;
  const b = customTo || t;
  return a <= b ? [a, b] : [b, a];
}
