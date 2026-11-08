/**
 * Constantes globais do sistema Dona Palha
 */

export const STORAGE_KEY = 'donapalha:v2';
export const LEGACY_STORAGE_KEY = 'donapalha:v1';

export const LOW_STOCK_THRESHOLD = 5;

export const TONES = ['lav', 'peach', 'sky', 'mint', 'rose', 'sun'];

export const PAYMENT_METHODS = [
  'Pix',
  'Dinheiro',
  'Cartão de débito',
  'Cartão de crédito',
  'Transferência',
  'Outro'
];

export const VIEWS = ['inicio', 'vendas', 'geral', 'sabores', 'custos'];

export const TABS = [
  { id: 'inicio', label: 'Início', icon: 'home' },
  { id: 'vendas', label: 'Vendas', icon: 'bag' },
  { id: 'geral', label: 'Visão geral', icon: 'grid' },
  { id: 'sabores', label: 'Sabores', icon: 'layers' },
  { id: 'custos', label: 'Custos', icon: 'receipt' }
];

export const PERIOD_OPTIONS = [
  { id: 'hoje', label: 'Hoje' },
  { id: '7d', label: 'Últimos 7 dias' },
  { id: 'mes', label: 'Mês atual' },
  { id: 'custom', label: 'Personalizado' }
];

export const MONTH_NAMES_SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
export const MONTH_NAMES_LONG = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
export const DAY_NAMES_SHORT = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
export const DAY_NAMES_LONG = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];

export const STOCK_ADJUSTMENT_REASONS = [
  'Perda / Vencimento',
  'Avaria / Embalagem danificada',
  'Degustação / Amostra',
  'Acerto de inventário (Contagem física)',
  'Consumo próprio',
  'Outro'
];

export const UNITS_OF_MEASURE = [
  { id: 'g', label: 'Gramas (g)', short: 'g' },
  { id: 'kg', label: 'Quilos (kg)', short: 'kg' },
  { id: 'ml', label: 'Mililitros (ml)', short: 'ml' },
  { id: 'l', label: 'Litros (L)', short: 'L' },
  { id: 'un', label: 'Unidades (un)', short: 'un' },
  { id: 'pct', label: 'Pacote (pct)', short: 'pct' },
  { id: 'cx', label: 'Caixa (cx)', short: 'cx' }
];

export const MARGIN_PRESETS = [30, 40, 50, 60, 70, 80];
