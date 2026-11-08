/**
 * Módulo de Registro e Detalhes de Venda
 * Validação de estoque em tempo real e cálculo instantâneo de lucros.
 */

import { openSheet, closeSheet } from '../components/BottomSheet.js';
import { showToast } from '../components/Toast.js';
import { dbService } from '../services/dbService.js';
import {
  formatMoney,
  moneyToInput,
  calculateSaleItem,
  validateStockMovement,
  MOVEMENT_TYPES
} from '../calculations/index.js';
import {
  PAYMENT_METHODS
} from '../utils/constants.js';
import {
  today,
  addDays,
  shortDate,
  dayLabel,
  getDueInfo,
  num,
  esc
} from '../utils/formatters.js';
import { I } from '../utils/icons.js';
import { armDelete } from '../utils/dom.js';

export function openSaleModal({ state, preFlavorId, user, onSaved, onOpenFlavor }) {
  if (!state.flavors.length) {
    showToast('Cadastre um sabor primeiro');
    if (typeof onOpenFlavor === 'function') onOpenFlavor();
    return;
  }

  const f0 = state.flavors.find(f => f.id === preFlavorId) ||
    state.flavors.find(f => f.stock > 0) ||
    state.flavors[0];

  function saleOptions(selectedId) {
    return state.flavors.map(f => {
      const stockText = f.stock > 0 ? `${f.stock} un em estoque` : 'sem estoque';
      return `<option value="${f.id}" ${f.id === selectedId ? 'selected' : ''}>${esc(f.name)} — ${stockText} (${formatMoney(f.price)})</option>`;
    }).join('');
  }

  function methodOptions(selectedMethod) {
    return PAYMENT_METHODS.map(m => `<option ${m === selectedMethod ? 'selected' : ''}>${m}</option>`).join('');
  }

  const body = `
    <form id="f-sale" novalidate>
      <div class="field">
        <label for="s-flavor">Sabor da palha italiana <span class="req">*</span></label>
        <select id="s-flavor">${saleOptions(f0.id)}</select>
        <div class="subline">
          <span id="s-stock"></span>
          <span id="s-ucost"></span>
        </div>
      </div>

      <div class="grid2">
        <div class="field">
          <label for="s-qty">Quantidade <span class="req">*</span></label>
          <div class="stepper">
            <button type="button" data-step="-1" aria-label="Diminuir">−</button>
            <input id="s-qty" inputmode="numeric" value="1">
            <button type="button" data-step="1" aria-label="Aumentar">+</button>
          </div>
        </div>
        <div class="field">
          <label for="s-price">Preço unitário (R$) <span class="req">*</span></label>
          <div class="pre">
            <span>R$</span>
            <input id="s-price" inputmode="decimal" value="${moneyToInput(f0.price)}">
          </div>
        </div>
      </div>

      <div class="sum3">
        <div><span>Valor total</span><b id="s-total"></b></div>
        <div><span>Custo total</span><b id="s-cost"></b></div>
        <div><span>Lucro estimado</span><b id="s-profit"></b></div>
      </div>

      <div class="grid2">
        <div class="field">
          <label for="s-client">Nome do cliente <span class="opt">(opcional)</span></label>
          <div class="pre">
            ${I('user')}
            <input id="s-client" autocomplete="off" placeholder="Ex.: Mariana Silva">
          </div>
        </div>
        <div class="field">
          <label for="s-phone">WhatsApp / Tel <span class="opt">(opcional)</span></label>
          <input id="s-phone" inputmode="tel" autocomplete="off" placeholder="Ex.: 11999998888">
        </div>
      </div>

      <div class="field">
        <span class="lbl">Situação do pagamento <span class="req">*</span></span>
        <div class="paysel">
          <button type="button" class="pnow" data-pay="now" aria-pressed="true">
            ${I('dollar')} 1. Pago na hora
          </button>
          <button type="button" class="plater" data-pay="later" aria-pressed="false">
            ${I('clock')} 2. Pagamento futuro
          </button>
        </div>
      </div>

      <div class="field" id="s-due-wrap" hidden>
        <label for="s-due">Vai pagar em que dia? <span class="req">*</span></label>
        <input id="s-due" type="date" value="${addDays(today(), 7)}">
        <p class="hint">A venda fica em “falta receber” até você marcar como paga.</p>
      </div>

      <div class="grid2">
        <div class="field">
          <label for="s-method" id="s-method-l">Forma de pagamento</label>
          <select id="s-method">${methodOptions('Pix')}</select>
        </div>
        <div class="field">
          <label for="s-date">Data da venda</label>
          <input id="s-date" type="date" value="${today()}">
        </div>
      </div>

      <div class="field">
        <label for="s-notes">Observações <span class="opt">(opcional)</span></label>
        <input id="s-notes" autocomplete="off" placeholder="Ex.: embalagem para presente, entrega às 16h">
      </div>

      <p class="msg" id="s-warn" hidden></p>

      <div class="formbar">
        <button class="btn" type="button" data-act="closeSheet">Cancelar</button>
        <button class="btn primary" type="submit" id="s-save">Salvar venda</button>
      </div>
    </form>
  `;

  openSheet({
    title: 'Registrar venda',
    sub: 'Dona Palha · Palha Italiana Artesanal',
    icon: 'bag',
    body,
    mount(b) {
      let payMode = 'now';
      const g = id => b.querySelector('#' + id);

      function calc() {
        const flavor = state.flavors.find(f => f.id === g('s-flavor').value);
        if (!flavor) return;

        const q = parseInt(g('s-qty').value, 10) || 0;
        const p = num(g('s-price').value);

        g('s-stock').innerHTML = `Estoque atual: <b>${flavor.stock} un</b>`;
        g('s-ucost').textContent = `Custo prod.: ${formatMoney(flavor.cost)} / un`;

        const itemCalc = calculateSaleItem({ qty: q, price: p, cost: flavor.cost });

        g('s-total').textContent = formatMoney(itemCalc.totalRevenue);
        g('s-cost').textContent = formatMoney(itemCalc.totalCost);

        const pe = g('s-profit');
        pe.textContent = formatMoney(itemCalc.totalProfit);
        pe.className = itemCalc.totalProfit >= 0 ? 'pos' : 'neg';

        let msg = '';
        if (q < 1) {
          msg = 'Informe uma quantidade de 1 ou mais.';
        } else if (!Number.isFinite(p) || p < 0) {
          msg = 'Informe o preço unitário.';
        } else if (q > flavor.stock) {
          msg = `Estoque insuficiente: restam ${flavor.stock} un de ${flavor.name}. Use Produzir para repor.`;
        } else if (payMode === 'later' && !g('s-due').value) {
          msg = 'Informe o dia em que o cliente vai pagar.';
        }

        const warnEl = g('s-warn');
        warnEl.hidden = !msg;
        warnEl.textContent = msg;
        g('s-save').disabled = Boolean(msg);
      }

      g('s-flavor').addEventListener('change', function () {
        const f = state.flavors.find(fl => fl.id === this.value);
        if (f) g('s-price').value = moneyToInput(f.price);
        calc();
      });

      ['s-qty', 's-price', 's-due'].forEach(id => {
        g(id).addEventListener('input', calc);
      });

      b.querySelectorAll('[data-step]').forEach(btn => {
        btn.addEventListener('click', () => {
          const cur = parseInt(g('s-qty').value, 10) || 0;
          g('s-qty').value = Math.max(1, cur + Number(btn.dataset.step));
          calc();
        });
      });

      b.querySelectorAll('[data-pay]').forEach(btn => {
        btn.addEventListener('click', () => {
          payMode = btn.dataset.pay;
          b.querySelectorAll('[data-pay]').forEach(x => {
            x.setAttribute('aria-pressed', String(x === btn));
          });
          g('s-due-wrap').hidden = payMode !== 'later';
          g('s-method-l').textContent = payMode === 'later' ? 'Vai pagar com' : 'Forma de pagamento';
          calc();
        });
      });

      g('f-sale').addEventListener('submit', async e => {
        e.preventDefault();
        calc();
        if (g('s-save').disabled) return;

        const flavorId = g('s-flavor').value;
        const q = parseInt(g('s-qty').value, 10);
        const p = num(g('s-price').value);
        const date = g('s-date').value || today();

        const submitBtn = g('s-save');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Salvando…';

        try {
          const newSale = await dbService.saveSale({
            saleData: {
              flavorId,
              qty: q,
              price: p,
              client: g('s-client').value.trim(),
              phone: g('s-phone').value.trim(),
              method: g('s-method').value,
              notes: g('s-notes').value.trim(),
              paid: payMode === 'now',
              due: payMode === 'later' ? g('s-due').value : '',
              date
            },
            user,
            state
          });

          closeSheet();
          showToast(payMode === 'now' ? 'Venda registrada' : `Falta receber ${formatMoney(q * p)} em ${shortDate(newSale.due)}`);
          if (typeof onSaved === 'function') onSaved(newSale);
        } catch (err) {
          const w = g('s-warn');
          w.hidden = false;
          w.textContent = err.message || 'Erro ao registrar venda.';
          submitBtn.disabled = false;
          submitBtn.textContent = 'Salvar venda';
        }
      });

      calc();
    }
  });
}

export function openSaleDetailModal({ state, saleId, user, onUpdated, onDeleted }) {
  const sale = state.sales.find(s => s.id === saleId);
  if (!sale) return;

  const itemCalc = calculateSaleItem({ qty: sale.qty, price: sale.price, cost: sale.cost });

  const rows = [
    ['Sabor', esc(sale.flavorName)],
    ['Quantidade', `${sale.qty} un`],
    ['Preço unitário', formatMoney(sale.price)],
    ['Valor total', formatMoney(itemCalc.totalRevenue)],
    ['Custo total', formatMoney(itemCalc.totalCost)],
    ['Lucro realizado', formatMoney(itemCalc.totalProfit)],
    ['Cliente', sale.client ? esc(sale.client) : '—']
  ];

  if (sale.phone) rows.push(['WhatsApp / Tel', esc(sale.phone)]);
  rows.push(['Data da venda', esc(dayLabel(sale.date))]);

  if (sale.paid) {
    rows.push(['Situação', `Pago${sale.paidAt ? ' em ' + shortDate(sale.paidAt) : ''}`]);
    rows.push(['Forma de pagamento', esc(sale.method || '—')]);
  } else {
    const due = getDueInfo(sale.due);
    rows.push(['Situação', `Falta receber ${formatMoney(itemCalc.totalRevenue)}`]);
    rows.push(['Vai pagar em', `${esc(shortDate(sale.due))} · ${esc(due.t)}`]);
    rows.push(['Vai pagar com', esc(sale.method || 'A combinar')]);
  }

  if (sale.notes) rows.push(['Observações', esc(sale.notes)]);

  function methodOptions(selectedMethod) {
    return PAYMENT_METHODS.map(m => `<option ${m === selectedMethod ? 'selected' : ''}>${m}</option>`).join('');
  }

  const body = `
    <dl class="kvlist">
      ${rows.map(r => `<div><dt>${r[0]}</dt><dd>${r[1]}</dd></div>`).join('')}
    </dl>
    ${sale.paid ? '' : `
      <div class="field">
        <label for="d-method">Recebido por</label>
        <select id="d-method">${methodOptions(sale.method || 'Pix')}</select>
      </div>
    `}
    <div class="actions">
      ${sale.paid ? `
        <button class="btn" type="button" id="d-unpay">Voltar para “falta receber”</button>
      ` : `
        <button class="btn primary" type="button" id="d-pay">${I('check')} Marcar como pago</button>
      `}
      <button class="btn danger" type="button" id="d-del">Excluir venda</button>
    </div>
  `;

  openSheet({
    title: 'Detalhes da Venda',
    body,
    mount(b) {
      const payBtn = b.querySelector('#d-pay');
      const unpayBtn = b.querySelector('#d-unpay');
      const delBtn = b.querySelector('#d-del');

      if (payBtn) {
        payBtn.addEventListener('click', async () => {
          const method = b.querySelector('#d-method')?.value || 'Pix';
          await dbService.updateSalePayment({
            saleId: sale.id,
            paid: true,
            method,
            user,
            state
          });
          closeSheet();
          showToast('Pagamento registrado com sucesso!');
          if (typeof onUpdated === 'function') onUpdated();
        });
      }

      if (unpayBtn) {
        unpayBtn.addEventListener('click', async () => {
          await dbService.updateSalePayment({
            saleId: sale.id,
            paid: false,
            user,
            state
          });
          closeSheet();
          showToast('Venda voltou para “falta receber”');
          if (typeof onUpdated === 'function') onUpdated();
        });
      }

      if (delBtn) {
        armDelete(delBtn, async () => {
          try {
            await dbService.cancelSale({
              saleId: sale.id,
              user,
              state
            });
            closeSheet();
            showToast('Venda excluída e estoque devolvido.');
            if (typeof onDeleted === 'function') onDeleted();
          } catch (err) {
            alert(err.message || 'Erro ao excluir venda.');
          }
        });
      }
    }
  });
}
