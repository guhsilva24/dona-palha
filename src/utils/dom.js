/**
 * Utilitários para manipulação do DOM e eventos
 */

export function $(selector, scope = document) {
  return scope.querySelector(selector);
}

export function $$(selector, scope = document) {
  return Array.from(scope.querySelectorAll(selector));
}

export function uid() {
  return Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
}

/**
 * Prepara botão com dupla confirmação para exclusões acidentais
 * @param {HTMLElement} btn
 * @param {Function} onConfirmed
 */
export function armDelete(btn, onConfirmed) {
  if (!btn) return;
  btn.addEventListener('click', () => {
    if (!btn.dataset.armed) {
      btn.dataset.armed = '1';
      const originalText = btn.textContent;
      btn.textContent = 'Toque de novo para confirmar';
      setTimeout(() => {
        delete btn.dataset.armed;
        btn.textContent = originalText;
      }, 3500);
    } else {
      delete btn.dataset.armed;
      onConfirmed();
    }
  });
}

