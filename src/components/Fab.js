/**
 * Botão de Ação Flutuante (Floating Action Button - FAB)
 */

import { I } from '../utils/icons.js';

const FAB_CONFIG = {
  inicio: { label: 'Nova venda', icon: 'plus', action: 'openSale' },
  vendas: { label: 'Nova venda', icon: 'plus', action: 'openSale' },
  geral: { label: 'Nova venda', icon: 'plus', action: 'openSale' },
  sabores: { label: 'Novo sabor', icon: 'plus', action: 'newFlavor' },
  custos: { label: 'Novo custo', icon: 'plus', action: 'newCost' }
};

export function renderFab(activeView = 'inicio', onFabClick) {
  const fabEl = document.getElementById('fab');
  if (!fabEl) return;

  const config = FAB_CONFIG[activeView] || FAB_CONFIG.inicio;
  fabEl.innerHTML = `${I(config.icon)} ${config.label}`;
  fabEl.dataset.act = config.action;

  // Atualiza handler
  fabEl.onclick = e => {
    e.preventDefault();
    if (typeof onFabClick === 'function') {
      onFabClick(config.action);
    }
  };
}
