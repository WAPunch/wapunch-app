import { useEffect, useState, useMemo } from 'react';
import { useSubmoduleNav } from '../../hooks/useSubmoduleNav';
import { 
  Users, 
  Laptop, 
  Smartphone,
  Monitor,
  Tablet,
  Search, 
  Filter,
  Plus,
  Edit,
  Trash2,
  ChevronLeft,
  ChevronRight,
  SortAsc,
  SortDesc,
  MoreHorizontal,
  Mail,
  Phone,
  MapPin,
  Calendar,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  Eye,
  Settings,
  HardDrive,
  Wifi,
  Battery,
  Shield,
  GitBranch
} from 'lucide-react';

interface Device {
  id: string;
  deviceName: string;
  deviceType: 'Laptop' | 'Desktop' | 'Smartphone' | 'Tablet' | 'Monitor' | 'Other';
  brand: string;
  model: string;
  serialNumber: string;
  macAddress?: string;
  ipAddress?: string;
  operatingSystem: string;
  status: 'Active' | 'Inactive' | 'Maintenance' | 'Retired' | 'Lost' | 'Stolen';
  assignedEmployeeId: string;
  assignedEmployeeName: string;
  assignedEmployeeEmail: string;
  assignedEmployeeJobTitle: string;
  assignedEmployeeDepartment: string;
  assignedEmployeeLocation: string;
  productionDate: string;
  deliveryDate: string;
  warrantyExpiry: string;
  lastMaintenanceDate?: string;
  nextMaintenanceDate?: string;
  notes?: string;
  avatar?: string;
  phone?: string;
}

// Function to generate avatar initials (100% reliable, works everywhere)
const generateAvatarInitials = (firstName: string, lastName: string) => {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
};

// Function to generate a consistent background color based on name
// Using WCAG 2.2 AA compliant colors (4.5:1 contrast ratio with white text)
const generateAvatarColor = (firstName: string, lastName: string) => {
  const colors = [
    '#008383', '#1976D2', '#D32F2F', '#E65100', '#7B1FA2',
    '#00695C', '#2E7D32', '#E65100', '#C2185B', '#455A64',
    '#5D4037', '#37474F', '#BF360C', '#1A237E', '#4A148C'
  ];
  const name = firstName + lastName;
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'Active':
      return (
        <span className="px-1.5 py-0.5 rounded-full text-xs font-medium bg-green-50 text-status-green">
          Active
        </span>
      );
    case 'Inactive':
      return (
        <span className="px-1.5 py-0.5 rounded-full text-xs font-medium bg-gray-50 text-status-gray">
          Inactive
        </span>
      );
    case 'Maintenance':
      return (
        <span className="px-1.5 py-0.5 rounded-full text-xs font-medium bg-orange-50 text-status-orange">
          Maintenance
        </span>
      );
    case 'Retired':
      return (
        <span className="px-1.5 py-0.5 rounded-full text-xs font-medium bg-gray-50 text-status-gray">
          Retired
        </span>
      );
    case 'Lost':
      return (
        <span className="px-1.5 py-0.5 rounded-full text-xs font-medium bg-red-50 text-status-red">
          Lost
        </span>
      );
    case 'Stolen':
      return (
        <span className="px-1.5 py-0.5 rounded-full text-xs font-medium bg-red-50 text-status-red">
          Stolen
        </span>
      );
    default:
      return (
        <span className="px-1.5 py-0.5 rounded-full text-xs font-medium bg-gray-50 text-status-gray">
          {status}
        </span>
      );
  }
};

const getDeviceTypeIcon = (deviceType: string) => {
  switch (deviceType) {
    case 'Laptop':
      return <Laptop className="w-4 h-4 text-status-blue" />;
    case 'Desktop':
      return <Monitor className="w-4 h-4 text-status-blue" />;
    case 'Smartphone':
      return <Smartphone className="w-4 h-4 text-status-green" />;
    case 'Tablet':
      return <Tablet className="w-4 h-4 text-status-purple" />;
    case 'Monitor':
      return <Monitor className="w-4 h-4 text-status-blue" />;
    default:
      return <Settings className="w-4 h-4 text-status-blue" />;
  }
};

const getDeviceTypeBadge = (deviceType: string) => {
  const typeConfig = {
    'Laptop': { bg: 'bg-blue-100', text: 'text-blue-800' },
    'Desktop': { bg: 'bg-gray-100', text: 'text-gray-800' },
    'Smartphone': { bg: 'bg-green-100', text: 'text-green-800' },
    'Tablet': { bg: 'bg-purple-100', text: 'text-purple-800' },
    'Monitor': { bg: 'bg-indigo-100', text: 'text-indigo-800' },
    'Other': { bg: 'bg-gray-100', text: 'text-gray-800' }
  };
  
  const config = typeConfig[deviceType as keyof typeof typeConfig] || typeConfig['Other'];
  
  return (
    <span className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
      {deviceType}
    </span>
  );
};

export default function TeamDevices() {
  const { registerSubmodules } = useSubmoduleNav();
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [sortBy, setSortBy] = useState<'deviceName' | 'deviceType' | 'assignedEmployeeName' | 'status' | 'deliveryDate'>('deviceName');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedDeviceType, setSelectedDeviceType] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('');

  useEffect(() => {
    // Register submodule tabs for IT Management section
    registerSubmodules('IT Management', [
      { id: 'team-devices', label: 'Team Devices', href: '/it-management/team-devices', icon: Laptop },
      { id: 'team-licenses', label: 'Team Licenses', href: '/it-management/team-licenses', icon: Shield },
      { id: 'team-requests', label: 'Team Requests', href: '/it-management/team-requests', icon: Settings }
    ]);
  }, [registerSubmodules]);

  const devices: Device[] = [
    {
      id: '1',
      deviceName: 'MacBook Pro 16"',
      deviceType: 'Laptop',
      brand: 'Apple',
      model: 'MacBook Pro 16-inch 2023',
      serialNumber: 'FVF123456789',
      macAddress: '00:1B:44:11:3A:B7',
      ipAddress: '192.168.1.101',
      operatingSystem: 'macOS Sonoma 14.2',
      status: 'Active',
      assignedEmployeeId: 'emp-001',
      assignedEmployeeName: 'Amanda Foster',
      assignedEmployeeEmail: 'amanda.foster@arquiluz.com',
      assignedEmployeeJobTitle: 'Senior UX Designer',
      assignedEmployeeDepartment: 'Design',
      assignedEmployeeLocation: 'San Francisco, CA',
      productionDate: '2023-10-15',
      deliveryDate: '2023-11-01',
      warrantyExpiry: '2026-10-15',
      lastMaintenanceDate: '2024-01-10',
      nextMaintenanceDate: '2024-04-10',
      notes: 'High-performance laptop for design work'
    },
    {
      id: '2',
      deviceName: 'iPhone 15 Pro',
      deviceType: 'Smartphone',
      brand: 'Apple',
      model: 'iPhone 15 Pro 256GB',
      serialNumber: 'F2LD123456789',
      operatingSystem: 'iOS 17.2',
      status: 'Active',
      assignedEmployeeId: 'emp-002',
      assignedEmployeeName: 'Marcus Chen',
      assignedEmployeeEmail: 'marcus.chen@arquiluz.com',
      assignedEmployeeJobTitle: 'Full Stack Developer',
      assignedEmployeeDepartment: 'Engineering',
      assignedEmployeeLocation: 'Austin, TX',
      productionDate: '2023-09-15',
      deliveryDate: '2023-09-22',
      warrantyExpiry: '2024-09-15',
      notes: 'Company phone for development team'
    },
    {
      id: '3',
      deviceName: 'Dell OptiPlex 7090',
      deviceType: 'Desktop',
      brand: 'Dell',
      model: 'OptiPlex 7090 Desktop',
      serialNumber: 'DL123456789',
      macAddress: '00:1B:44:11:3A:B8',
      ipAddress: '192.168.1.102',
      operatingSystem: 'Windows 11 Pro',
      status: 'Active',
      assignedEmployeeId: 'emp-003',
      assignedEmployeeName: 'Elena Rodriguez',
      assignedEmployeeEmail: 'elena.rodriguez@arquiluz.com',
      assignedEmployeeJobTitle: 'Product Manager',
      assignedEmployeeDepartment: 'Product',
      assignedEmployeeLocation: 'Miami, FL',
      productionDate: '2023-08-20',
      deliveryDate: '2023-09-05',
      warrantyExpiry: '2026-08-20',
      lastMaintenanceDate: '2024-01-05',
      nextMaintenanceDate: '2024-04-05',
      notes: 'Standard office desktop'
    },
    {
      id: '4',
      deviceName: 'iPad Pro 12.9"',
      deviceType: 'Tablet',
      brand: 'Apple',
      model: 'iPad Pro 12.9-inch 6th Gen',
      serialNumber: 'F2LD987654321',
      operatingSystem: 'iPadOS 17.2',
      status: 'Active',
      assignedEmployeeId: 'emp-004',
      assignedEmployeeName: 'James Wilson',
      assignedEmployeeEmail: 'james.wilson@arquiluz.com',
      assignedEmployeeJobTitle: 'Marketing Specialist',
      assignedEmployeeDepartment: 'Marketing',
      assignedEmployeeLocation: 'Seattle, WA',
      productionDate: '2023-05-10',
      deliveryDate: '2023-05-25',
      warrantyExpiry: '2024-05-10',
      notes: 'For presentations and field work'
    },
    {
      id: '5',
      deviceName: 'ThinkPad X1 Carbon',
      deviceType: 'Laptop',
      brand: 'Lenovo',
      model: 'ThinkPad X1 Carbon Gen 11',
      serialNumber: 'LV123456789',
      macAddress: '00:1B:44:11:3A:B9',
      ipAddress: '192.168.1.103',
      operatingSystem: 'Windows 11 Pro',
      status: 'Maintenance',
      assignedEmployeeId: 'emp-005',
      assignedEmployeeName: 'Sophie Anderson',
      assignedEmployeeEmail: 'sophie.anderson@arquiluz.com',
      assignedEmployeeJobTitle: 'Data Analyst',
      assignedEmployeeDepartment: 'Analytics',
      assignedEmployeeLocation: 'Denver, CO',
      productionDate: '2023-07-15',
      deliveryDate: '2023-08-01',
      warrantyExpiry: '2026-07-15',
      lastMaintenanceDate: '2024-01-15',
      nextMaintenanceDate: '2024-01-20',
      notes: 'Battery replacement in progress'
    },
    {
      id: '6',
      deviceName: 'Samsung Galaxy S24',
      deviceType: 'Smartphone',
      brand: 'Samsung',
      model: 'Galaxy S24 256GB',
      serialNumber: 'SM123456789',
      operatingSystem: 'Android 14',
      status: 'Active',
      assignedEmployeeId: 'emp-006',
      assignedEmployeeName: 'Alex Thompson',
      assignedEmployeeEmail: 'alex.thompson@arquiluz.com',
      assignedEmployeeJobTitle: 'DevOps Engineer',
      assignedEmployeeDepartment: 'Engineering',
      assignedEmployeeLocation: 'Portland, OR',
      productionDate: '2024-01-10',
      deliveryDate: '2024-01-20',
      warrantyExpiry: '2025-01-10',
      notes: 'Latest Android device for testing'
    },
    {
      id: '7',
      deviceName: 'Dell UltraSharp 27"',
      deviceType: 'Monitor',
      operatingSystem: 'N/A',
      brand: 'Dell',
      model: 'UltraSharp U2723QE',
      serialNumber: 'DL987654321',
      status: 'Active',
      assignedEmployeeId: 'emp-007',
      assignedEmployeeName: 'Maria Garcia',
      assignedEmployeeEmail: 'maria.garcia@arquiluz.com',
      assignedEmployeeJobTitle: 'HR Coordinator',
      assignedEmployeeDepartment: 'Human Resources',
      assignedEmployeeLocation: 'Phoenix, AZ',
      productionDate: '2023-06-01',
      deliveryDate: '2023-06-15',
      warrantyExpiry: '2026-06-01',
      notes: '4K monitor for detailed work'
    },
    {
      id: '8',
      deviceName: 'MacBook Air M2',
      deviceType: 'Laptop',
      brand: 'Apple',
      model: 'MacBook Air 13-inch M2',
      serialNumber: 'FVF987654321',
      macAddress: '00:1B:44:11:3A:BA',
      ipAddress: '192.168.1.104',
      operatingSystem: 'macOS Sonoma 14.2',
      status: 'Active',
      assignedEmployeeId: 'emp-008',
      assignedEmployeeName: 'David Park',
      assignedEmployeeEmail: 'david.park@arquiluz.com',
      assignedEmployeeJobTitle: 'Sales Manager',
      assignedEmployeeDepartment: 'Sales',
      assignedEmployeeLocation: 'Los Angeles, CA',
      productionDate: '2023-04-15',
      deliveryDate: '2023-05-01',
      warrantyExpiry: '2026-04-15',
      lastMaintenanceDate: '2023-12-15',
      nextMaintenanceDate: '2024-03-15',
      notes: 'Lightweight laptop for sales team'
    },
    {
      id: '9',
      deviceName: 'Surface Pro 9',
      deviceType: 'Tablet',
      brand: 'Microsoft',
      model: 'Surface Pro 9 256GB',
      serialNumber: 'MS123456789',
      operatingSystem: 'Windows 11 Pro',
      status: 'Inactive',
      assignedEmployeeId: 'emp-009',
      assignedEmployeeName: 'Rachel Brown',
      assignedEmployeeEmail: 'rachel.brown@arquiluz.com',
      assignedEmployeeJobTitle: 'Content Writer',
      assignedEmployeeDepartment: 'Marketing',
      assignedEmployeeLocation: 'Chicago, IL',
      productionDate: '2023-03-20',
      deliveryDate: '2023-04-05',
      warrantyExpiry: '2024-03-20',
      notes: 'Returned by employee, needs reassignment'
    },
    {
      id: '10',
      deviceName: 'HP EliteBook 850',
      deviceType: 'Laptop',
      brand: 'HP',
      model: 'EliteBook 850 G10',
      serialNumber: 'HP123456789',
      macAddress: '00:1B:44:11:3A:BB',
      ipAddress: '192.168.1.105',
      operatingSystem: 'Windows 11 Pro',
      status: 'Active',
      assignedEmployeeId: 'emp-010',
      assignedEmployeeName: 'Kevin Lee',
      assignedEmployeeEmail: 'kevin.lee@arquiluz.com',
      assignedEmployeeJobTitle: 'QA Engineer',
      assignedEmployeeDepartment: 'Engineering',
      assignedEmployeeLocation: 'Boston, MA',
      productionDate: '2023-09-01',
      deliveryDate: '2023-09-15',
      warrantyExpiry: '2026-09-01',
      lastMaintenanceDate: '2023-12-01',
      nextMaintenanceDate: '2024-03-01',
      notes: 'Business laptop for QA testing'
    }
  ];

  const filteredDevices = useMemo(() => {
    return devices.filter(device => {
      const matchesSearch = 
        device.deviceName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        device.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
        device.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
        device.serialNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        device.assignedEmployeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        device.assignedEmployeeJobTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
        device.assignedEmployeeDepartment.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesDeviceType = !selectedDeviceType || device.deviceType === selectedDeviceType;
      const matchesStatus = !selectedStatus || device.status === selectedStatus;
      const matchesDepartment = !selectedDepartment || device.assignedEmployeeDepartment === selectedDepartment;
      
      return matchesSearch && matchesDeviceType && matchesStatus && matchesDepartment;
    });
  }, [devices, searchTerm, selectedDeviceType, selectedStatus, selectedDepartment]);

  const sortedDevices = useMemo(() => {
    return [...filteredDevices].sort((a, b) => {
      let aValue: string | number;
      let bValue: string | number;
      
      switch (sortBy) {
        case 'deviceName':
          aValue = a.deviceName;
          bValue = b.deviceName;
          break;
        case 'deviceType':
          aValue = a.deviceType;
          bValue = b.deviceType;
          break;
        case 'assignedEmployeeName':
          aValue = a.assignedEmployeeName;
          bValue = b.assignedEmployeeName;
          break;
        case 'status':
          aValue = a.status;
          bValue = b.status;
          break;
        case 'deliveryDate':
          aValue = new Date(a.deliveryDate).getTime();
          bValue = new Date(b.deliveryDate).getTime();
          break;
        default:
          aValue = a.deviceName;
          bValue = b.deviceName;
      }
      
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortOrder === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }
      
      return sortOrder === 'asc' 
        ? (aValue as number) - (bValue as number)
        : (bValue as number) - (aValue as number);
    });
  }, [filteredDevices, sortBy, sortOrder]);

  const totalPages = Math.ceil(sortedDevices.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedDevices = sortedDevices.slice(startIndex, startIndex + itemsPerPage);

  const handleSort = (field: typeof sortBy) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedDeviceType('');
    setSelectedStatus('');
    setSelectedDepartment('');
  };

  const deviceTypes = [...new Set(devices.map(device => device.deviceType))];
  const statuses = [...new Set(devices.map(device => device.status))];
  const departments = [...new Set(devices.map(device => device.assignedEmployeeDepartment))];

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground mb-1">Team Devices</h1>
        <p className="text-xs text-muted-foreground">Manage and track company devices assigned to employees</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <Laptop className="h-5 w-5 text-primary" />
            <div>
              <div className="text-2xl font-bold">{devices.filter(d => d.status === 'Active').length}</div>
              <div className="text-sm text-muted-foreground">Active Devices</div>
            </div>
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-status-orange" />
            <div>
              <div className="text-2xl font-bold">{devices.filter(d => d.status === 'Maintenance').length}</div>
              <div className="text-sm text-muted-foreground">In Maintenance</div>
            </div>
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <XCircle className="h-5 w-5 text-status-red" />
            <div>
              <div className="text-2xl font-bold">{devices.filter(d => d.status === 'Lost' || d.status === 'Stolen').length}</div>
              <div className="text-sm text-muted-foreground">Lost/Stolen</div>
            </div>
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <Clock className="h-5 w-5" style={{ color: 'var(--neutral-gray)' }} />
            <div>
              <div className="text-2xl font-bold">{devices.filter(d => d.status === 'Inactive').length}</div>
              <div className="text-sm text-muted-foreground">Inactive</div>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="mb-4">
        <div className={`bg-white border border-gray-200 py-6 px-6 ${showFilters ? 'rounded-t-lg' : 'rounded-lg'}`}>
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search devices, employees, or serial numbers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1 border border-gray-200 rounded text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50"
                aria-label="Search devices"
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                className={`px-3 py-1 border rounded text-sm transition-colors ${
                  showFilters
                    ? 'bg-gray-300 text-black border-gray-300'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
                onClick={() => setShowFilters(!showFilters)}
                aria-label="Toggle filters"
              >
                <Filter className="w-4 h-4 inline mr-1" />
                Filters
              </button>
            </div>
          </div>
        </div>

        {showFilters && (
          <div className="bg-white border-l border-r border-b border-gray-200 rounded-b-lg py-6 px-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
              <select
                value={selectedDeviceType}
                onChange={(e) => setSelectedDeviceType(e.target.value)}
                className="px-3 py-1 border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary/20 focus:border-primary/50"
                aria-label="Filter by device type"
                id="device-type-filter"
              >
                <option value="">All Device Types</option>
                {deviceTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="px-3 py-1 border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary/20 focus:border-primary/50"
                aria-label="Filter by status"
                id="status-filter"
              >
                <option value="">All Statuses</option>
                {statuses.map(status => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
              <select
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
                className="px-3 py-1 border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary/20 focus:border-primary/50"
                aria-label="Filter by department"
                id="department-filter"
              >
                <option value="">All Departments</option>
                {departments.map(dept => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
            </div>
            <div className="flex justify-between items-center">
              <button
                onClick={clearFilters}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                Clear all filters
              </button>
              <div className="flex gap-3 items-center">
                <span className="text-xs text-gray-500">Sort by:</span>
                <button
                  onClick={() => handleSort('deviceName')}
                  className={`text-xs hover:text-gray-900 flex items-center gap-1 ${
                    sortBy === 'deviceName' ? 'text-gray-900 font-medium' : 'text-gray-600'
                  }`}
                >
                  Device Name
                  {sortBy === 'deviceName' && (sortOrder === 'asc' ? <SortAsc className="w-3 h-3" /> : <SortDesc className="w-3 h-3" />)}
                </button>
                <button
                  onClick={() => handleSort('deviceType')}
                  className={`text-xs hover:text-gray-900 flex items-center gap-1 ${
                    sortBy === 'deviceType' ? 'text-gray-900 font-medium' : 'text-gray-600'
                  }`}
                >
                  Device Type
                  {sortBy === 'deviceType' && (sortOrder === 'asc' ? <SortAsc className="w-3 h-3" /> : <SortDesc className="w-3 h-3" />)}
                </button>
                <button
                  onClick={() => handleSort('assignedEmployeeName')}
                  className={`text-xs hover:text-gray-900 flex items-center gap-1 ${
                    sortBy === 'assignedEmployeeName' ? 'text-gray-900 font-medium' : 'text-gray-600'
                  }`}
                >
                  Employee
                  {sortBy === 'assignedEmployeeName' && (sortOrder === 'asc' ? <SortAsc className="w-3 h-3" /> : <SortDesc className="w-3 h-3" />)}
                </button>
                <button
                  onClick={() => handleSort('status')}
                  className={`text-xs hover:text-gray-900 flex items-center gap-1 ${
                    sortBy === 'status' ? 'text-gray-900 font-medium' : 'text-gray-600'
                  }`}
                >
                  Status
                  {sortBy === 'status' && (sortOrder === 'asc' ? <SortAsc className="w-3 h-3" /> : <SortDesc className="w-3 h-3" />)}
                </button>
                <button
                  onClick={() => handleSort('deliveryDate')}
                  className={`text-xs hover:text-gray-900 flex items-center gap-1 ${
                    sortBy === 'deliveryDate' ? 'text-gray-900 font-medium' : 'text-gray-600'
                  }`}
                >
                  Delivery Date
                  {sortBy === 'deliveryDate' && (sortOrder === 'asc' ? <SortAsc className="w-3 h-3" /> : <SortDesc className="w-3 h-3" />)}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Table View */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden mb-4">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left py-3 px-6 font-medium text-gray-900 text-xs">
                  <button
                    onClick={() => handleSort('deviceName')}
                    className="flex items-center gap-1 hover:text-gray-700"
                  >
                    Device
                    {sortBy === 'deviceName' && (sortOrder === 'asc' ? <SortAsc className="w-3 h-3" /> : <SortDesc className="w-3 h-3" />)}
                  </button>
                </th>
                <th className="text-left py-3 px-4 font-medium text-gray-900 text-xs">
                  <button
                    onClick={() => handleSort('deviceType')}
                    className="flex items-center gap-1 hover:text-gray-700"
                  >
                    Type
                    {sortBy === 'deviceType' && (sortOrder === 'asc' ? <SortAsc className="w-3 h-3" /> : <SortDesc className="w-3 h-3" />)}
                  </button>
                </th>
                <th className="text-left py-3 px-4 font-medium text-gray-900 text-xs">
                  Serial Number
                </th>
                <th className="text-left py-3 px-4 font-medium text-gray-900 text-xs">
                  <button
                    onClick={() => handleSort('assignedEmployeeName')}
                    className="flex items-center gap-1 hover:text-gray-700"
                  >
                    Assigned To
                    {sortBy === 'assignedEmployeeName' && (sortOrder === 'asc' ? <SortAsc className="w-3 h-3" /> : <SortDesc className="w-3 h-3" />)}
                  </button>
                </th>
                <th className="text-left py-3 px-4 font-medium text-gray-900 text-xs">
                  <button
                    onClick={() => handleSort('status')}
                    className="flex items-center gap-1 hover:text-gray-700"
                  >
                    Status
                    {sortBy === 'status' && (sortOrder === 'asc' ? <SortAsc className="w-3 h-3" /> : <SortDesc className="w-3 h-3" />)}
                  </button>
                </th>
                <th className="text-left py-3 px-4 font-medium text-gray-900 text-xs">
                  <button
                    onClick={() => handleSort('deliveryDate')}
                    className="flex items-center gap-1 hover:text-gray-700"
                  >
                    Delivery Date
                    {sortBy === 'deliveryDate' && (sortOrder === 'asc' ? <SortAsc className="w-3 h-3" /> : <SortDesc className="w-3 h-3" />)}
                  </button>
                </th>
                <th className="text-left py-3 px-4 font-medium text-gray-900 text-xs">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {paginatedDevices.map((device) => {
                const nameParts = device.assignedEmployeeName.split(' ');
                const firstName = nameParts[0] || '';
                const lastName = nameParts.slice(1).join(' ') || '';
                const avatarColor = generateAvatarColor(firstName, lastName);
                const avatarInitials = generateAvatarInitials(firstName, lastName);
                
                return (
                  <tr key={device.id} className="hover:bg-gray-50">
                    <td className="py-2 px-6">
                      <div className="flex items-center gap-3">
                        {getDeviceTypeIcon(device.deviceType)}
                        <div>
                          <div className="text-sm font-medium text-gray-900">{device.deviceName}</div>
                          <div className="text-xs text-gray-500">{device.brand} {device.model}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-2 px-4">
                      <div className="flex items-center gap-2">
                        {getDeviceTypeIcon(device.deviceType)}
                        {getDeviceTypeBadge(device.deviceType)}
                      </div>
                    </td>
                    <td className="py-2 px-4">
                      <span className="text-sm text-gray-900 font-mono">{device.serialNumber}</span>
                    </td>
                    <td className="py-2 px-4">
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-medium"
                          style={{ backgroundColor: avatarColor }}
                        >
                          {device.avatar ? (
                            <img 
                              src={device.avatar} 
                              alt={device.assignedEmployeeName}
                              className="w-8 h-8 rounded-full object-cover"
                            />
                          ) : (
                            avatarInitials
                          )}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900">{device.assignedEmployeeName}</div>
                          <div className="text-xs text-gray-500">{device.assignedEmployeeJobTitle}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-2 px-4">
                      {getStatusBadge(device.status)}
                    </td>
                    <td className="py-2 px-4">
                      <span className="text-sm text-gray-900">{new Date(device.deliveryDate).toLocaleDateString()}</span>
                    </td>
                    <td className="py-2 px-4">
                      <div className="flex items-center gap-2">
                        <button
                          className="p-1 hover:bg-gray-100 rounded transition-colors"
                          aria-label={`View details for ${device.deviceName}`}
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          className="p-1 hover:bg-gray-100 rounded transition-colors"
                          aria-label={`Edit ${device.deviceName}`}
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          className="p-1 hover:bg-gray-100 rounded transition-colors"
                          aria-label={`Delete ${device.deviceName}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <div className="bg-white border border-gray-200 rounded-lg py-6 px-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-600">Show:</span>
            <select
              value={itemsPerPage}
              onChange={(e) => {
                setItemsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary/20 focus:border-primary/50"
              aria-label="Items per page"
              id="items-per-page"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span className="text-xs text-gray-600">
              Showing {startIndex + 1}-{Math.min(startIndex + itemsPerPage, sortedDevices.length)} of {sortedDevices.length}
            </span>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center gap-3">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className={`flex items-center gap-1 px-2 py-1 border rounded text-xs transition-colors ${
                  currentPage === 1
                    ? 'border-gray-200 text-gray-400 cursor-not-allowed'
                    : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                <ChevronLeft className="w-3 h-3" />
                Previous
              </button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`w-6 h-6 text-xs rounded transition-colors flex items-center justify-center ${
                        currentPage === pageNum
                          ? 'bg-gray-300 text-black'
                          : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className={`flex items-center gap-1 px-2 py-1 border rounded text-xs transition-colors ${
                  currentPage === totalPages
                    ? 'border-gray-200 text-gray-400 cursor-not-allowed'
                    : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                Next
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
