-- ====================================================================
-- SCHEMA COMPLETO E SEGURO DO SISTEMA DONA PALHA
-- Suporta autenticação Supabase, RLS, integridade de cálculos e estoque
-- ====================================================================

-- 1. EXTENSÕES NECESSÁRIAS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. TABELA DE PERFIS DE USUÁRIO
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  business_name TEXT DEFAULT 'Dona Palha',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. TABELA DE SABORES (PRODUTOS)
CREATE TABLE IF NOT EXISTS public.flavors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price_cents INTEGER NOT NULL DEFAULT 0 CHECK (price_cents >= 0),
  cost_cents INTEGER NOT NULL DEFAULT 0 CHECK (cost_cents >= 0),
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  tone TEXT NOT NULL DEFAULT 'lav',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. TABELA DE CUSTOS E INSUMOS (COMPRAS)
CREATE TABLE IF NOT EXISTS public.costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'g',
  qty NUMERIC NOT NULL CHECK (qty > 0),
  total_cents INTEGER NOT NULL CHECK (total_cents >= 0),
  unit_cost_cents INTEGER NOT NULL DEFAULT 0 CHECK (unit_cost_cents >= 0),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. TABELA DE PRODUÇÃO (FORNADAS)
CREATE TABLE IF NOT EXISTS public.productions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  flavor_id UUID NOT NULL REFERENCES public.flavors(id) ON DELETE RESTRICT,
  flavor_name TEXT NOT NULL,
  qty INTEGER NOT NULL CHECK (qty > 0),
  batch_cost_cents INTEGER NOT NULL CHECK (batch_cost_cents >= 0),
  unit_cost_cents INTEGER NOT NULL CHECK (unit_cost_cents >= 0),
  selling_price_cents INTEGER NOT NULL CHECK (selling_price_cents >= 0),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. INGREDIENTES UTILIZADOS NA FORNADA
CREATE TABLE IF NOT EXISTS public.production_ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  production_id UUID NOT NULL REFERENCES public.productions(id) ON DELETE CASCADE,
  cost_id UUID REFERENCES public.costs(id) ON DELETE SET NULL,
  item_name TEXT NOT NULL,
  qty_used NUMERIC NOT NULL CHECK (qty_used > 0),
  unit_cost_cents INTEGER NOT NULL CHECK (unit_cost_cents >= 0),
  total_cost_cents INTEGER NOT NULL CHECK (total_cost_cents >= 0),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. TABELA DE VENDAS (PRESERVA CUSTO HISTÓRICO)
CREATE TABLE IF NOT EXISTS public.sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  flavor_id UUID NOT NULL REFERENCES public.flavors(id) ON DELETE RESTRICT,
  flavor_name TEXT NOT NULL,
  qty INTEGER NOT NULL CHECK (qty > 0),
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  cost_cents INTEGER NOT NULL CHECK (cost_cents >= 0),
  client TEXT,
  phone TEXT,
  method TEXT NOT NULL DEFAULT 'Pix',
  notes TEXT,
  paid BOOLEAN NOT NULL DEFAULT TRUE,
  due_date DATE,
  paid_at DATE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. TABELA DE MOVIMENTAÇÕES DE ESTOQUE (HISTÓRICO COMPLETO)
CREATE TABLE IF NOT EXISTS public.stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  flavor_id UUID NOT NULL REFERENCES public.flavors(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('production_in', 'sale_out', 'sale_cancel_in', 'loss', 'adjustment_in', 'adjustment_out')),
  delta INTEGER NOT NULL,
  previous_stock INTEGER NOT NULL,
  new_stock INTEGER NOT NULL CHECK (new_stock >= 0),
  unit_cost_cents INTEGER NOT NULL DEFAULT 0,
  reference_id UUID,
  reference_type TEXT,
  reason TEXT,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ====================================================================
-- ÍNDICES PARA PERFORMANCE
-- ====================================================================
CREATE INDEX IF NOT EXISTS idx_flavors_user ON public.flavors(user_id);
CREATE INDEX IF NOT EXISTS idx_costs_user_date ON public.costs(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_sales_user_date ON public.sales(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_sales_user_paid ON public.sales(user_id, paid);
CREATE INDEX IF NOT EXISTS idx_productions_user ON public.productions(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_prod_ing_prod_id ON public.production_ingredients(production_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_flavor ON public.stock_movements(flavor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_movements_user ON public.stock_movements(user_id, date DESC);

-- ====================================================================
-- ROW LEVEL SECURITY (RLS) - SEGURANÇA TOTAL POR USUÁRIO
-- ====================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flavors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.productions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

-- Políticas para profiles
CREATE POLICY "Usuário acessa seu próprio perfil" ON public.profiles
  FOR ALL USING (auth.uid() = id);

-- Políticas para flavors
CREATE POLICY "Usuário gerencia seus próprios sabores" ON public.flavors
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Políticas para costs
CREATE POLICY "Usuário gerencia seus próprios custos" ON public.costs
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Políticas para productions
CREATE POLICY "Usuário gerencia suas produções" ON public.productions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Políticas para production_ingredients
CREATE POLICY "Usuário gerencia ingredientes de suas produções" ON public.production_ingredients
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.productions p
      WHERE p.id = production_ingredients.production_id AND p.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.productions p
      WHERE p.id = production_ingredients.production_id AND p.user_id = auth.uid()
    )
  );

-- Políticas para sales
CREATE POLICY "Usuário gerencia suas vendas" ON public.sales
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Políticas para stock_movements
CREATE POLICY "Usuário visualiza suas movimentações de estoque" ON public.stock_movements
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ====================================================================
-- FUNÇÕES POSTGRESQL ATÔMICAS PARA GARANTIR INTEGRIDADE
-- ====================================================================

-- Função para registrar venda com validação de estoque negativo e preservação de histórico
CREATE OR REPLACE FUNCTION public.execute_sale(
  p_flavor_id UUID,
  p_qty INTEGER,
  p_price_cents INTEGER,
  p_client TEXT,
  p_phone TEXT,
  p_method TEXT,
  p_notes TEXT,
  p_paid BOOLEAN,
  p_due_date DATE,
  p_paid_at DATE,
  p_date DATE
) RETURNS UUID AS $$
DECLARE
  v_flavor RECORD;
  v_sale_id UUID;
  v_user_id UUID := auth.uid();
  v_new_stock INTEGER;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  IF p_qty <= 0 THEN
    RAISE EXCEPTION 'A quantidade vendida deve ser maior que zero';
  END IF;

  -- Bloqueia a linha do sabor para evitar condição de corrida em vendas simultâneas
  SELECT * INTO v_flavor FROM public.flavors
  WHERE id = p_flavor_id AND user_id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sabor não encontrado ou não pertence ao usuário';
  END IF;

  IF v_flavor.stock < p_qty THEN
    RAISE EXCEPTION 'Estoque insuficiente: há % un disponível(is), tentou vender % un', v_flavor.stock, p_qty;
  END IF;

  v_new_stock := v_flavor.stock - p_qty;

  -- Atualiza o estoque do sabor
  UPDATE public.flavors
  SET stock = v_new_stock, updated_at = NOW()
  WHERE id = p_flavor_id;

  -- Insere a venda com snapshot do custo atual
  INSERT INTO public.sales (
    user_id, flavor_id, flavor_name, qty, price_cents, cost_cents,
    client, phone, method, notes, paid, due_date, paid_at, date
  ) VALUES (
    v_user_id, p_flavor_id, v_flavor.name, p_qty, p_price_cents, v_flavor.cost_cents,
    p_client, p_phone, p_method, p_notes, p_paid, p_due_date, p_paid_at, p_date
  ) RETURNING id INTO v_sale_id;

  -- Registra a movimentação de saída no histórico de estoque
  INSERT INTO public.stock_movements (
    user_id, flavor_id, type, delta, previous_stock, new_stock,
    unit_cost_cents, reference_id, reference_type, reason, date
  ) VALUES (
    v_user_id, p_flavor_id, 'sale_out', -p_qty, v_flavor.stock, v_new_stock,
    v_flavor.cost_cents, v_sale_id, 'sale', 'Venda realizada', p_date
  );

  RETURN v_sale_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para registrar produção e atualizar custo médio ponderado
CREATE OR REPLACE FUNCTION public.execute_production(
  p_flavor_id UUID,
  p_qty INTEGER,
  p_batch_cost_cents INTEGER,
  p_date DATE,
  p_notes TEXT,
  p_ingredients JSONB
) RETURNS UUID AS $$
DECLARE
  v_flavor RECORD;
  v_prod_id UUID;
  v_user_id UUID := auth.uid();
  v_old_stock INTEGER;
  v_new_stock INTEGER;
  v_old_cost_cents INTEGER;
  v_unit_batch_cost_cents INTEGER;
  v_new_avg_cost_cents INTEGER;
  v_ing RECORD;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  IF p_qty <= 0 THEN
    RAISE EXCEPTION 'A quantidade produzida deve ser maior que zero';
  END IF;

  SELECT * INTO v_flavor FROM public.flavors
  WHERE id = p_flavor_id AND user_id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sabor não encontrado';
  END IF;

  v_old_stock := v_flavor.stock;
  v_old_cost_cents := v_flavor.cost_cents;
  v_new_stock := v_old_stock + p_qty;
  v_unit_batch_cost_cents := ROUND(p_batch_cost_cents::NUMERIC / p_qty);

  -- Cálculo do custo médio ponderado
  IF v_old_stock > 0 THEN
    v_new_avg_cost_cents := ROUND(((v_old_stock * v_old_cost_cents) + p_batch_cost_cents)::NUMERIC / v_new_stock);
  ELSE
    v_new_avg_cost_cents := v_unit_batch_cost_cents;
  END IF;

  -- Atualiza o sabor com novo estoque e novo custo médio
  UPDATE public.flavors
  SET stock = v_new_stock,
      cost_cents = v_new_avg_cost_cents,
      updated_at = NOW()
  WHERE id = p_flavor_id;

  -- Insere o registro de produção
  INSERT INTO public.productions (
    user_id, flavor_id, flavor_name, qty, batch_cost_cents,
    unit_cost_cents, selling_price_cents, date, notes
  ) VALUES (
    v_user_id, p_flavor_id, v_flavor.name, p_qty, p_batch_cost_cents,
    v_unit_batch_cost_cents, v_flavor.price_cents, p_date, p_notes
  ) RETURNING id INTO v_prod_id;

  -- Registra os ingredientes utilizados a partir do JSONB
  IF p_ingredients IS NOT NULL AND jsonb_array_length(p_ingredients) > 0 THEN
    FOR v_ing IN SELECT * FROM jsonb_to_recordset(p_ingredients) AS x(
      cost_id UUID, item_name TEXT, qty_used NUMERIC, unit_cost_cents INTEGER, total_cost_cents INTEGER
    ) LOOP
      INSERT INTO public.production_ingredients (
        production_id, cost_id, item_name, qty_used, unit_cost_cents, total_cost_cents
      ) VALUES (
        v_prod_id, v_ing.cost_id, v_ing.item_name, v_ing.qty_used, v_ing.unit_cost_cents, v_ing.total_cost_cents
      );
    END LOOP;
  END IF;

  -- Movimentação de estoque de entrada
  INSERT INTO public.stock_movements (
    user_id, flavor_id, type, delta, previous_stock, new_stock,
    unit_cost_cents, reference_id, reference_type, reason, date
  ) VALUES (
    v_user_id, p_flavor_id, 'production_in', p_qty, v_old_stock, v_new_stock,
    v_unit_batch_cost_cents, v_prod_id, 'production', 'Produção de fornada', p_date
  );

  RETURN v_prod_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para cancelamento/exclusão de venda com devolução de estoque
CREATE OR REPLACE FUNCTION public.cancel_sale(p_sale_id UUID) RETURNS BOOLEAN AS $$
DECLARE
  v_sale RECORD;
  v_flavor RECORD;
  v_user_id UUID := auth.uid();
  v_new_stock INTEGER;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  SELECT * INTO v_sale FROM public.sales
  WHERE id = p_sale_id AND user_id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Venda não encontrada';
  END IF;

  SELECT * INTO v_flavor FROM public.flavors
  WHERE id = v_sale.flavor_id AND user_id = v_user_id
  FOR UPDATE;

  IF FOUND THEN
    v_new_stock := v_flavor.stock + v_sale.qty;
    UPDATE public.flavors SET stock = v_new_stock, updated_at = NOW() WHERE id = v_flavor.id;

    INSERT INTO public.stock_movements (
      user_id, flavor_id, type, delta, previous_stock, new_stock,
      unit_cost_cents, reference_id, reference_type, reason, date
    ) VALUES (
      v_user_id, v_flavor.id, 'sale_cancel_in', v_sale.qty, v_flavor.stock, v_new_stock,
      v_sale.cost_cents, p_sale_id, 'sale_cancel', 'Estorno de venda cancelada', CURRENT_DATE
    );
  END IF;

  DELETE FROM public.sales WHERE id = p_sale_id;
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para ajuste manual de estoque (perdas, quebras ou correções de inventário)
CREATE OR REPLACE FUNCTION public.adjust_stock(
  p_flavor_id UUID,
  p_delta INTEGER,
  p_type TEXT,
  p_reason TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  v_flavor RECORD;
  v_user_id UUID := auth.uid();
  v_new_stock INTEGER;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  IF p_type NOT IN ('loss', 'adjustment_in', 'adjustment_out') THEN
    RAISE EXCEPTION 'Tipo de ajuste inválido';
  END IF;

  SELECT * INTO v_flavor FROM public.flavors
  WHERE id = p_flavor_id AND user_id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sabor não encontrado';
  END IF;

  v_new_stock := v_flavor.stock + p_delta;
  IF v_new_stock < 0 THEN
    RAISE EXCEPTION 'O estoque não pode ficar negativo';
  END IF;

  UPDATE public.flavors SET stock = v_new_stock, updated_at = NOW() WHERE id = p_flavor_id;

  INSERT INTO public.stock_movements (
    user_id, flavor_id, type, delta, previous_stock, new_stock,
    unit_cost_cents, reason, date
  ) VALUES (
    v_user_id, p_flavor_id, p_type, p_delta, v_flavor.stock, v_new_stock,
    v_flavor.cost_cents, p_reason, CURRENT_DATE
  );

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Gatilho para criar perfil automaticamente no cadastro Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, business_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', 'Empreendedor'), 'Dona Palha');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

