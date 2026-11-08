/**
 * Módulo de Cadastro e Edição de Sabor
 */

import { openSheet, closeSheet } from '../components/BottomSheet.js';
import { showToast } from '../components/Toast.js';
import { dbService } from '../services/dbService.js';
import { formatMoney, moneyToInput } from '../calculations/index.js';
import { num, esc } from '../utils/formatters.js';
import { TONES } from '../utils/constants.js';
import { armDelete } from '../utils/dom.js';

export function openFlavorModal({ state, flavorId, user, onSaved, onDeleted, onProduceClick, onAdjustStockClick }) {
  const flavor = flavorId ? state.flavors.find(f => f.id === flavorId) : null;

  const body = `
    <form id="f-fl" novalidate>
      <div class="field">
        <label for="f-name">Nome do sabor <span class="req">*</span></label>
        <input id="f-name" autocomplete="off" placeholder="Ex.: Tradicional, Ninho, Maracujá" value="${flavor ? esc(flavor.name) : ''}">
      </div>

      <div class="field">
        <label for="f-price">Preço de venda (por palha) <span class="req">*</span></label>
        <div class="pre">
          <span>R$</span>
          <input id="f-price" inputmode="decimal" placeholder="0,00" value="${flavor ? moneyToInput(flavor.price) : ''}">
        </div>
      </div>

      <div class="sum3">
        <div><span>Custo por palha</span><b id="f-ucost">${flavor ? formatMoney(flavor.cost) : 'Aguardando'}</b></div>
        <div><span>Lucro por palha</span><b id="f-uprofit">—</b></div>
        <div><span>Margem</span><b id="f-margin">—</b></div>
      </div>
      <p class="hint" style="margin:-6px 0 14px">
        O custo será calculado e atualizado automaticamente sempre que você registrar uma fornada na aba Produzir.
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

      function calc() {
        const p = num(g('f-price').value);
        const c = flavor ? Number(flavor.cost) || 0 : 0;
        const lu = p - c;

        g('f-ucost').textContent = flavor ? formatMoney(c) : 'Calculado na produção';
        g('f-uprofit').textContent = Number.isFinite(p) && flavor ? formatMoney(lu) : '—';
        g('f-uprofit').className = lu >= 0 ? 'pos' : 'neg';
        g('f-margin').textContent = p > 0 && flavor ? `${Math.round((lu / p) * 100)}%` : '—';
      }

      g('f-price').addEventListener('input', calc);
      calc();

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
