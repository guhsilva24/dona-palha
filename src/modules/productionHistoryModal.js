/**
 * Modal de Histórico de Fornadas (Fornada 1, Fornada 2...)
 * Exibe cada lote de forma separada com ingredientes, gramas e rendimento.
 */

import { openSheet } from '../components/BottomSheet.js';
import { formatMoney } from '../calculations/index.js';
import { dayLabel, shortDate, esc } from '../utils/formatters.js';

export function openProductionHistoryModal({ state, flavorId = null }) {
  let productions = (state.productions || []).slice();

  // Atribui números sequenciais se não tiverem sido gravados
  productions.forEach((p, idx) => {
    if (!p.batchNumber) p.batchNumber = idx + 1;
  });

  if (flavorId) {
    productions = productions.filter(p => p.flavorId === flavorId);
  }

  // Ordena da mais recente para a mais antiga para exibição
  const reversedList = productions.slice().reverse();

  const title = flavorId
    ? `Fornadas: ${state.flavors.find(f => f.id === flavorId)?.name || 'Sabor'}`
    : 'Histórico de Fornadas';

  let body = '';

  if (!reversedList.length) {
    body = `
      <div class="card empty">
        <b>Nenhuma fornada registrada</b>
        Quando você produzir um lote de palhas italianas, cada fornada (Fornada 1, Fornada 2...) ficará separada aqui.
      </div>
    `;
  } else {
    body = `
      <div class="list" style="background:none;border:0;box-shadow:none">
        ${reversedList.map((p, displayIdx) => {
          const batchNum = p.batchNumber || (reversedList.length - displayIdx);
          const ingredients = p.ingredients || [];
          return `
            <div class="card" style="padding:14px;margin-bottom:14px">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                <span class="pill good" style="font-size:12.5px;padding:3px 10px">
                  Fornada ${batchNum}
                </span>
                <span class="muted" style="font-size:12.5px">
                  ${esc(dayLabel(p.date))}
                </span>
              </div>

              <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px">
                <h3 style="margin:0;font-size:16px">${esc(p.flavorName)}</h3>
                <b style="font-size:15px;color:var(--brand)">${p.qty} palhas produzidas</b>
              </div>

              <div class="sum" style="margin:10px 0 12px;padding:8px 12px;background:var(--field)">
                <div>
                  <span>Custo total da fornada</span>
                  <b style="font-size:15px">${formatMoney(p.batchCost)}</b>
                </div>
                <div>
                  <span>Custo real por palha</span>
                  <b style="font-size:15px;color:var(--good)">${formatMoney(p.unitCost)} / un</b>
                </div>
              </div>

              ${ingredients.length ? `
                <div style="font-size:12.5px;color:var(--muted);margin-bottom:6px;font-weight:700">
                  Ingredientes utilizados nesta Fornada ${batchNum}:
                </div>
                <div style="display:grid;gap:6px;font-size:13px;background:var(--field);padding:10px;border-radius:12px">
                  ${ingredients.map(ing => {
                    const u = ing.unit || 'g';
                    return `
                      <div style="display:flex;justify-content:space-between;align-items:center">
                        <span>• <b>${esc(ing.item)}</b>: ${ing.qty} ${esc(u)}</span>
                        <b style="color:var(--ink)">${formatMoney(ing.total)}</b>
                      </div>
                    `;
                  }).join('')}
                </div>
              ` : ''}

              ${p.notes ? `
                <div class="muted" style="font-size:12px;margin-top:8px">
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
    sub: `${reversedList.length} ${reversedList.length === 1 ? 'fornada registrada' : 'fornadas registradas'}`,
    icon: 'box',
    body
  });
}
