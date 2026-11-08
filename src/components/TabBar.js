/**
 * Barra de navegação inferior (TabBar)
 */

import { TABS } from '../utils/constants.js';
import { I } from '../utils/icons.js';

export function renderTabBar(activeView = 'inicio') {
  const container = document.getElementById('tabs');
  if (!container) return;

  container.innerHTML = TABS.map(tab => {
    const isCurrent = tab.id === activeView;
    return `
      <a href="#${tab.id}" ${isCurrent ? 'aria-current="page"' : ''}>
        ${I(tab.icon)}
        ${tab.label}
      </a>
    `;
  }).join('');
}

