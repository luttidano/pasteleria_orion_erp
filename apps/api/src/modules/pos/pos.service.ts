import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { CreateSaleDto } from './dto/create-sale.dto';

@Injectable()
export class PosService {
  private readonly supabase: SupabaseClient;

  constructor(private readonly configService: ConfigService) {
    const supabaseUrl =
      this.configService.get<string>('SUPABASE_URL') ||
      this.configService.get<string>('VITE_SUPABASE_URL') ||
      process.env.SUPABASE_URL ||
      process.env.VITE_SUPABASE_URL;

    // Esta clave es exclusivamente para el backend.
    // No utilizar VITE_SUPABASE_ANON_KEY como sustituto.
    const serviceRoleKey =
      this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY') ||
      process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error(
        'Falta SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el entorno de la API.',
      );
    }

    this.supabase = createClient(supabaseUrl, serviceRoleKey);
  }

  /**
   * Registra una venta y sus productos.
   */
  async createSale(dto: CreateSaleDto) {
    if (!dto.items?.length) {
      throw new BadRequestException(
        'La venta debe contener al menos un producto.',
      );
    }

    // Los precios enviados por el navegador no se consideran confiables.
    // Calculamos el total a partir de las líneas de la venta.
    const items = dto.items.map((item) => {
      const lineTotal = this.roundMoney(item.quantity * item.unitPrice);

      return {
        product_id: item.productId ?? null,
        product_name: item.productName.trim(),
        quantity: item.quantity,
        unit_price: item.unitPrice,
        line_total: lineTotal,
      };
    });

    if (items.some((item) => !item.product_name)) {
      throw new BadRequestException(
        'Todos los productos deben tener un nombre.',
      );
    }

    const itemsTotal = this.roundMoney(
      items.reduce((sum, item) => sum + item.line_total, 0),
    );

    const declaredTotal = this.roundMoney(dto.total);
    const declaredSubtotal = this.roundMoney(dto.subtotal);
    const declaredTax = this.roundMoney(dto.taxAmount);

    if (Math.abs(itemsTotal - declaredTotal) > 0.01) {
      throw new BadRequestException(
        'El total de la venta no coincide con el total de sus productos.',
      );
    }

    if (
      Math.abs(
        this.roundMoney(declaredSubtotal + declaredTax) - declaredTotal,
      ) > 0.01
    ) {
      throw new BadRequestException(
        'El subtotal más el impuesto debe coincidir con el total.',
      );
    }

    // El ticket se genera en el servidor para evitar depender
    // del número que envíe el navegador.
    const ticketNumber = `TK-${Date.now()}-${randomUUID()
      .slice(0, 6)
      .toUpperCase()}`;

    // 1. Guardar la cabecera.
    const { data: sale, error: saleError } = await this.supabase
      .from('pos_sale')
      .insert({
        ticket_number: ticketNumber,
        payment_method: dto.paymentMethod,
        subtotal: declaredSubtotal,
        tax_amount: declaredTax,
        total: declaredTotal,
        status: 'completada',
        sold_at: new Date().toISOString(),
        data_origin: 'demo',
      })
      .select()
      .single();

    if (saleError || !sale) {
      console.error('[PosService] Error creando venta:', saleError?.message);

      throw new InternalServerErrorException(
        'No se pudo registrar la venta.',
      );
    }

    // 2. Guardar los productos relacionados con la venta.
    const saleItems = items.map((item) => ({
      ...item,
      sale_id: sale.id,
    }));

    const { data: savedItems, error: itemsError } = await this.supabase
      .from('pos_sale_item')
      .insert(saleItems)
      .select();

    if (itemsError || !savedItems) {
      console.error(
        '[PosService] Error guardando productos:',
        itemsError?.message,
      );

      // Intentar eliminar la cabecera si falló el detalle.
      // La FK ON DELETE CASCADE eliminará también sus detalles.
      const { error: rollbackError } = await this.supabase
        .from('pos_sale')
        .delete()
        .eq('id', sale.id);

      if (rollbackError) {
        console.error(
          '[PosService] No se pudo revertir la venta:',
          rollbackError.message,
        );
      }

      throw new InternalServerErrorException(
        'No se pudieron guardar los productos de la venta.',
      );
    }

    // 3. Registrar el ingreso contable asociado a esta venta.
    // Los movimientos contables exigen un monto positivo; una venta gratuita
    // queda registrada en el POS, pero no genera un ingreso de caja por $0.
    // La restricción única parcial sobre pos_sale_id evita duplicados.
    const accountingMovementCreated = declaredTotal > 0;
    if (accountingMovementCreated) {
      await this.createAccountingMovementForSale({
        id: sale.id,
        ticketNumber: sale.ticket_number,
        soldAt: sale.sold_at,
        total: declaredTotal,
      });
    }

    return {
      id: sale.id,
      ticketNumber: sale.ticket_number,
      paymentMethod: sale.payment_method,
      subtotal: Number(sale.subtotal),
      taxAmount: Number(sale.tax_amount),
      total: Number(sale.total),
      status: sale.status,
      soldAt: sale.sold_at,
      dataOrigin: sale.data_origin,
      accountingMovementCreated,
      items: savedItems,
    };
  }

  /**
   * Obtiene las últimas ventas guardadas.
   */
  async findAllSales() {
    const { data, error } = await this.supabase
      .from('pos_sale')
      .select('*, pos_sale_item(*)')
      .order('sold_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('[PosService] Error consultando ventas:', error.message);

      throw new InternalServerErrorException(
        'No se pudo consultar el historial de ventas.',
      );
    }

    return (data ?? []).map((sale) => ({
      id: sale.id,
      ticketNumber: sale.ticket_number,
      paymentMethod: sale.payment_method,
      subtotal: Number(sale.subtotal),
      taxAmount: Number(sale.tax_amount),
      total: Number(sale.total),
      status: sale.status,
      soldAt: sale.sold_at,
      dataOrigin: sale.data_origin,
      items: sale.pos_sale_item ?? [],
    }));
  }

  /**
   * Obtiene una venta específica con sus productos.
   */
  async findSaleById(id: string) {
    const { data, error } = await this.supabase
      .from('pos_sale')
      .select('*, pos_sale_item(*)')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('[PosService] Error consultando venta:', error.message);

      throw new InternalServerErrorException(
        'No se pudo consultar la venta.',
      );
    }

    if (!data) {
      throw new BadRequestException('La venta solicitada no existe.');
    }

    return {
      id: data.id,
      ticketNumber: data.ticket_number,
      paymentMethod: data.payment_method,
      subtotal: Number(data.subtotal),
      taxAmount: Number(data.tax_amount),
      total: Number(data.total),
      status: data.status,
      soldAt: data.sold_at,
      dataOrigin: data.data_origin,
      items: data.pos_sale_item ?? [],
    };
  }


  /**
   * Crea un único movimiento de ingreso por cada venta completada.
   * Se utiliza la cuenta 4101 (Ventas de Pastelería y Cafetería).
   */
  private async createAccountingMovementForSale(sale: {
    id: string;
    ticketNumber: string;
    soldAt: string;
    total: number;
  }): Promise<void> {
    // Comprobación previa para que la operación sea idempotente ante reintentos.
    const { data: existingMovement, error: existingError } = await this.supabase
      .from('accounting_movement')
      .select('id')
      .eq('pos_sale_id', sale.id)
      .maybeSingle();

    if (existingError) {
      console.error(
        '[PosService] No se pudo comprobar el movimiento contable:',
        existingError.message,
      );
      await this.rollbackSale(sale.id);
      throw new InternalServerErrorException(
        'No se pudo verificar el movimiento contable de la venta.',
      );
    }

    if (existingMovement) return;

    const { data: account, error: accountError } = await this.supabase
      .from('accounting_account')
      .select('id')
      .eq('code', '4101')
      .eq('is_active', true)
      .maybeSingle();

    if (accountError || !account) {
      console.error(
        '[PosService] No se encontró la cuenta contable 4101:',
        accountError?.message,
      );
      await this.rollbackSale(sale.id);
      throw new InternalServerErrorException(
        'No se pudo registrar la venta: falta la cuenta contable activa 4101.',
      );
    }

    const { error: movementError } = await this.supabase
      .from('accounting_movement')
      .insert({
        movement_date: sale.soldAt.slice(0, 10),
        concept: `Venta POS ${sale.ticketNumber}`,
        movement_type: 'ingreso',
        account_id: account.id,
        amount: Math.round(sale.total * 100) / 100,
        origin: 'pos',
        pos_sale_id: sale.id,
      });

    if (!movementError) return;

    // Si hubo una respuesta de red ambigua o una carrera concurrente, comprobamos
    // si la restricción única ya dejó creado el movimiento para esta venta.
    const { data: movementAfterError, error: verifyError } = await this.supabase
      .from('accounting_movement')
      .select('id')
      .eq('pos_sale_id', sale.id)
      .maybeSingle();

    if (!verifyError && movementAfterError) return;

    console.error(
      '[PosService] Error creando movimiento contable:',
      movementError.message,
    );
    await this.rollbackSale(sale.id);
    throw new InternalServerErrorException(
      'No se pudo registrar el ingreso contable de la venta. La operación fue revertida; vuelve a intentarlo.',
    );
  }

  /** Intenta revertir la venta si falla la contabilización. */
  private async rollbackSale(saleId: string): Promise<void> {
    const { error } = await this.supabase
      .from('pos_sale')
      .delete()
      .eq('id', saleId);

    if (error) {
      console.error(
        '[PosService] No se pudo revertir la venta tras un error contable:',
        error.message,
      );
    }
  }

  private roundMoney(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }
}