import React, { useState } from 'react';
import { Eye, EyeOff, Mail, Lock, ArrowRight, Phone, Box } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/auth-store';
import { getUserProfile } from '../../lib/supabase';
import { router } from '../../lib/router';

// Microsoft and Google SVG Icons
const MicrosoftIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    <rect x="1" y="1" width="8" height="8" fill="#F25022"/>
    <rect x="11" y="1" width="8" height="8" fill="#7FBA00"/>
    <rect x="1" y="11" width="8" height="8" fill="#00A4EF"/>
    <rect x="11" y="11" width="8" height="8" fill="#FFB900"/>
  </svg>
);

const GoogleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    <path d="M19.6 10.23c0-.82-.1-1.42-.25-2.05H10v3.72h5.5c-.15.96-.74 2.38-2.13 3.34v2.66h3.44c2.01-1.85 3.19-4.58 3.19-7.67z" fill="#4285F4"/>
    <path d="M10 20c2.7 0 4.96-.89 6.61-2.4l-3.44-2.66c-.9.6-2.06 1.03-3.17 1.03-2.44 0-4.5-1.64-5.24-3.85H1.3v2.75A9.99 9.99 0 0010 20z" fill="#34A853"/>
    <path d="M4.76 11.12c-.18-.6-.28-1.24-.28-1.9s.1-1.3.28-1.9V4.57H1.3A9.99 9.99 0 000 10c0 1.61.39 3.14 1.3 4.43l3.46-2.31z" fill="#FBBC05"/>
    <path d="M10 3.98c1.35 0 2.56.46 3.51 1.36l2.64-2.64C14.96.89 12.7 0 10 0 6.09 0 2.72 2.25 1.3 5.57l3.46 2.75c.74-2.21 2.8-3.85 5.24-3.85z" fill="#EA4335"/>
  </svg>
);

export default function Login() {
  const { setAuth, setError, setLoading } = useAuthStore();
  const [emailOrPhone, setEmailOrPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setLoginError(null);
    setError(null);
    
    try {
      // Check if Supabase is configured
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      console.log('Environment variables check:', {
        url: supabaseUrl,
        urlLength: supabaseUrl?.length,
        hasKey: !!supabaseAnonKey,
        keyLength: supabaseAnonKey?.length,
        keyStart: supabaseAnonKey?.substring(0, 20)
      });
      
      if (!supabaseUrl || !supabaseAnonKey || supabaseUrl.includes('placeholder')) {
        const isProduction = import.meta.env.PROD;
        const errorMessage = isProduction
          ? 'Supabase no está configurado en Vercel. Por favor:\n1. Ve a tu proyecto en Vercel\n2. Settings > Environment Variables\n3. Agrega VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY\n4. Selecciona todos los ambientes (Production, Preview, Development)\n5. Guarda y redesplega la aplicación'
          : 'Supabase no está configurado. Por favor, configura las variables de entorno VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en un archivo .env.local y REINICIA el servidor de desarrollo.';
        
        console.error('Supabase configuration error:', {
          hasUrl: !!supabaseUrl,
          hasKey: !!supabaseAnonKey,
          urlValue: supabaseUrl || 'MISSING',
          isProduction,
        });
        
        setLoginError(errorMessage);
        setIsLoading(false);
        return;
      }

      // Sign in with Supabase
      console.log('Attempting to sign in with Supabase...', {
        url: supabaseUrl,
        hasKey: !!supabaseAnonKey,
        email: emailOrPhone
      });
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email: emailOrPhone, // Supabase uses email, not phone
        password: password,
      });

      console.log('Supabase sign in response:', { data, error });

      if (error) {
        console.error('Supabase auth error:', error);
        throw error;
      }

      if (data.user && data.session) {
        // Set basic user immediately for fast navigation
        setAuth(
          {
            id: data.user.id,
            email: data.user.email || '',
            name: data.user.user_metadata?.name || data.user.email || '',
            role: 'user',
          },
          data.session.access_token
        );

        // Navigate immediately
        router.navigate('/dashboard', true);

        // Background enrich profile (no await)
        getUserProfile(data.user.id)
          .then((profile) => {
            if (!profile) return;
            useAuthStore.getState().updateUser({
              name: profile.name || data.user?.email || '',
              role: (profile.role as 'user' | 'admin') || 'user',
              department: profile.department,
              position: profile.position,
            });
          })
          .catch(() => {});
      }
    } catch (error: any) {
      let errorMessage = 'Failed to sign in';
      
      console.error('Login error:', error);
      
      if (error?.message) {
        errorMessage = error.message;
      } else if (error?.toString().includes('Failed to fetch') || error?.toString().includes('NetworkError')) {
        errorMessage = 'No se pudo conectar con Supabase. Verifica:\n1. Que tu proyecto de Supabase esté activo\n2. Que las credenciales en .env.local sean correctas\n3. Que no haya problemas de red o CORS';
      } else if (error?.code === 'PGRST301' || error?.message?.includes('JWT')) {
        errorMessage = 'Error de autenticación con Supabase. Verifica que tu anon key sea correcta.';
      } else if (error?.code === 'invalid_credentials' || error?.message?.includes('Invalid login')) {
        errorMessage = 'Email o contraseña incorrectos.';
      }
      
      setLoginError(errorMessage);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleO365Login = async () => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseAnonKey || supabaseUrl.includes('placeholder')) {
      setLoginError('Supabase no está configurado. Por favor, configura las variables de entorno.');
      return;
    }

    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'azure',
        options: {
          redirectTo: `${window.location.origin}/dashboard`,
        },
      });
      
      if (error) throw error;
    } catch (error: any) {
      setLoginError(error.message || 'Failed to sign in with Microsoft');
    }
  };

  const handleGoogleLogin = async () => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseAnonKey || supabaseUrl.includes('placeholder')) {
      setLoginError('Supabase no está configurado. Por favor, configura las variables de entorno.');
      return;
    }

    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/dashboard`,
        },
      });
      
      if (error) throw error;
    } catch (error: any) {
      setLoginError(error.message || 'Failed to sign in with Google');
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-md">
          {/* Mobile Header */}
          <div className="lg:hidden text-center mb-8">
            <div className="mx-auto mb-4 flex items-center justify-center gap-2">
              <Box size={32} style={{ color: 'var(--primary-brand-hex)' }} />
              <span className="text-2xl font-semibold text-gray-900">WAPunch</span>
            </div>
          </div>

          {/* Login Form */}
          <div className="bg-white border border-gray-200 rounded-lg py-6 px-6 shadow-card">
            <div className="mb-6">
              <h2 className="text-2xl font-semibold text-foreground mb-2">Sign In</h2>
              <p className="text-muted-foreground">Enter your credentials to access your company portal</p>
              {loginError && (
                <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                  {loginError}
                </div>
              )}
            </div>


            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email or Phone Input */}
              <div>
                <label htmlFor="emailOrPhone" className="block text-sm font-medium text-foreground mb-2">
                  Email or Phone
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    id="emailOrPhone"
                    type="text"
                    value={emailOrPhone}
                    onChange={(e) => setEmailOrPhone(e.target.value)}
                    className="w-full pl-10 pr-3 h-8 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary/20 focus:border-primary/50"
                    placeholder="Enter your email or phone number"
                    required
                  />
                </div>
              </div>

              {/* Password Input */}
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-foreground mb-2">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-10 h-8 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary/20 focus:border-primary/50"
                    placeholder="Enter your password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Remember Me & Forgot Password */}
              <div className="flex items-center justify-between">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-1 focus:ring-primary/20"
                  />
                  <span className="ml-2 text-sm text-muted-foreground">Remember me</span>
                </label>
                {/* Forgot Password - Available for both login types */}
                <button
                  type="button"
                  onClick={() => window.location.href = '/reset-password'}
                  className="text-sm text-primary hover:text-primary/80 transition-colors"
                >
                  Forgot password?
                </button>
              </div>

              {/* Login Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 px-4 h-8 rounded text-white transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: 'var(--primary-brand-hex)' }}
              >
                {isLoading ? (
                  <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    Sign In
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            {/* Divider and Social Login */}
            <div className="my-6">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-muted-foreground">Or continue with</span>
                </div>
              </div>
            </div>

            {/* Social Login Buttons */}
            <div className="space-y-3">
                  <button
                    onClick={handleO365Login}
                    className="w-full flex items-center justify-center gap-2 px-4 h-8 border border-gray-300 rounded text-sm text-foreground hover:bg-gray-50 transition-colors"
                  >
                    <MicrosoftIcon />
                    Microsoft
                  </button>

                  <button
                    onClick={handleGoogleLogin}
                    className="w-full flex items-center justify-center gap-2 px-4 h-8 border border-gray-300 rounded text-sm text-foreground hover:bg-gray-50 transition-colors"
                  >
                    <GoogleIcon />
                    Google
                  </button>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center mt-6">
            <p className="text-sm text-muted-foreground">
              Don't have a user account?{' '}
              <button 
                onClick={() => window.location.href = '/signup'}
                className="text-primary hover:text-primary/80 transition-colors"
              >
                Sign up
              </button>
              {' '}or contact your administrator, or{' '}
              <button 
                onClick={() => window.location.href = '/company-registration'}
                className="text-primary hover:text-primary/80 transition-colors"
              >
                register your company
              </button>
              {' '}to create a new portal.
            </p>
          </div>
        </div>
      </div>

      {/* Right Side - Graphite Black Background */}
      <div className="hidden lg:flex lg:w-1/2 items-center justify-center p-12" style={{ backgroundColor: 'var(--gray-950)' }}>
        <div className="max-w-md text-center text-white">
          <div className="mb-8">
            <div className="mx-auto mb-6 flex items-center justify-center gap-3">
              <Box size={48} style={{ color: 'var(--primary-brand-hex)' }} />
              <span className="text-4xl font-semibold text-white">WAPunch</span>
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}
