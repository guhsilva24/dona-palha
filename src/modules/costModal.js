/**
 * Módulo de Cadastro e Edição de Custos e Insumos
 * Suporta cadastro de caixas/pacotes com peso em gramas
 * (Ex.: comprou 1 cx de chocolate de 400g por R$ 20,00)
 */

import { openSheet, closeSheet } from '../components/BottomSheet.js';
import { showToast } from '../components/Toast.js';
import { dbService } from '../services/dbService.js';
import { formatMoney, moneyToInput } from '../calculations/index.js';
import { today, num, esc } from '../utils/formatters.js';
import { armDelete } from '../utils/dom.js';

export function openCostModal({ state, costId, user, onSaved, onDeleted }) {
  const cost = costId ? state.costs.find(c => c.id === costId) : null;
  const isPackage = cost?.packageWeight > 0 || (cost && cost.packageType !== 'unidade');
  const packageType = cost?.packageType || 'cx';
  const packageWeight = cost?.packageWeight || (cost?.unit === 'g' ? cost.qty : 400);
  const packagesCount = cost?.packagesCount || 1;

  const body = `
    <form id="f-cost-form" novalidate>
      <div class="field">
        <label for="k-item">Nome do produto / ingrediente <span class="req">*</span></label>
        <input id="k-item" autocomplete="off" placeholder="Ex.: Chocolate em barra, Leite condensado, Biscoito" value="${cost ? esc(cost.item) : ''}">
      </div>

      <div class="field">
        <label for="k-pkg-type">Tipo de compra / apresentação</label>
        <select id="k-pkg-type">
          <option value="cx" ${packageType === 'cx' ? 'selected' : ''}>Caixa com peso em gramas (cx)</option>
          <option value="pct" ${packageType === 'pct' ? 'selected' : ''}>Pacote com peso em gramas (pct)</option>
          <option value="lata" ${packageType === 'lata' ? 'selected' : ''}>Lata com peso em gramas (lata)</option>
          <option value="barra" ${packageType === 'barra' ? 'selected' : ''}>Barra / Pedaço em gramas</option>
          <option value="kg" ${packageType === 'kg' ? 'selected' : ''}>Quilo avulso (kg)</option>
          <option value="un" ${packageType === 'un' ? 'selected' : ''}>Unidade simples (embalagem, laço, adesivo)</option>
        </select>
      </div>

      <div class="grid2" id="k-weight-fields">
        <div class="field">
          <label for="k-pkg-count" id="k-pkg-count-l">Quantidade comprada <span class="req">*</span></label>
          <input id="k-pkg-count" inputmode="numeric" placeholder="Ex: 1" value="${packagesCount}">
        </div>
        <div class="field" id="k-weight-wrap">
          <label for="k-pkg-weight">Peso por embalagem (gramas) <span class="req">*</span></label>
          <div class="pre">
            <span>g</span>
            <input id="k-pkg-weight" inputmode="numeric" placeholder="Ex: 400" value="${packageWeight}">
          </div>
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
          <span id="k-summary-label">Custo por grama calculado</span>
          <b id="k-unit">R$ 0,00</b>
        </div>
      </div>

      <p class="hint" id="k-example-hint" style="margin:-6px 0 14px"></p>
      <p class="msg" id="k-warn" hidden></p>

      <div class="actions">
        <button class="btn primary block" type="submit" id="k-submit">
          ${cost ? 'Salvar insumo' : 'Cadastrar insumo'}
        </button>
        ${cost ? `
          <button class="btn danger" type="button" id="k-del">Excluir insumo</button>
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
        const type = g('k-pkg-type').value;
        const count = parseFloat(String(g('k-pkg-count').value).replace(',', '.')) || 1;
        const weight = parseFloat(String(g('k-pkg-weight').value).replace(',', '.')) || 0;
        const total = num(g('k-total').value);

        const isSimpleUnit = type === 'un';
        const isKg = type === 'kg';

        g('k-weight-wrap').hidden = isSimpleUnit || isKg;
        g('k-pkg-count-l').textContent = isSimpleUnit
          ? 'Quantidade de unidades'
          : isKg
            ? 'Quantidade em quilos (kg)'
            : 'Quantidade de caixas / embalagens';

        let totalGrams = 0;
        let unitText = '';

        if (isSimpleUnit) {
          totalGrams = count;
          unitText = 'unidade';
        } else if (isKg) {
          totalGrams = count * 1000;
          unitText = 'g';
        } else {
          totalGrams = count * (weight > 0 ? weight : 1);
          unitText = 'g';
        }

        if (totalGrams > 0 && total >= 0) {
          const costPerGram = total / totalGrams;
          if (unitText === 'g') {
            g('k-summary-label').textContent = `Custo por grama (${totalGrams}g totais)`;
            g('k-unit').innerHTML = `${formatMoney(costPerGram)} <small style="font-size:13px;font-weight:400;color:var(--muted)">/ g</small>`;
            g('k-example-hint').innerHTML = `
              Exemplo de uso: Se você usar <b>350g</b> em uma fornada de <b>25 palhas</b>, o custo deste ingrediente será <b>${formatMoney(350 * costPerGram)}</b> (${formatMoney((350 * costPerGram) / 25)} por palha).
            `;
          } else {
            g('k-summary-label').textContent = `Custo por unidade (${count} un)`;
            g('k-unit').textContent = `${formatMoney(total / count)} / un`;
            g('k-example-hint').textContent = '';
          }
        } else {
          g('k-unit').textContent = 'R$ 0,00';
          g('k-example-hint').textContent = '';
        }
      }

      g('k-pkg-type').addEventListener('change', calc);
      g('k-pkg-count').addEventListener('input', calc);
      g('k-pkg-weight').addEventListener('input', calc);
      g('k-total').addEventListener('input', calc);
      calc();

      g('f-cost-form').addEventListener('submit', async e => {
        e.preventDefault();
        const item = g('k-item').value.trim();
        const type = g('k-pkg-type').value;
        const count = parseFloat(String(g('k-pkg-count').value).replace(',', '.')) || 1;
        const weight = parseFloat(String(g('k-pkg-weight').value).replace(',', '.')) || 0;
        const total = num(g('k-total').value);
        const d = g('k-date').value || today();

        let totalGrams = count;
        let unit = 'un';

        if (type === 'un') {
          totalGrams = count;
          unit = 'un';
        } else if (type === 'kg') {
          totalGrams = count * 1000;
          unit = 'g';
        } else {
          totalGrams = count * (weight > 0 ? weight : 1);
          unit = 'g';
        }

        let msg = '';
        if (!item) msg = 'Informe o nome do item comprado.';
        else if (!(count > 0)) msg = 'Informe a quantidade comprada maior que zero.';
        else if (type !== 'un' && type !== 'kg' && !(weight > 0)) msg = 'Informe o peso em gramas por embalagem (ex: 400g).';
        else if (!(total >= 0)) msg = 'Informe o valor total pago.';

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
              packageType: type,
              packagesCount: count,
              packageWeight: weight,
              unit,
              qty: totalGrams,
              total,
              date: d
            },
            user,
            state
          });

          closeSheet();
          showToast(cost ? 'Insumo atualizado' : 'Insumo registrado com sucesso');
          if (typeof onSaved === 'function') onSaved();
        } catch (err) {
          warnEl.hidden = false;
          warnEl.textContent = err.message || 'Erro ao salvar insumo.';
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
              showToast('Insumo excluído.');
              if (typeof onDeleted === 'function') onDeleted();
            } catch (err) {
              alert(err.message || 'Erro ao excluir insumo.');
            }
          });
        }
      }
    }
  });
}
