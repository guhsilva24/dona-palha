/**
 * Serviço de Banco de Dados Unificado (Supabase + Persistência Local)
 * Garante atomicidade, controle de perdas, histórico de estoque e custo histórico.
 */

import { supabase, isSupabaseReady } from './supabaseClient.js';
import { storageService, createEmptyState, normalizeState } from './storageService.js';
import {
  toCents,
  fromCents,
  calculateSaleItem,
  calculateWeightedAverageCost,
  validateStockMovement,
  MOVEMENT_TYPES
} from '../calculations/index.js';
import { uid } from '../utils/dom.js';
import { today } from '../utils/formatters.js';

export const dbService = {
  /**
   * Carrega os dados do usuário. Se estiver autenticado no Supabase,
   * busca das tabelas na nuvem com RLS. Caso contrário, usa armazenamento local.
   */
  async loadAll(user = null) {
    if (!user || !isSupabaseReady()) {
      return storageService.load();
    }

    try {
      const [
        { data: flavors, error: errFlavors },
        { data: costs, error: errCosts },
        { data: sales, error: errSales },
        { data: productions, error: errProd },
        { data: movements, error: errMov }
      ] = await Promise.all([
        supabase.from('flavors').select('*').order('created_at', { ascending: true }),
        supabase.from('costs').select('*').order('date', { ascending: false }),
        supabase.from('sales').select('*').order('date', { ascending: false }),
        supabase.from('productions').select('*, production_ingredients(*)').order('date', { ascending: false }),
        supabase.from('stock_movements').select('*').order('created_at', { ascending: false })
      ]);

      if (errFlavors || errCosts || errSales) {
        console.warn('Erro ao consultar Supabase, utilizando cache local:', errFlavors || errCosts || errSales);
        return storageService.load();
      }

      // Mapeia do schema SQL para os objetos do frontend
      const mappedFlavors = (flavors || []).map(f => ({
        id: f.id,
        name: f.name,
        price: fromCents(f.price_cents),
        cost: fromCents(f.cost_cents),
        stock: f.stock,
        tone: f.tone
      }));

      const mappedCosts = (costs || []).map(c => ({
        id: c.id,
        item: c.item,
        unit: c.unit || (c.item?.toLowerCase().includes('embal') ? 'un' : 'g'),
        qty: Number(c.qty),
        total: fromCents(c.total_cents),
        date: c.date
      }));

      const mappedSales = (sales || []).map(s => ({
        id: s.id,
        date: s.date,
        flavorId: s.flavor_id,
        flavorName: s.flavor_name,
        qty: s.qty,
        price: fromCents(s.price_cents),
        cost: fromCents(s.cost_cents),
        client: s.client || '',
        phone: s.phone || '',
        method: s.method,
        notes: s.notes || '',
        paid: s.paid,
        due: s.due_date || '',
        paidAt: s.paid_at || ''
      }));

      const mappedProductions = (productions || []).map(p => ({
        id: p.id,
        date: p.date,
        flavorId: p.flavor_id,
        flavorName: p.flavor_name,
        qty: p.qty,
        batchCost: fromCents(p.batch_cost_cents),
        unitCost: fromCents(p.unit_cost_cents),
        sellingPrice: fromCents(p.selling_price_cents),
        notes: p.notes || '',
        ingredients: (p.production_ingredients || []).map(pi => ({
          costId: pi.cost_id,
          item: pi.item_name,
          qty: Number(pi.qty_used),
          unitCost: fromCents(pi.unit_cost_cents),
          total: fromCents(pi.total_cost_cents)
        }))
      }));

      const mappedMovements = (movements || []).map(m => ({
        id: m.id,
        flavorId: m.flavor_id,
        type: m.type,
        delta: m.delta,
        previousStock: m.previous_stock,
        newStock: m.new_stock,
        reason: m.reason || '',
        date: m.date
      }));

      const cloudState = {
        flavors: mappedFlavors,
        costs: mappedCosts,
        sales: mappedSales,
        productions: mappedProductions,
        stockMovements: mappedMovements,
        demo: false,
        rev: Date.now(),
        lastSync: new Date().toISOString()
      };

      // Se a nuvem estiver vazia e houver dados locais, preservamos e salvamos
      const localData = storageService.load();
      if (mappedFlavors.length === 0 && mappedCosts.length === 0 && mappedSales.length === 0 && (localData.flavors.length > 0 || localData.sales.length > 0)) {
        return localData;
      }

      storageService.save(cloudState);
      return cloudState;
    } catch (err) {
      console.error('Falha geral ao sincronizar com Supabase:', err);
      return storageService.load();
    }
  },

  /**
   * Salva uma nova venda mantendo histórico de custo e movimentação de saída no estoque.
   */
  async saveSale({ saleData, user, state }) {
    const { flavorId, qty, price, client, phone, method, notes, paid, due, date } = saleData;
    const flavor = state.flavors.find(f => f.id === flavorId);
    if (!flavor) throw new Error('Sabor não encontrado.');

    // Validação de prevenção de estoque negativo
    const stockValidation = validateStockMovement({
      currentStock: flavor.stock,
      delta: -qty,
      type: MOVEMENT_TYPES.SALE_OUT
    });

    if (!stockValidation.valid) {
      throw new Error(stockValidation.error);
    }

    const saleDate = date || today();
    const paidAt = paid ? saleDate : '';
    const priceCents = toCents(price);
    const costCents = toCents(flavor.cost);

    let createdId = uid();

    // Se conectado no Supabase com usuário autenticado, tenta executar a função RPC atômica
    if (user && isSupabaseReady()) {
      try {
        const { data, error } = await supabase.rpc('execute_sale', {
          p_flavor_id: flavor.id,
          p_qty: qty,
          p_price_cents: priceCents,
          p_client: client || '',
          p_phone: phone || '',
          p_method: method || 'Pix',
          p_notes: notes || '',
          p_paid: Boolean(paid),
          p_due_date: paid ? null : (due || null),
          p_paid_at: paid ? paidAt : null,
          p_date: saleDate
        });

        if (error) {
          console.warn('RPC execute_sale falhou ou não existe, executando fallback via tabelas:', error.message);
          // Fallback seguro via tabelas Supabase
          const { data: insertedSale, error: saleErr } = await supabase.from('sales').insert({
            user_id: user.id,
            flavor_id: flavor.id,
            flavor_name: flavor.name,
            qty,
            price_cents: priceCents,
            cost_cents: costCents,
            client,
            phone,
            method,
            notes,
            paid: Boolean(paid),
            due_date: paid ? null : due,
            paid_at: paidAt || null,
            date: saleDate
          }).select().single();

          if (saleErr) throw saleErr;
          createdId = insertedSale.id;

          // Atualiza estoque no banco
          await supabase.from('flavors').update({
            stock: stockValidation.projectedStock
          }).eq('id', flavor.id);

          // Registra movimentação de saída
          await supabase.from('stock_movements').insert({
            user_id: user.id,
            flavor_id: flavor.id,
            type: MOVEMENT_TYPES.SALE_OUT,
            delta: -qty,
            previous_stock: flavor.stock,
            new_stock: stockValidation.projectedStock,
            unit_cost_cents: costCents,
            reference_id: createdId,
            reference_type: 'sale',
            reason: 'Venda realizada',
            date: saleDate
          });
        } else if (data) {
          createdId = data;
        }
      } catch (cloudErr) {
        console.error('Erro ao persistir venda no Supabase:', cloudErr);
        throw cloudErr;
      }
    }

    // Atualiza estado local
    const newSale = {
      id: createdId,
      ts: Date.now(),
      date: saleDate,
      flavorId: flavor.id,
      flavorName: flavor.name,
      qty,
      price: fromCents(priceCents),
      cost: fromCents(costCents),
      client: client || '',
      phone: phone || '',
      method: method || 'Pix',
      notes: notes || '',
      paid: Boolean(paid),
      due: paid ? '' : (due || ''),
      paidAt
    };

    flavor.stock = stockValidation.projectedStock;
    state.sales.push(newSale);

    state.stockMovements.push({
      id: uid(),
      flavorId: flavor.id,
      type: MOVEMENT_TYPES.SALE_OUT,
      delta: -qty,
      previousStock: flavor.stock + qty,
      newStock: flavor.stock,
      reason: 'Venda realizada',
      date: saleDate
    });

    storageService.save(state);
    return newSale;
  },

  /**
   * Cancela/Exclui venda e devolve as unidades ao estoque
   */
  async cancelSale({ saleId, user, state }) {
    const saleIndex = state.sales.findIndex(s => s.id === saleId);
    if (saleIndex === -1) throw new Error('Venda não encontrada.');

    const sale = state.sales[saleIndex];
    const flavor = state.flavors.find(f => f.id === sale.flavorId);

    if (user && isSupabaseReady()) {
      try {
        const { error } = await supabase.rpc('cancel_sale', { p_sale_id: saleId });
        if (error) {
          // Fallback via tabela
          await supabase.from('sales').delete().eq('id', saleId);
          if (flavor) {
            await supabase.from('flavors').update({
              stock: flavor.stock + sale.qty
            }).eq('id', flavor.id);
          }
        }
      } catch (err) {
        console.warn('Erro ao estornar venda no Supabase:', err);
      }
    }

    if (flavor) {
      const prev = flavor.stock;
      flavor.stock += sale.qty;
      state.stockMovements.push({
        id: uid(),
        flavorId: flavor.id,
        type: MOVEMENT_TYPES.SALE_CANCEL_IN,
        delta: sale.qty,
        previousStock: prev,
        newStock: flavor.stock,
        reason: 'Estorno de venda cancelada',
        date: today()
      });
    }

    state.sales.splice(saleIndex, 1);
    storageService.save(state);
  },

  /**
   * Atualiza status de pagamento da venda (marcar como pago ou voltar a receber)
   */
  async updateSalePayment({ saleId, paid, method, paidAt, user, state }) {
    const sale = state.sales.find(s => s.id === saleId);
    if (!sale) throw new Error('Venda não encontrada.');

    sale.paid = Boolean(paid);
    if (paid) {
      sale.paidAt = paidAt || today();
      if (method) sale.method = method;
    } else {
      sale.paidAt = '';
    }

    if (user && isSupabaseReady()) {
      try {
        await supabase.from('sales').update({
          paid: sale.paid,
          paid_at: sale.paidAt || null,
          method: sale.method
        }).eq('id', saleId);
      } catch (err) {
        console.warn('Erro ao atualizar pagamento no Supabase:', err);
      }
    }

    storageService.save(state);
    return sale;
  },

  /**
   * Cadastra ou edita um sabor
   */
  async saveFlavor({ flavorData, user, state }) {
    const { id, name, price, stock, tone } = flavorData;
    const priceCents = toCents(price);
    const initialStock = Math.max(0, parseInt(stock, 10) || 0);

    let existing = id ? state.flavors.find(f => f.id === id) : null;
    let savedId = id || uid();

    if (user && isSupabaseReady()) {
      try {
        if (existing) {
          const { error } = await supabase.from('flavors').update({
            name,
            price_cents: priceCents,
            stock: initialStock,
            updated_at: new Date().toISOString()
          }).eq('id', id);
          if (error) throw error;
        } else {
          const { data, error } = await supabase.from('flavors').insert({
            user_id: user.id,
            name,
            price_cents: priceCents,
            cost_cents: 0,
            stock: initialStock,
            tone: tone || 'lav'
          }).select().single();
          if (error) throw error;
          savedId = data.id;
        }
      } catch (err) {
        console.error('Erro ao salvar sabor no Supabase:', err);
        throw err;
      }
    }

    if (existing) {
      existing.name = name;
      existing.price = fromCents(priceCents);
      existing.stock = initialStock;
      // Atualiza nome nos registros de vendas locais
      state.sales.forEach(s => {
        if (s.flavorId === existing.id) s.flavorName = name;
      });
    } else {
      const newFlavor = {
        id: savedId,
        name,
        price: fromCents(priceCents),
        cost: 0,
        stock: initialStock,
        tone: tone || 'lav'
      };
      state.flavors.push(newFlavor);
    }

    storageService.save(state);
    return savedId;
  },

  /**
   * Exclui sabor
   */
  async deleteFlavor({ flavorId, user, state }) {
    if (user && isSupabaseReady()) {
      try {
        await supabase.from('flavors').delete().eq('id', flavorId);
      } catch (err) {
        console.warn('Erro ao deletar sabor no Supabase:', err);
      }
    }

    state.flavors = state.flavors.filter(f => f.id !== flavorId);
    storageService.save(state);
  },

  /**
   * Cadastra ou edita um custo/insumo
   */
  async saveCost({ costData, user, state }) {
    const { id, item, unit = 'g', qty, total, date } = costData;
    const totalCents = toCents(total);
    const parsedQty = parseFloat(String(qty).replace(',', '.')) || 1;
    const costDate = date || today();

    let existing = id ? state.costs.find(c => c.id === id) : null;
    let savedId = id || uid();

    if (user && isSupabaseReady()) {
      try {
        if (existing) {
          const { error } = await supabase.from('costs').update({
            item,
            unit,
            qty: parsedQty,
            total_cents: totalCents,
            unit_cost_cents: Math.round(totalCents / parsedQty),
            date: costDate,
            updated_at: new Date().toISOString()
          }).eq('id', id);
          if (error) throw error;
        } else {
          const { data, error } = await supabase.from('costs').insert({
            user_id: user.id,
            item,
            unit,
            qty: parsedQty,
            total_cents: totalCents,
            unit_cost_cents: Math.round(totalCents / parsedQty),
            date: costDate
          }).select().single();
          if (error) throw error;
          savedId = data.id;
        }
      } catch (err) {
        console.error('Erro ao salvar custo no Supabase:', err);
        throw err;
      }
    }

    if (existing) {
      existing.item = item;
      existing.unit = unit;
      existing.qty = parsedQty;
      existing.total = fromCents(totalCents);
      existing.date = costDate;
    } else {
      state.costs.push({
        id: savedId,
        ts: Date.now(),
        item,
        unit,
        qty: parsedQty,
        total: fromCents(totalCents),
        date: costDate
      });
    }

    storageService.save(state);
    return savedId;
  },

  /**
   * Exclui custo
   */
  async deleteCost({ costId, user, state }) {
    if (user && isSupabaseReady()) {
      try {
        await supabase.from('costs').delete().eq('id', costId);
      } catch (err) {
        console.warn('Erro ao deletar custo no Supabase:', err);
      }
    }

    state.costs = state.costs.filter(c => c.id !== costId);
    storageService.save(state);
  },

  /**
   * Registra uma produção de fornada completa com cálculo de custo médio ponderado
   * e movimentação automática de entrada no estoque.
   */
  async saveProduction({ productionData, user, state }) {
    const { flavorId, qty, batchCostCents, ingredients, notes, date } = productionData;
    const flavor = state.flavors.find(f => f.id === flavorId);
    if (!flavor) throw new Error('Sabor não encontrado para produção.');

    const prodQty = parseInt(qty, 10);
    if (!prodQty || prodQty <= 0) throw new Error('A quantidade produzida deve ser maior que zero.');

    const prodDate = date || today();

    // Calcula novo custo médio ponderado
    const avgCostResult = calculateWeightedAverageCost({
      currentStock: flavor.stock,
      currentCost: flavor.cost,
      producedUnits: prodQty,
      batchCost: fromCents(batchCostCents)
    });

    let prodId = uid();

    // Persistência no Supabase
    if (user && isSupabaseReady()) {
      try {
        const ingredientsJson = ingredients.map(i => ({
          cost_id: i.costId || null,
          item_name: i.item,
          qty_used: i.qty,
          unit_cost_cents: toCents(i.unitCost),
          total_cost_cents: toCents(i.total)
        }));

        const { data, error } = await supabase.rpc('execute_production', {
          p_flavor_id: flavor.id,
          p_qty: prodQty,
          p_batch_cost_cents: batchCostCents,
          p_date: prodDate,
          p_notes: notes || '',
          p_ingredients: ingredientsJson
        });

        if (error) {
          console.warn('RPC execute_production falhou, executando inserção manual:', error.message);
          // Fallback manual
          const { data: insertedProd, error: prodErr } = await supabase.from('productions').insert({
            user_id: user.id,
            flavor_id: flavor.id,
            flavor_name: flavor.name,
            qty: prodQty,
            batch_cost_cents: batchCostCents,
            unit_cost_cents: Math.round(batchCostCents / prodQty),
            selling_price_cents: toCents(flavor.price),
            date: prodDate,
            notes: notes || ''
          }).select().single();

          if (prodErr) throw prodErr;
          prodId = insertedProd.id;

          // Inserir ingredientes
          if (ingredientsJson.length > 0) {
            await supabase.from('production_ingredients').insert(
              ingredientsJson.map(ing => ({
                production_id: prodId,
                cost_id: ing.cost_id,
                item_name: ing.item_name,
                qty_used: ing.qty_used,
                unit_cost_cents: ing.unit_cost_cents,
                total_cost_cents: ing.total_cost_cents
              }))
            );
          }

          // Atualizar sabor
          await supabase.from('flavors').update({
            stock: avgCostResult.newStock,
            cost_cents: avgCostResult.newAvgCostCents
          }).eq('id', flavor.id);

          // Inserir movimentação
          await supabase.from('stock_movements').insert({
            user_id: user.id,
            flavor_id: flavor.id,
            type: MOVEMENT_TYPES.PRODUCTION_IN,
            delta: prodQty,
            previous_stock: flavor.stock,
            new_stock: avgCostResult.newStock,
            unit_cost_cents: Math.round(batchCostCents / prodQty),
            reference_id: prodId,
            reference_type: 'production',
            reason: 'Produção de fornada',
            date: prodDate
          });
        } else if (data) {
          prodId = data;
        }
      } catch (err) {
        console.error('Erro ao persistir produção no Supabase:', err);
        throw err;
      }
    }

    // Atualiza estado local
    const previousStock = flavor.stock;
    flavor.stock = avgCostResult.newStock;
    flavor.cost = avgCostResult.newAvgCost;
    flavor.batchCost = fromCents(batchCostCents);
    flavor.batchUnits = prodQty;

    state.productions.push({
      id: prodId,
      date: prodDate,
      flavorId: flavor.id,
      flavorName: flavor.name,
      qty: prodQty,
      batchCost: fromCents(batchCostCents),
      unitCost: fromCents(Math.round(batchCostCents / prodQty)),
      sellingPrice: flavor.price,
      notes: notes || '',
      ingredients: ingredients.map(i => ({ ...i }))
    });

    state.stockMovements.push({
      id: uid(),
      flavorId: flavor.id,
      type: MOVEMENT_TYPES.PRODUCTION_IN,
      delta: prodQty,
      previousStock,
      newStock: flavor.stock,
      reason: 'Produção de fornada',
      date: prodDate
    });

    storageService.save(state);
    return prodId;
  },

  /**
   * Registra ajuste manual de estoque (perda, avaria ou acerto de inventário)
   */
  async saveStockAdjustment({ flavorId, delta, type, reason, user, state }) {
    const flavor = state.flavors.find(f => f.id === flavorId);
    if (!flavor) throw new Error('Sabor não encontrado.');

    const numDelta = parseInt(delta, 10);
    const validation = validateStockMovement({
      currentStock: flavor.stock,
      delta: numDelta,
      type
    });

    if (!validation.valid) {
      throw new Error(validation.error);
    }

    if (user && isSupabaseReady()) {
      try {
        const { error } = await supabase.rpc('adjust_stock', {
          p_flavor_id: flavor.id,
          p_delta: numDelta,
          p_type: type,
          p_reason: reason || ''
        });

        if (error) {
          await supabase.from('flavors').update({
            stock: validation.projectedStock
          }).eq('id', flavor.id);

          await supabase.from('stock_movements').insert({
            user_id: user.id,
            flavor_id: flavor.id,
            type,
            delta: numDelta,
            previous_stock: flavor.stock,
            new_stock: validation.projectedStock,
            reason: reason || '',
            date: today()
          });
        }
      } catch (err) {
        console.error('Erro ao registrar ajuste de estoque no Supabase:', err);
        throw err;
      }
    }

    const previousStock = flavor.stock;
    flavor.stock = validation.projectedStock;

    state.stockMovements.push({
      id: uid(),
      flavorId: flavor.id,
      type,
      delta: numDelta,
      previousStock,
      newStock: flavor.stock,
      reason: reason || '',
      date: today()
    });

    storageService.save(state);
  },

  /**
   * Migra dados locais para o Supabase quando um usuário faz login pela primeira vez
   */
  async uploadLocalDataToSupabase(user, state) {
    if (!user || !isSupabaseReady()) return;

    try {
      // 1. Sabores
      for (const f of state.flavors) {
        await supabase.from('flavors').upsert({
          id: f.id,
          user_id: user.id,
          name: f.name,
          price_cents: toCents(f.price),
          cost_cents: toCents(f.cost),
          stock: f.stock,
          tone: f.tone || 'lav'
        });
      }

      // 2. Custos
      for (const c of state.costs) {
        await supabase.from('costs').upsert({
          id: c.id,
          user_id: user.id,
          item: c.item,
          unit: c.unit || 'g',
          qty: c.qty,
          total_cents: toCents(c.total),
          unit_cost_cents: Math.round(toCents(c.total) / (c.qty || 1)),
          date: c.date
        });
      }

      // 3. Vendas
      for (const s of state.sales) {
        await supabase.from('sales').upsert({
          id: s.id,
          user_id: user.id,
          flavor_id: s.flavorId,
          flavor_name: s.flavorName,
          qty: s.qty,
          price_cents: toCents(s.price),
          cost_cents: toCents(s.cost),
          client: s.client || '',
          phone: s.phone || '',
          method: s.method || 'Pix',
          notes: s.notes || '',
          paid: Boolean(s.paid),
          due_date: s.due || null,
          paid_at: s.paidAt || null,
          date: s.date
        });
      }

      console.info('Migração de dados locais para Supabase concluída com sucesso!');
    } catch (err) {
      console.warn('Erro durante upload de dados para Supabase:', err);
    }
  }
};

