/**
 * Componente Modal Bottom Sheet (Janela deslizante inferior)
 */

import { I } from '../utils/icons.js';
import { esc } from '../utils/formatters.js';

let activeMountCleanup = null;

export function openSheet({ title, body, mount, icon, sub, onClose }) {
  closeSheet();

  const root = document.getElementById('sheet-root');
  if (!root) return;

  root.innerHTML = `
    <div class="backdrop" data-act="closeSheet"></div>
    <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-t" tabindex="-1">
      <div class="grab"></div>
      <div class="sheet-h">
        ${icon ? `<span class="sh-ic">${I(icon)}</span>` : ''}
        <div class="sh-t">
          <h2 id="sheet-t">${esc(title)}</h2>
          ${sub ? `<p>${esc(sub)}</p>` : ''}
        </div>
        <button class="icon-btn" type="button" data-act="closeSheet" aria-label="Fechar">
          ${I('x')}
        </button>
      </div>
      <div class="sheet-b">${body}</div>
    </div>
  `;

  root.hidden = false;
  document.body.classList.add('lock');

  const sheetEl = root.querySelector('.sheet');
  if (sheetEl) sheetEl.focus();

  if (typeof mount === 'function') {
    activeMountCleanup = mount(root.querySelector('.sheet-b'));
  }

  // Suporte a fechamento pelo backdrop ou botão
  root.querySelectorAll('[data-act="closeSheet"]').forEach(el => {
    el.addEventListener('click', () => {
      closeSheet();
      if (typeof onClose === 'function') onClose();
    });
  });
}

export function closeSheet() {
  const root = document.getElementById('sheet-root');
  if (!root || root.hidden) return;

  if (typeof activeMountCleanup === 'function') {
    try {
      activeMountCleanup();
    } catch (e) {
      console.warn('Erro ao limpar sheet:', e);
    }
    activeMountCleanup = null;
  }

  root.innerHTML = '';
  root.hidden = true;
  document.body.classList.remove('lock');
}
