import { IsOptional, IsString, IsIn } from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsIn(['admin', 'baker', 'cashier'], { message: 'Rol inválido' })
  role?: 'admin' | 'baker' | 'cashier';
}
