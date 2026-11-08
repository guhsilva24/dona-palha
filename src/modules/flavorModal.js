/**
 * Módulo de Cadastro e Edição de Sabor com Precificação por Margem de Lucro (%)
 */

import { openSheet, closeSheet } from '../components/BottomSheet.js';
import { showToast } from '../components/Toast.js';
import { dbService } from '../services/dbService.js';
import {
  formatMoney,
  moneyToInput,
  calculatePriceFromMargin,
  calculateMarginFromPrice
} from '../calculations/index.js';
import { num, esc } from '../utils/formatters.js';
import { TONES, MARGIN_PRESETS } from '../utils/constants.js';
import { armDelete } from '../utils/dom.js';

export function openFlavorModal({ state, flavorId, user, onSaved, onDeleted, onProduceClick, onAdjustStockClick }) {
  const flavor = flavorId ? state.flavors.find(f => f.id === flavorId) : null;
  const currentCost = flavor ? Number(flavor.cost) || 0 : 0;
  const initialMargin = flavor && flavor.price > 0 && currentCost > 0
    ? Math.round(((flavor.price - currentCost) / flavor.price) * 100)
    : 50;

  const body = `
    <form id="f-fl" novalidate>
      <div class="field">
        <label for="f-name">Nome do sabor <span class="req">*</span></label>
        <input id="f-name" autocomplete="off" placeholder="Ex.: Tradicional, Ninho com Nutella, Maracujá" value="${flavor ? esc(flavor.name) : ''}">
      </div>

      <!-- Ajuste da Margem de Lucro Desejada -->
      <div class="card" style="padding:12px;margin:0 0 14px;background:var(--field);border:1px solid var(--line)">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <label style="font-size:13px;font-weight:700;margin:0">Definir Margem de Lucro Desejada (%)</label>
          <span class="pill good" id="f-margin-badge">${initialMargin}%</span>
        </div>

        <div class="chips" style="margin-bottom:8px">
          ${MARGIN_PRESETS.map(m => `
            <button class="chip" type="button" data-margin-preset="${m}" aria-pressed="${m === initialMargin}">
              ${m}%
            </button>
          `).join('')}
        </div>

        <div class="field" style="margin-bottom:0">
          <label for="f-margin-input" style="font-size:12px">Margem de lucro personalizada (%)</label>
          <div class="pre">
            <span>%</span>
            <input id="f-margin-input" inputmode="numeric" type="number" min="1" max="95" value="${initialMargin}" placeholder="50">
          </div>
        </div>
      </div>

      <div class="field">
        <label for="f-price">Preço de venda (por palha) <span class="req">*</span></label>
        <div class="pre">
          <span>R$</span>
          <input id="f-price" inputmode="decimal" placeholder="0,00" value="${flavor ? moneyToInput(flavor.price) : ''}">
        </div>
      </div>

      <div class="sum3">
        <div><span>Custo por palha</span><b id="f-ucost">${flavor && currentCost > 0 ? formatMoney(currentCost) : 'Calculado na fornada'}</b></div>
        <div><span>Lucro por palha</span><b id="f-uprofit">—</b></div>
        <div><span>Margem calculada</span><b id="f-margin">—</b></div>
      </div>

      <p class="hint" style="margin:-6px 0 14px">
        Ao alterar a margem (%), o preço de venda é calculado automaticamente. Você também pode digitar o preço livremente.
      </p>

      <div class="field">
        <label for="f-stock">Quantidade em estoque</label>
        <input id="f-stock" inputmode="numeric" value="${flavor ? flavor.stock : 0}">
      </div>

      <p class="msg" id="f-warn" hidden></p>

      <div class="actions">
        <button class="btn primary block" type="submit" id="f-submit">
          ${flavor ? 'Salvar sabor' : 'Cadastrar sabor'}
        </button>
        ${flavor ? `
          <div class="grid2">
            <button class="btn" type="button" id="f-btn-produce">Produzir Fornada</button>
            <button class="btn" type="button" id="f-btn-adjust">Ajustar Estoque / Perdas</button>
          </div>
          <button class="btn danger block" type="button" id="f-del">Excluir sabor</button>
        ` : ''}
      </div>
    </form>
  `;

  openSheet({
    title: flavor ? 'Editar sabor' : 'Novo sabor',
    body,
    mount(b) {
      const g = id => b.querySelector('#' + id);
      let isUpdatingPrice = false;

      function updateFromPrice() {
        if (isUpdatingPrice) return;
        const p = num(g('f-price').value);
        const c = flavor ? Number(flavor.cost) || 0 : 0;
        const marginCalc = calculateMarginFromPrice({ cost: c, price: p });

        g('f-ucost').textContent = c > 0 ? formatMoney(c) : 'Calculado na fornada';
        g('f-uprofit').textContent = Number.isFinite(p) && c > 0 ? formatMoney(marginCalc.profit) : '—';
        g('f-uprofit').className = marginCalc.profit >= 0 ? 'pos' : 'neg';

        const marginLabel = p > 0 && c > 0 ? `${marginCalc.marginPercent}%` : '—';
        g('f-margin').textContent = marginLabel;
        g('f-margin-badge').textContent = marginLabel !== '—' ? marginLabel : '50%';

        if (p > 0 && c > 0) {
          g('f-margin-input').value = marginCalc.marginPercent;
          b.querySelectorAll('[data-margin-preset]').forEach(btn => {
            btn.setAttribute('aria-pressed', String(Number(btn.dataset.marginPreset) === marginCalc.marginPercent));
          });
        }
      }

      function updateFromMargin(marginVal) {
        const c = flavor ? Number(flavor.cost) || 0 : 0;
        const m = Math.min(95, Math.max(1, parseFloat(String(marginVal).replace(',', '.')) || 0));

        g('f-margin-badge').textContent = `${m}%`;
        g('f-margin-input').value = m;

        b.querySelectorAll('[data-margin-preset]').forEach(btn => {
          btn.setAttribute('aria-pressed', String(Number(btn.dataset.marginPreset) === m));
        });

        // Se houver custo cadastrado, sugere o preço de venda baseado na margem
        if (c > 0) {
          isUpdatingPrice = true;
          const priceCalc = calculatePriceFromMargin({ cost: c, marginPercent: m });
          g('f-price').value = moneyToInput(priceCalc.suggestedPrice);
          g('f-uprofit').textContent = formatMoney(priceCalc.profit);
          g('f-uprofit').className = 'pos';
          g('f-margin').textContent = `${m}%`;
          isUpdatingPrice = false;
        } else {
          // Se ainda não houver custo, apenas calcula o lucro visual com base no preço atual
          const p = num(g('f-price').value);
          if (p > 0) {
            g('f-margin').textContent = `${m}%`;
          }
        }
      }

      // Presets de margem
      b.querySelectorAll('[data-margin-preset]').forEach(btn => {
        btn.addEventListener('click', () => {
          updateFromMargin(Number(btn.dataset.marginPreset));
        });
      });

      // Digitação manual da margem
      g('f-margin-input').addEventListener('input', e => {
        const val = parseFloat(e.target.value);
        if (Number.isFinite(val) && val > 0 && val < 99) {
          updateFromMargin(val);
        }
      });

      // Digitação do preço
      g('f-price').addEventListener('input', updateFromPrice);
      updateFromPrice();

      g('f-fl').addEventListener('submit', async e => {
        e.preventDefault();
        const name = g('f-name').value.trim();
        const price = num(g('f-price').value);
        const stock = parseInt(g('f-stock').value, 10);

        let msg = '';
        if (!name) msg = 'Informe o nome do sabor.';
        else if (!Number.isFinite(price) || price < 0) msg = 'Informe o preço de venda.';
        else if (!Number.isFinite(stock) || stock < 0) msg = 'Informe o estoque (pode ser 0).';

        const warnEl = g('f-warn');
        warnEl.hidden = !msg;
        warnEl.textContent = msg;
        if (msg) return;

        const submitBtn = g('f-submit');
        submitBtn.disabled = true;

        try {
          await dbService.saveFlavor({
            flavorData: {
              id: flavor ? flavor.id : null,
              name,
              price,
              stock,
              tone: flavor ? flavor.tone : TONES[state.flavors.length % TONES.length]
            },
            user,
            state
          });

          closeSheet();
          showToast(flavor ? 'Sabor atualizado com sucesso' : 'Novo sabor cadastrado!');
          if (typeof onSaved === 'function') onSaved();
        } catch (err) {
          warnEl.hidden = false;
          warnEl.textContent = err.message || 'Erro ao salvar sabor.';
          submitBtn.disabled = false;
        }
      });

      if (flavor) {
        const delBtn = g('f-del');
        if (delBtn) {
          armDelete(delBtn, async () => {
            try {
              await dbService.deleteFlavor({
                flavorId: flavor.id,
                user,
                state
              });
              closeSheet();
              showToast('Sabor excluído.');
              if (typeof onDeleted === 'function') onDeleted();
            } catch (err) {
              alert(err.message || 'Erro ao excluir sabor.');
            }
          });
        }

        const produceBtn = g('f-btn-produce');
        if (produceBtn) {
          produceBtn.addEventListener('click', () => {
            closeSheet();
            if (typeof onProduceClick === 'function') onProduceClick(flavor.id);
          });
        }

        const adjustBtn = g('f-btn-adjust');
        if (adjustBtn) {
          adjustBtn.addEventListener('click', () => {
            closeSheet();
            if (typeof onAdjustStockClick === 'function') onAdjustStockClick(flavor.id);
          });
        }
      }
    }
  });
}
