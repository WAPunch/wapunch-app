import { useEffect, useState } from 'react';
import { useCompany } from '../../hooks/useCompany';
import { useAuth } from '../../hooks/useAuth';
import { router } from '../../lib/router';
import { useSubmoduleNav } from '../../hooks/useSubmoduleNav';
import { Building2, Plus, Check, X, AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Company, CompanyUser } from '../../stores/company-store';

export default function ManageOrganizations() {
  const { user } = useAuth();
  const { 
    currentCompany, 
    availableCompanies, 
    isLoading: companiesLoading,
    switchCompany,
    loadUserCompanies
  } = useCompany();
  const { registerSubmodules } = useSubmoduleNav();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newCompanyCode, setNewCompanyCode] = useState('');

  useEffect(() => {
    registerSubmodules('Manage Organizations', []);
  }, [registerSubmodules]);

  const handleSwitchCompany = async (companyId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      await switchCompany(companyId);
    } catch (err: any) {
      setError(err?.message || 'Failed to switch company');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompanyCode.trim()) {
      setError('Please enter a company code');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // First, find the company by code or name
      const { data: companies, error: searchError } = await supabase
        .from('companies')
        .select('id, name, is_active')
        .or(`name.ilike.%${newCompanyCode}%,id.eq.${newCompanyCode}`)
        .eq('is_active', true)
        .limit(1);

      if (searchError) throw searchError;

      if (!companies || companies.length === 0) {
        setError('Company not found. Please check the company code or name.');
        return;
      }

      const company = companies[0];

      // Check if user is already a member
      if (!company) {
        setError('Company not found');
        return;
      }

      const { data: existingMembership } = await supabase
        .from('company_users')
        .select('id')
        .eq('user_id', user?.id)
        .eq('company_id', company.id)
        .eq('is_deleted', false)
        .single();

      if (existingMembership) {
        setError('You are already a member of this company');
        return;
      }

      // Request to join the company (this would typically require admin approval)
      // For now, we'll create a membership request or directly add if allowed
      const { error: joinError } = await supabase
        .from('company_users')
        .insert({
          user_id: user?.id,
          company_id: company.id,
          role: 'employee', // Default role, can be changed by admin
          is_deleted: false,
        });

      if (joinError) {
        // If error is about RLS, it means user doesn't have permission
        if (joinError.code === '42501' || joinError.message.includes('permission')) {
          setError('You need to be invited by a company administrator to join this company.');
        } else {
          throw joinError;
        }
        return;
      }

      // Reload companies
      if (user?.id) {
        await loadUserCompanies(user.id);
      }

      setShowAddForm(false);
      setNewCompanyCode('');
      setError(null);
    } catch (err: any) {
      console.error('Error adding company:', err);
      setError(err?.message || 'Failed to add company');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6" style={{ paddingTop: 'calc(1.5rem + 2.5rem)' }}>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-title font-semibold text-foreground mb-1">Manage Organizations</h1>
        <p className="text-small text-muted-foreground">
          View and manage all organizations you belong to
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="text-sm font-medium text-red-800">Error</div>
            <div className="text-sm text-red-700">{error}</div>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-red-600 hover:text-red-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Add Company Section */}
      <div className="mb-6">
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Join a Company</h2>
              <p className="text-sm text-gray-600 mt-1">
                Enter a company code or name to request access
              </p>
            </div>
            <button
              onClick={() => {
                setShowAddForm(!showAddForm);
                setError(null);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:opacity-90 transition-colors text-sm"
            >
              <Plus className="w-4 h-4" />
              {showAddForm ? 'Cancel' : 'Add Company'}
            </button>
          </div>

          {showAddForm && (
            <form onSubmit={handleAddCompany} className="mt-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newCompanyCode}
                  onChange={(e) => setNewCompanyCode(e.target.value)}
                  placeholder="Enter company code or name"
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  disabled={isLoading}
                />
                <button
                  type="submit"
                  disabled={isLoading || !newCompanyCode.trim()}
                  className="px-6 py-2 bg-primary text-white rounded-lg hover:opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Joining...
                    </>
                  ) : (
                    'Join'
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Companies List */}
      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">My Organizations</h2>
          <p className="text-sm text-gray-600 mt-1">
            {availableCompanies.length === 0
              ? 'You are not a member of any organizations yet'
              : `You are a member of ${availableCompanies.length} organization${availableCompanies.length !== 1 ? 's' : ''}`
            }
          </p>
        </div>

        {availableCompanies.length === 0 ? (
          <div className="p-12 text-center">
            <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 mb-2">No organizations found</p>
            <p className="text-sm text-gray-500">
              Use the "Add Company" button above to join an organization
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {availableCompanies.map((companyUser) => {
              const isCurrent = currentCompany?.id === companyUser.company_id;
              return (
                <div
                  key={companyUser.id}
                  className={`p-6 hover:bg-gray-50 transition-colors ${
                    isCurrent ? 'bg-primary/5' : ''
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4 flex-1">
                      <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Building2 
                          className="w-6 h-6"
                          style={{ color: 'var(--primary-brand-hex)' }}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-lg font-semibold text-gray-900">
                            {companyUser.company?.name || 'Unknown Company'}
                          </h3>
                          {isCurrent && (
                            <span className="px-2 py-1 bg-primary/10 text-primary text-xs font-medium rounded-full">
                              Current
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <span className="capitalize">
                            Role: {companyUser.role.replace('_', ' ')}
                          </span>
                          {companyUser.company?.country && (
                            <span>• {companyUser.company.country}</span>
                          )}
                        </div>
                        {companyUser.company?.address && (
                          <div className="text-sm text-gray-500 mt-1">
                            {companyUser.company.address}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      {isCurrent ? (
                        <div className="flex items-center gap-2 px-4 py-2 text-sm text-primary bg-primary/10 rounded-lg">
                          <Check className="w-4 h-4" />
                          Active
                        </div>
                      ) : (
                        <button
                          onClick={() => handleSwitchCompany(companyUser.company_id)}
                          disabled={isLoading}
                          className="px-4 py-2 text-sm text-white bg-primary rounded-lg hover:opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                          {isLoading ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Switching...
                            </>
                          ) : (
                            'Switch to this company'
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

