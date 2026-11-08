/**
 * Módulo de Produção de Fornadas (Fornada 1, Fornada 2...)
 * Suporta ingredientes com embalagens e gramas (ex: 1 cx de 400g e usa 350g em fornada de 25 palhas)
 */

import { openSheet, closeSheet } from '../components/BottomSheet.js';
import { showToast } from '../components/Toast.js';
import { dbService } from '../services/dbService.js';
import {
  formatMoney,
  calculateIngredientCost,
  calculateBatchSummary,
  calculateWeightedAverageCost,
  getNextBatchNumber
} from '../calculations/index.js';
import { today, num, esc } from '../utils/formatters.js';

export function openProduceModal({ state, preFlavorId, user, onSaved, onGoCosts, onOpenFlavor, onViewHistory }) {
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
  let rows = [{ costId: String(state.costs[0].id), qty: '' }];

  function flavorOptions(selectedId) {
    return state.flavors.map(f => `
      <option value="${f.id}" ${f.id === selectedId ? 'selected' : ''}>
        ${esc(f.name)} — ${f.stock} em estoque (${formatMoney(f.price)})
      </option>
    `).join('');
  }

  function ingredientOptions(selectedCostId) {
    return state.costs.map(c => {
      const u = c.unit || (c.item?.toLowerCase().includes('embal') ? 'un' : 'g');
      const unitCost = c.qty > 0 ? c.total / c.qty : 0;
      let label = `${esc(c.item)}`;
      if (c.packagesCount && c.packageWeight) {
        label += ` (${c.packagesCount} cx de ${c.packageWeight}g)`;
      } else {
        label += ` (${c.qty} ${esc(u)})`;
      }
      label += ` — ${formatMoney(unitCost)}/${esc(u)}`;
      return `
        <option value="${esc(c.id)}" ${String(c.id) === String(selectedCostId) ? 'selected' : ''}>
          ${label}
        </option>
      `;
    }).join('');
  }

  function renderRowsHtml() {
    return rows.map((r, index) => {
      const selectedCost = state.costs.find(c => String(c.id) === String(r.costId)) || state.costs[0];
      const u = selectedCost?.unit || 'g';
      const placeholder = selectedCost?.packageWeight
        ? `Ex: 350 (de ${selectedCost.packageWeight}g da caixa)`
        : `Ex: 350 (${esc(u)})`;

      return `
        <div class="card" style="padding:12px;margin:0 0 10px" data-ing-row="${index}">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
            <label style="margin:0;font-size:13px;font-weight:700">Ingrediente ${index + 1}</label>
            ${rows.length > 1 ? `
              <button class="link" type="button" data-del-row="${index}" style="font-size:12px;color:var(--bad)">
                Remover
              </button>
            ` : ''}
          </div>
          <div class="field">
            <select data-ing-cost>${ingredientOptions(r.costId)}</select>
          </div>
          <div class="field" style="margin-bottom:0">
            <label>Quantidade utilizada (${esc(u)})</label>
            <input data-ing-qty inputmode="decimal" placeholder="${placeholder}" value="${esc(r.qty)}">
          </div>
          <div class="subline">
            <span>Custo proporcional usado</span>
            <b data-ing-total>R$ 0,00</b>
          </div>
        </div>
      `;
    }).join('');
  }

  const initialBatchNum = getNextBatchNumber(state.productions, f0.id);

  const body = `
    <form id="f-prod" novalidate>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <span class="pill good" id="p-batch-pill" style="font-size:13px;padding:4px 12px">
          Fornada ${initialBatchNum}
        </span>
        ${(state.productions || []).length > 0 ? `
          <button class="link" type="button" id="p-btn-history">Ver fornadas anteriores</button>
        ` : ''}
      </div>

      <div class="field">
        <label for="p-flavor">Sabor que está sendo produzido <span class="req">*</span></label>
        <select id="p-flavor">${flavorOptions(f0.id)}</select>
      </div>

      <div class="sec-h" style="margin-top:8px">
        <h2>Ingredientes desta fornada</h2>
      </div>
      <p class="hint" style="margin:0 0 12px">
        Selecione o insumo e informe quantas gramas utilizou (ex.: comprou 1 cx de 400g, porém usou 350g). O sistema calcula o custo exato.
      </p>

      <div id="p-ingredients">${renderRowsHtml()}</div>
      <button class="btn block" id="p-add-ing" type="button" style="margin-bottom:14px">
        + Adicionar outro ingrediente
      </button>

      <div class="field">
        <label for="p-qty" id="p-qty-label">Quantas palhas essa Fornada ${initialBatchNum} rendeu? <span class="req">*</span></label>
        <input id="p-qty" inputmode="numeric" placeholder="Ex.: 25">
      </div>

      <div class="sum3">
        <div><span>Custo da fornada</span><b id="p-lot">—</b></div>
        <div><span>Custo real / palha</span><b id="p-unit">—</b></div>
        <div><span>Margem de lucro</span><b id="p-profit">—</b></div>
      </div>

      <div class="sum" style="grid-template-columns:1fr 1fr">
        <div><span>Faturamento previsto</span><b id="p-revenue">—</b></div>
        <div><span>Lucro previsto</span><b id="p-lot-profit">—</b></div>
      </div>

      <p class="hint" id="p-hint" style="margin:-4px 0 14px"></p>
      <p class="msg" id="p-warn" hidden></p>

      <button class="btn primary block" type="submit" id="p-submit">
        Registrar Fornada e atualizar estoque
      </button>
    </form>
  `;

  openSheet({
    title: 'Nova Produção',
    body,
    mount(b) {
      const g = id => b.querySelector('#' + id);

      function getCurrentBatchNum() {
        const flavorId = g('p-flavor').value;
        return getNextBatchNumber(state.productions, flavorId);
      }

      function updateBatchLabels() {
        const num = getCurrentBatchNum();
        const pill = g('p-batch-pill');
        const qtyLabel = g('p-qty-label');
        if (pill) pill.textContent = `Fornada ${num}`;
        if (qtyLabel) qtyLabel.innerHTML = `Quantas palhas essa <b>Fornada ${num}</b> rendeu? <span class="req">*</span>`;
      }

      function calculateState() {
        let totalCostCents = 0;
        let allValid = true;

        const rowEls = b.querySelectorAll('[data-ing-row]');
        const ingredientsList = [];

        rowEls.forEach(el => {
          const costSelect = el.querySelector('[data-ing-cost]');
          const qtyInput = el.querySelector('[data-ing-qty]');
          if (!costSelect || !qtyInput) return;

          const costId = costSelect.value;
          const q = num(qtyInput.value);
          const costItem = state.costs.find(c => String(c.id) === String(costId));

          if (!costItem || !(q > 0)) {
            allValid = false;
            const totalEl = el.querySelector('[data-ing-total]');
            if (totalEl) totalEl.textContent = 'R$ 0,00';
            return;
          }

          const lineCalc = calculateIngredientCost({
            supplyTotal: costItem.total,
            supplyQty: costItem.qty,
            supplyUnit: costItem.unit || 'g',
            packageWeight: costItem.packageWeight,
            packagesCount: costItem.packagesCount,
            usedQty: q,
            usedUnit: costItem.unit || 'g'
          });

          totalCostCents += lineCalc.lineCostCents;
          const totalEl = el.querySelector('[data-ing-total]');
          if (totalEl) totalEl.textContent = formatMoney(lineCalc.lineCost);

          ingredientsList.push({
            costId: costItem.id,
            item: costItem.item,
            unit: costItem.unit || 'g',
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
        g('p-profit').textContent = isValid ? `${summary.profitMarginPercent}% (${formatMoney(summary.unitProfit)})` : '—';
        g('p-profit').className = summary.unitProfit >= 0 ? 'pos' : 'neg';
        g('p-revenue').textContent = isValid ? formatMoney(summary.projectedRevenue) : '—';
        g('p-lot-profit').textContent = isValid ? formatMoney(summary.projectedProfit) : '—';

        if (flavor) {
          const num = getCurrentBatchNum();
          g('p-hint').textContent = `Preço de venda: ${formatMoney(flavor.price)} cada. Ao salvar a Fornada ${num}, o estoque aumentará em ${producedUnits || 0} un e o custo médio ponderado será recalculado.`;
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

        b.querySelectorAll('[data-del-row]').forEach(btn => {
          btn.onclick = () => {
            const index = parseInt(btn.dataset.delRow, 10);
            if (rows.length > 1) {
              rows.splice(index, 1);
              g('p-ingredients').innerHTML = renderRowsHtml();
              bindRows();
            }
          };
        });

        calculateState();
      }

      const historyBtn = g('p-btn-history');
      if (historyBtn) {
        historyBtn.addEventListener('click', () => {
          closeSheet();
          if (typeof onViewHistory === 'function') onViewHistory();
        });
      }

      g('p-add-ing').addEventListener('click', () => {
        const rowEls = b.querySelectorAll('[data-ing-row]');
        rowEls.forEach((el, idx) => {
          if (rows[idx]) {
            rows[idx].costId = el.querySelector('[data-ing-cost]').value;
            rows[idx].qty = el.querySelector('[data-ing-qty]').value;
          }
        });

        rows.push({ costId: String(state.costs[0].id), qty: '' });
        g('p-ingredients').innerHTML = renderRowsHtml();
        bindRows();
      });

      g('p-flavor').addEventListener('change', () => {
        updateBatchLabels();
        calculateState();
      });

      g('p-qty').addEventListener('input', calculateState);
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

        const batchNum = getCurrentBatchNum();
        const totalBatchCount = getNextBatchNumber(state.productions);

        try {
          await dbService.saveProduction({
            productionData: {
              flavorId: res.flavor.id,
              batchNumber: batchNum,
              globalBatchNumber: totalBatchCount,
              qty: res.producedUnits,
              batchCostCents: res.totalCostCents,
              ingredients: res.ingredientsList,
              date: today(),
              notes: `Fornada ${batchNum} (${res.producedUnits} palhas produzidas)`
            },
            user,
            state
          });

          closeSheet();
          showToast(`Fornada ${batchNum} registrada! Custo real: ${formatMoney(res.summary.unitCost)} / un`);
          if (typeof onSaved === 'function') onSaved();
        } catch (err) {
          warnEl.hidden = false;
          warnEl.textContent = err.message || 'Erro ao registrar produção.';
          submitBtn.disabled = false;
          submitBtn.textContent = 'Registrar Fornada e atualizar estoque';
        }
      });
    }
  });
}
