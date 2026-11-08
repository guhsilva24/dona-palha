/**
 * Modal de Autenticação Supabase, Sincronização em Nuvem e Backup
 */

import { authService } from '../services/authService.js';
import { isSupabaseReady } from '../services/supabaseClient.js';
import { storageService } from '../services/storageService.js';
import { dbService } from '../services/dbService.js';
import { openSheet, closeSheet } from './BottomSheet.js';
import { showToast } from './Toast.js';
import { I } from '../utils/icons.js';
import { esc } from '../utils/formatters.js';

export function openAuthModal({ user, state, onUserChanged, onDataReload }) {
  const isCloud = isSupabaseReady();

  let body = '';

  if (!isCloud) {
    body = `
      <div class="card note" style="margin-top:0">
        ${I('info')}
        <div>
          <b>Armazenamento Local Ativo.</b><br>
          Seus dados estão sendo guardados com segurança neste navegador.
          Para sincronizar na nuvem e acessar em múltiplos aparelhos, configure as chaves do Supabase no arquivo <code>.env</code>:
          <pre style="margin:8px 0;background:var(--field);padding:8px;border-radius:8px;font-size:12px;overflow-x:auto">VITE_SUPABASE_URL=https://...
VITE_SUPABASE_PUBLISHABLE_KEY=...</pre>
        </div>
      </div>

      <div class="sec-h" style="margin-top:16px"><h2>Backup e Exportação</h2></div>
      <div class="actions">
        <button class="btn" type="button" id="btn-export-json">${I('box')} Baixar Backup (JSON)</button>
        <label class="btn" style="cursor:pointer">
          ${I('refresh')} Importar Backup
          <input type="file" id="input-import-json" accept=".json" style="display:none">
        </label>
      </div>
    `;
  } else if (user) {
    body = `
      <div class="card" style="padding:16px;margin-bottom:14px">
        <div style="display:flex;align-items:center;gap:12px">
          <div class="av lg">${esc((user.email || 'U').charAt(0).toUpperCase())}</div>
          <div style="min-width:0;flex:1">
            <h3 style="margin:0;font-size:16px">${esc(user.user_metadata?.full_name || 'Confeiteiro(a)')}</h3>
            <span class="muted" style="font-size:13px">${esc(user.email)}</span>
          </div>
        </div>
      </div>

      <div class="actions">
        <button class="btn primary" type="button" id="btn-sync-cloud">${I('refresh')} Sincronizar com Nuvem Agora</button>
        <button class="btn" type="button" id="btn-export-json">${I('box')} Baixar Backup (JSON)</button>
        <button class="btn danger" type="button" id="btn-logout">${I('x')} Sair da Conta</button>
      </div>
    `;
  } else {
    body = `
      <div class="chips" style="margin-bottom:16px">
        <button class="chip" type="button" id="tab-login" aria-pressed="true">Entrar</button>
        <button class="chip" type="button" id="tab-signup" aria-pressed="false">Criar Conta</button>
      </div>

      <!-- Formulário de Login -->
      <form id="f-auth-login" novalidate>
        <div class="field">
          <label for="auth-email">Email</label>
          <input id="auth-email" type="email" placeholder="seu@email.com" required>
        </div>
        <div class="field">
          <label for="auth-pass">Senha</label>
          <input id="auth-pass" type="password" placeholder="••••••••" required>
        </div>
        <p class="msg error" id="auth-error-login" hidden></p>
        <div class="actions">
          <button class="btn primary block" type="submit" id="btn-submit-login">Entrar no Dona Palha</button>
          <button class="link" type="button" id="btn-forgot-pass">Esqueci minha senha</button>
        </div>
      </form>

      <!-- Formulário de Cadastro -->
      <form id="f-auth-signup" novalidate hidden>
        <div class="field">
          <label for="signup-name">Seu Nome ou Confeitaria</label>
          <input id="signup-name" type="text" placeholder="Ex: Gustavo - Dona Palha">
        </div>
        <div class="field">
          <label for="signup-email">Email</label>
          <input id="signup-email" type="email" placeholder="seu@email.com" required>
        </div>
        <div class="field">
          <label for="signup-pass">Criar Senha (mínimo 6 dígitos)</label>
          <input id="signup-pass" type="password" placeholder="••••••••" required>
        </div>
        <p class="msg error" id="auth-error-signup" hidden></p>
        <button class="btn primary block" type="submit" id="btn-submit-signup">Cadastrar e Conectar</button>
      </form>

      <div class="sec-h" style="margin-top:20px"><h2>Backup Local</h2></div>
      <div class="actions">
        <button class="btn" type="button" id="btn-export-json">${I('box')} Baixar Backup (JSON)</button>
      </div>
    `;
  }

  openSheet({
    title: 'Sincronização & Conta',
    sub: isCloud ? 'Banco de dados Supabase na nuvem' : 'Modo local seguro',
    icon: 'cloud',
    body,
    mount(container) {
      // Exportar JSON
      const btnExport = container.querySelector('#btn-export-json');
      if (btnExport) {
        btnExport.addEventListener('click', () => {
          storageService.exportToJson(state);
          showToast('Backup baixado com sucesso!');
        });
      }

      // Importar JSON
      const inputImport = container.querySelector('#input-import-json');
      if (inputImport) {
        inputImport.addEventListener('change', async e => {
          const file = e.target.files?.[0];
          if (!file) return;
          try {
            const imported = await storageService.importFromJson(file);
            showToast('Dados restaurados!');
            closeSheet();
            if (typeof onDataReload === 'function') onDataReload(imported);
          } catch (err) {
            alert(err.message);
          }
        });
      }

      // Se logado: Sincronizar e Sair
      const btnSync = container.querySelector('#btn-sync-cloud');
      if (btnSync) {
        btnSync.addEventListener('click', async () => {
          btnSync.disabled = true;
          btnSync.textContent = 'Sincronizando…';
          try {
            await dbService.uploadLocalDataToSupabase(user, state);
            const freshData = await dbService.loadAll(user);
            showToast('Sincronização com Supabase concluída!');
            closeSheet();
            if (typeof onDataReload === 'function') onDataReload(freshData);
          } catch (e) {
            showToast('Erro ao sincronizar.');
          } finally {
            btnSync.disabled = false;
          }
        });
      }

      const btnLogout = container.querySelector('#btn-logout');
      if (btnLogout) {
        btnLogout.addEventListener('click', async () => {
          try {
            await authService.signOut();
            showToast('Desconectado com sucesso.');
            closeSheet();
            if (typeof onUserChanged === 'function') onUserChanged(null);
          } catch (e) {
            showToast('Erro ao desconectar.');
          }
        });
      }

      // Se deslogado: alternar abas de login / signup
      const tabLogin = container.querySelector('#tab-login');
      const tabSignup = container.querySelector('#tab-signup');
      const fLogin = container.querySelector('#f-auth-login');
      const fSignup = container.querySelector('#f-auth-signup');

      if (tabLogin && tabSignup) {
        tabLogin.addEventListener('click', () => {
          tabLogin.setAttribute('aria-pressed', 'true');
          tabSignup.setAttribute('aria-pressed', 'false');
          fLogin.hidden = false;
          fSignup.hidden = true;
        });

        tabSignup.addEventListener('click', () => {
          tabSignup.setAttribute('aria-pressed', 'true');
          tabLogin.setAttribute('aria-pressed', 'false');
          fSignup.hidden = false;
          fLogin.hidden = true;
        });
      }

      // Submissão Login
      if (fLogin) {
        fLogin.addEventListener('submit', async e => {
          e.preventDefault();
          const email = container.querySelector('#auth-email').value.trim();
          const pass = container.querySelector('#auth-pass').value;
          const errEl = container.querySelector('#auth-error-login');
          const submitBtn = container.querySelector('#btn-submit-login');

          errEl.hidden = true;
          if (!email || !pass) {
            errEl.textContent = 'Preencha email e senha.';
            errEl.hidden = false;
            return;
          }

          submitBtn.disabled = true;
          submitBtn.textContent = 'Entrando…';

          try {
            const data = await authService.signIn(email, pass);
            showToast(`Bem-vindo, ${data.user.email}!`);
            // Sobe os dados locais caso a nuvem esteja vazia
            await dbService.uploadLocalDataToSupabase(data.user, state);
            const loaded = await dbService.loadAll(data.user);
            closeSheet();
            if (typeof onUserChanged === 'function') onUserChanged(data.user);
            if (typeof onDataReload === 'function') onDataReload(loaded);
          } catch (err) {
            errEl.textContent = err.message || 'Falha ao autenticar.';
            errEl.hidden = false;
          } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Entrar no Dona Palha';
          }
        });
      }

      // Submissão Cadastro
      if (fSignup) {
        fSignup.addEventListener('submit', async e => {
          e.preventDefault();
          const name = container.querySelector('#signup-name').value.trim();
          const email = container.querySelector('#signup-email').value.trim();
          const pass = container.querySelector('#signup-pass').value;
          const errEl = container.querySelector('#auth-error-signup');
          const submitBtn = container.querySelector('#btn-submit-signup');

          errEl.hidden = true;
          if (!email || pass.length < 6) {
            errEl.textContent = 'Informe um email válido e senha com no mínimo 6 dígitos.';
            errEl.hidden = false;
            return;
          }

          submitBtn.disabled = true;
          submitBtn.textContent = 'Cadastrando…';

          try {
            const data = await authService.signUp(email, pass, name);
            showToast('Cadastro realizado! Conectado na nuvem.');
            if (data.user) {
              await dbService.uploadLocalDataToSupabase(data.user, state);
              const loaded = await dbService.loadAll(data.user);
              closeSheet();
              if (typeof onUserChanged === 'function') onUserChanged(data.user);
              if (typeof onDataReload === 'function') onDataReload(loaded);
            } else {
              closeSheet();
            }
          } catch (err) {
            errEl.textContent = err.message || 'Erro ao criar conta.';
            errEl.hidden = false;
          } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Cadastrar e Conectar';
          }
        });
      }

      // Recuperar senha
      const btnForgot = container.querySelector('#btn-forgot-pass');
      if (btnForgot) {
        btnForgot.addEventListener('click', async () => {
          const email = container.querySelector('#auth-email')?.value.trim();
          if (!email) {
            alert('Digite seu email no campo acima primeiro.');
            return;
          }
          try {
            await authService.resetPassword(email);
            showToast('Email de recuperação enviado!');
          } catch (e) {
            alert(e.message || 'Erro ao solicitar redefinição.');
          }
        });
      }
    }
  });
}
