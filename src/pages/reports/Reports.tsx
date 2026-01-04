import { useEffect, useState } from 'react';
import { useSubmoduleNav } from '../../hooks/useSubmoduleNav';
import { 
  Printer, 
  Users, 
  Clock, 
  Building2,
  FileText,
  Download,
  Filter,
  Search
} from 'lucide-react';

interface ReportModule {
  id: string;
  label: string;
  icon: any;
  description: string;
}

const reportModules: ReportModule[] = [
  {
    id: 'time-attendance',
    label: 'Time & Attendance',
    icon: Clock,
    description: 'Attendance reports, time tracking, and workforce analytics'
  },
  {
    id: 'workers',
    label: 'Workers',
    icon: Users,
    description: 'Worker reports, employee analytics, and workforce metrics'
  },
  {
    id: 'sites',
    label: 'Sites',
    icon: Building2,
    description: 'Site reports, location analytics, and facility metrics'
  }
];

export default function CompanyReports() {
  const { registerSubmodules } = useSubmoduleNav();
  const [activeModule, setActiveModule] = useState<string>('time-attendance');

  useEffect(() => {
    // Clear any existing submodules to hide the secondary navbar
    registerSubmodules('Reports', []);
  }, [registerSubmodules]);

  const activeModuleData = reportModules.find(module => module.id === activeModule);

  return (
    <div className="flex h-[calc(100vh-48px)] -ml-6 -mr-6">
      {/* Secondary Sidebar */}
       <div className="w-56 bg-white border-r border-gray-200 flex-shrink-0">
         {/* Sidebar Header */}
         <div className="px-6 border-b border-gray-200 flex items-center" style={{ height: '48px' }}>
           <h2 className="text-sm font-semibold text-gray-900">Report Modules</h2>
         </div>

        {/* Module Navigation */}
        <nav className="px-4 py-4">
          <ul className="space-y-1">
            {reportModules.map((module) => {
              const Icon = module.icon;
              const isActive = activeModule === module.id;
              
              return (
                 <li key={module.id}>
                     <button
                       onClick={() => setActiveModule(module.id)}
                       className={`w-full flex items-center px-3 py-2 text-sm rounded transition-colors ${
                         isActive
                           ? 'bg-primary text-white'
                           : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                       }`}
                     >
                     <span className="font-medium">{module.label}</span>
                   </button>
                 </li>
              );
            })}
          </ul>
        </nav>
      </div>

       {/* Main Content Area */}
       <div className="flex-1 flex flex-col min-w-0">
         {/* Secondary Navbar for Report Tabs */}
         <div className="border-b border-gray-200 bg-white flex items-center" style={{ height: '48px' }}>
           {/* Report Tabs will go here */}
         </div>

        {/* Content Body */}
        <div className="flex-1 bg-gray-50 overflow-y-auto">
          <div>
            {/* Coming Soon Content */}
            <div className="flex items-center justify-center min-h-[400px]">
              <div className="text-center">
                <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h2 className="text-2xl font-semibold text-gray-600 mb-2">
                  {activeModuleData?.label} Reports
                </h2>
                <p className="text-gray-500 mb-6">
                  {activeModuleData?.description}
                </p>
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg">
                  <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></div>
                  <span className="text-sm text-gray-600">Coming Soon</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}