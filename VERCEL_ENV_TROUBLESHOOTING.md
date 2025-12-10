# Solución de Problemas: Variables de Entorno en Vercel

Si ves el mensaje "Supabase no está configurado en Vercel", sigue estos pasos:

## ✅ Verificación Paso a Paso

### 1. Verifica que las Variables Estén Configuradas

1. Ve a [vercel.com](https://vercel.com) y selecciona tu proyecto
2. Ve a **Settings** → **Environment Variables**
3. Debes ver estas dos variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

### 2. Verifica los Valores

**Para `VITE_SUPABASE_URL`:**
- Debe ser: `https://xxxxx.supabase.co`
- NO debe tener espacios al inicio o final
- Debe comenzar con `https://`
- Debe terminar con `.supabase.co`

**Para `VITE_SUPABASE_ANON_KEY`:**
- Debe ser un JWT token largo que comienza con `eyJ`
- NO debe tener espacios al inicio o final
- NO uses la "secret key" (solo para backend)
- Usa la "anon" o "publishable" key

### 3. Verifica los Ambientes

Cada variable debe estar habilitada para:
- ✅ **Production** (muy importante)
- ✅ **Preview**
- ✅ **Development**

**Cómo verificar:**
- Haz clic en cada variable
- Verifica que los checkboxes de Production, Preview y Development estén marcados
- Si no están marcados, márcalos y guarda

### 4. Redesplegar DESPUÉS de Agregar Variables

**⚠️ MUY IMPORTANTE:** Las variables de Vite se inyectan en tiempo de BUILD, no en tiempo de ejecución.

Si agregaste las variables después del último deploy:

1. Ve a **Deployments**
2. Haz clic en los tres puntos (⋯) del último deployment
3. Selecciona **Redeploy**
4. Espera a que termine el deploy

**O simplemente haz un nuevo push:**
```bash
git commit --allow-empty -m "Trigger redeploy for env vars"
git push
```

### 5. Verificar en la Consola del Navegador

1. Abre tu aplicación en Vercel
2. Abre la consola del navegador (F12 → Console)
3. Intenta hacer login
4. Busca el log: `Environment variables check:`
5. Verifica:
   - `url` debe tener tu URL de Supabase (no "MISSING")
   - `hasKey` debe ser `true`
   - `keyLength` debe ser un número grande (más de 100)

## 🔍 Debugging Avanzado

Si después de seguir todos los pasos sigue sin funcionar:

### Verifica los Logs del Build en Vercel

1. Ve a **Deployments**
2. Haz clic en el último deployment
3. Revisa los **Build Logs**
4. Busca si hay algún error relacionado con las variables de entorno

### Verifica que el Proyecto de Supabase Esté Activo

1. Ve a [supabase.com](https://supabase.com)
2. Selecciona tu proyecto
3. Verifica que NO esté pausado
4. Si está pausado, haz clic en "Restore"

### Prueba las Credenciales Localmente

1. Crea un archivo `.env.local` en tu proyecto local
2. Agrega las mismas credenciales que pusiste en Vercel:
   ```env
   VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
   VITE_SUPABASE_ANON_KEY=tu-anon-key
   ```
3. Ejecuta `npm run dev`
4. Intenta hacer login
5. Si funciona localmente pero no en Vercel, el problema es la configuración en Vercel

## 📝 Checklist Final

Antes de reportar un problema, verifica:

- [ ] Las variables están en Vercel Settings → Environment Variables
- [ ] Los nombres son exactamente: `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`
- [ ] Los valores son correctos (sin espacios, URLs completas)
- [ ] Están habilitadas para Production, Preview y Development
- [ ] Redesplegaste DESPUÉS de agregar las variables
- [ ] El proyecto de Supabase está activo (no pausado)
- [ ] Revisaste la consola del navegador para ver los logs

## 🆘 Si Nada Funciona

1. Elimina las variables en Vercel
2. Vuelve a agregarlas desde cero
3. Verifica que los valores sean correctos
4. Asegúrate de seleccionar todos los ambientes
5. Guarda
6. Redesplega
7. Espera a que termine el deploy completamente
8. Prueba de nuevo

