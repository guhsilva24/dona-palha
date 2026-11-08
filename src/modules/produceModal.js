/**
 * Módulo de Produção de Fornadas (Fornada 1, Fornada 2...)
 * Permite adicionar múltiplos ingredientes (chocolate, leite condensado, bolacha maisena, etc.),
 * colocar a quantidade utilizada de cada um e o rendimento em palhas.
 * Calcula automaticamente o Custo Exato por Palha / Produto!
 */

import { openSheet, closeSheet } from '../components/BottomSheet.js';
import { showToast } from '../components/Toast.js';
import { dbService } from '../services/dbService.js';
import {
  formatMoney,
  calculateIngredientCost,
  calculateBatchSummary,
  getNextBatchNumber
} from '../calculations/index.js';
import { today, num, esc } from '../utils/formatters.js';
import { I } from '../utils/icons.js';

export function openProduceModal({ state, preFlavorId, user, onSaved, onGoCosts, onOpenFlavor, onViewHistory }) {
  if (!state.flavors.length) {
    showToast('Cadastre um sabor primeiro em Sabores.');
    if (typeof onOpenFlavor === 'function') onOpenFlavor();
    return;
  }

  if (!state.costs.length) {
    showToast('Cadastre primeiro as compras de insumos na aba Custos.');
    if (typeof onGoCosts === 'function') onGoCosts();
    return;
  }

  const f0 = state.flavors.find(f => f.id === preFlavorId) || state.flavors[0];
  const firstCost = state.costs[0];
  let rows = [{
    costId: String(firstCost.id),
    qty: ''
  }];

  function flavorOptions(selectedId) {
    return state.flavors.map(f => `
      <option value="${f.id}" ${f.id === selectedId ? 'selected' : ''}>
        ${esc(f.name)} — Estoque: ${f.stock} un (${formatMoney(f.price)})
      </option>
    `).join('');
  }

  function ingredientOptions(selectedCostId) {
    return state.costs.map(c => {
      const u = c.unit || (c.item?.toLowerCase().includes('embal') ? 'un' : 'g');
      const unitCost = c.qty > 0 ? (c.total / c.qty) : 0;
      let label = `${esc(c.item)}`;
      if (c.packagesCount && c.packageWeight) {
        label += ` (${c.packagesCount} cx de ${c.packageWeight}g = ${c.qty}g)`;
      } else {
        label += ` (${c.qty} ${esc(u)})`;
      }
      label += ` — ${u === 'g' ? `R$ ${unitCost.toFixed(4).replace('.', ',')}/g` : `${formatMoney(unitCost)}/un`}`;

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
        ? `Ex: 349 (de ${selectedCost.qty}g totais)`
        : `Ex: 349 (${esc(u)})`;

      return `
        <div class="card" style="padding:14px;margin:0 0 10px;background:var(--card);border:1px solid var(--line)" data-ing-row="${index}">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
            <span style="font-size:13px;font-weight:700;color:var(--brand-dark)">
              Ingrediente ${index + 1}
            </span>
            ${rows.length > 1 ? `
              <button class="link" type="button" data-del-row="${index}" style="font-size:12px;color:var(--bad)">
                ${I('trash')} Remover
              </button>
            ` : ''}
          </div>

          <div class="field" style="margin-bottom:10px">
            <label style="font-size:12px">Qual produto você usou?</label>
            <select data-ing-cost>${ingredientOptions(r.costId)}</select>
          </div>

          <div class="field" style="margin-bottom:8px">
            <label style="font-size:12px">Quantas gramas/unidades usou na receita? <span class="req">*</span></label>
            <div class="pre">
              <span data-ing-unit>${esc(u)}</span>
              <input data-ing-qty inputmode="decimal" placeholder="${placeholder}" value="${esc(r.qty)}">
            </div>
          </div>

          <div style="display:flex;justify-content:space-between;align-items:center;background:var(--field);padding:6px 10px;border-radius:10px;font-size:12.5px">
            <span class="muted">Custo usado na receita:</span>
            <b data-ing-total style="color:var(--ink)">R$ 0,00</b>
          </div>
        </div>
      `;
    }).join('');
  }

  const initialBatchNum = getNextBatchNumber(state.productions, f0.id);

  const body = `
    <form id="f-prod" novalidate>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <span class="pill good" id="p-batch-pill" style="font-size:13px;padding:4px 12px;font-weight:700">
          Fornada ${initialBatchNum}
        </span>
        ${(state.productions || []).length > 0 ? `
          <button class="link" type="button" id="p-btn-history">${I('box')} Ver fornadas anteriores</button>
        ` : ''}
      </div>

      <div class="field">
        <label for="p-flavor">Sabor que você está produzindo <span class="req">*</span></label>
        <select id="p-flavor">${flavorOptions(f0.id)}</select>
      </div>

      <div class="sec-h" style="margin:16px 0 6px">
        <h2>Ingredientes colocados na receita</h2>
      </div>
      <p class="muted" style="margin:0 0 12px;font-size:12.5px;line-height:1.4">
        Adicione os produtos que você colocou na panela/tigela e quanto gastou de cada um:
      </p>

      <div id="p-ingredients">${renderRowsHtml()}</div>

      <button class="btn block" id="p-add-ing" type="button" style="margin-bottom:16px">
        ${I('plus')} Adicionar outro ingrediente (ex: Leite condensado, Bolacha maisena)
      </button>

      <div style="background:var(--field);padding:10px 14px;border-radius:12px;display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <span class="muted" style="font-size:13px">Gasto total com os ingredientes desta fornada:</span>
        <b style="font-size:17px;color:var(--brand)" id="p-total-ingredients">R$ 0,00</b>
      </div>

      <!-- RENDIMENTO DA FORNADA -->
      <div class="field">
        <label for="p-qty" id="p-qty-label" style="font-size:14px;font-weight:700">
          Quantas palhas essa fornada rendeu no final? <span class="req">*</span>
        </label>
        <div class="pre">
          <span>un</span>
          <input id="p-qty" inputmode="numeric" placeholder="Ex: 255" style="font-size:17px;font-weight:700">
        </div>
        <span class="muted" style="font-size:12px;margin-top:4px;display:block">
          Exemplo: Se rendeu 255 palhas, o sistema divide o custo dos ingredientes por 255.
        </span>
      </div>

      <!-- CARD RESULTADO DO CUSTO POR PRODUTO -->
      <div class="card" style="padding:16px;background:var(--card);border:2px solid var(--brand);border-radius:16px;margin:16px 0;box-shadow:0 4px 12px rgba(0,0,0,0.05)">
        <div style="text-align:center;padding-bottom:12px;border-bottom:1px dashed var(--line)">
          <span class="muted" style="font-size:11.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;display:block">
            Custo Real por Palha / Produto
          </span>
          <b style="font-size:28px;color:var(--brand);display:block;margin:4px 0" id="p-unit-display">
            R$ 0,00
          </b>
          <span class="muted" style="font-size:12px" id="p-unit-sub">
            por cada palha produzida
          </span>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;text-align:center;margin-top:12px">
          <div>
            <span class="muted" style="font-size:11px;display:block">Preço de Venda</span>
            <b style="font-size:16px" id="p-price-display">—</b>
          </div>
          <div>
            <span class="muted" style="font-size:11px;display:block">Lucro por Palha</span>
            <b style="font-size:16px" id="p-profit-display" class="pos">—</b>
          </div>
        </div>

        <div style="margin-top:10px;padding-top:10px;border-top:1px dashed var(--line);font-size:12px;color:var(--muted);line-height:1.45" id="p-calc-explanation">
          Preencha a quantidade usada dos ingredientes e quantas palhas renderam para ver o cálculo.
        </div>
      </div>

      <div class="field">
        <label for="p-date">Data da produção</label>
        <input id="p-date" type="date" value="${today()}">
      </div>

      <p class="msg" id="p-warn" hidden></p>

      <div class="actions">
        <button class="btn primary block" type="submit" id="p-submit">
          ${I('check')} Salvar Fornada e Adicionar ao Estoque
        </button>
      </div>
    </form>
  `;

  openSheet({
    title: 'Produzir Palhas (Fornada)',
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
        if (qtyLabel) qtyLabel.innerHTML = `Quantas palhas essa <b>Fornada ${num}</b> rendeu no final? <span class="req">*</span>`;
      }

      function calculateState() {
        let totalCostCents = 0;
        let allValid = true;

        const rowEls = b.querySelectorAll('[data-ing-row]');
        const ingredientsList = [];

        rowEls.forEach((el, idx) => {
          const costSelect = el.querySelector('[data-ing-cost]');
          const qtyInput = el.querySelector('[data-ing-qty]');
          const unitBadge = el.querySelector('[data-ing-unit]');
          if (!costSelect || !qtyInput) return;

          const costId = costSelect.value;
          const q = num(qtyInput.value);
          const costItem = state.costs.find(c => String(c.id) === String(costId));

          if (costItem && unitBadge) {
            unitBadge.textContent = costItem.unit || 'g';
          }

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

        const totalCostDecimal = totalCostCents / 100;
        g('p-total-ingredients').textContent = formatMoney(totalCostDecimal);

        const producedUnits = parseInt(g('p-qty').value, 10);
        const flavor = state.flavors.find(f => f.id === g('p-flavor').value);

        if (flavor) {
          g('p-price-display').textContent = formatMoney(flavor.price);
        }

        const isValid = allValid && producedUnits >= 1 && totalCostCents > 0;

        if (isValid) {
          const exactUnitCost = totalCostDecimal / producedUnits;
          const unitCostStr = exactUnitCost < 0.10
            ? `R$ ${exactUnitCost.toFixed(3).replace('.', ',')}`
            : formatMoney(exactUnitCost);

          g('p-unit-display').textContent = unitCostStr;
          g('p-unit-sub').textContent = `por cada palha (rendeu ${producedUnits} un)`;

          const profitPerPalha = flavor ? (flavor.price - exactUnitCost) : 0;
          g('p-profit-display').textContent = formatMoney(profitPerPalha);
          g('p-profit-display').className = profitPerPalha >= 0 ? 'pos' : 'neg';

          const revenue = flavor ? (flavor.price * producedUnits) : 0;
          const totalProfit = flavor ? (revenue - totalCostDecimal) : 0;

          g('p-calc-explanation').innerHTML = `
            <b>Cálculo Exato:</b> ${formatMoney(totalCostDecimal)} (gasto com ingredientes) ÷ ${producedUnits} palhas = <b>${unitCostStr} por palha pronta</b>.<br>
            Faturamento previsto: <b>${formatMoney(revenue)}</b> · Lucro total da fornada: <b style="color:var(--brand)">${formatMoney(totalProfit)}</b>.
          `;
        } else {
          g('p-unit-display').textContent = 'R$ 0,00';
          g('p-unit-sub').textContent = 'por cada palha produzida';
          g('p-profit-display').textContent = '—';
          g('p-calc-explanation').textContent = 'Adicione os ingredientes usados e informe quantas palhas renderam para ver o cálculo do custo.';
        }

        return {
          totalCostCents,
          producedUnits,
          isValid,
          flavor,
          ingredientsList
        };
      }

      function bindRows() {
        b.querySelectorAll('[data-ing-cost]').forEach((select, idx) => {
          select.onchange = e => {
            const rowEl = e.target.closest('[data-ing-row]');
            const costItem = state.costs.find(c => String(c.id) === String(e.target.value));
            const unitBadge = rowEl?.querySelector('[data-ing-unit]');
            const qtyInput = rowEl?.querySelector('[data-ing-qty]');
            if (costItem && unitBadge) {
              unitBadge.textContent = costItem.unit || 'g';
            }
            if (costItem && qtyInput) {
              qtyInput.placeholder = costItem.packageWeight
                ? `Ex: 349 (de ${costItem.qty}g totais)`
                : `Ex: 349 (${costItem.unit || 'g'})`;
            }
            if (rows[idx]) rows[idx].costId = e.target.value;
            calculateState();
          };
        });

        b.querySelectorAll('[data-ing-qty]').forEach((input, idx) => {
          input.oninput = () => {
            if (rows[idx]) rows[idx].qty = input.value;
            calculateState();
          };
        });

        b.querySelectorAll('[data-del-row]').forEach(btn => {
          btn.onclick = () => {
            const index = parseInt(btn.dataset.delRow, 10);
            if (rows.length > 1) {
              rows.splice(index, 1);
              g('p-ingredients').innerHTML = renderRowsHtml();
              bindRows();
              calculateState();
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
        const nextCost = state.costs[rows.length % state.costs.length] || state.costs[0];
        rows.push({
          costId: String(nextCost.id),
          qty: ''
        });
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
        const calcRes = calculateState();
        const warnEl = g('p-warn');
        warnEl.hidden = true;

        if (!calcRes.flavor) {
          warnEl.textContent = 'Selecione um sabor.';
          warnEl.hidden = false;
          return;
        }

        if (!calcRes.isValid) {
          warnEl.textContent = 'Preencha a quantidade usada dos ingredientes e quantas palhas a fornada rendeu.';
          warnEl.hidden = false;
          return;
        }

        const submitBtn = g('p-submit');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Gravando produção…';

        const batchNum = getCurrentBatchNum();
        const prodDate = g('p-date')?.value || today();

        try {
          await dbService.saveProduction({
            productionData: {
              flavorId: calcRes.flavor.id,
              qty: calcRes.producedUnits,
              batchCostCents: calcRes.totalCostCents,
              ingredients: calcRes.ingredientsList,
              notes: `Fornada ${batchNum}`,
              date: prodDate
            },
            user,
            state
          });

          closeSheet();
          showToast(`Fornada ${batchNum} registrada! +${calcRes.producedUnits} palhas adicionadas ao sabor ${calcRes.flavor.name}.`);
          if (typeof onSaved === 'function') onSaved();
        } catch (err) {
          warnEl.textContent = err.message || 'Erro ao registrar fornada.';
          warnEl.hidden = false;
          submitBtn.disabled = false;
          submitBtn.textContent = 'Salvar Fornada e Adicionar ao Estoque';
        }
      });
    }
  });
}
