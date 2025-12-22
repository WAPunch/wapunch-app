import React, { useState } from 'react';
import { Eye, EyeOff, Mail, Lock, ArrowRight, Phone, MessageCircleCode, User } from 'lucide-react';
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

export default function Signup() {
  const { setAuth, setError } = useAuthStore();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [signupError, setSignupError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      setSignupError('Passwords do not match');
      return;
    }
    
    if (password.length < 6) {
      setSignupError('Password must be at least 6 characters');
      return;
    }
    
    setIsLoading(true);
    setSignupError(null);
    setError(null);
    
    try {
      // Check if Supabase is configured
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      if (!supabaseUrl || !supabaseAnonKey || supabaseUrl.includes('placeholder')) {
        setSignupError(
          'Supabase no está configurado. Por favor, configura las variables de entorno VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en un archivo .env.local'
        );
        setIsLoading(false);
        return;
      }

      // Sign up with Supabase
      console.log('Attempting to sign up with Supabase...', {
        url: supabaseUrl,
        hasKey: !!supabaseAnonKey,
        email: email
      });
      
      const { data, error } = await supabase.auth.signUp({
        email: email,
        password: password,
        options: {
          data: {
            name: name,
            phone: phone,
          },
        },
      });

      console.log('Supabase sign up response:', { data, error });

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
            name: name || data.user.email || '',
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
              name: profile.name || name || data.user?.email || '',
              role: (profile.role as 'user' | 'admin') || 'user',
              department: profile.department,
              position: profile.position,
            });
          })
          .catch(() => {});
      }
    } catch (error: any) {
      let errorMessage = 'Failed to sign up';
      
      console.error('Signup error:', error);
      
      if (error?.message) {
        errorMessage = error.message;
      } else if (error?.toString().includes('Failed to fetch') || error?.toString().includes('NetworkError')) {
        errorMessage = 'No se pudo conectar con Supabase. Verifica:\n1. Que tu proyecto de Supabase esté activo (no pausado)\n2. Que las credenciales en .env.local sean correctas\n3. Que hayas reiniciado el servidor después de crear .env.local\n4. Que no haya problemas de red o CORS';
      } else if (error?.code === 'PGRST301' || error?.message?.includes('JWT')) {
        errorMessage = 'Error de autenticación con Supabase. Verifica que tu anon key sea correcta.';
      } else if (error?.message?.includes('User already registered')) {
        errorMessage = 'Este email ya está registrado. Intenta hacer login en su lugar.';
      }
      
      setSignupError(errorMessage);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleO365Login = async () => {
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'azure',
        options: {
          redirectTo: `${window.location.origin}/dashboard`,
        },
      });
      
      if (error) throw error;
    } catch (error: any) {
      setSignupError(error.message || 'Failed to sign in with Microsoft');
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/dashboard`,
        },
      });
      
      if (error) throw error;
    } catch (error: any) {
      setSignupError(error.message || 'Failed to sign in with Google');
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Signup Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-md">
          {/* Mobile Header */}
          <div className="lg:hidden text-center mb-8">
            <div className="mx-auto mb-4 flex items-center justify-center gap-2">
              <MessageCircleCode size={32} style={{ color: 'var(--primary-brand-hex)' }} />
              <span className="text-2xl font-semibold text-gray-900">WAPunch</span>
            </div>
          </div>

          {/* Signup Form */}
          <div className="bg-white border border-gray-200 rounded-lg py-6 px-6 shadow-card">
            <div className="mb-6">
              <h2 className="text-2xl font-semibold text-foreground mb-2">Sign Up</h2>
              <p className="text-muted-foreground">Create your account to access your company portal</p>
              {signupError && (
                <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                  {signupError}
                </div>
              )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Name Input */}
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-foreground mb-2">
                  Full Name
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-10 pr-3 h-8 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary/20 focus:border-primary/50"
                    placeholder="Enter your full name"
                    required
                  />
                </div>
              </div>

              {/* Email Input */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-foreground mb-2">
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-3 h-8 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary/20 focus:border-primary/50"
                    placeholder="Enter your email"
                    required
                  />
                </div>
              </div>

              {/* Phone Input */}
              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-foreground mb-2">
                  Phone Number
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full pl-10 pr-3 h-8 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary/20 focus:border-primary/50"
                    placeholder="Enter your phone number"
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

              {/* Confirm Password Input */}
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-foreground mb-2">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    id="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-10 pr-10 h-8 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary/20 focus:border-primary/50"
                    placeholder="Confirm your password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Signup Button */}
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
                    Sign Up
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
              Already have an account?{' '}
              <button 
                onClick={() => window.location.href = '/login'}
                className="text-primary hover:text-primary/80 transition-colors"
              >
                Sign in
              </button>
            </p>
          </div>
        </div>
      </div>

      {/* Right Side - Graphite Black Background */}
      <div className="hidden lg:flex lg:w-1/2 items-center justify-center p-12" style={{ backgroundColor: 'var(--gray-950)' }}>
        <div className="max-w-md text-center text-white">
          <div className="mb-8">
            <div className="mx-auto mb-6 flex items-center justify-center gap-3">
              <MessageCircleCode size={48} style={{ color: 'var(--primary-brand-hex)' }} />
              <span className="text-4xl font-semibold text-white">WAPunch</span>
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}

