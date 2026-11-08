/**
 * Módulo de Produção de Fornada
 * Seleciona ingredientes cadastrados em custos, calcula proporções exatas,
 * rendimento de palhas, custo real unitário, projeções e atualiza o custo médio ponderado.
 */

import { openSheet, closeSheet } from '../components/BottomSheet.js';
import { showToast } from '../components/Toast.js';
import { dbService } from '../services/dbService.js';
import {
  formatMoney,
  calculateIngredientCost,
  calculateBatchSummary,
  calculateWeightedAverageCost
} from '../calculations/index.js';
import { today, num, esc } from '../utils/formatters.js';

export function openProduceModal({ state, preFlavorId, user, onSaved, onGoCosts, onOpenFlavor }) {
  if (!state.flavors.length) {
    showToast('Cadastre um sabor primeiro');
    if (typeof onOpenFlavor === 'function') onOpenFlavor();
    return;
  }

  if (!state.costs.length) {
    showToast('Cadastre primeiro os ingredientes em Custos');
    if (typeof onGoCosts === 'function') onGoCosts();
    return;
  }

  const f0 = state.flavors.find(f => f.id === preFlavorId) || state.flavors[0];
  const rows = [{ costId: String(state.costs[0].id), qty: '' }];

  function flavorOptions(selectedId) {
    return state.flavors.map(f => `
      <option value="${f.id}" ${f.id === selectedId ? 'selected' : ''}>
        ${esc(f.name)} — ${f.stock} em estoque (${formatMoney(f.price)})
      </option>
    `).join('');
  }

  function ingredientOptions(selectedCostId) {
    return state.costs.map(c => {
      const unit = c.qty > 0 ? c.total / c.qty : 0;
      return `
        <option value="${esc(c.id)}" ${String(c.id) === String(selectedCostId) ? 'selected' : ''}>
          ${esc(c.item)} — ${formatMoney(unit)} por unidade
        </option>
      `;
    }).join('');
  }

  function rowHtml(r, index) {
    return `
      <div class="card" style="padding:12px;margin:0 0 10px" data-ing-row="${index}">
        <div class="field">
          <label>Ingrediente ${index + 1}</label>
          <select data-ing-cost>${ingredientOptions(r.costId)}</select>
        </div>
        <div class="field" style="margin-bottom:0">
          <label>Quantidade utilizada</label>
          <input data-ing-qty inputmode="decimal" placeholder="Ex.: 2 (kg, latas, pacotes...)" value="${esc(r.qty)}">
        </div>
        <div class="subline">
          <span>Custo deste ingrediente</span>
          <b data-ing-total>R$ 0,00</b>
        </div>
      </div>
    `;
  }

  const body = `
    <form id="f-prod" novalidate>
      <div class="field">
        <label for="p-flavor">Sabor que está sendo produzido <span class="req">*</span></label>
        <select id="p-flavor">${flavorOptions(f0.id)}</select>
      </div>

      <div class="sec-h" style="margin-top:8px">
        <h2>Ingredientes da fornada</h2>
      </div>
      <p class="hint" style="margin:0 0 12px">
        Selecione os insumos cadastrados em Custos e informe quanto de cada um foi usado nesta fornada. O sistema calcula a proporção exata.
      </p>

      <div id="p-ingredients">${rows.map(rowHtml).join('')}</div>
      <button class="btn block" id="p-add-ing" type="button" style="margin-bottom:14px">
        + Adicionar outro ingrediente
      </button>

      <div class="field">
        <label for="p-qty">Quantas palhas essa fornada rendeu? <span class="req">*</span></label>
        <input id="p-qty" inputmode="numeric" placeholder="Ex.: 40">
      </div>

      <div class="sum3">
        <div><span>Custo total da fornada</span><b id="p-lot">—</b></div>
        <div><span>Custo real por palha</span><b id="p-unit">—</b></div>
        <div><span>Lucro por palha</span><b id="p-profit">—</b></div>
      </div>

      <div class="sum" style="grid-template-columns:1fr 1fr">
        <div><span>Faturamento previsto</span><b id="p-revenue">—</b></div>
        <div><span>Lucro previsto</span><b id="p-lot-profit">—</b></div>
      </div>

      <p class="hint" id="p-hint" style="margin:-4px 0 14px"></p>
      <p class="msg" id="p-warn" hidden></p>

      <button class="btn primary block" type="submit" id="p-submit">
        Registrar produção e atualizar estoque
      </button>
    </form>
  `;

  openSheet({
    title: 'Nova produção de fornada',
    body,
    mount(b) {
      const g = id => b.querySelector('#' + id);

      function calculateState() {
        let totalCostCents = 0;
        let allValid = true;

        const rowEls = b.querySelectorAll('[data-ing-row]');
        const ingredientsList = [];

        rowEls.forEach(el => {
          const costId = el.querySelector('[data-ing-cost]').value;
          const q = num(el.querySelector('[data-ing-qty]').value);
          const costItem = state.costs.find(c => String(c.id) === String(costId));

          if (!costItem || !(q > 0)) {
            allValid = false;
            el.querySelector('[data-ing-total]').textContent = 'R$ 0,00';
            return;
          }

          const lineCalc = calculateIngredientCost({
            supplyTotal: costItem.total,
            supplyQty: costItem.qty,
            usedQty: q
          });

          totalCostCents += lineCalc.lineCostCents;
          el.querySelector('[data-ing-total]').textContent = formatMoney(lineCalc.lineCost);

          ingredientsList.push({
            costId: costItem.id,
            item: costItem.item,
            qty: q,
            unitCost: lineCalc.unitCost,
            total: lineCalc.lineCost
          });
        });

        const producedUnits = parseInt(g('p-qty').value, 10);
        const flavor = state.flavors.find(f => f.id === g('p-flavor').value);

        const summary = calculateBatchSummary({
          batchCostCents: totalCostCents,
          batchUnits: producedUnits || 0,
          sellingPrice: flavor ? flavor.price : 0
        });

        const isValid = allValid && producedUnits >= 1 && totalCostCents > 0;

        g('p-lot').textContent = allValid && totalCostCents > 0 ? formatMoney(summary.batchCost) : '—';
        g('p-unit').textContent = isValid ? formatMoney(summary.unitCost) : '—';
        g('p-profit').textContent = isValid ? formatMoney(summary.unitProfit) : '—';
        g('p-revenue').textContent = isValid ? formatMoney(summary.projectedRevenue) : '—';
        g('p-lot-profit').textContent = isValid ? formatMoney(summary.projectedProfit) : '—';

        if (flavor) {
          g('p-hint').textContent = `Preço de venda: ${formatMoney(flavor.price)} por palha. O custo por palha será ponderado com as ${flavor.stock} unidades existentes no estoque.`;
        }

        return {
          totalCostCents,
          producedUnits,
          isValid,
          flavor,
          ingredientsList,
          summary
        };
      }

      function bindRows() {
        b.querySelectorAll('[data-ing-cost], [data-ing-qty]').forEach(el => {
          el.oninput = calculateState;
          el.onchange = calculateState;
        });
        calculateState();
      }

      g('p-add-ing').addEventListener('click', () => {
        rows.push({ costId: String(state.costs[0].id), qty: '' });
        g('p-ingredients').insertAdjacentHTML('beforeend', rowHtml(rows[rows.length - 1], rows.length - 1));
        bindRows();
      });

      g('p-qty').addEventListener('input', calculateState);
      g('p-flavor').addEventListener('change', calculateState);
      bindRows();

      g('f-prod').addEventListener('submit', async e => {
        e.preventDefault();
        const res = calculateState();
        const warnEl = g('p-warn');

        if (!res.isValid) {
          warnEl.hidden = false;
          warnEl.textContent = 'Informe os ingredientes utilizados e quantas palhas foram produzidas na fornada.';
          return;
        }

        warnEl.hidden = true;
        const submitBtn = g('p-submit');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Gravando fornada…';

        try {
          await dbService.saveProduction({
            productionData: {
              flavorId: res.flavor.id,
              qty: res.producedUnits,
              batchCostCents: res.totalCostCents,
              ingredients: res.ingredientsList,
              date: today(),
              notes: `Fornada de ${res.producedUnits} un`
            },
            user,
            state
          });

          closeSheet();
          showToast(`Produção registrada! Custo real: ${formatMoney(res.summary.unitCost)}`);
          if (typeof onSaved === 'function') onSaved();
        } catch (err) {
          warnEl.hidden = false;
          warnEl.textContent = err.message || 'Erro ao registrar produção.';
          submitBtn.disabled = false;
          submitBtn.textContent = 'Registrar produção e atualizar estoque';
        }
      });
    }
  });
}
