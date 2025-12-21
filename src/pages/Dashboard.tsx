import { useEffect } from 'react';
import { useSubmoduleNav } from '../hooks/useSubmoduleNav';
import { useWorkers } from '../hooks/useWorkers';
import { useSites } from '../hooks/useSites';
import { useWhosWorking } from '../hooks/useWhosWorking';
import { useCompany } from '../hooks/useCompany';
import { router } from '../lib/router';
import { Home, Users, MapPin, Clock, Building2, TrendingUp, Activity } from 'lucide-react';

export default function ManagementDashboard() {
  const { registerSubmodules } = useSubmoduleNav();
  const { workers, isLoading: workersLoading } = useWorkers();
  const { sites, isLoading: sitesLoading } = useSites();
  const { workers: activeWorkers, isLoading: activeWorkersLoading } = useWhosWorking();
  const { currentCompany } = useCompany();

  useEffect(() => {
    // Register submodule tabs for management dashboard
    registerSubmodules('Management Dashboard', [
      { id: 'dashboard', label: 'Dashboard', href: '/dashboard', icon: Home }
    ]);
  }, [registerSubmodules]);

  // Calculate active workers (present, on-break, on-transfer)
  const workersCurrentlyIn = activeWorkers.filter(w => 
    w.status === 'present' || w.status === 'on-break' || w.status === 'on-transfer'
  ).length;

  // Calculate active sites
  const activeSites = sites.filter(s => s.is_active).length;

  const handleNavigateToWhosWorking = () => {
    router.navigate('/time-and-attendance/whos-working');
  };

  const handleNavigateToWorkers = () => {
    router.navigate('/workers/directory');
  };

  const handleNavigateToSites = () => {
    router.navigate('/sites');
  };

  const isLoading = workersLoading || sitesLoading || activeWorkersLoading;

  return (
    <div className="p-6">
      {/* Dashboard Header */}
      <div className="mb-8">
        <h1 className="text-title font-semibold text-foreground mb-1">Dashboard</h1>
        <p className="text-small text-muted-foreground">Overview of your attendance tracking system</p>
      </div>

      {/* Company Information Card */}
      {currentCompany && (
        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-8">
          <div className="flex items-start gap-4">
            <div className="flex items-center justify-center w-16 h-16 rounded-lg bg-primary/10">
              <Building2 className="h-8 w-8 text-primary" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-semibold text-foreground mb-2">{currentCompany.name}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-muted-foreground">
                {currentCompany.country && (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    <span>{currentCompany.country}</span>
                  </div>
                )}
                {currentCompany.timezone && (
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    <span>Timezone: {currentCompany.timezone}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {/* Total Workers */}
        <button
          onClick={handleNavigateToWorkers}
          className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-all duration-200 hover:border-primary/20 text-left w-full"
        >
          <div className="flex items-center justify-between mb-4">
            <Users className="h-8 w-8 text-primary" />
            <div className="text-right">
              <div className="text-3xl font-bold text-foreground">
                {isLoading ? '...' : workers.length}
              </div>
            </div>
          </div>
          <div className="text-sm font-medium text-muted-foreground">Total Workers</div>
          <div className="text-xs text-primary mt-2">View all workers →</div>
        </button>

        {/* Workers Currently In */}
        <button
          onClick={handleNavigateToWhosWorking}
          className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-all duration-200 hover:border-primary/20 text-left w-full"
        >
          <div className="flex items-center justify-between mb-4">
            <Activity className="h-8 w-8 text-status-green" />
            <div className="text-right">
              <div className="text-3xl font-bold text-foreground">
                {isLoading ? '...' : workersCurrentlyIn}
              </div>
              {!isLoading && workers.length > 0 && (
                <div className="text-sm text-status-green">
                  {Math.round((workersCurrentlyIn / workers.length) * 100)}%
                </div>
              )}
            </div>
          </div>
          <div className="text-sm font-medium text-muted-foreground">Currently Working</div>
          <div className="text-xs text-primary mt-2">See who's working →</div>
        </button>

        {/* Total Sites */}
        <button
          onClick={handleNavigateToSites}
          className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-all duration-200 hover:border-primary/20 text-left w-full"
        >
          <div className="flex items-center justify-between mb-4">
            <MapPin className="h-8 w-8 text-status-blue" />
            <div className="text-right">
              <div className="text-3xl font-bold text-foreground">
                {isLoading ? '...' : sites.length}
              </div>
              {!isLoading && sites.length > 0 && (
                <div className="text-sm text-muted-foreground">
                  {activeSites} active
                </div>
              )}
            </div>
          </div>
          <div className="text-sm font-medium text-muted-foreground">Total Sites</div>
          <div className="text-xs text-primary mt-2">Manage sites →</div>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Worker Status Breakdown */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="text-heading font-semibold mb-6">Worker Status</h2>
          <div className="space-y-4">
            {!isLoading && (
              <>
                <div className="p-3 hover:bg-gray-50 rounded-lg transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-medium">Present</div>
                    <span className="font-bold text-status-green">
                      {activeWorkers.filter(w => w.status === 'present').length}
                    </span>
                  </div>
                  <div className="bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-status-green rounded-full h-2 transition-all duration-300"
                      style={{ width: `${workers.length > 0 ? (activeWorkers.filter(w => w.status === 'present').length / workers.length) * 100 : 0}%` }}
                    />
                  </div>
                </div>

                <div className="p-3 hover:bg-gray-50 rounded-lg transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-medium">On Break</div>
                    <span className="font-bold text-status-yellow">
                      {activeWorkers.filter(w => w.status === 'on-break').length}
                    </span>
                  </div>
                  <div className="bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-status-yellow rounded-full h-2 transition-all duration-300"
                      style={{ width: `${workers.length > 0 ? (activeWorkers.filter(w => w.status === 'on-break').length / workers.length) * 100 : 0}%` }}
                    />
                  </div>
                </div>

                <div className="p-3 hover:bg-gray-50 rounded-lg transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-medium">On Transfer</div>
                    <span className="font-bold text-status-blue">
                      {activeWorkers.filter(w => w.status === 'on-transfer').length}
                    </span>
                  </div>
                  <div className="bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-status-blue rounded-full h-2 transition-all duration-300"
                      style={{ width: `${workers.length > 0 ? (activeWorkers.filter(w => w.status === 'on-transfer').length / workers.length) * 100 : 0}%` }}
                    />
                  </div>
                </div>

                <div className="p-3 hover:bg-gray-50 rounded-lg transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-medium">Absent</div>
                    <span className="font-bold text-muted-foreground">
                      {activeWorkers.filter(w => w.status === 'absent').length}
                    </span>
                  </div>
                  <div className="bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-gray-400 rounded-full h-2 transition-all duration-300"
                      style={{ width: `${workers.length > 0 ? (activeWorkers.filter(w => w.status === 'absent').length / workers.length) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-6">
            <Clock className="h-6 w-6 text-status-blue" />
            <h2 className="text-heading font-semibold">Quick Actions</h2>
          </div>
          <div className="space-y-3">
            <button
              onClick={() => router.navigate('/time-and-attendance/whos-working')}
              className="w-full p-4 text-left hover:bg-gray-50 rounded-lg transition-colors border border-gray-200"
            >
              <div className="font-medium mb-1">Who's Working</div>
              <div className="text-sm text-muted-foreground">View real-time worker attendance status</div>
            </button>

            <button
              onClick={() => router.navigate('/time-and-attendance/attendance')}
              className="w-full p-4 text-left hover:bg-gray-50 rounded-lg transition-colors border border-gray-200"
            >
              <div className="font-medium mb-1">Attendance</div>
              <div className="text-sm text-muted-foreground">Review attendance logs and reports</div>
            </button>

            <button
              onClick={() => router.navigate('/workers/directory')}
              className="w-full p-4 text-left hover:bg-gray-50 rounded-lg transition-colors border border-gray-200"
            >
              <div className="font-medium mb-1">Worker Directory</div>
              <div className="text-sm text-muted-foreground">Manage worker profiles and information</div>
            </button>

            <button
              onClick={() => router.navigate('/sites')}
              className="w-full p-4 text-left hover:bg-gray-50 rounded-lg transition-colors border border-gray-200"
            >
              <div className="font-medium mb-1">Manage Sites</div>
              <div className="text-sm text-muted-foreground">Configure locations and geofencing</div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
