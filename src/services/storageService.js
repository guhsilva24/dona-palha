/**
 * Serviço de Armazenamento Local e Migração de Dados Legados
 * Garante que nenhum dado existente em donapalha:v1 seja perdido.
 */

import { STORAGE_KEY, LEGACY_STORAGE_KEY } from '../utils/constants.js';

export function createEmptyState() {
  return {
    flavors: [],
    sales: [],
    costs: [],
    productions: [],
    stockMovements: [],
    settings: {
      defaultMargin: 50
    },
    demo: false,
    rev: 0,
    lastSync: null
  };
}

export function normalizeState(data = {}) {
  const d = data || {};
  const safeArray = arr => (Array.isArray(arr) ? arr.map(item => ({ ...item })) : []);
  return {
    flavors: safeArray(d.flavors),
    sales: safeArray(d.sales),
    costs: safeArray(d.costs),
    productions: safeArray(d.productions),
    stockMovements: safeArray(d.stockMovements),
    settings: {
      defaultMargin: Number(d.settings?.defaultMargin) || 50,
      ...(d.settings || {})
    },
    demo: Boolean(d.demo),
    rev: Number(d.rev) || 0,
    lastSync: d.lastSync || null
  };
}

export const storageService = {
  /**
   * Carrega os dados persistidos. Verifica primeiro donapalha:v2.
   * Se não encontrar, migra automaticamente de donapalha:v1 sem perda de dados.
   */
  load() {
    try {
      // 1. Tenta carregar a versão v2
      const rawV2 = localStorage.getItem(STORAGE_KEY);
      if (rawV2) {
        const parsed = JSON.parse(rawV2);
        return normalizeState(parsed);
      }

      // 2. Se não existir v2, verifica se existe dados da versão original v1
      const rawV1 = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (rawV1) {
        const legacyData = JSON.parse(rawV1);
        const migrated = normalizeState(legacyData);
        migrated.rev = Date.now();
        // Salva na nova chave v2 sem apagar a v1 por segurança
        this.save(migrated);
        console.info('Dados legados de Dona Palha v1 migrados com sucesso para v2.');
        return migrated;
      }
    } catch (err) {
      console.error('Erro ao ler localStorage:', err);
    }
    return createEmptyState();
  },

  /**
   * Salva o estado atual no localStorage
   */
  save(state) {
    try {
      const payload = {
        ...state,
        rev: Date.now()
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      return true;
    } catch (err) {
      console.error('Erro ao salvar no localStorage:', err);
      return false;
    }
  },

  /**
   * Limpa os dados (ou restaura para vazio)
   */
  clear() {
    try {
      localStorage.removeItem(STORAGE_KEY);
      return true;
    } catch (err) {
      return false;
    }
  },

  /**
   * Exporta todo o estado do sistema para backup JSON
   */
  exportToJson(state) {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(state, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `dona-palha-backup-${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  },

  /**
   * Importa estado de um arquivo JSON
   */
  async importFromJson(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = event => {
        try {
          const parsed = JSON.parse(event.target.result);
          const normalized = normalizeState(parsed);
          this.save(normalized);
          resolve(normalized);
        } catch (err) {
          reject(new Error('Arquivo JSON inválido ou corrompido.'));
        }
      };
      reader.onerror = () => reject(new Error('Falha ao ler o arquivo selecionado.'));
      reader.readAsText(file);
    });
  }
};
