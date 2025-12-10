import { createClient } from '@supabase/supabase-js';
import { logger } from './logger';

// Get environment variables
// Note: Supabase now uses "publishable key" instead of "anon key", but they work the same way
const getSupabaseConfig = () => {
  const url = import.meta.env.VITE_SUPABASE_URL || '';
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';
  
  // Log in both dev and production for debugging
  const envInfo = {
    url: url || 'MISSING',
    hasKey: !!key,
    keyLength: key?.length || 0,
    keyStart: key?.substring(0, 20) || 'N/A',
    isProduction: import.meta.env.PROD,
    allEnvKeys: Object.keys(import.meta.env).filter(k => k.startsWith('VITE_'))
  };
  
  console.log('🔧 Supabase config loaded:', envInfo);
  
  return { url, key };
};

const { url: supabaseUrl, key: supabaseAnonKey } = getSupabaseConfig();

// Create Supabase client (will work even if env vars are missing, but auth won't work)
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key',
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  }
);

// Warn if environment variables are missing
if (!supabaseUrl || !supabaseAnonKey || supabaseUrl.includes('placeholder')) {
  const isProduction = import.meta.env.PROD;
  const message = isProduction
    ? '⚠️ Supabase environment variables are missing in production!\n' +
      'Please configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Vercel:\n' +
      '1. Go to your Vercel project settings\n' +
      '2. Navigate to Environment Variables\n' +
      '3. Add both variables for Production, Preview, and Development\n' +
      '4. Redeploy your application'
    : '⚠️ Supabase environment variables are missing!\n' +
      'Please create a .env.local file with:\n' +
      'VITE_SUPABASE_URL=your-project-url\n' +
      'VITE_SUPABASE_ANON_KEY=your-publishable-key\n\n' +
      'Get these from your Supabase project settings (Settings > API)\n' +
      'Use the "publishable" key (not the "secret" key)';
  
  console.warn(message);
  logger.warn('Missing Supabase environment variables', {
    hasUrl: !!supabaseUrl,
    hasKey: !!supabaseAnonKey,
    urlValue: supabaseUrl ? `${supabaseUrl.substring(0, 20)}...` : 'MISSING',
    isProduction,
  });
}

// Helper function to get current user
export const getCurrentUser = async () => {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) throw error;
    return user;
  } catch (error) {
    logger.error('Error getting current user', error instanceof Error ? error : new Error(String(error)));
    return null;
  }
};

// Helper function to get user profile
export const getUserProfile = async (userId: string) => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    logger.error('Error getting user profile', error instanceof Error ? error : new Error(String(error)));
    return null;
  }
};

