/**
 * Módulo de Cadastro e Edição de Custos e Insumos
 * Calcula automaticamente o Custo por Produto com base na Quantidade Usada e Rendimento
 * Exemplo real:
 * - Comprou 1 cx de chocolate de 400g por R$ 20,00
 * - Usa 350g em uma fornada de 25 palhas
 * -> Custo por produto = R$ 0,70 por palha!
 */

import { openSheet, closeSheet } from '../components/BottomSheet.js';
import { showToast } from '../components/Toast.js';
import { dbService } from '../services/dbService.js';
import { formatMoney, moneyToInput, calculateCostPerProduct } from '../calculations/index.js';
import { today, num, esc } from '../utils/formatters.js';
import { armDelete } from '../utils/dom.js';
import { I } from '../utils/icons.js';

export function openCostModal({ state, costId, user, onSaved, onDeleted }) {
  const cost = costId ? state.costs.find(c => c.id === costId) : null;
  const packageType = cost?.packageType || 'cx';
  const packageWeight = cost?.packageWeight ?? (cost?.unit === 'g' ? cost.qty : 400);
  const packagesCount = cost?.packagesCount ?? 1;
  const usedQty = cost?.usedQty ?? (cost?.unit === 'un' ? 25 : (cost?.packageWeight ? Math.min(cost.packageWeight, 350) : 350));
  const recipeYield = cost?.recipeYield ?? 25;

  const body = `
    <form id="f-cost-form" novalidate>
      <!-- BLOCO 1: COMPRA DO INSUMO -->
      <div style="margin-bottom:12px">
        <span class="pill" style="font-weight:700;font-size:11px;background:var(--brand-soft);color:var(--brand-dark);padding:4px 10px;border-radius:20px">
          1. DADOS DA COMPRA
        </span>
      </div>

      <div class="field">
        <label for="k-item">Nome do produto / ingrediente <span class="req">*</span></label>
        <input id="k-item" autocomplete="off" placeholder="Ex.: Chocolate em barra, Leite condensado, Biscoito maisena, Embalagem" value="${cost ? esc(cost.item) : ''}">
      </div>

      <div class="field">
        <label for="k-pkg-type">Como você comprou esse produto?</label>
        <select id="k-pkg-type">
          <option value="cx" ${packageType === 'cx' ? 'selected' : ''}>Caixa com peso em gramas (cx) - Ex: Barra/Gotas 400g</option>
          <option value="pct" ${packageType === 'pct' ? 'selected' : ''}>Pacote com peso em gramas (pct) - Ex: Biscoito 400g</option>
          <option value="lata" ${packageType === 'lata' ? 'selected' : ''}>Lata com peso em gramas (lata) - Ex: Leite condensado 395g</option>
          <option value="barra" ${packageType === 'barra' ? 'selected' : ''}>Barra em gramas (barra) - Ex: Barra 1000g</option>
          <option value="kg" ${packageType === 'kg' ? 'selected' : ''}>Quilo avulso (kg)</option>
          <option value="un" ${packageType === 'un' ? 'selected' : ''}>Unidade simples (un) - Ex: Caixinhas, saquinhos, adesivos</option>
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

      <!-- BLOCO 2: USO NA RECEITA E CUSTO POR PRODUTO -->
      <div style="margin:20px 0 10px;padding-top:14px;border-top:1px solid var(--line)">
        <span class="pill good" style="font-weight:700;font-size:11px;padding:4px 10px;border-radius:20px">
          2. QUANTIDADE USADA E CUSTO POR PRODUTO
        </span>
      </div>
      <p class="muted" style="margin:0 0 14px;font-size:13px;line-height:1.4">
        Informe quanto você usa em uma receita/fornada e quantas palhas rendem para ver o <b>custo exato por produto</b>:
      </p>

      <div class="grid2">
        <div class="field">
          <label for="k-used-qty" id="k-used-qty-l">Quantidade usada na receita <span class="req">*</span></label>
          <div class="pre">
            <span id="k-used-unit-badge">g</span>
            <input id="k-used-qty" inputmode="decimal" placeholder="Ex: 350" value="${usedQty}">
          </div>
        </div>
        <div class="field">
          <label for="k-recipe-yield">Rendimento da receita <span class="req">*</span></label>
          <div class="pre">
            <span>un</span>
            <input id="k-recipe-yield" inputmode="numeric" placeholder="Ex: 25" value="${recipeYield}">
          </div>
        </div>
      </div>

      <!-- CARD RESULTADO DO CÁLCULO EM TEMPO REAL -->
      <div class="card" style="padding:16px;background:var(--card);border:2px solid var(--brand);border-radius:14px;margin-bottom:16px;box-shadow:0 4px 12px rgba(0,0,0,0.04)">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;text-align:center">
          <div style="border-right:1px solid var(--line);padding-right:8px">
            <span class="muted" style="font-size:11.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;display:block">
              Custo por Produto
            </span>
            <b style="font-size:24px;color:var(--brand);display:block;margin:3px 0" id="k-res-product">
              R$ 0,00
            </b>
            <span class="muted" style="font-size:11px" id="k-res-product-sub">
              por palha italiana
            </span>
          </div>
          <div>
            <span class="muted" style="font-size:11.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;display:block">
              Custo Usado na Receita
            </span>
            <b style="font-size:20px;color:var(--ink);display:block;margin:5px 0" id="k-res-batch">
              R$ 0,00
            </b>
            <span class="muted" style="font-size:11px" id="k-res-batch-sub">
              na fornada
            </span>
          </div>
        </div>

        <div style="margin-top:12px;padding-top:10px;border-top:1px dashed var(--line);font-size:12.5px;color:var(--muted);line-height:1.45" id="k-res-explanation">
          Preencha o valor pago para calcular automaticamente.
        </div>
      </div>

      <p class="msg" id="k-warn" hidden></p>

      <div class="actions">
        <button class="btn primary block" type="submit" id="k-submit">
          ${I('check')} ${cost ? 'Salvar Insumo' : 'Cadastrar Insumo'}
        </button>
        ${cost ? `
          <button class="btn danger" type="button" id="k-del">${I('trash')} Excluir insumo</button>
        ` : ''}
      </div>
    </form>
  `;

  openSheet({
    title: cost ? 'Editar Insumo e Custo' : 'Novo Insumo / Custo por Produto',
    body,
    mount(b) {
      const g = id => b.querySelector('#' + id);

      function calc() {
        const type = g('k-pkg-type').value;
        const count = parseFloat(String(g('k-pkg-count').value).replace(',', '.')) || 1;
        const weight = parseFloat(String(g('k-pkg-weight').value).replace(',', '.')) || 0;
        const total = num(g('k-total').value);
        const used = parseFloat(String(g('k-used-qty').value).replace(',', '.')) || 0;
        const recipeYield = parseInt(String(g('k-recipe-yield').value), 10) || 25;

        const isSimpleUnit = type === 'un';
        const isKg = type === 'kg';

        g('k-weight-wrap').hidden = isSimpleUnit || isKg;
        g('k-pkg-count-l').textContent = isSimpleUnit
          ? 'Quantidade de unidades compradas'
          : isKg
            ? 'Quantidade em quilos (kg)'
            : 'Quantidade de caixas / embalagens';

        const unit = isSimpleUnit ? 'un' : 'g';
        g('k-used-unit-badge').textContent = unit;

        const result = calculateCostPerProduct({
          supplyTotal: total,
          supplyQty: isSimpleUnit ? count : (isKg ? count * 1000 : count * (weight > 0 ? weight : 1)),
          supplyUnit: unit,
          packageWeight: isSimpleUnit || isKg ? null : weight,
          packagesCount: count,
          usedQty: used,
          recipeYield
        });

        if (total > 0 && result.totalPurchased > 0) {
          g('k-res-product').textContent = formatMoney(result.costPerProduct);
          g('k-res-product-sub').textContent = `por palha (${recipeYield} un na receita)`;

          g('k-res-batch').textContent = formatMoney(result.usedCost);
          g('k-res-batch-sub').textContent = `${used}${unit} de ${result.totalPurchased}${unit}`;

          const unitDesc = unit === 'g' ? 'por grama' : 'por unidade';
          const unitRate = formatMoney(result.costPerUnit);

          let expl = `<b>Cálculo claro:</b> Custo base = <b>${unitRate}</b> ${unitDesc}. `;
          expl += `Usando <b>${used}${unit}</b> na fornada = <b>${formatMoney(result.usedCost)}</b>. `;
          expl += `Dividido por <b>${recipeYield} produtos</b> = <b style="color:var(--brand)">${formatMoney(result.costPerProduct)} por unidade</b>.`;

          if (result.remainingQty > 0) {
            expl += `<br><span style="color:var(--brand-dark);font-weight:600">Sobra no estoque:</span> ${result.remainingQty}${unit} (${formatMoney(result.remainingCost)}) para as próximas produções.`;
          }

          g('k-res-explanation').innerHTML = expl;
        } else {
          g('k-res-product').textContent = 'R$ 0,00';
          g('k-res-batch').textContent = 'R$ 0,00';
          g('k-res-explanation').textContent = 'Informe o valor total pago para ver o custo por produto calculado.';
        }

        return result;
      }

      g('k-pkg-type').addEventListener('change', calc);
      g('k-pkg-count').addEventListener('input', calc);
      g('k-pkg-weight').addEventListener('input', calc);
      g('k-total').addEventListener('input', calc);
      g('k-used-qty').addEventListener('input', calc);
      g('k-recipe-yield').addEventListener('input', calc);

      calc();

      g('f-cost-form').addEventListener('submit', async e => {
        e.preventDefault();
        const item = g('k-item').value.trim();
        const type = g('k-pkg-type').value;
        const count = parseFloat(String(g('k-pkg-count').value).replace(',', '.')) || 1;
        const weight = parseFloat(String(g('k-pkg-weight').value).replace(',', '.')) || 0;
        const total = num(g('k-total').value);
        const used = parseFloat(String(g('k-used-qty').value).replace(',', '.')) || 0;
        const recipeYield = parseInt(String(g('k-recipe-yield').value), 10) || 25;
        const d = g('k-date').value || today();

        const isSimpleUnit = type === 'un';
        const isKg = type === 'kg';
        const unit = isSimpleUnit ? 'un' : 'g';

        let totalGrams = isSimpleUnit ? count : (isKg ? count * 1000 : count * (weight > 0 ? weight : 1));

        let msg = '';
        if (!item) msg = 'Informe o nome do item comprado.';
        else if (!(count > 0)) msg = 'Informe a quantidade comprada maior que zero.';
        else if (!isSimpleUnit && !isKg && !(weight > 0)) msg = 'Informe o peso em gramas por embalagem (ex: 400g).';
        else if (!(total > 0)) msg = 'Informe o valor total pago.';
        else if (!(used > 0)) msg = 'Informe a quantidade usada na receita (ex: 350g).';
        else if (!(recipeYield > 0)) msg = 'Informe o rendimento da receita (ex: 25 produtos).';

        const warnEl = g('k-warn');
        warnEl.hidden = !msg;
        warnEl.textContent = msg;
        if (msg) return;

        const submitBtn = g('k-submit');
        submitBtn.disabled = true;

        const calcResult = calculateCostPerProduct({
          supplyTotal: total,
          supplyQty: totalGrams,
          supplyUnit: unit,
          packageWeight: isSimpleUnit || isKg ? null : weight,
          packagesCount: count,
          usedQty: used,
          recipeYield
        });

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
              usedQty: used,
              recipeYield,
              costPerProduct: calcResult.costPerProduct,
              usedCost: calcResult.usedCost,
              date: d
            },
            user,
            state
          });

          closeSheet();
          showToast(cost ? 'Insumo atualizado!' : 'Insumo e custo por produto salvos!');
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
