/**
 * Módulo de Cadastro e Edição de Custos e Insumos (Compras)
 * Simples, direto e preparado para quem compra insumos no mercado.
 * Exemplo: 4 caixas de chocolate de 400g por R$ 5,99 cada caixa (ou R$ 23,96 total).
 */

import { openSheet, closeSheet } from '../components/BottomSheet.js';
import { showToast } from '../components/Toast.js';
import { dbService } from '../services/dbService.js';
import { formatMoney, moneyToInput } from '../calculations/index.js';
import { today, num, esc } from '../utils/formatters.js';
import { armDelete } from '../utils/dom.js';
import { I } from '../utils/icons.js';

export function openCostModal({ state, costId, user, onSaved, onDeleted }) {
  const cost = costId ? state.costs.find(c => c.id === costId) : null;
  const packageType = cost?.packageType || 'cx';
  const packagesCount = cost?.packagesCount ?? 1;
  const packageWeight = cost?.packageWeight ?? (cost?.unit === 'g' ? (cost.qty / packagesCount) : 400);
  const totalVal = cost ? cost.total : 0;
  const unitPriceVal = cost && packagesCount > 0 ? (cost.total / packagesCount) : 0;

  const body = `
    <form id="f-cost-form" novalidate>
      <div class="field">
        <label for="k-item">Nome do produto / ingrediente <span class="req">*</span></label>
        <input id="k-item" autocomplete="off" placeholder="Ex.: Chocolate em barra, Leite condensado, Bolacha maisena, Embalagem" value="${cost ? esc(cost.item) : ''}">
      </div>

      <div class="field">
        <label for="k-pkg-type">Como você comprou esse produto?</label>
        <select id="k-pkg-type">
          <option value="cx" ${packageType === 'cx' ? 'selected' : ''}>Caixa com peso em gramas (cx) - Ex: Chocolate 400g</option>
          <option value="pct" ${packageType === 'pct' ? 'selected' : ''}>Pacote com peso em gramas (pct) - Ex: Bolacha maisena 400g</option>
          <option value="lata" ${packageType === 'lata' ? 'selected' : ''}>Lata com peso em gramas (lata) - Ex: Leite condensado 395g</option>
          <option value="barra" ${packageType === 'barra' ? 'selected' : ''}>Barra em gramas (barra) - Ex: Barra de 1000g</option>
          <option value="kg" ${packageType === 'kg' ? 'selected' : ''}>Quilo avulso (kg)</option>
          <option value="un" ${packageType === 'un' ? 'selected' : ''}>Unidade simples (un) - Ex: Caixinhas, saquinhos, laços</option>
        </select>
      </div>

      <div class="grid2" id="k-weight-fields">
        <div class="field">
          <label for="k-pkg-count" id="k-pkg-count-l">Quantidade comprada <span class="req">*</span></label>
          <input id="k-pkg-count" inputmode="numeric" placeholder="Ex: 4" value="${packagesCount}">
        </div>
        <div class="field" id="k-weight-wrap">
          <label for="k-pkg-weight">Peso por embalagem (g) <span class="req">*</span></label>
          <div class="pre">
            <span>g</span>
            <input id="k-pkg-weight" inputmode="numeric" placeholder="Ex: 400" value="${packageWeight}">
          </div>
        </div>
      </div>

      <div class="grid2">
        <div class="field" id="k-unit-price-wrap">
          <label for="k-unit-price" id="k-unit-price-l">Preço por caixa/unidade</label>
          <div class="pre">
            <span>R$</span>
            <input id="k-unit-price" inputmode="decimal" placeholder="Ex: 5,99" value="${unitPriceVal > 0 ? moneyToInput(unitPriceVal) : ''}">
          </div>
        </div>
        <div class="field">
          <label for="k-total">Valor total pago <span class="req">*</span></label>
          <div class="pre">
            <span>R$</span>
            <input id="k-total" inputmode="decimal" placeholder="Ex: 23,96" value="${totalVal > 0 ? moneyToInput(totalVal) : ''}">
          </div>
        </div>
      </div>

      <div class="field">
        <label for="k-date">Data da compra</label>
        <input id="k-date" type="date" value="${cost ? cost.date : today()}">
      </div>

      <!-- CARD RESUMO CLARO E DIDÁTICO -->
      <div class="card" style="padding:14px;background:var(--card);border:1px solid var(--line);border-radius:14px;margin-bottom:16px">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;text-align:center">
          <div style="border-right:1px solid var(--line);padding-right:8px">
            <span class="muted" style="font-size:11px;font-weight:700;text-transform:uppercase;display:block">
              Total da Compra
            </span>
            <b style="font-size:20px;color:var(--brand);display:block;margin:2px 0" id="k-res-total">
              R$ 0,00
            </b>
            <span class="muted" style="font-size:11.5px" id="k-res-stock">
              0g comprados
            </span>
          </div>
          <div>
            <span class="muted" style="font-size:11px;font-weight:700;text-transform:uppercase;display:block">
              Custo Proporcional
            </span>
            <b style="font-size:18px;color:var(--ink);display:block;margin:3px 0" id="k-res-rate">
              R$ 0,00
            </b>
            <span class="muted" style="font-size:11.5px" id="k-res-unit">
              por grama
            </span>
          </div>
        </div>

        <div style="margin-top:10px;padding-top:8px;border-top:1px dashed var(--line);font-size:12px;color:var(--muted);line-height:1.4" id="k-res-tip">
          💡 Cadastre suas compras do mercado aqui. Depois, na aba <b>Sabores</b>, clique em <b>Produzir Fornada</b> para usar esses ingredientes e calcular o custo de cada palha italiana!
        </div>
      </div>

      <p class="msg" id="k-warn" hidden></p>

      <div class="actions">
        <button class="btn primary block" type="submit" id="k-submit">
          ${I('check')} ${cost ? 'Salvar Alterações' : 'Cadastrar Compra'}
        </button>
        ${cost ? `
          <button class="btn danger" type="button" id="k-del">${I('trash')} Excluir produto</button>
        ` : ''}
      </div>
    </form>
  `;

  openSheet({
    title: cost ? 'Editar Compra de Insumo' : 'Nova Compra de Insumos',
    body,
    mount(b) {
      const g = id => b.querySelector('#' + id);
      let isUpdatingPrice = false;

      function updateResumo() {
        const type = g('k-pkg-type').value;
        const count = parseFloat(String(g('k-pkg-count').value).replace(',', '.')) || 1;
        const weight = parseFloat(String(g('k-pkg-weight').value).replace(',', '.')) || 0;
        const total = num(g('k-total').value);

        const isSimpleUnit = type === 'un';
        const isKg = type === 'kg';

        g('k-weight-wrap').hidden = isSimpleUnit || isKg;
        g('k-pkg-count-l').textContent = isSimpleUnit
          ? 'Quantidade de unidades compradas'
          : isKg
            ? 'Quantidade em quilos (kg)'
            : 'Quantidade de caixas / embalagens';

        g('k-unit-price-l').textContent = isSimpleUnit
          ? 'Preço por unidade (R$)'
          : isKg
            ? 'Preço por quilo (R$)'
            : 'Preço por caixa / embalagem (R$)';

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

        if (total > 0 && totalGrams > 0) {
          g('k-res-total').textContent = formatMoney(total);
          g('k-res-stock').textContent = isSimpleUnit
            ? `${count} un compradas`
            : `${totalGrams.toLocaleString('pt-BR')}g (${count} ${type}${weight > 0 ? ' de ' + weight + 'g' : ''})`;

          const costPerUnit = total / totalGrams;
          if (unitText === 'g') {
            g('k-res-rate').textContent = `R$ ${costPerUnit.toFixed(4).replace('.', ',')}`;
            g('k-res-unit').textContent = 'por grama';
          } else {
            g('k-res-rate').textContent = formatMoney(costPerUnit);
            g('k-res-unit').textContent = 'por unidade';
          }
        } else {
          g('k-res-total').textContent = 'R$ 0,00';
          g('k-res-stock').textContent = '0g comprados';
          g('k-res-rate').textContent = 'R$ 0,00';
        }
      }

      // Ao digitar preço unitário -> atualiza valor total
      g('k-unit-price').addEventListener('input', () => {
        if (isUpdatingPrice) return;
        const unitP = num(g('k-unit-price').value);
        const count = parseFloat(String(g('k-pkg-count').value).replace(',', '.')) || 1;
        if (Number.isFinite(unitP) && unitP >= 0) {
          isUpdatingPrice = true;
          const totalVal = unitP * count;
          g('k-total').value = moneyToInput(totalVal);
          isUpdatingPrice = false;
        }
        updateResumo();
      });

      // Ao digitar valor total -> atualiza preço unitário
      g('k-total').addEventListener('input', () => {
        if (isUpdatingPrice) return;
        const tot = num(g('k-total').value);
        const count = parseFloat(String(g('k-pkg-count').value).replace(',', '.')) || 1;
        if (Number.isFinite(tot) && tot >= 0 && count > 0) {
          isUpdatingPrice = true;
          const unitVal = tot / count;
          g('k-unit-price').value = moneyToInput(unitVal);
          isUpdatingPrice = false;
        }
        updateResumo();
      });

      // Ao alterar quantidade de caixas
      g('k-pkg-count').addEventListener('input', () => {
        const count = parseFloat(String(g('k-pkg-count').value).replace(',', '.')) || 1;
        const unitP = num(g('k-unit-price').value);
        if (unitP > 0) {
          isUpdatingPrice = true;
          g('k-total').value = moneyToInput(unitP * count);
          isUpdatingPrice = false;
        }
        updateResumo();
      });

      g('k-pkg-type').addEventListener('change', updateResumo);
      g('k-pkg-weight').addEventListener('input', updateResumo);

      updateResumo();

      g('f-cost-form').addEventListener('submit', async e => {
        e.preventDefault();
        const item = g('k-item').value.trim();
        const type = g('k-pkg-type').value;
        const count = parseFloat(String(g('k-pkg-count').value).replace(',', '.')) || 1;
        const weight = parseFloat(String(g('k-pkg-weight').value).replace(',', '.')) || 0;
        const total = num(g('k-total').value);
        const d = g('k-date').value || today();

        const isSimpleUnit = type === 'un';
        const isKg = type === 'kg';
        const unit = isSimpleUnit ? 'un' : 'g';
        const totalGrams = isSimpleUnit ? count : (isKg ? count * 1000 : count * (weight > 0 ? weight : 1));

        let msg = '';
        if (!item) msg = 'Informe o nome do item comprado.';
        else if (!(count > 0)) msg = 'Informe a quantidade comprada maior que zero.';
        else if (!isSimpleUnit && !isKg && !(weight > 0)) msg = 'Informe o peso em gramas por embalagem (ex: 400g).';
        else if (!(total > 0)) msg = 'Informe o valor total pago ou preço por embalagem.';

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
              packageWeight: isSimpleUnit || isKg ? null : weight,
              unit,
              qty: totalGrams,
              total,
              date: d
            },
            user,
            state
          });

          closeSheet();
          showToast(cost ? 'Compra atualizada com sucesso!' : 'Compra cadastrada no estoque!');
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
              showToast('Produto excluído.');
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
