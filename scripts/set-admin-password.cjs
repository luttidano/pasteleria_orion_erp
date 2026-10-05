#!/usr/bin/env node
/**
 * Script administrativo para restablecer o definir la contraseña de un usuario en Supabase.
 * Uso:
 *   node scripts/set-admin-password.cjs <nueva_contraseña> [email]
 *
 * Ejemplo:
 *   node scripts/set-admin-password.cjs Admin1234
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require(path.join(__dirname, '../apps/web/node_modules/@supabase/supabase-js'));

const envPath = path.join(__dirname, '../.env');
if (!fs.existsSync(envPath)) {
  console.error('❌ Error: No se encontró el archivo .env en la raíz del proyecto.');
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf-8');
const getEnv = (key) => {
  const match = envContent.match(new RegExp(`^${key}="?([^"\\r\\n]+)"?`, 'm'));
  return match ? match[1].trim() : '';
};

const supabaseUrl = getEnv('VITE_SUPABASE_URL');
const serviceKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');

if (!supabaseUrl || !serviceKey) {
  console.error('❌ Error: VITE_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY no están configuradas en .env');
  process.exit(1);
}

const newPassword = process.argv[2];
const targetEmail = (process.argv[3] || 'admin@admin.cl').trim().toLowerCase();

if (!newPassword) {
  console.log('📌 Uso: node scripts/set-admin-password.cjs <nueva_contraseña> [email]');
  console.log('Ejemplo: node scripts/set-admin-password.cjs MiPassword123');
  process.exit(0);
}

if (newPassword.length < 6) {
  console.error('❌ La contraseña debe tener al menos 6 caracteres.');
  process.exit(1);
}

async function main() {
  const adminClient = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log(`🔍 Buscando usuario "${targetEmail}" en Supabase Auth...`);
  const { data: usersData, error: listError } = await adminClient.auth.admin.listUsers();
  if (listError) {
    console.error('❌ Error al listar usuarios:', listError.message);
    process.exit(1);
  }

  const user = usersData.users.find((u) => u.email?.toLowerCase() === targetEmail);

  if (!user) {
    console.log(`⚠️ El usuario ${targetEmail} no existe. Creándolo ahora...`);
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email: targetEmail,
      password: newPassword,
      email_confirm: true,
      user_metadata: { name: 'admin', role: 'admin' },
    });

    if (createError) {
      console.error('❌ Error al crear usuario:', createError.message);
      process.exit(1);
    }

    console.log(`✅ Usuario creado exitosamente con ID: ${newUser.user.id}`);
  } else {
    console.log(`🔄 Actualizando contraseña para el usuario ID: ${user.id}...`);
    const { error: updateError } = await adminClient.auth.admin.updateUserById(user.id, {
      password: newPassword,
      email_confirm: true,
    });

    if (updateError) {
      console.error('❌ Error al actualizar contraseña:', updateError.message);
      process.exit(1);
    }

    console.log(`✅ Contraseña actualizada correctamente para ${targetEmail}`);
  }

  // Asegurar rol en public.profiles
  try {
    const { data: profile } = await adminClient
      .from('profiles')
      .select('id, role')
      .eq('email', targetEmail)
      .maybeSingle();

    if (profile && profile.role !== 'admin') {
      await adminClient.from('profiles').update({ role: 'admin' }).eq('id', profile.id);
      console.log('✅ Rol de administrador asegurado en tabla profiles.');
    }
  } catch (err) {
    // Silently continue
  }

  console.log('\n🎉 ¡Listo! Ahora tu compañero y tú pueden iniciar sesión con:');
  console.log(`   📧 Correo:     ${targetEmail}`);
  console.log(`   🔑 Contraseña: ${newPassword}`);
}

main().catch((err) => {
  console.error('❌ Error inesperado:', err);
  process.exit(1);
});
