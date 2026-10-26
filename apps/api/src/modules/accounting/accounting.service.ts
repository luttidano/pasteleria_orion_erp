import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { CreateAccountingMovementDto } from './dto/create-accounting-movement.dto';

@Injectable()
export class AccountingService {
  private readonly supabase: SupabaseClient;

  constructor(private readonly configService: ConfigService) {
    const supabaseUrl =
      this.configService.get<string>('SUPABASE_URL') ||
      this.configService.get<string>('VITE_SUPABASE_URL') ||
      process.env.SUPABASE_URL ||
      process.env.VITE_SUPABASE_URL;
    const serviceRoleKey =
      this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY') ||
      process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error(
        'Falta SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el entorno de la API.',
      );
    }

    // La clave de servicio solo se utiliza en el backend.
    this.supabase = createClient(supabaseUrl, serviceRoleKey);
  }

  async findAccounts() {
    const { data, error } = await this.supabase
      .from('accounting_account')
      .select('id, code, name, account_type, is_active')
      .eq('is_active', true)
      .order('code', { ascending: true });

    if (error) {
      console.error('[AccountingService] Error consultando cuentas:', error.message);
      throw new InternalServerErrorException('No se pudieron consultar las cuentas contables.');
    }

    return (data ?? []).map((account) => ({
      id: account.id,
      code: account.code,
      name: account.name,
      accountType: account.account_type,
      isActive: account.is_active,
    }));
  }

  async findMovements() {
    const { data, error } = await this.supabase
      .from('accounting_movement')
      .select('id, movement_number, movement_date, concept, movement_type, account_id, amount, origin, pos_sale_id, payment_method, created_at')
      .order('movement_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) {
      console.error('[AccountingService] Error consultando movimientos:', error.message);
      throw new InternalServerErrorException('No se pudieron consultar los movimientos contables.');
    }

    const accountIds = [...new Set((data ?? []).map((movement) => movement.account_id))];
    let accountsById = new Map<string, { code: string; name: string }>();

    if (accountIds.length) {
      const { data: accounts, error: accountsError } = await this.supabase
        .from('accounting_account')
        .select('id, code, name')
        .in('id', accountIds);

      if (accountsError) {
        console.error('[AccountingService] Error consultando nombres de cuentas:', accountsError.message);
        throw new InternalServerErrorException('No se pudieron cargar las cuentas de los movimientos.');
      }

      accountsById = new Map(
        (accounts ?? []).map((account) => [account.id, { code: account.code, name: account.name }]),
      );
    }

    // El método de pago vive en la venta del POS; se consulta por separado
    // para mostrarlo en el Libro Diario sin duplicar datos contables.
    const posSaleIds = [...new Set(
      (data ?? [])
        .filter((movement) => movement.origin === 'pos' && movement.pos_sale_id)
        .map((movement) => movement.pos_sale_id as string),
    )];
    let paymentMethodBySaleId = new Map<string, string>();

    if (posSaleIds.length) {
      const { data: sales, error: salesError } = await this.supabase
        .from('pos_sale')
        .select('id, payment_method')
        .in('id', posSaleIds);

      if (salesError) {
        console.error('[AccountingService] Error consultando métodos de pago POS:', salesError.message);
        throw new InternalServerErrorException('No se pudieron cargar los métodos de pago de las ventas.');
      }

      paymentMethodBySaleId = new Map(
        (sales ?? []).map((sale) => [sale.id, sale.payment_method as string]),
      );
    }

    return (data ?? []).map((movement) => {
      const account = accountsById.get(movement.account_id);
      return {
        id: movement.id,
        movementNumber: movement.movement_number,
        date: movement.movement_date,
        concept: movement.concept,
        category: movement.movement_type,
        accountId: movement.account_id,
        account: account ? `${account.code} - ${account.name}` : 'Cuenta no disponible',
        amount: Number(movement.amount),
        origin: movement.origin,
        posSaleId: movement.pos_sale_id,
        paymentMethod: movement.pos_sale_id
          ? paymentMethodBySaleId.get(movement.pos_sale_id) ?? movement.payment_method ?? null
          : movement.payment_method ?? null,
        createdAt: movement.created_at,
      };
    });
  }

  async createMovement(dto: CreateAccountingMovementDto) {
    const concept = dto.concept.trim();
    if (!concept) {
      throw new BadRequestException('El concepto del movimiento es obligatorio.');
    }

    const { data: account, error: accountError } = await this.supabase
      .from('accounting_account')
      .select('id, code, name, is_active')
      .eq('id', dto.accountId)
      .maybeSingle();

    if (accountError) {
      console.error('[AccountingService] Error validando cuenta:', accountError.message);
      throw new InternalServerErrorException('No se pudo validar la cuenta contable.');
    }
    if (!account || !account.is_active) {
      throw new NotFoundException('La cuenta contable seleccionada no existe o está inactiva.');
    }

    const { data, error } = await this.supabase
      .from('accounting_movement')
      .insert({
        movement_date: dto.movementDate,
        concept,
        movement_type: dto.movementType,
        account_id: dto.accountId,
        amount: Math.round(dto.amount * 100) / 100,
        payment_method: dto.paymentMethod,
        origin: 'manual',
        pos_sale_id: null,
      })
      .select('id, movement_number, movement_date, concept, movement_type, account_id, amount, origin, pos_sale_id, payment_method, created_at')
      .single();

    if (error || !data) {
      console.error('[AccountingService] Error creando movimiento:', error?.message);
      throw new InternalServerErrorException('No se pudo registrar el movimiento contable.');
    }

    return {
      id: data.id,
      movementNumber: data.movement_number,
      date: data.movement_date,
      concept: data.concept,
      category: data.movement_type,
      accountId: data.account_id,
      account: `${account.code} - ${account.name}`,
      amount: Number(data.amount),
      origin: data.origin,
      posSaleId: data.pos_sale_id,
      paymentMethod: data.payment_method,
      createdAt: data.created_at,
    };
  }
}
