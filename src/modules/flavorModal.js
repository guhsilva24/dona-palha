/**
 * Módulo de Cadastro e Edição de Sabores
 * Simples, limpo e direto ao ponto.
 * A margem de lucro padrão é configurada na aba Ajustes/Configurações.
 */

import { openSheet, closeSheet } from '../components/BottomSheet.js';
import { showToast } from '../components/Toast.js';
import { dbService } from '../services/dbService.js';
import { formatMoney, moneyToInput } from '../calculations/index.js';
import { num, esc } from '../utils/formatters.js';
import { TONES } from '../utils/constants.js';
import { armDelete } from '../utils/dom.js';
import { I } from '../utils/icons.js';

export function openFlavorModal({ state, flavorId, user, onSaved, onDeleted, onProduceClick, onAdjustStockClick }) {
  const flavor = flavorId ? state.flavors.find(f => f.id === flavorId) : null;
  const currentCost = flavor ? Number(flavor.cost) || 0 : 0;
  const currentPrice = flavor ? Number(flavor.price) || 0 : 0;
  const currentStock = flavor ? Number(flavor.stock) || 0 : 0;
  const defaultTone = flavor ? (flavor.tone || 'lav') : TONES[state.flavors.length % TONES.length];

  const body = `
    <form id="f-fl" novalidate>
      <div class="field">
        <label for="f-name">Nome do sabor <span class="req">*</span></label>
        <input id="f-name" autocomplete="off" placeholder="Ex.: Tradicional, Ninho com Nutella, Oreo, Maracujá" value="${flavor ? esc(flavor.name) : ''}">
      </div>

      <div class="field">
        <label for="f-price">Preço de venda (por cada palha) <span class="req">*</span></label>
        <div class="pre">
          <span>R$</span>
          <input id="f-price" inputmode="decimal" placeholder="Ex: 3,50" value="${currentPrice > 0 ? moneyToInput(currentPrice) : ''}">
        </div>
      </div>

      <div class="field">
        <label for="f-stock">Quantidade de palhas prontas em estoque</label>
        <input id="f-stock" inputmode="numeric" placeholder="0" value="${currentStock}">
        <span class="muted" style="font-size:12px;margin-top:4px;display:block">
          💡 Dica: Se você for fazer as palhas agora, pode deixar 0 e registrar a produção clicando em <b>Produzir Fornada</b>!
        </span>
      </div>

      <!-- RESUMO VISUAL DO SABOR -->
      <div class="card" style="padding:14px;background:var(--card);border:1px solid var(--line);border-radius:14px;margin-bottom:16px">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;text-align:center">
          <div style="border-right:1px solid var(--line);padding-right:8px">
            <span class="muted" style="font-size:11px;font-weight:700;text-transform:uppercase;display:block">
              Custo por Palha
            </span>
            <b style="font-size:18px;display:block;margin:2px 0" id="f-card-cost">
              ${currentCost > 0 ? formatMoney(currentCost) : '—'}
            </b>
            <span class="muted" style="font-size:11px" id="f-card-cost-sub">
              ${currentCost > 0 ? 'calculado na fornada' : 'será calculado na fornada'}
            </span>
          </div>
          <div>
            <span class="muted" style="font-size:11px;font-weight:700;text-transform:uppercase;display:block">
              Lucro Estimado
            </span>
            <b style="font-size:18px;display:block;margin:2px 0" id="f-card-profit">
              —
            </b>
            <span class="muted" style="font-size:11px">
              por palha vendida
            </span>
          </div>
        </div>
      </div>

      <p class="msg" id="f-warn" hidden></p>

      <div class="actions">
        <button class="btn primary block" type="submit" id="f-submit">
          ${I('check')} ${flavor ? 'Salvar Alterações' : 'Cadastrar Sabor'}
        </button>

        ${flavor ? `
          <div class="grid2">
            <button class="btn" type="button" id="f-btn-produce" style="background:var(--brand-soft);color:var(--brand);font-weight:700">
              ${I('plus')} Produzir Fornada
            </button>
            <button class="btn" type="button" id="f-btn-adjust">
              Ajustar Estoque
            </button>
          </div>
          <button class="btn danger block" type="button" id="f-del">
            ${I('trash')} Excluir sabor
          </button>
        ` : ''}
      </div>
    </form>
  `;

  openSheet({
    title: flavor ? 'Editar Sabor' : 'Novo Sabor',
    body,
    mount(b) {
      const g = id => b.querySelector('#' + id);

      function updateResumo() {
        const p = num(g('f-price').value);
        const c = currentCost;
        if (Number.isFinite(p) && p > 0) {
          if (c > 0) {
            const profit = p - c;
            g('f-card-profit').textContent = formatMoney(profit);
            g('f-card-profit').className = profit >= 0 ? 'pos' : 'neg';
          } else {
            g('f-card-profit').textContent = formatMoney(p);
            g('f-card-profit').className = 'pos';
          }
        } else {
          g('f-card-profit').textContent = '—';
        }
      }

      g('f-price').addEventListener('input', updateResumo);
      updateResumo();

      g('f-fl').addEventListener('submit', async e => {
        e.preventDefault();
        const name = g('f-name').value.trim();
        const price = num(g('f-price').value);
        const stock = parseInt(g('f-stock').value, 10);

        let msg = '';
        if (!name) msg = 'Informe o nome do sabor.';
        else if (!Number.isFinite(price) || price < 0) msg = 'Informe o preço de venda.';
        else if (!Number.isFinite(stock) || stock < 0) msg = 'Informe a quantidade em estoque (pode ser 0).';

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
              tone: defaultTone
            },
            user,
            state
          });

          closeSheet();
          showToast(flavor ? 'Sabor atualizado com sucesso!' : 'Novo sabor cadastrado!');
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
