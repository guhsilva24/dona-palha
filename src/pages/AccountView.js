/**
 * Página de Ajustes, Configurações de Margem de Lucro e Conta Supabase (AccountView)
 */

import { authService } from '../services/authService.js';
import { dbService } from '../services/dbService.js';
import { storageService } from '../services/storageService.js';
import { isSupabaseReady } from '../services/supabaseClient.js';
import { formatMoney, calculatePriceFromMargin } from '../calculations/index.js';
import { showToast } from '../components/Toast.js';
import { esc } from '../utils/formatters.js';
import { MARGIN_PRESETS } from '../utils/constants.js';
import { I } from '../utils/icons.js';

export function renderAccountView({ user, state }) {
  const isCloud = isSupabaseReady();
  const currentMargin = state.settings?.defaultMargin || 50;

  // Simulação de preço com base na margem atual para uma palha com custo base de R$ 1,50
  const sim = calculatePriceFromMargin({ cost: 1.50, marginPercent: currentMargin });

  let html = `
    <!-- SEÇÃO 1: MARGEM DE LUCRO PADRÃO DO NEGÓCIO -->
    <div class="card" style="padding:16px;margin-bottom:18px;border:1px solid var(--line);border-radius:18px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
        <span class="sh-ic" style="width:36px;height:36px;border-radius:10px">${I('trend')}</span>
        <div>
          <h2 style="margin:0;font-size:16px">Margem de Lucro Desejada</h2>
          <span class="muted" style="font-size:12.5px">Configuração geral de lucro para suas palhas</span>
        </div>
      </div>

      <p class="muted" style="margin:8px 0 12px;font-size:13px;line-height:1.4">
        Defina a porcentagem de lucro padrão que você deseja ter na venda das suas palhas:
      </p>

      <div class="chips" style="margin-bottom:12px;overflow-x:auto">
        ${[30, 40, 50, 60, 70, 80, 100].map(m => `
          <button class="chip" type="button" data-cfg-margin="${m}" aria-pressed="${m === currentMargin}">
            ${m}%
          </button>
        `).join('')}
      </div>

      <div class="field" style="margin-bottom:10px">
        <label for="cfg-margin-input" style="font-size:12.5px">Margem de lucro personalizada (%)</label>
        <div class="pre">
          <span>%</span>
          <input id="cfg-margin-input" inputmode="numeric" type="number" min="1" max="95" value="${currentMargin}" placeholder="50">
        </div>
      </div>

      <!-- SIMULADOR DINÂMICO DE LUCRO -->
      <div style="background:var(--brand-soft);padding:10px 14px;border-radius:12px;margin-bottom:14px;font-size:12.5px;color:var(--ink);line-height:1.4" id="cfg-margin-sim">
        💡 <b>Exemplo prático:</b> Se uma palha italiana custar <b>R$ 1,50</b> em ingredientes, com <b>${currentMargin}% de margem</b> o preço sugerido é <b>${formatMoney(sim.suggestedPrice)}</b> (você lucra <b>${formatMoney(sim.profit)}</b> por unidade vendida).
      </div>

      <button class="btn primary block" type="button" id="btn-save-margin">
        ${I('check')} Salvar Margem de Lucro
      </button>
    </div>
  `;

  // SEÇÃO 2: CONTA E NUVEM SUPABASE
  if (!user) {
    html += `
      <div class="card" style="padding:18px;margin-bottom:16px;text-align:center;border-radius:18px">
        <div class="brand-mark" style="margin:0 auto 10px;width:44px;height:44px;font-size:22px;border-radius:12px;background:var(--brand);color:#fff">
          ${I('cloud')}
        </div>
        <h2 style="margin:0 0 4px;font-size:17px">Conectar ao Supabase</h2>
        <p class="muted" style="margin:0;font-size:13px">
          ${isCloud ? 'Nuvem Supabase pronta para sincronização' : 'Modo local seguro (configure as chaves no .env)'}
        </p>
      </div>

      <div class="chips" style="margin-bottom:14px">
        <button class="chip" type="button" id="tab-login" aria-pressed="true">Entrar</button>
        <button class="chip" type="button" id="tab-signup" aria-pressed="false">Criar Conta</button>
      </div>

      <!-- Formulário de Login -->
      <form id="f-page-login" novalidate class="card" style="padding:16px;margin-bottom:18px;border-radius:18px">
        <div class="field">
          <label for="page-email">Email <span class="req">*</span></label>
          <input id="page-email" type="email" placeholder="seu@email.com" required autocomplete="email">
        </div>
        <div class="field">
          <label for="page-pass">Senha <span class="req">*</span></label>
          <input id="page-pass" type="password" placeholder="••••••••" required autocomplete="current-password">
        </div>
        <p class="msg error" id="page-error-login" hidden></p>
        <div class="actions">
          <button class="btn primary block" type="submit" id="btn-page-submit-login">
            ${I('check')} Entrar com Supabase
          </button>
          <button class="link" type="button" id="btn-page-forgot">Esqueci minha senha</button>
        </div>
      </form>

      <!-- Formulário de Cadastro -->
      <form id="f-page-signup" novalidate class="card" style="padding:16px;margin-bottom:18px;border-radius:18px" hidden>
        <div class="field">
          <label for="page-signup-name">Nome da sua Confeitaria ou Confeiteiro(a)</label>
          <input id="page-signup-name" type="text" placeholder="Ex.: Gustavo - Dona Palha">
        </div>
        <div class="field">
          <label for="page-signup-email">Email <span class="req">*</span></label>
          <input id="page-signup-email" type="email" placeholder="seu@email.com" required autocomplete="email">
        </div>
        <div class="field">
          <label for="page-signup-pass">Criar Senha (mínimo 6 dígitos) <span class="req">*</span></label>
          <input id="page-signup-pass" type="password" placeholder="••••••••" required autocomplete="new-password">
        </div>
        <p class="msg error" id="page-error-signup" hidden></p>
        <button class="btn primary block" type="submit" id="btn-page-submit-signup">
          ${I('plus')} Criar Conta e Conectar
        </button>
      </form>
    `;
  } else {
    // Usuário logado
    const userName = user.user_metadata?.full_name || 'Confeiteiro(a)';
    const userEmail = user.email || '';
    const initial = (userName || userEmail || 'D').charAt(0).toUpperCase();

    html += `
      <div class="card" style="padding:16px;margin-bottom:16px;border-radius:18px">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
          <div class="av lg" style="background:var(--brand);color:#fff">${esc(initial)}</div>
          <div style="min-width:0;flex:1">
            <h2 style="margin:0;font-size:17px">${esc(userName)}</h2>
            <div class="muted" style="font-size:13px">${esc(userEmail)}</div>
            <span class="pill good" style="margin-top:4px">
              ${I('cloud')} Conectado ao Supabase
            </span>
          </div>
        </div>

        <div class="sum" style="margin:12px 0 0;padding:8px 12px;background:var(--field)">
          <div>
            <span>Sabores salvos</span>
            <b>${state.flavors.length}</b>
          </div>
          <div>
            <span>Vendas salvas</span>
            <b>${state.sales.length}</b>
          </div>
        </div>
      </div>

      <div class="actions" style="margin-bottom:18px">
        <button class="btn primary block" type="button" id="btn-sync-cloud">
          ${I('refresh')} Sincronizar Tudo com Supabase Agora
        </button>
        <button class="btn danger block" type="button" id="btn-logout">
          ${I('x')} Sair da Conta
        </button>
      </div>
    `;
  }

  // SEÇÃO 3: BACKUP E SEGURANÇA LOCAL
  html += `
    <div class="sec-h"><h2>Backup e Segurança Local</h2></div>
    <div class="card" style="padding:14px;border-radius:18px">
      <p class="muted" style="margin:0 0 12px;font-size:13px">
        Mesmo sem internet ou sem login, todos os seus dados ficam salvos com segurança neste aparelho. Você pode baixar uma cópia do arquivo a qualquer momento:
      </p>
      <div class="actions">
        <button class="btn" type="button" id="btn-export-json">${I('box')} Baixar Backup Completo (JSON)</button>
        <label class="btn" style="cursor:pointer">
          ${I('refresh')} Importar / Restaurar Backup
          <input type="file" id="input-import-json" accept=".json" style="display:none">
        </label>
      </div>
    </div>
  `;

  return html;
}

export function bindAccountViewEvents({ container, user, state, onUserChanged, onDataReload }) {
  // Ajuste de margem de lucro
  const marginInput = container.querySelector('#cfg-margin-input');
  const marginSim = container.querySelector('#cfg-margin-sim');
  const btnSaveMargin = container.querySelector('#btn-save-margin');

  function updateMarginSim(val) {
    const m = Math.min(95, Math.max(1, parseFloat(String(val).replace(',', '.')) || 50));
    const sim = calculatePriceFromMargin({ cost: 1.50, marginPercent: m });
    if (marginSim) {
      marginSim.innerHTML = `💡 <b>Exemplo prático:</b> Se uma palha italiana custar <b>R$ 1,50</b> em ingredientes, com <b>${m}% de margem</b> o preço sugerido é <b>${formatMoney(sim.suggestedPrice)}</b> (você lucra <b>${formatMoney(sim.profit)}</b> por unidade vendida).`;
    }
  }

  container.querySelectorAll('[data-cfg-margin]').forEach(btn => {
    btn.addEventListener('click', () => {
      const val = Number(btn.dataset.cfgMargin);
      if (marginInput) marginInput.value = val;
      container.querySelectorAll('[data-cfg-margin]').forEach(b => {
        b.setAttribute('aria-pressed', String(Number(b.dataset.cfgMargin) === val));
      });
      updateMarginSim(val);
    });
  });

  if (marginInput) {
    marginInput.addEventListener('input', e => {
      const val = parseFloat(e.target.value);
      if (val > 0) {
        container.querySelectorAll('[data-cfg-margin]').forEach(b => {
          b.setAttribute('aria-pressed', String(Number(b.dataset.cfgMargin) === val));
        });
        updateMarginSim(val);
      }
    });
  }

  if (btnSaveMargin) {
    btnSaveMargin.addEventListener('click', () => {
      const val = Math.min(95, Math.max(1, parseFloat(String(marginInput?.value || 50).replace(',', '.')) || 50));
      state.settings = state.settings || {};
      state.settings.defaultMargin = val;
      storageService.save(state);
      showToast(`Margem padrão de ${val}% salva com sucesso!`);
    });
  }

  // Alternar abas Entrar / Criar Conta
  const tabLogin = container.querySelector('#tab-login');
  const tabSignup = container.querySelector('#tab-signup');
  const fLogin = container.querySelector('#f-page-login');
  const fSignup = container.querySelector('#f-page-signup');

  if (tabLogin && tabSignup) {
    tabLogin.addEventListener('click', () => {
      tabLogin.setAttribute('aria-pressed', 'true');
      tabSignup.setAttribute('aria-pressed', 'false');
      if (fLogin) fLogin.hidden = false;
      if (fSignup) fSignup.hidden = true;
    });

    tabSignup.addEventListener('click', () => {
      tabSignup.setAttribute('aria-pressed', 'true');
      tabLogin.setAttribute('aria-pressed', 'false');
      if (fSignup) fSignup.hidden = false;
      if (fLogin) fLogin.hidden = true;
    });
  }

  // Submissão Login
  if (fLogin) {
    fLogin.addEventListener('submit', async e => {
      e.preventDefault();
      const email = container.querySelector('#page-email').value.trim();
      const pass = container.querySelector('#page-pass').value;
      const errEl = container.querySelector('#page-error-login');
      const submitBtn = container.querySelector('#btn-page-submit-login');

      errEl.hidden = true;
      if (!email || !pass) {
        errEl.textContent = 'Preencha o email e a senha.';
        errEl.hidden = false;
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = 'Entrando…';

      try {
        const data = await authService.signIn(email, pass);
        showToast(`Bem-vindo, ${data.user.email}!`);
        await dbService.uploadLocalDataToSupabase(data.user, state);
        const loaded = await dbService.loadAll(data.user);
        if (typeof onUserChanged === 'function') onUserChanged(data.user);
        if (typeof onDataReload === 'function') onDataReload(loaded);
      } catch (err) {
        errEl.textContent = err.message || 'Falha ao autenticar.';
        errEl.hidden = false;
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Entrar com Supabase';
      }
    });
  }

  // Submissão Cadastro
  if (fSignup) {
    fSignup.addEventListener('submit', async e => {
      e.preventDefault();
      const name = container.querySelector('#page-signup-name').value.trim();
      const email = container.querySelector('#page-signup-email').value.trim();
      const pass = container.querySelector('#page-signup-pass').value;
      const errEl = container.querySelector('#page-error-signup');
      const submitBtn = container.querySelector('#btn-page-submit-signup');

      errEl.hidden = true;
      if (!email || pass.length < 6) {
        errEl.textContent = 'Informe um email válido e senha com no mínimo 6 dígitos.';
        errEl.hidden = false;
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = 'Criando conta…';

      try {
        const data = await authService.signUp(email, pass, name);
        showToast('Cadastro realizado! Conectado na nuvem.');
        if (data.user) {
          await dbService.uploadLocalDataToSupabase(data.user, state);
          const loaded = await dbService.loadAll(data.user);
          if (typeof onUserChanged === 'function') onUserChanged(data.user);
          if (typeof onDataReload === 'function') onDataReload(loaded);
        }
      } catch (err) {
        errEl.textContent = err.message || 'Erro ao criar conta no Supabase.';
        errEl.hidden = false;
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Criar Conta e Conectar';
      }
    });
  }

  // Esqueci minha senha
  const btnForgot = container.querySelector('#btn-page-forgot');
  if (btnForgot) {
    btnForgot.addEventListener('click', async () => {
      const email = container.querySelector('#page-email')?.value.trim();
      if (!email) {
        alert('Digite seu email no campo acima primeiro.');
        return;
      }
      try {
        await authService.resetPassword(email);
        showToast('Link de recuperação enviado para seu email!');
      } catch (e) {
        alert(e.message || 'Erro ao solicitar recuperação.');
      }
    });
  }

  // Sincronizar Tudo
  const btnSync = container.querySelector('#btn-sync-cloud');
  if (btnSync && user) {
    btnSync.addEventListener('click', async () => {
      btnSync.disabled = true;
      btnSync.textContent = 'Sincronizando…';
      try {
        await dbService.uploadLocalDataToSupabase(user, state);
        const freshData = await dbService.loadAll(user);
        showToast('Dados sincronizados com o Supabase!');
        if (typeof onDataReload === 'function') onDataReload(freshData);
      } catch (e) {
        showToast('Erro ao sincronizar.');
      } finally {
        btnSync.disabled = false;
        btnSync.textContent = 'Sincronizar Tudo com Supabase Agora';
      }
    });
  }

  // Logout
  const btnLogout = container.querySelector('#btn-logout');
  if (btnLogout) {
    btnLogout.addEventListener('click', async () => {
      try {
        await authService.signOut();
        showToast('Desconectado com sucesso.');
        if (typeof onUserChanged === 'function') onUserChanged(null);
      } catch (e) {
        showToast('Erro ao desconectar.');
      }
    });
  }

  // Exportar Backup
  const btnExport = container.querySelector('#btn-export-json');
  if (btnExport) {
    btnExport.addEventListener('click', () => {
      storageService.exportToJson(state);
      showToast('Backup JSON baixado com sucesso!');
    });
  }

  // Importar Backup
  const inputImport = container.querySelector('#input-import-json');
  if (inputImport) {
    inputImport.addEventListener('change', async e => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const imported = await storageService.importFromJson(file);
        showToast('Dados restaurados!');
        if (typeof onDataReload === 'function') onDataReload(imported);
      } catch (err) {
        alert(err.message);
      }
    });
  }
}
