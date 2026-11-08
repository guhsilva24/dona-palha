/**
 * Módulo de Controle de Perdas, Ajustes e Histórico de Estoque
 */

import { openSheet, closeSheet } from '../components/BottomSheet.js';
import { showToast } from '../components/Toast.js';
import { dbService } from '../services/dbService.js';
import { MOVEMENT_TYPES } from '../calculations/index.js';
import { STOCK_ADJUSTMENT_REASONS } from '../utils/constants.js';
import { shortDate, esc } from '../utils/formatters.js';

export function openStockMovementModal({ state, flavorId, user, onSaved }) {
  const flavor = state.flavors.find(f => f.id === flavorId);
  if (!flavor) return;

  const movements = (state.stockMovements || [])
    .filter(m => m.flavorId === flavor.id)
    .slice()
    .reverse();

  function reasonOptions() {
    return STOCK_ADJUSTMENT_REASONS.map(r => `<option value="${r}">${r}</option>`).join('');
  }

  const typeLabels = {
    [MOVEMENT_TYPES.PRODUCTION_IN]: 'Entrada (Produção)',
    [MOVEMENT_TYPES.SALE_OUT]: 'Saída (Venda)',
    [MOVEMENT_TYPES.SALE_CANCEL_IN]: 'Estorno (Cancelamento)',
    [MOVEMENT_TYPES.LOSS]: 'Perda / Descarte',
    [MOVEMENT_TYPES.ADJUSTMENT_IN]: 'Acerto (+) Entrada',
    [MOVEMENT_TYPES.ADJUSTMENT_OUT]: 'Acerto (−) Saída'
  };

  const body = `
    <div class="card" style="padding:14px;margin-bottom:16px">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div>
          <b style="font-size:16px">${esc(flavor.name)}</b>
          <div class="muted" style="font-size:13px">Estoque atual: <b>${flavor.stock} un</b></div>
        </div>
      </div>
    </div>

    <form id="f-adjust" novalidate style="margin-bottom:20px">
      <div class="sec-h" style="margin-top:0"><h2>Registrar Ajuste ou Perda</h2></div>

      <div class="field">
        <label for="adj-type">Tipo de movimentação <span class="req">*</span></label>
        <select id="adj-type">
          <option value="${MOVEMENT_TYPES.LOSS}">Perda / Vencimento / Descarte (−)</option>
          <option value="${MOVEMENT_TYPES.ADJUSTMENT_OUT}">Ajuste de inventário para baixo (−)</option>
          <option value="${MOVEMENT_TYPES.ADJUSTMENT_IN}">Ajuste de inventário para cima (+)</option>
        </select>
      </div>

      <div class="grid2">
        <div class="field">
          <label for="adj-qty">Quantidade <span class="req">*</span></label>
          <input id="adj-qty" type="number" min="1" placeholder="Ex: 2">
        </div>
        <div class="field">
          <label for="adj-reason">Motivo</label>
          <select id="adj-reason">${reasonOptions()}</select>
        </div>
      </div>

      <div class="field">
        <label for="adj-notes">Observação complementar <span class="opt">(opcional)</span></label>
        <input id="adj-notes" placeholder="Ex.: Quebrou na embalagem">
      </div>

      <p class="msg" id="adj-warn" hidden></p>
      <button class="btn primary block" type="submit" id="adj-submit">Confirmar Ajuste</button>
    </form>

    <div class="sec-h"><h2>Histórico de Movimentações</h2></div>
    ${movements.length ? `
      <div class="list">
        ${movements.map(m => {
          const isPositive = m.delta > 0;
          return `
            <div class="row">
              <span class="av sm ${isPositive ? 'good' : 'bad'}" style="width:34px;height:34px;font-size:12px">
                ${isPositive ? '+' : ''}${m.delta}
              </span>
              <span class="row-m">
                <span class="row-t">${esc(typeLabels[m.type] || m.type)}</span>
                <span class="row-s">${esc(m.reason || 'Sem motivo')} · ${shortDate(m.date)}</span>
              </span>
              <span class="row-r">
                <b>${m.newStock} un</b>
                <span class="row-s">saldo</span>
              </span>
            </div>
          `;
        }).join('')}
      </div>
    ` : `
      <div class="card empty"><b>Nenhuma movimentação registrada</b>As movimentações de produção, vendas e perdas aparecem aqui.</div>
    `}
  `;

  openSheet({
    title: 'Estoque & Perdas',
    sub: flavor.name,
    body,
    mount(b) {
      const g = id => b.querySelector('#' + id);

      g('f-adjust').addEventListener('submit', async e => {
        e.preventDefault();
        const type = g('adj-type').value;
        const qty = parseInt(g('adj-qty').value, 10);
        const reason = `${g('adj-reason').value} ${g('adj-notes').value.trim()}`.trim();
        const warnEl = g('adj-warn');

        if (!qty || qty <= 0) {
          warnEl.hidden = false;
          warnEl.textContent = 'Informe uma quantidade válida maior que zero.';
          return;
        }

        const delta = type === MOVEMENT_TYPES.ADJUSTMENT_IN ? qty : -qty;

        if (flavor.stock + delta < 0) {
          warnEl.hidden = false;
          warnEl.textContent = `Operação não permitida: estoque ficaria negativo (${flavor.stock + delta}).`;
          return;
        }

        warnEl.hidden = true;
        const submitBtn = g('adj-submit');
        submitBtn.disabled = true;

        try {
          await dbService.saveStockAdjustment({
            flavorId: flavor.id,
            delta,
            type,
            reason,
            user,
            state
          });

          closeSheet();
          showToast('Ajuste de estoque salvo com sucesso!');
          if (typeof onSaved === 'function') onSaved();
        } catch (err) {
          warnEl.hidden = false;
          warnEl.textContent = err.message || 'Erro ao registrar ajuste.';
          submitBtn.disabled = false;
        }
      });
    }
  });
}

