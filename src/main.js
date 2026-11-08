/**
 * Ponto de Entrada da Aplicação Dona Palha
 * Orquestrador modular, reativo e integrado ao Supabase
 */

import './styles/main.css';

import { authService } from './services/authService.js';
import { dbService } from './services/dbService.js';
import { storageService, createEmptyState } from './services/storageService.js';
import { syncService } from './services/syncService.js';
import { isSupabaseReady } from './services/supabaseClient.js';

import { renderHeader, updateSyncBadge } from './components/Header.js';
import { renderTabBar } from './components/TabBar.js';
import { renderFab } from './components/Fab.js';
import { closeSheet } from './components/BottomSheet.js';
import { showToast } from './components/Toast.js';
import { openAuthModal } from './components/AuthModal.js';

import { renderHomeView } from './pages/HomeView.js';
import { renderSalesView } from './pages/SalesView.js';
import { renderGeneralView } from './pages/GeneralView.js';
import { renderFlavorsView } from './pages/FlavorsView.js';
import { renderCostsView } from './pages/CostsView.js';

import { openSaleModal, openSaleDetailModal } from './modules/salesModal.js';
import { openFlavorModal } from './modules/flavorModal.js';
import { openProduceModal } from './modules/produceModal.js';
import { openCostModal } from './modules/costModal.js';
import { openStockMovementModal } from './modules/stockMovementModal.js';
import { openProductionHistoryModal } from './modules/productionHistoryModal.js';

import { getDemoState } from './utils/demoData.js';
import { VIEWS, DAY_NAMES_LONG, MONTH_NAMES_LONG } from './utils/constants.js';
import { today, addDays, parseDateParts, shortDate, shiftMonth } from './utils/formatters.js';
import { formatMoney } from './calculations/index.js';

class AppController {
  constructor() {
    this.user = null;
    this.state = createEmptyState();
    this.currentView = 'inicio';
    this.query = '';
    this.salesFilter = 'todas';
    this.period = 'hoje';
    this.customFrom = today().slice(0, 8) + '01';
    this.customTo = today();
    this.selectedMonth = today().slice(0, 7);
    this.keepSearch = false;
  }

  async init() {
    syncService.init();

    // 1. Carrega dados do cache local imediatamente para exibição instantânea
    this.state = storageService.load();
    this.render();

    // 2. Conecta ao Supabase Auth se configurado
    if (isSupabaseReady()) {
      syncService.setStatus('busy');
      try {
        const user = await authService.getCurrentUser();
        this.user = user;
        if (user) {
          syncService.setStatus('busy');
          this.state = await dbService.loadAll(user);
          syncService.setStatus('ok');
        } else {
          syncService.setStatus('local');
        }
      } catch (err) {
        console.warn('Erro na autenticação inicial:', err);
        syncService.setStatus('err');
      }

      // Escuta mudanças de sessão
      authService.onAuthStateChange(async (event, user) => {
        this.user = user;
        if (user) {
          syncService.setStatus('busy');
          this.state = await dbService.loadAll(user);
          syncService.setStatus('ok');
        } else {
          syncService.setStatus('local');
        }
        this.render();
      });
    } else {
      syncService.setStatus('local');
    }

    // Escuta status de sincronização
    syncService.subscribe(status => {
      updateSyncBadge(status);
    });

    this.bindEvents();
    this.handleRoute();
  }

  getPeriodLabel() {
    const t = today();
    if (this.period === 'hoje') {
      const p = parseDateParts(t);
      return `Hoje · ${DAY_NAMES_LONG[p.w]}, ${shortDate(t)}`;
    }
    if (this.period === 'mes') {
      const p = parseDateParts(t);
      return `${MONTH_NAMES_LONG[p.m - 1].charAt(0).toUpperCase() + MONTH_NAMES_LONG[p.m - 1].slice(1)} de ${p.y}`;
    }
    if (this.period === '7d') {
      return `Últimos 7 dias (desde ${shortDate(addDays(t, -6))})`;
    }
    return `De ${shortDate(this.customFrom)} a ${shortDate(this.customTo)}`;
  }

  getTitleInfo() {
    const t = today();
    const p = parseDateParts(t);
    const dayDesc = `${DAY_NAMES_LONG[p.w]}, ${p.d} de ${MONTH_NAMES_LONG[p.m - 1]}`;

    const totalSoldUnits = this.state.sales.reduce((acc, s) => acc + (Number(s.qty) || 0), 0);
    const totalFlavorsStock = this.state.flavors.reduce((acc, f) => acc + (Number(f.stock) || 0), 0);
    const totalCosts = this.state.costs.reduce((acc, c) => acc + (Number(c.total) || 0), 0);

    const userName = this.user?.user_metadata?.full_name || 'Gustavo';

    const titles = {
      inicio: [`Olá, ${userName}`, dayDesc],
      vendas: [
        'Vendas',
        `${this.state.sales.length} ${this.state.sales.length === 1 ? 'venda' : 'vendas'} · ${totalSoldUnits} un vendidas`
      ],
      geral: ['Visão geral', this.getPeriodLabel()],
      sabores: [
        'Sabores',
        `${this.state.flavors.length} ${this.state.flavors.length === 1 ? 'sabor' : 'sabores'} · ${totalFlavorsStock} un em estoque`
      ],
      custos: [
        'Custos',
        `${this.state.costs.length} ${this.state.costs.length === 1 ? 'compra' : 'compras'} · ${formatMoney(totalCosts)} gastos`
      ]
    };

    return titles[this.currentView] || titles.inicio;
  }

  handleRoute() {
    const hash = window.location.hash.replace('#', '');
    const targetView = VIEWS.includes(hash) ? hash : 'inicio';

    if (targetView !== this.currentView || !this.keepSearch) {
      if (!this.keepSearch) {
        this.query = '';
        this.salesFilter = 'todas';
      }
    }
    this.keepSearch = false;
    this.currentView = targetView;
    closeSheet();
    this.render();
    window.scrollTo(0, 0);
  }

  render() {
    const [title, subtitle] = this.getTitleInfo();

    // Renderiza Header
    renderHeader({
      user: this.user,
      title,
      subtitle,
      query: this.query,
      onSearchInput: q => {
        this.query = q;
        if (this.currentView === 'inicio' && q) {
          this.keepSearch = true;
          window.location.hash = '#vendas';
        } else {
          this.renderViewContent();
        }
      },
      onClearSearch: () => {
        this.query = '';
        this.renderViewContent();
      },
      onSyncClick: () => {
        openAuthModal({
          user: this.user,
          state: this.state,
          onUserChanged: newUser => {
            this.user = newUser;
            this.render();
          },
          onDataReload: freshState => {
            this.state = freshState;
            this.render();
          }
        });
      }
    });

    updateSyncBadge(syncService.getStatus());
    renderTabBar(this.currentView);
    renderFab(this.currentView, action => this.handleFabAction(action));

    this.renderViewContent();
  }

  renderViewContent() {
    const container = document.getElementById('view');
    if (!container) return;

    let content = '';
    const periodLabel = this.getPeriodLabel();

    switch (this.currentView) {
      case 'inicio':
        content = renderHomeView({
          state: this.state,
          period: this.period,
          customFrom: this.customFrom,
          customTo: this.customTo,
          periodLabel
        });
        break;
      case 'vendas':
        content = renderSalesView({
          state: this.state,
          filter: this.salesFilter,
          query: this.query
        });
        break;
      case 'geral':
        content = renderGeneralView({
          state: this.state,
          period: this.period,
          customFrom: this.customFrom,
          customTo: this.customTo,
          selectedMonth: this.selectedMonth,
          query: this.query,
          periodLabel
        });
        break;
      case 'sabores':
        content = renderFlavorsView({
          state: this.state,
          query: this.query
        });
        break;
      case 'custos':
        content = renderCostsView({
          state: this.state,
          query: this.query
        });
        break;
      default:
        content = '';
    }

    container.innerHTML = content;
  }

  handleFabAction(action) {
    if (action === 'openSale') this.openSaleAction();
    else if (action === 'newFlavor') this.openFlavorAction();
    else if (action === 'newCost') this.openCostAction();
  }

  openSaleAction(preFlavorId = null) {
    openSaleModal({
      state: this.state,
      preFlavorId,
      user: this.user,
      onSaved: () => this.render(),
      onOpenFlavor: () => this.openFlavorAction()
    });
  }

  openFlavorAction(flavorId = null) {
    openFlavorModal({
      state: this.state,
      flavorId,
      user: this.user,
      onSaved: () => this.render(),
      onDeleted: () => this.render(),
      onProduceClick: fid => this.openProduceAction(fid),
      onAdjustStockClick: fid => this.openAdjustStockAction(fid)
    });
  }

  openProduceAction(preFlavorId = null) {
    openProduceModal({
      state: this.state,
      preFlavorId,
      user: this.user,
      onSaved: () => this.render(),
      onGoCosts: () => {
        window.location.hash = '#custos';
      },
      onOpenFlavor: () => this.openFlavorAction(),
      onViewHistory: () => {
        openProductionHistoryModal({ state: this.state, flavorId: preFlavorId });
      }
    });
  }

  openCostAction(costId = null) {
    openCostModal({
      state: this.state,
      costId,
      user: this.user,
      onSaved: () => this.render(),
      onDeleted: () => this.render()
    });
  }

  openAdjustStockAction(flavorId) {
    openStockMovementModal({
      state: this.state,
      flavorId,
      user: this.user,
      onSaved: () => this.render()
    });
  }

  bindEvents() {
    window.addEventListener('hashchange', () => this.handleRoute());

    // Fechar sheet com Escape
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') closeSheet();
    });

    // Inputs de datas personalizadas
    document.addEventListener('change', e => {
      if (e.target.id === 'p-from') {
        this.customFrom = e.target.value || this.customFrom;
        this.renderViewContent();
      } else if (e.target.id === 'p-to') {
        this.customTo = e.target.value || this.customTo;
        this.renderViewContent();
      }
    });

    // Delegação de cliques para botões e links com data-act
    document.addEventListener('click', async e => {
      const el = e.target.closest('[data-act]');
      if (!el) return;

      const act = el.dataset.act;
      const id = el.dataset.id;

      switch (act) {
        case 'closeSheet':
          closeSheet();
          break;
        case 'openSale':
          this.openSaleAction(id);
          break;
        case 'saleDetail':
          openSaleDetailModal({
            state: this.state,
            saleId: id,
            user: this.user,
            onUpdated: () => this.render(),
            onDeleted: () => this.render()
          });
          break;
        case 'quickMarkPaid':
          try {
            await dbService.updateSalePayment({
              saleId: id,
              paid: true,
              user: this.user,
              state: this.state
            });
            showToast('Pagamento registrado!');
            this.render();
          } catch (err) {
            showToast('Erro ao marcar venda.');
          }
          break;
        case 'newFlavor':
        case 'editFlavor':
          this.openFlavorAction(id);
          break;
        case 'produce':
          this.openProduceAction(id);
          break;
        case 'viewProductionHistory':
          openProductionHistoryModal({ state: this.state, flavorId: id });
          break;
        case 'adjustStock':
          this.openAdjustStockAction(id);
          break;
        case 'newCost':
        case 'editCost':
          this.openCostAction(id);
          break;
        case 'filterSales':
          this.salesFilter = el.dataset.v;
          this.renderViewContent();
          break;
        case 'setPeriod':
          this.period = el.dataset.v;
          this.render();
          break;
        case 'goPending':
          this.salesFilter = 'pendentes';
          this.keepSearch = true;
          if (this.currentView === 'vendas') {
            this.render();
            window.scrollTo(0, 0);
          } else {
            window.location.hash = '#vendas';
          }
          break;
        case 'mprev':
          this.selectedMonth = shiftMonth(this.selectedMonth, -1);
          this.renderViewContent();
          break;
        case 'mnext':
          if (this.selectedMonth < today().slice(0, 7)) {
            this.selectedMonth = shiftMonth(this.selectedMonth, 1);
            this.renderViewContent();
          }
          break;
        case 'demo':
          this.state = getDemoState();
          storageService.save(this.state);
          this.render();
          showToast('Dados de exemplo carregados!');
          break;
        case 'clearDemo':
          this.state = createEmptyState();
          storageService.save(this.state);
          this.render();
          showToast('Tudo limpo! Comece cadastrando seus sabores.');
          break;
      }
    });
  }
}

// Inicializa a aplicação quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
  const app = new AppController();
  app.init();
});

