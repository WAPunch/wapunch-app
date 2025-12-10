# Configurar Variables de Entorno en Vercel

Para que la aplicación funcione en Vercel, necesitas configurar las variables de entorno de Supabase.

## Pasos para Configurar en Vercel:

### 1. Obtener las Credenciales de Supabase

Si aún no las tienes, sigue estos pasos:

1. Ve a [supabase.com](https://supabase.com) e inicia sesión
2. Selecciona tu proyecto (o crea uno nuevo)
3. Ve a **Settings** (⚙️) en el menú lateral
4. Haz clic en **API** en el submenú
5. Copia estos valores:
   - **Project URL** (formato: `https://xxxxx.supabase.co`)
   - **anon public** key (una cadena larga que comienza con `eyJ`)

### 2. Configurar en Vercel Dashboard

1. Ve a tu proyecto en [vercel.com](https://vercel.com)
2. Haz clic en **Settings** en el menú superior
3. En el menú lateral, haz clic en **Environment Variables**
4. Agrega las siguientes variables:

   **Variable 1:**
   - Name: `VITE_SUPABASE_URL`
   - Value: `https://tu-proyecto-id.supabase.co` (tu Project URL)
   - Environments: Selecciona **Production**, **Preview**, y **Development**

   **Variable 2:**
   - Name: `VITE_SUPABASE_ANON_KEY`
   - Value: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (tu anon key)
   - Environments: Selecciona **Production**, **Preview**, y **Development**

5. Haz clic en **Save** para cada variable

### 3. Redesplegar la Aplicación

Después de agregar las variables de entorno:

1. Ve a la pestaña **Deployments** en Vercel
2. Haz clic en los tres puntos (⋯) del último deployment
3. Selecciona **Redeploy**
4. O simplemente haz un nuevo push a tu repositorio

### 4. Verificar que Funciona

Una vez que el deploy termine:

1. Abre tu aplicación en Vercel
2. Intenta hacer login
3. Deberías poder autenticarte correctamente

## ⚠️ Notas Importantes:

- **NO** uses el "service_role" key en el frontend (es secreto y solo para backend)
- Solo usa el "anon" o "public" key
- El Project URL debe comenzar con `https://` y terminar con `.supabase.co`
- Las variables de entorno en Vercel son diferentes a las de `.env.local` local
- Después de agregar las variables, **debes redesplegar** para que surtan efecto

## Solución de Problemas:

Si después de configurar las variables aún no funciona:

1. Verifica que los nombres de las variables sean exactamente:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

2. Verifica que estén habilitadas para el ambiente correcto (Production/Preview/Development)

3. Asegúrate de haber redesplegado después de agregar las variables

4. Revisa los logs del deployment en Vercel para ver si hay errores

