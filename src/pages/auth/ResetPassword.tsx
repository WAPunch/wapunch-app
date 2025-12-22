import React, { useState } from 'react';
import { ArrowLeft, Mail, CheckCircle, AlertCircle, Shield, Clock, Phone, MessageCircleCode } from 'lucide-react';

export default function ResetPassword() {
  const [emailOrPhone, setEmailOrPhone] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    
    // Simulate reset password process
    setTimeout(() => {
      setIsLoading(false);
      if (emailOrPhone) {
        setIsSubmitted(true);
      } else {
        setError('Please enter a valid email address or phone number');
      }
    }, 2000);
  };

  const handleBackToLogin = () => {
    // Navigate back to login
    window.history.back();
  };

  const handleResendEmail = () => {
    setIsSubmitted(false);
    setEmailOrPhone('');
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen flex">
        {/* Left Side - Success Form */}
        <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-white">
          <div className="w-full max-w-md">
            {/* Mobile Header */}
            <div className="lg:hidden text-center mb-8">
              <div className="mx-auto mb-4 flex items-center justify-center">
                <div className="flex items-center justify-center gap-2">
                  <MessageCircleCode size={32} style={{ color: 'var(--primary-brand-hex)' }} />
                  <span className="text-2xl font-semibold text-gray-900">WAPunch</span>
                </div>
              </div>
              <h1 className="text-2xl font-semibold text-foreground mb-2">
                Check Your Email
              </h1>
              <p className="text-muted-foreground">
                We've sent a password reset link to <strong>{emailOrPhone}</strong>
              </p>
            </div>

            {/* Success Form */}
            <div className="bg-white border border-gray-200 rounded-lg py-6 px-6 shadow-card">
            <div className="mb-6">
              <h2 className="text-2xl font-semibold text-foreground mb-2">Check Your Email</h2>
              <p className="text-muted-foreground">
                We've sent a password reset link to <strong>{emailOrPhone}</strong>
              </p>
            </div>

              {/* Instructions */}
              <div className="space-y-4 mb-6">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-semibold text-primary">1</span>
                  </div>
                  <div>
                    <p className="text-sm text-foreground font-medium">Check your email inbox</p>
                    <p className="text-xs text-muted-foreground">Look for an email from RHEMO</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-semibold text-primary">2</span>
                  </div>
                  <div>
                    <p className="text-sm text-foreground font-medium">Click the reset link</p>
                    <p className="text-xs text-muted-foreground">The link will expire in 24 hours</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-semibold text-primary">3</span>
                  </div>
                  <div>
                    <p className="text-sm text-foreground font-medium">Create a new password</p>
                    <p className="text-xs text-muted-foreground">Follow the security requirements</p>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3">
                <button
                  onClick={handleResendEmail}
                  className="w-full flex items-center justify-center gap-2 px-4 h-8 rounded text-white transition-colors text-sm"
                  style={{ backgroundColor: 'var(--primary-brand-hex)' }}
                >
                  Resend Email
                </button>
                
                <button
                  onClick={handleBackToLogin}
                  className="w-full flex items-center justify-center gap-2 px-4 h-8 bg-gray-200 text-gray-700 rounded text-sm hover:bg-gray-300 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to Login
                </button>
              </div>
            </div>

            {/* Help Text */}
            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                <Mail className="w-4 h-4" />
                <span>Didn't receive the email?</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Check your spam folder or contact your administrator if you continue to have issues.
              </p>
            </div>
          </div>
        </div>

        {/* Right Side - Graphite Black Background */}
        <div className="hidden lg:flex lg:w-1/2 items-center justify-center p-12" style={{ backgroundColor: 'var(--gray-950)' }}>
          <div className="max-w-md text-center text-white">
            <div className="mb-8">
              <div className="w-20 h-20 bg-green-500/20 backdrop-blur-sm rounded-2xl mx-auto mb-6 flex items-center justify-center">
                <CheckCircle className="w-10 h-10 text-green-400" />
              </div>
              <h1 className="text-4xl font-bold mb-4">Email Sent!</h1>
              <p className="text-xl text-white/80 leading-relaxed">
                We've sent a secure password reset link to your email address.
              </p>
            </div>
            
            <div className="space-y-4 text-left">
              <div className="flex items-center gap-3 text-white/90">
                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                <span>Secure password reset process</span>
              </div>
              <div className="flex items-center gap-3 text-white/90">
                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                <span>24-hour link expiration</span>
              </div>
              <div className="flex items-center gap-3 text-white/90">
                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                <span>Follow the instructions in your email</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Reset Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-md">
            {/* Mobile Header */}
            <div className="lg:hidden text-center mb-8">
              <div className="mx-auto mb-4 flex items-center justify-center">
                <div className="flex items-center justify-center gap-2">
                  <MessageCircleCode size={32} style={{ color: 'var(--primary-brand-hex)' }} />
                  <span className="text-2xl font-semibold text-gray-900">WAPunch</span>
                </div>
              </div>
          </div>

          {/* Reset Form */}
          <div className="bg-white border border-gray-200 rounded-lg py-6 px-6 shadow-card">
            <div className="mb-6">
              <h2 className="text-2xl font-semibold text-foreground mb-2">Reset Password</h2>
              <p className="text-muted-foreground">Enter your credentials and we'll send you a secure reset link</p>
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

              {/* Error Message */}
              {error && (
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <AlertCircle className="w-4 h-4" />
                  {error}
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 px-4 h-8 rounded text-white transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: 'var(--primary-brand-hex)' }}
              >
                {isLoading ? (
                  <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                ) : (
                  'Send Reset Link'
                )}
              </button>
            </form>

            {/* Back to Login */}
            <div className="mt-6 pt-4 border-t border-gray-200">
              <button
                onClick={handleBackToLogin}
                className="w-full flex items-center justify-center gap-2 px-4 h-8 bg-gray-200 text-gray-700 rounded text-sm hover:bg-gray-300 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Login
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* Right Side - Graphite Black Background */}
      <div className="hidden lg:flex lg:w-1/2 items-center justify-center p-12" style={{ backgroundColor: 'var(--gray-950)' }}>
        <div className="max-w-md text-center text-white">
          <div className="mb-8">
            <div className="mx-auto mb-6 flex items-center justify-center">
              <div className="flex items-center justify-center gap-3">
                <MessageCircleCode size={48} style={{ color: 'var(--primary-brand-hex)' }} />
                <span className="text-4xl font-semibold text-white">WAPunch</span>
              </div>
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}
