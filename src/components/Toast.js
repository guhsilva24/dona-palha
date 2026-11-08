/**
 * Componente Toast para alertas e notificações temporárias
 */

let toastTimer = null;

export function showToast(message, duration = 2800) {
  const toastEl = document.getElementById('toast');
  if (!toastEl) return;

  toastEl.textContent = message;
  toastEl.hidden = false;

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastEl.hidden = true;
  }, duration);
}

