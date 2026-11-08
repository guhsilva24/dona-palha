/**
 * Módulo de Cadastro e Edição de Custos e Insumos
 * Suporta unidade de medida (gramas, kg, ml, unidades, pacotes)
 * e custo por grama para receitas artesanais.
 */

import { openSheet, closeSheet } from '../components/BottomSheet.js';
import { showToast } from '../components/Toast.js';
import { dbService } from '../services/dbService.js';
import { formatMoney, moneyToInput } from '../calculations/index.js';
import { UNITS_OF_MEASURE } from '../utils/constants.js';
import { today, num, esc } from '../utils/formatters.js';
import { armDelete } from '../utils/dom.js';

export function openCostModal({ state, costId, user, onSaved, onDeleted }) {
  const cost = costId ? state.costs.find(c => c.id === costId) : null;
  const currentUnit = cost?.unit || (cost?.item?.toLowerCase().includes('embal') ? 'un' : 'g');

  function unitOptions(selectedUnit) {
    return UNITS_OF_MEASURE.map(u => `
      <option value="${u.id}" ${u.id === selectedUnit ? 'selected' : ''}>
        ${u.label}
      </option>
    `).join('');
  }

  const body = `
    <form id="f-cost-form" novalidate>
      <div class="field">
        <label for="k-item">Item comprado <span class="req">*</span></label>
        <input id="k-item" autocomplete="off" placeholder="Ex.: Chocolate em barra, Leite condensado, Embalagem" value="${cost ? esc(cost.item) : ''}">
      </div>

      <div class="grid2">
        <div class="field">
          <label for="k-unit-sel">Unidade de medida</label>
          <select id="k-unit-sel">${unitOptions(currentUnit)}</select>
        </div>
        <div class="field">
          <label for="k-qty">Quantidade comprada <span class="req">*</span></label>
          <input id="k-qty" inputmode="decimal" placeholder="Ex: 1000" value="${cost ? cost.qty : ''}">
        </div>
      </div>

      <div class="grid2">
        <div class="field">
          <label for="k-total">Valor total pago <span class="req">*</span></label>
          <div class="pre">
            <span>R$</span>
            <input id="k-total" inputmode="decimal" placeholder="0,00" value="${cost ? moneyToInput(cost.total) : ''}">
          </div>
        </div>
        <div class="field">
          <label for="k-date">Data da compra</label>
          <input id="k-date" type="date" value="${cost ? cost.date : today()}">
        </div>
      </div>

      <div class="sum" style="grid-template-columns:1fr">
        <div>
          <span id="k-unit-desc">Custo por unidade comprada</span>
          <b id="k-unit">R$ 0,00</b>
        </div>
      </div>

      <p class="hint" id="k-hint" style="margin:-6px 0 14px">
        Dica: Se comprou em quilos (ex: barra de 1kg), cadastre 1000g para facilitar a medição das receitas da sua palha italiana.
      </p>

      <p class="msg" id="k-warn" hidden></p>

      <div class="actions">
        <button class="btn primary block" type="submit" id="k-submit">
          ${cost ? 'Salvar custo' : 'Registrar custo'}
        </button>
        ${cost ? `
          <button class="btn danger" type="button" id="k-del">Excluir custo</button>
        ` : ''}
      </div>
    </form>
  `;

  openSheet({
    title: cost ? 'Editar insumo' : 'Novo insumo / compra',
    body,
    mount(b) {
      const g = id => b.querySelector('#' + id);

      function calc() {
        const q = parseFloat(String(g('k-qty').value).replace(',', '.'));
        const t = num(g('k-total').value);
        const unit = g('k-unit-sel').value;

        if (q > 0 && t >= 0) {
          const unitCost = t / q;
          if (unit === 'g') {
            const perKg = unitCost * 1000;
            g('k-unit-desc').textContent = `Custo por grama (g)`;
            g('k-unit').innerHTML = `${formatMoney(unitCost)} <small style="font-size:13px;font-weight:400;color:var(--muted)">/g (${formatMoney(perKg)}/kg)</small>`;
          } else if (unit === 'kg') {
            const perGram = unitCost / 1000;
            g('k-unit-desc').textContent = `Custo por quilo (kg)`;
            g('k-unit').innerHTML = `${formatMoney(unitCost)} <small style="font-size:13px;font-weight:400;color:var(--muted)">/kg (${formatMoney(perGram)}/g)</small>`;
          } else if (unit === 'ml') {
            g('k-unit-desc').textContent = `Custo por ml`;
            g('k-unit').textContent = `${formatMoney(unitCost)} / ml`;
          } else {
            g('k-unit-desc').textContent = `Custo por ${unit}`;
            g('k-unit').textContent = `${formatMoney(unitCost)} / ${unit}`;
          }
        } else {
          g('k-unit').textContent = 'R$ 0,00';
        }
      }

      g('k-qty').addEventListener('input', calc);
      g('k-total').addEventListener('input', calc);
      g('k-unit-sel').addEventListener('change', calc);
      calc();

      g('f-cost-form').addEventListener('submit', async e => {
        e.preventDefault();
        const item = g('k-item').value.trim();
        const unit = g('k-unit-sel').value;
        const q = parseFloat(String(g('k-qty').value).replace(',', '.'));
        const t = num(g('k-total').value);
        const d = g('k-date').value || today();

        let msg = '';
        if (!item) msg = 'Informe o nome do item comprado.';
        else if (!(q > 0)) msg = 'Informe a quantidade comprada maior que zero.';
        else if (!(t >= 0)) msg = 'Informe o valor total pago.';

        const warnEl = g('k-warn');
        warnEl.hidden = !msg;
        warnEl.textContent = msg;
        if (msg) return;

        const submitBtn = g('k-submit');
        submitBtn.disabled = true;

        try {
          await dbService.saveCost({
            costData: {
              id: cost ? cost.id : null,
              item,
              unit,
              qty: q,
              total: t,
              date: d
            },
            user,
            state
          });

          closeSheet();
          showToast(cost ? 'Custo atualizado' : 'Custo registrado com sucesso');
          if (typeof onSaved === 'function') onSaved();
        } catch (err) {
          warnEl.hidden = false;
          warnEl.textContent = err.message || 'Erro ao salvar custo.';
          submitBtn.disabled = false;
        }
      });

      if (cost) {
        const delBtn = g('k-del');
        if (delBtn) {
          armDelete(delBtn, async () => {
            try {
              await dbService.deleteCost({
                costId: cost.id,
                user,
                state
              });
              closeSheet();
              showToast('Custo excluído.');
              if (typeof onDeleted === 'function') onDeleted();
            } catch (err) {
              alert(err.message || 'Erro ao excluir custo.');
            }
          });
        }
      }
    }
  });
}
