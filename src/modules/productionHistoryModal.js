/**
 * Modal de Histórico de Fornadas (Produções)
 * Exibe todos os lotes produzidos com ingredientes, rendimento e custos unitários.
 */

import { openSheet } from '../components/BottomSheet.js';
import { formatMoney } from '../calculations/index.js';
import { dayLabel, shortDate, esc } from '../utils/formatters.js';
import { I } from '../utils/icons.js';

export function openProductionHistoryModal({ state, flavorId = null }) {
  let productions = (state.productions || []).slice().reverse();

  if (flavorId) {
    productions = productions.filter(p => p.flavorId === flavorId);
  }

  const title = flavorId
    ? `Fornadas: ${state.flavors.find(f => f.id === flavorId)?.name || 'Sabor'}`
    : 'Histórico de Fornadas';

  let body = '';

  if (!productions.length) {
    body = `
      <div class="card empty">
        <b>Nenhuma fornada registrada</b>
        Quando você produzir um lote de palhas, todos os detalhes (ingredientes, rendimento e custos) ficam registrados aqui.
      </div>
    `;
  } else {
    body = `
      <div class="list">
        ${productions.map(p => {
          const ingredients = p.ingredients || [];
          return `
            <div class="card" style="padding:14px;margin-bottom:12px">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
                <div>
                  <b style="font-size:16px">${esc(p.flavorName)}</b>
                  <div class="muted" style="font-size:12.5px">${esc(dayLabel(p.date))} · ${p.qty} un produzidas</div>
                </div>
                <span class="pill good">${formatMoney(p.unitCost)} / un</span>
              </div>

              <div class="sum" style="margin:10px 0 12px;padding:8px 12px;background:var(--field)">
                <div>
                  <span>Custo total da fornada</span>
                  <b style="font-size:15px">${formatMoney(p.batchCost)}</b>
                </div>
                <div>
                  <span>Preço de venda</span>
                  <b style="font-size:15px">${formatMoney(p.sellingPrice)}</b>
                </div>
              </div>

              ${ingredients.length ? `
                <div style="font-size:12.5px;color:var(--muted);margin-bottom:4px;font-weight:700">Ingredientes utilizados:</div>
                <div style="display:grid;gap:4px;font-size:12.5px">
                  ${ingredients.map(ing => `
                    <div style="display:flex;justify-content:space-between">
                      <span>• ${esc(ing.item)} (${ing.qty})</span>
                      <b>${formatMoney(ing.total)}</b>
                    </div>
                  `).join('')}
                </div>
              ` : ''}

              ${p.notes ? `
                <div class="muted" style="font-size:12px;margin-top:8px;font-style:italic">
                  Obs: ${esc(p.notes)}
                </div>
              ` : ''}
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  openSheet({
    title,
    sub: 'Registro histórico de lotes e ingredientes',
    icon: 'box',
    body
  });
}

