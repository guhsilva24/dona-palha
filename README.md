# 🍬 Dona Palha — Sistema de Gestão Financeira e Produção Artesanal

Sistema web profissional, modular e escalável para confeitarias artesanais de palha italiana. Desenvolvido com **Vite**, **JavaScript Modular (ES Modules)**, **Supabase (PostgreSQL + RLS + Auth)** e preparado para deploy contínuo na **Vercel**.

---

## 📁 1. Estrutura de Diretórios

```
dona-palha/
├── .env.example                          # Exemplo de variáveis de ambiente Supabase
├── .gitignore                            # Arquivos e diretórios ignorados pelo Git
├── Dona_Palha_atualizado.backup.html     # Cópia preservada de segurança do arquivo original
├── Dona_Palha_atualizado.html            # Arquivo HTML original de referência
├── index.html                            # Ponto de entrada HTML do Vite
├── package.json                          # Dependências e scripts do projeto
├── vercel.json                           # Configuração de rotas SPA e segurança para Vercel
├── vite.config.js                        # Configuração do bundler Vite e Vitest
├── public/
│   └── favicon.svg                       # Ícone do aplicativo Dona Palha
├── supabase/
│   └── migrations/
│       └── 20261107000000_create_dona_palha_schema.sql  # Schema SQL, RLS e funções atômicas
├── src/
│   ├── calculations/                     # Motor financeiro e de produção independente
│   │   ├── breakevenCalculations.js      # Ponto de equilíbrio e cobertura de custos
│   │   ├── index.js                      # Exportação unificada dos cálculos
│   │   ├── inventoryCalculations.js      # Custo médio ponderado e validação de estoque
│   │   ├── money.js                      # Aritmética precisa em centavos inteiros (sem erro de ponto flutuante)
│   │   ├── productionCalculations.js     # Custos proporcionais de ingredientes, lote e projeções
│   │   └── salesCalculations.js          # Agregações de vendas, lucro realizado e períodos
│   ├── components/                       # Componentes reutilizáveis de interface
│   │   ├── AuthModal.js                  # Modal de autenticação Supabase, backup e sincronização
│   │   ├── BottomSheet.js                # Janela modal deslizante inferior
│   │   ├── Fab.js                        # Botão de ação flutuante adaptável
│   │   ├── Header.js                     # Banner hero, status de sincronização e busca
│   │   ├── TabBar.js                     # Barra de navegação inferior com abas fixas
│   │   └── Toast.js                      # Notificações e alertas flutuantes
│   ├── modules/                          # Formulários e regras de negócio modais
│   │   ├── costModal.js                  # Cadastro e edição de compras e insumos
│   │   ├── flavorModal.js                # Cadastro e edição de sabores e preços
│   │   ├── produceModal.js               # Produção de fornada com múltiplos ingredientes
│   │   ├── salesModal.js                 # Registro e detalhamento de vendas com validação
│   │   └── stockMovementModal.js         # Controle de perdas, quebras e acertos de inventário
│   ├── pages/                            # Telas principais do aplicativo
│   │   ├── CostsView.js                  # Gestão de compras e gastos operacionais
│   │   ├── FlavorsView.js                # Cardápio, preços, margens e estoque
│   │   ├── GeneralView.js                # Análise de custos por produto, mês e ponto de equilíbrio
│   │   ├── HomeView.js                   # Painel executivo, KPIs de período e valores a receber
│   │   └── SalesView.js                  # Histórico de vendas diárias e pendências
│   ├── services/                         # Serviços de integração e persistência
│   │   ├── authService.js                # Autenticação com Supabase Auth
│   │   ├── dbService.js                  # Operações no Supabase com fallback local seguro
│   │   ├── storageService.js             # Persistência local e migração de dados legados (v1 -> v2)
│   │   ├── supabaseClient.js             # Conexão e inicialização do cliente Supabase
│   │   └── syncService.js                # Monitoramento de status de conexão (Online/Offline)
│   ├── styles/                           # Folhas de estilo modulares
│   │   ├── base.css                      # Reset, tipografia e layout base
│   │   ├── components.css                # Estilos de cards, botões, pills, steppers e sheets
│   │   ├── main.css                      # Importador mestre de CSS
│   │   ├── variables.css                 # Paleta de cores, temas claro/escuro e fontes
│   │   └── views.css                     # Estilos específicos das telas e hero
│   └── utils/                            # Utilitários gerais
│       ├── constants.js                  # Constantes, métodos de pagamento e chaves
│       ├── demoData.js                   # Gerador de dados de demonstração
│       ├── dom.js                        # Manipulação do DOM e proteção contra exclusão acidental
│       ├── formatters.js                 # Formatação de datas, moedas e sanitização HTML
│       └── icons.js                      # Catálogo de ícones SVG otimizados
└── tests/                                # Testes unitários automatizados
    ├── calculations.test.js              # Testes completos do motor financeiro e de estoque
    └── storageMigration.test.js          # Testes de integridade da migração de dados
```

---

## 🧮 2. Motor de Cálculos e Integridade

Todos os cálculos monetários são processados em **centavos inteiros** (`src/calculations/money.js`), evitando imprecisões de ponto flutuante do padrão IEEE 754.

- **Custo Proporcional de Ingredientes:** `custo = (total_pago / quantidade_comprada) * quantidade_usada`
- **Custo Médio Ponderado de Estoque:** `novo_custo = ((estoque_antigo * custo_antigo) + custo_fornada) / (estoque_antigo + unidades_produzidas)`
- **Validação de Estoque Negativo:** O sistema impede vendas e saídas caso a quantidade solicitada seja superior ao saldo disponível (tanto no frontend quanto nas funções PostgreSQL).
- **Preservação de Custo Histórico:** Cada venda registra uma fotografia (*snapshot*) do custo unitário do sabor no momento da transação. Alterações futuras no custo de produção não distorcem vendas passadas.

---

## ☁️ 3. Configuração do Supabase

### 3.1 Criação do Projeto
1. Acesse [https://supabase.com](https://supabase.com) e crie um novo projeto.
2. No menu lateral, acesse **SQL Editor**.
3. Copie o conteúdo do arquivo `supabase/migrations/20261107000000_create_dona_palha_schema.sql` e execute no SQL Editor.
   - Isso criará todas as tabelas (`profiles`, `flavors`, `costs`, `productions`, `production_ingredients`, `sales`, `stock_movements`).
   - Aplicará as políticas de segurança **Row Level Security (RLS)** para que cada confeiteiro acesse exclusivamente seus dados.
   - Criará as funções PostgreSQL atômicas (`execute_sale`, `execute_production`, `cancel_sale`, `adjust_stock`).

### 3.2 Variáveis de Ambiente
Copie o arquivo `.env.example` para `.env`:
```bash
cp .env.example .env
```
Preencha com os dados obtidos em **Project Settings > API**:
```env
VITE_SUPABASE_URL=https://uadfjhamlmepzfqjqcqj.supabase.co/rest/v1/
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_Rg-lgBLE8ZBIHskHsGgKfQ_8I9KWDPi
```

> **Aviso de Segurança:** Nunca utilize a chave `service_role` no frontend. Apenas a chave pública (`anon`) deve ser informada.

---

## 🚀 4. Como Executar Localmente

### Pré-requisitos:
- Node.js versão 18 ou superior.
- Gerenciador de pacotes `npm`.

### Comandos:
```bash
# 1. Instalar as dependências
npm install

# 2. Executar os testes automatizados
npm test

# 3. Iniciar o servidor de desenvolvimento
npm run dev

# 4. Gerar build de produção
npm run build
```

O servidor local iniciará em `http://localhost:3000`.

---

## 🌐 5. Procedimento para Publicar na Vercel

1. **Subir o código para o GitHub:**
   ```bash
   git add .
   git commit -m "feat: reestruturação completa do Dona Palha"
   git branch -M main
   git remote add origin https://github.com/seu-usuario/dona-palha.git
   git push -u origin main
   ```

2. **Importar o repositório na Vercel:**
   - Acesse [https://vercel.com](https://vercel.com) e faça login.
   - Clique em **Add New... > Project** e selecione o repositório do GitHub.
   - A Vercel detectará automaticamente as configurações do `vercel.json` e Vite:
     - **Framework Preset:** Vite
     - **Build Command:** `npm run build`
     - **Output Directory:** `dist`

3. **Configurar as Variáveis de Ambiente na Vercel:**
   - Na seção **Environment Variables**, adicione:
     - `VITE_SUPABASE_URL`: URL do seu projeto Supabase.
     - `VITE_SUPABASE_PUBLISHABLE_KEY`: Chave anônima pública do Supabase.

4. **Deploy:**
   - Clique em **Deploy**. A aplicação estará no ar com HTTPS e CDN global.

---

## 🔄 6. Estratégia de Migração e Preservação de Dados

1. **Backup da versão original:** Uma cópia idêntica da versão em arquivo único foi mantida no arquivo `Dona_Palha_atualizado.backup.html`.
2. **Migração Automática do LocalStorage:** Ao iniciar, o `storageService` verifica a existência da chave legada `donapalha:v1`. Caso detectada, migra automaticamente todos os sabores, vendas e custos para o novo padrão sem apagar o histórico anterior.
3. **Migração para Supabase em 1 Clique:** No menu de Conta/Nuvem (canto superior direito no Hero), o usuário pode clicar em **"Sincronizar com Nuvem Agora"** para fazer o upload completo do histórico local para o banco PostgreSQL seguro do Supabase.
4. **Exportação/Importação JSON:** O usuário pode a qualquer momento baixar um arquivo JSON com o backup integral de seus dados ou restaurar uma cópia.
