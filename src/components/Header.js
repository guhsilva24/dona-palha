/**
 * Componente Header (Hero Banner, Sincronização e Busca)
 */

import { I } from '../utils/icons.js';
import { greet, longToday, esc } from '../utils/formatters.js';

export function renderHeader({ user, title, subtitle, query, onSearchInput, onClearSearch, onSyncClick }) {
  const header = document.querySelector('header.hero');
  if (!header) return;

  const defaultTitle = user ? `Olá, ${user.user_metadata?.full_name || user.email?.split('@')[0] || 'Gustavo'}` : 'Olá, Gustavo';
  const defaultSub = `${greet()} · ${longToday()}`;

  header.innerHTML = `
    <div class="wrap">
      <div class="hero-top">
        <div class="brand">
          <span class="brand-mark">${I('layers')}</span>
          Dona Palha
        </div>
        <div class="sync-wrap">
          <button class="sync" id="sync-btn" data-k="local" type="button" title="Configurações de Conta e Nuvem">
            Só neste aparelho
          </button>
        </div>
      </div>
      <h1 id="hTitle">${esc(title || defaultTitle)}</h1>
      <p id="hSub">${esc(subtitle || defaultSub)}</p>
      <div class="search">
        ${I('search')}
        <input id="q" type="search" autocomplete="off" aria-label="Buscar" placeholder="Buscar venda ou cliente…" value="${esc(query || '')}">
        <button class="clear" id="qclear" type="button" aria-label="Limpar busca" ${query ? '' : 'hidden'}>
          ${I('x')}
        </button>
      </div>
    </div>
  `;

  const inputEl = header.querySelector('#q');
  const clearEl = header.querySelector('#qclear');
  const syncBtn = header.querySelector('#sync-btn');

  if (inputEl) {
    inputEl.addEventListener('input', e => {
      const val = e.target.value;
      if (clearEl) clearEl.hidden = !val;
      if (typeof onSearchInput === 'function') onSearchInput(val);
    });
  }

  if (clearEl) {
    clearEl.addEventListener('click', () => {
      if (inputEl) {
        inputEl.value = '';
        inputEl.focus();
      }
      clearEl.hidden = true;
      if (typeof onClearSearch === 'function') onClearSearch();
    });
  }

  if (syncBtn && typeof onSyncClick === 'function') {
    syncBtn.addEventListener('click', onSyncClick);
  }
}

export function updateSyncBadge(statusKey, customText = null) {
  const syncEl = document.getElementById('sync-btn');
  if (!syncEl) return;

  const labels = {
    ok: ['Salvo na nuvem', 'ok'],
    busy: ['Salvando…', 'busy'],
    local: ['Apenas neste aparelho', 'local'],
    err: ['Sem conexão', 'err']
  };

  const [defaultText, kind] = labels[statusKey] || ['Conectando…', 'busy'];
  syncEl.textContent = customText || defaultText;
  syncEl.dataset.k = kind;
}
