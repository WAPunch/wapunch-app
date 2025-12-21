import { useEffect, useState, useMemo } from 'react';
import { useSubmoduleNav } from '../../hooks/useSubmoduleNav';
import { getCurrentStatusDotColor } from '../../hooks/useWorkers';
import { 
  Clock, 
  Calendar, 
  MapPin, 
  Users, 
  Plus, 
  Filter, 
  Search, 
  ChevronLeft, 
  ChevronRight,
  ChevronDown,
  Bell,
  Copy,
  Wand2,
  Minus,
  EyeOff,
  UserX,
  Download,
  Upload,
  Share2,
  Menu,
  Printer,
  FileSpreadsheet,
  CalendarX,
  Settings,
  AlertTriangle,
  CheckCircle,
  User,
  MoreVertical,
  Edit,
  Trash2,
  Eye,
  Flag,
  SortAsc,
  SortDesc
} from 'lucide-react';

// Function to generate avatar initials
const generateAvatarInitials = (firstName: string, lastName: string) => {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
};

// Function to get proportional dot size based on avatar size
const getDotSize = (avatarSize: 'sm' | 'md' | 'lg') => {
  switch (avatarSize) {
    case 'sm': // w-8 h-8 (32px)
      return 'w-2.5 h-2.5'; // 10px
    case 'md': // w-10 h-10 (40px)
      return 'w-3 h-3'; // 12px
    case 'lg': // w-12 h-12 (48px)
      return 'w-3.5 h-3.5'; // 14px
    default:
      return 'w-2.5 h-2.5';
  }
};


interface Employee {
  id: string;
  name: string;
  role: string;
  department: string;
  avatar?: string;
  status: string;
  current_status?: 'out' | 'in' | 'on_break' | 'on_transfer';
  availability: {
    monday: string[];
    tuesday: string[];
    wednesday: string[];
    thursday: string[];
    friday: string[];
    saturday: string[];
    sunday: string[];
  };
  qualifications: string[];
  hourlyRate: number;
  maxHoursPerWeek: number;
}

interface Shift {
  id: string;
  workerId: string;
  date: string;
  startTime: string;
  endTime: string;
  role: string;
  location: string;
  status: 'scheduled' | 'confirmed' | 'completed' | 'cancelled';
  notes?: string;
}

export default function TeamSchedule() {
  const { registerSubmodules } = useSubmoduleNav();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week');
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [showCreateShift, setShowCreateShift] = useState(false);
  
  // Multi-select filter states
  const [selectedDepartment, setSelectedDepartment] = useState<string[]>([]);
  const [selectedRole, setSelectedRole] = useState<string[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<string[]>([]);
  
  // Dropdown visibility states
  const [showDepartmentDropdown, setShowDepartmentDropdown] = useState(false);
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  
  // Search terms within dropdowns
  const [departmentSearchTerm, setDepartmentSearchTerm] = useState('');
  
  // Action buttons states
  const [showActionsDropdown, setShowActionsDropdown] = useState(false);
  const [showAddDropdown, setShowAddDropdown] = useState(false);
  const [roleSearchTerm, setRoleSearchTerm] = useState('');
  const [statusSearchTerm, setStatusSearchTerm] = useState('');
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  
  // Sorting states
  const [sortBy, setSortBy] = useState<'name' | 'department' | 'role'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    // Register submodule tabs for time and attendance
    registerSubmodules('Time & Attendance', [
      { id: 'whos-working', label: "Who's Working", href: '/time-and-attendance/whos-working', icon: Users },
      { id: 'schedule', label: 'Schedule', href: '/time-and-attendance/schedule', icon: Calendar },
      { id: 'attendance', label: 'Attendance', href: '/time-and-attendance/attendance', icon: Clock },
      { id: 'attendance-flags', label: 'Attendance Flags', href: '/time-and-attendance/attendance-flags', icon: Flag }
    ]);
  }, [registerSubmodules]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest('.dropdown-container')) {
        setShowActionsDropdown(false);
        setShowAddDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Helper function to map status to current_status
  const mapStatusToCurrentStatus = (status: string): 'out' | 'in' | 'on_break' | 'on_transfer' => {
    switch (status) {
      case 'present':
        return 'in';
      case 'on-break':
        return 'on_break';
      case 'on-transfer':
        return 'on_transfer';
      default:
        return 'out';
    }
  };

  // Mock data
  const employees: Employee[] = [
    {
      id: '1',
      name: 'Sarah Johnson',
      role: 'Senior Developer',
      department: 'Engineering',
      status: 'present',
      current_status: 'in',
      availability: {
        monday: ['09:00', '18:00'],
        tuesday: ['09:00', '18:00'],
        wednesday: ['09:00', '18:00'],
        thursday: ['09:00', '18:00'],
        friday: ['09:00', '17:00'],
        saturday: [],
        sunday: []
      },
      qualifications: ['JavaScript', 'React', 'Node.js'],
      hourlyRate: 75,
      maxHoursPerWeek: 40
    },
    {
      id: '2',
      name: 'Mike Chen',
      role: 'UX Designer',
      department: 'Design',
      status: 'on-break',
      current_status: 'on_break',
      availability: {
        monday: ['08:00', '17:00'],
        tuesday: ['08:00', '17:00'],
        wednesday: ['08:00', '17:00'],
        thursday: ['08:00', '17:00'],
        friday: ['08:00', '16:00'],
        saturday: [],
        sunday: []
      },
      qualifications: ['Figma', 'Sketch', 'Adobe Creative Suite'],
      hourlyRate: 65,
      maxHoursPerWeek: 40
    },
    {
      id: '3',
      name: 'Alex Rodriguez',
      role: 'Project Manager',
      department: 'Management',
      status: 'present',
      current_status: 'in',
      availability: {
        monday: ['09:00', '18:00'],
        tuesday: ['09:00', '18:00'],
        wednesday: ['09:00', '18:00'],
        thursday: ['09:00', '18:00'],
        friday: ['09:00', '17:00'],
        saturday: [],
        sunday: []
      },
      qualifications: ['Agile', 'Scrum', 'Project Management'],
      hourlyRate: 85,
      maxHoursPerWeek: 40
    },
    {
      id: '4',
      name: 'David Kim',
      role: 'Frontend Developer',
      department: 'Engineering',
      status: 'on-transfer',
      current_status: 'on_transfer',
      availability: {
        monday: ['10:00', '19:00'],
        tuesday: ['10:00', '19:00'],
        wednesday: ['10:00', '19:00'],
        thursday: ['10:00', '19:00'],
        friday: ['10:00', '19:00'],
        saturday: [],
        sunday: []
      },
      qualifications: ['Vue.js', 'JavaScript', 'CSS'],
      hourlyRate: 70,
      maxHoursPerWeek: 40
    },
    {
      id: '5',
      name: 'Lisa Wang',
      role: 'Backend Developer',
      department: 'Engineering',
      status: 'present',
      current_status: 'in',
      availability: {
        monday: ['09:00', '18:00'],
        tuesday: ['09:00', '18:00'],
        wednesday: ['09:00', '18:00'],
        thursday: ['09:00', '18:00'],
        friday: ['09:00', '18:00'],
        saturday: [],
        sunday: []
      },
      qualifications: ['Python', 'Django', 'PostgreSQL'],
      hourlyRate: 80,
      maxHoursPerWeek: 40
    },
    {
      id: '6',
      name: 'James Wilson',
      role: 'DevOps Engineer',
      department: 'Engineering',
      status: 'absent',
      availability: {
        monday: ['08:00', '17:00'],
        tuesday: ['08:00', '17:00'],
        wednesday: ['08:00', '17:00'],
        thursday: ['08:00', '17:00'],
        friday: ['08:00', '17:00'],
        saturday: [],
        sunday: []
      },
      qualifications: ['AWS', 'Docker', 'Kubernetes'],
      hourlyRate: 90,
      maxHoursPerWeek: 40
    },
    {
      id: '7',
      name: 'Maria Garcia',
      role: 'UI Designer',
      department: 'Design',
      status: 'on-leave',
      availability: {
        monday: ['09:00', '18:00'],
        tuesday: ['09:00', '18:00'],
        wednesday: ['09:00', '18:00'],
        thursday: ['09:00', '18:00'],
        friday: ['09:00', '18:00'],
        saturday: [],
        sunday: []
      },
      qualifications: ['Adobe XD', 'InVision', 'Prototyping'],
      hourlyRate: 60,
      maxHoursPerWeek: 40
    },
    {
      id: '8',
      name: 'Robert Taylor',
      role: 'Product Manager',
      department: 'Management',
      status: 'present',
      availability: {
        monday: ['09:00', '18:00'],
        tuesday: ['09:00', '18:00'],
        wednesday: ['09:00', '18:00'],
        thursday: ['09:00', '18:00'],
        friday: ['09:00', '18:00'],
        saturday: [],
        sunday: []
      },
      qualifications: ['Product Strategy', 'User Research', 'Analytics'],
      hourlyRate: 95,
      maxHoursPerWeek: 40
    },
    {
      id: '9',
      name: 'Jennifer Brown',
      role: 'QA Engineer',
      department: 'Engineering',
      status: 'on-break',
      availability: {
        monday: ['10:00', '19:00'],
        tuesday: ['10:00', '19:00'],
        wednesday: ['10:00', '19:00'],
        thursday: ['10:00', '19:00'],
        friday: ['10:00', '19:00'],
        saturday: [],
        sunday: []
      },
      qualifications: ['Selenium', 'Jest', 'Manual Testing'],
      hourlyRate: 65,
      maxHoursPerWeek: 40
    },
    {
      id: '10',
      name: 'Christopher Lee',
      role: 'Full Stack Developer',
      department: 'Engineering',
      status: 'present',
      availability: {
        monday: ['09:00', '18:00'],
        tuesday: ['09:00', '18:00'],
        wednesday: ['09:00', '18:00'],
        thursday: ['09:00', '18:00'],
        friday: ['09:00', '18:00'],
        saturday: [],
        sunday: []
      },
      qualifications: ['React', 'Node.js', 'MongoDB'],
      hourlyRate: 85,
      maxHoursPerWeek: 40
    },
    {
      id: '11',
      name: 'Amanda Davis',
      role: 'Marketing Manager',
      department: 'Marketing',
      status: 'present',
      availability: {
        monday: ['09:00', '18:00'],
        tuesday: ['09:00', '18:00'],
        wednesday: ['09:00', '18:00'],
        thursday: ['09:00', '18:00'],
        friday: ['09:00', '18:00'],
        saturday: [],
        sunday: []
      },
      qualifications: ['Digital Marketing', 'SEO', 'Analytics'],
      hourlyRate: 70,
      maxHoursPerWeek: 40
    },
    {
      id: '12',
      name: 'Kevin Martinez',
      role: 'Sales Representative',
      department: 'Sales',
      status: 'on-break',
      availability: {
        monday: ['08:00', '17:00'],
        tuesday: ['08:00', '17:00'],
        wednesday: ['08:00', '17:00'],
        thursday: ['08:00', '17:00'],
        friday: ['08:00', '17:00'],
        saturday: [],
        sunday: []
      },
      qualifications: ['CRM', 'Lead Generation', 'Negotiation'],
      hourlyRate: 55,
      maxHoursPerWeek: 40
    },
    {
      id: '13',
      name: 'Rachel Green',
      role: 'Content Writer',
      department: 'Marketing',
      status: 'on-transfer',
      availability: {
        monday: ['10:00', '19:00'],
        tuesday: ['10:00', '19:00'],
        wednesday: ['10:00', '19:00'],
        thursday: ['10:00', '19:00'],
        friday: ['10:00', '19:00'],
        saturday: [],
        sunday: []
      },
      qualifications: ['Copywriting', 'SEO Writing', 'Content Strategy'],
      hourlyRate: 50,
      maxHoursPerWeek: 40
    },
    {
      id: '14',
      name: 'Thomas Anderson',
      role: 'Data Analyst',
      department: 'Analytics',
      status: 'present',
      availability: {
        monday: ['09:00', '18:00'],
        tuesday: ['09:00', '18:00'],
        wednesday: ['09:00', '18:00'],
        thursday: ['09:00', '18:00'],
        friday: ['09:00', '18:00'],
        saturday: [],
        sunday: []
      },
      qualifications: ['SQL', 'Python', 'Tableau'],
      hourlyRate: 75,
      maxHoursPerWeek: 40
    },
    {
      id: '15',
      name: 'Nicole White',
      role: 'HR Specialist',
      department: 'Human Resources',
      status: 'absent',
      availability: {
        monday: ['09:00', '18:00'],
        tuesday: ['09:00', '18:00'],
        wednesday: ['09:00', '18:00'],
        thursday: ['09:00', '18:00'],
        friday: ['09:00', '18:00'],
        saturday: [],
        sunday: []
      },
      qualifications: ['Recruitment', 'Employee Relations', 'HRIS'],
      hourlyRate: 60,
      maxHoursPerWeek: 40
    },
    {
      id: '16',
      name: 'Daniel Clark',
      role: 'Mobile Developer',
      department: 'Engineering',
      status: 'on-leave',
      availability: {
        monday: ['10:00', '19:00'],
        tuesday: ['10:00', '19:00'],
        wednesday: ['10:00', '19:00'],
        thursday: ['10:00', '19:00'],
        friday: ['10:00', '19:00'],
        saturday: [],
        sunday: []
      },
      qualifications: ['React Native', 'iOS', 'Android'],
      hourlyRate: 80,
      maxHoursPerWeek: 40
    },
    {
      id: '17',
      name: 'Samantha Turner',
      role: 'Graphic Designer',
      department: 'Design',
      status: 'present',
      availability: {
        monday: ['09:00', '18:00'],
        tuesday: ['09:00', '18:00'],
        wednesday: ['09:00', '18:00'],
        thursday: ['09:00', '18:00'],
        friday: ['09:00', '18:00'],
        saturday: [],
        sunday: []
      },
      qualifications: ['Photoshop', 'Illustrator', 'Brand Design'],
      hourlyRate: 55,
      maxHoursPerWeek: 40
    },
    {
      id: '18',
      name: 'Mark Johnson',
      role: 'System Administrator',
      department: 'IT',
      status: 'on-break',
      availability: {
        monday: ['08:00', '17:00'],
        tuesday: ['08:00', '17:00'],
        wednesday: ['08:00', '17:00'],
        thursday: ['08:00', '17:00'],
        friday: ['08:00', '17:00'],
        saturday: [],
        sunday: []
      },
      qualifications: ['Windows Server', 'Linux', 'Network Security'],
      hourlyRate: 70,
      maxHoursPerWeek: 40
    },
    {
      id: '19',
      name: 'Laura Miller',
      role: 'Business Analyst',
      department: 'Analytics',
      status: 'present',
      availability: {
        monday: ['09:00', '18:00'],
        tuesday: ['09:00', '18:00'],
        wednesday: ['09:00', '18:00'],
        thursday: ['09:00', '18:00'],
        friday: ['09:00', '18:00'],
        saturday: [],
        sunday: []
      },
      qualifications: ['Requirements Analysis', 'Process Improvement', 'Documentation'],
      hourlyRate: 65,
      maxHoursPerWeek: 40
    },
    {
      id: '20',
      name: 'Alex Thompson',
      role: 'Customer Success Manager',
      department: 'Customer Success',
      status: 'on-transfer',
      availability: {
        monday: ['09:00', '18:00'],
        tuesday: ['09:00', '18:00'],
        wednesday: ['09:00', '18:00'],
        thursday: ['09:00', '18:00'],
        friday: ['09:00', '18:00'],
        saturday: [],
        sunday: []
      },
      qualifications: ['Customer Relations', 'Account Management', 'Retention'],
      hourlyRate: 60,
      maxHoursPerWeek: 40
    },
    {
      id: '21',
      name: 'Jessica Adams',
      role: 'Financial Analyst',
      department: 'Finance',
      status: 'present',
      availability: {
        monday: ['09:00', '18:00'],
        tuesday: ['09:00', '18:00'],
        wednesday: ['09:00', '18:00'],
        thursday: ['09:00', '18:00'],
        friday: ['09:00', '18:00'],
        saturday: [],
        sunday: []
      },
      qualifications: ['Financial Modeling', 'Excel', 'Budgeting'],
      hourlyRate: 70,
      maxHoursPerWeek: 40
    },
    {
      id: '22',
      name: 'Ryan Cooper',
      role: 'Security Engineer',
      department: 'IT',
      status: 'absent',
      availability: {
        monday: ['10:00', '19:00'],
        tuesday: ['10:00', '19:00'],
        wednesday: ['10:00', '19:00'],
        thursday: ['10:00', '19:00'],
        friday: ['10:00', '19:00'],
        saturday: [],
        sunday: []
      },
      qualifications: ['Cybersecurity', 'Penetration Testing', 'Compliance'],
      hourlyRate: 95,
      maxHoursPerWeek: 40
    },
    {
      id: '23',
      name: 'Michelle Lewis',
      role: 'Operations Manager',
      department: 'Operations',
      status: 'on-leave',
      availability: {
        monday: ['08:00', '17:00'],
        tuesday: ['08:00', '17:00'],
        wednesday: ['08:00', '17:00'],
        thursday: ['08:00', '17:00'],
        friday: ['08:00', '17:00'],
        saturday: [],
        sunday: []
      },
      qualifications: ['Process Optimization', 'Supply Chain', 'Quality Control'],
      hourlyRate: 75,
      maxHoursPerWeek: 40
    },
    {
      id: '24',
      name: 'Brandon Wright',
      role: 'Technical Writer',
      department: 'Engineering',
      status: 'present',
      availability: {
        monday: ['09:00', '18:00'],
        tuesday: ['09:00', '18:00'],
        wednesday: ['09:00', '18:00'],
        thursday: ['09:00', '18:00'],
        friday: ['09:00', '18:00'],
        saturday: [],
        sunday: []
      },
      qualifications: ['Technical Documentation', 'API Documentation', 'User Guides'],
      hourlyRate: 55,
      maxHoursPerWeek: 40
    },
    {
      id: '25',
      name: 'Stephanie Hall',
      role: 'Training Coordinator',
      department: 'Human Resources',
      status: 'on-break',
      availability: {
        monday: ['09:00', '18:00'],
        tuesday: ['09:00', '18:00'],
        wednesday: ['09:00', '18:00'],
        thursday: ['09:00', '18:00'],
        friday: ['09:00', '18:00'],
        saturday: [],
        sunday: []
      },
      qualifications: ['Training Development', 'LMS', 'Employee Onboarding'],
      hourlyRate: 50,
      maxHoursPerWeek: 40
    },
    {
      id: '26',
      name: 'Elena Rodriguez',
      role: 'Senior UX Designer',
      department: 'Design',
      status: 'present',
      availability: {
        monday: ['09:00', '18:00'],
        tuesday: ['09:00', '18:00'],
        wednesday: ['09:00', '18:00'],
        thursday: ['09:00', '18:00'],
        friday: ['09:00', '18:00'],
        saturday: [],
        sunday: []
      },
      qualifications: ['User Research', 'Prototyping', 'Design Systems'],
      hourlyRate: 75,
      maxHoursPerWeek: 40
    },
    {
      id: '27',
      name: 'Marcus Thompson',
      role: 'DevOps Lead',
      department: 'Engineering',
      status: 'on-break',
      availability: {
        monday: ['08:00', '17:00'],
        tuesday: ['08:00', '17:00'],
        wednesday: ['08:00', '17:00'],
        thursday: ['08:00', '17:00'],
        friday: ['08:00', '17:00'],
        saturday: [],
        sunday: []
      },
      qualifications: ['AWS', 'Terraform', 'CI/CD'],
      hourlyRate: 100,
      maxHoursPerWeek: 40
    },
    {
      id: '28',
      name: 'Sophie Chen',
      role: 'Product Designer',
      department: 'Design',
      status: 'on-transfer',
      availability: {
        monday: ['10:00', '19:00'],
        tuesday: ['10:00', '19:00'],
        wednesday: ['10:00', '19:00'],
        thursday: ['10:00', '19:00'],
        friday: ['10:00', '19:00'],
        saturday: [],
        sunday: []
      },
      qualifications: ['Figma', 'Design Thinking', 'User Testing'],
      hourlyRate: 70,
      maxHoursPerWeek: 40
    },
    {
      id: '29',
      name: 'Carlos Mendez',
      role: 'Senior Backend Developer',
      department: 'Engineering',
      status: 'absent',
      availability: {
        monday: ['09:00', '18:00'],
        tuesday: ['09:00', '18:00'],
        wednesday: ['09:00', '18:00'],
        thursday: ['09:00', '18:00'],
        friday: ['09:00', '18:00'],
        saturday: [],
        sunday: []
      },
      qualifications: ['Java', 'Spring Boot', 'Microservices'],
      hourlyRate: 90,
      maxHoursPerWeek: 40
    },
    {
      id: '30',
      name: 'Isabella Foster',
      role: 'Content Marketing Manager',
      department: 'Marketing',
      status: 'on-leave',
      availability: {
        monday: ['09:00', '18:00'],
        tuesday: ['09:00', '18:00'],
        wednesday: ['09:00', '18:00'],
        thursday: ['09:00', '18:00'],
        friday: ['09:00', '18:00'],
        saturday: [],
        sunday: []
      },
      qualifications: ['Content Strategy', 'SEO', 'Social Media'],
      hourlyRate: 65,
      maxHoursPerWeek: 40
    }
  ];

  // Get current week dates for shift data
  const getCurrentWeekDates = (): string[] => {
    const today = new Date();
    const start = new Date(today);
    const day = start.getDay();
    const diff = start.getDate() - day + (day === 0 ? -6 : 1);
    start.setDate(diff);
    
    const week: string[] = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(start);
      day.setDate(start.getDate() + i);
      const dateStr = day.toISOString().split('T')[0];
      if (dateStr) {
        week.push(dateStr);
      }
    }
    return week;
  };

  const currentWeekDates = getCurrentWeekDates();
  // Ensure we have all 7 dates, use fallback if needed
  const getDate = (index: number): string => {
    const date = currentWeekDates[index];
    if (date) return date;
    const fallback = new Date().toISOString().split('T')[0];
    return fallback || '';
  };

  const shifts: Shift[] = [
    // Monday shifts
    {
      id: '1',
      workerId: '1',
      date: getDate(0), // Monday
      startTime: '09:00',
      endTime: '17:00',
      role: 'Senior Developer',
      location: 'Main Office',
      status: 'scheduled'
    },
    {
      id: '2',
      workerId: '2',
      date: getDate(0), // Monday
      startTime: '08:00',
      endTime: '16:00',
      role: 'UX Designer',
      location: 'Main Office',
      status: 'confirmed'
    },
    {
      id: '3',
      workerId: '3',
      date: getDate(0), // Monday
      startTime: '09:00',
      endTime: '18:00',
      role: 'Project Manager',
      location: 'Main Office',
      status: 'completed'
    },
    {
      id: '4',
      workerId: '4',
      date: getDate(0), // Monday
      startTime: '10:00',
      endTime: '19:00',
      role: 'Frontend Developer',
      location: 'Remote',
      status: 'cancelled'
    },
    {
      id: '5',
      workerId: '5',
      date: getDate(0), // Monday
      startTime: '09:00',
      endTime: '18:00',
      role: 'Backend Developer',
      location: 'Main Office',
      status: 'scheduled'
    },
    {
      id: '6',
      workerId: '6',
      date: getDate(0), // Monday
      startTime: '08:00',
      endTime: '17:00',
      role: 'DevOps Engineer',
      location: 'Data Center',
      status: 'confirmed'
    },
    {
      id: '7',
      workerId: '7',
      date: getDate(0), // Monday
      startTime: '09:00',
      endTime: '18:00',
      role: 'UI Designer',
      location: 'Main Office',
      status: 'scheduled'
    },
    {
      id: '8',
      workerId: '8',
      date: getDate(0), // Monday
      startTime: '09:00',
      endTime: '18:00',
      role: 'Product Manager',
      location: 'Main Office',
      status: 'completed'
    },
    {
      id: '9',
      workerId: '9',
      date: getDate(0), // Monday
      startTime: '10:00',
      endTime: '19:00',
      role: 'QA Engineer',
      location: 'Testing Lab',
      status: 'scheduled'
    },
    {
      id: '10',
      workerId: '10',
      date: getDate(0), // Monday
      startTime: '09:00',
      endTime: '18:00',
      role: 'Full Stack Developer',
      location: 'Main Office',
      status: 'confirmed'
    },
    // Additional Monday shifts for more variety
    {
      id: '56',
      workerId: '11',
      date: getDate(0), // Monday
      startTime: '09:00',
      endTime: '13:00',
      role: 'Marketing Manager',
      location: 'Main Office',
      status: 'scheduled'
    },
    {
      id: '56b',
      workerId: '11',
      date: getDate(0), // Monday
      startTime: '14:00',
      endTime: '18:00',
      role: 'Marketing Manager',
      location: 'Client Site',
      status: 'confirmed'
    },
    {
      id: '57',
      workerId: '12',
      date: getDate(0), // Monday
      startTime: '08:00',
      endTime: '17:00',
      role: 'Sales Representative',
      location: 'Remote',
      status: 'confirmed'
    },
    {
      id: '58',
      workerId: '14',
      date: getDate(0), // Monday
      startTime: '10:00',
      endTime: '19:00',
      role: 'Data Analyst',
      location: 'Main Office',
      status: 'scheduled'
    },
    {
      id: '59',
      workerId: '17',
      date: getDate(0), // Monday
      startTime: '09:00',
      endTime: '18:00',
      role: 'Graphic Designer',
      location: 'Main Office',
      status: 'completed'
    },
    {
      id: '60',
      workerId: '21',
      date: getDate(0), // Monday
      startTime: '09:00',
      endTime: '18:00',
      role: 'Financial Analyst',
      location: 'Main Office',
      status: 'scheduled'
    },
    // Tuesday shifts
    {
      id: '11',
      workerId: '1',
      date: getDate(1), // Tuesday
      startTime: '09:00',
      endTime: '17:00',
      role: 'Senior Developer',
      location: 'Main Office',
      status: 'scheduled'
    },
    {
      id: '12',
      workerId: '2',
      date: getDate(1), // Tuesday
      startTime: '08:00',
      endTime: '16:00',
      role: 'UX Designer',
      location: 'Main Office',
      status: 'confirmed'
    },
    {
      id: '13',
      workerId: '3',
      date: getDate(1), // Tuesday
      startTime: '09:00',
      endTime: '18:00',
      role: 'Project Manager',
      location: 'Main Office',
      status: 'scheduled'
    },
    {
      id: '14',
      workerId: '4',
      date: getDate(1), // Tuesday
      startTime: '10:00',
      endTime: '19:00',
      role: 'Frontend Developer',
      location: 'Remote',
      status: 'cancelled'
    },
    {
      id: '15',
      workerId: '5',
      date: getDate(1), // Tuesday
      startTime: '09:00',
      endTime: '18:00',
      role: 'Backend Developer',
      location: 'Main Office',
      status: 'completed'
    },
    {
      id: '16',
      workerId: '6',
      date: getDate(1), // Tuesday
      startTime: '08:00',
      endTime: '17:00',
      role: 'DevOps Engineer',
      location: 'Data Center',
      status: 'scheduled'
    },
    {
      id: '17',
      workerId: '7',
      date: getDate(1), // Tuesday
      startTime: '09:00',
      endTime: '18:00',
      role: 'UI Designer',
      location: 'Main Office',
      status: 'confirmed'
    },
    {
      id: '18',
      workerId: '8',
      date: getDate(1), // Tuesday
      startTime: '09:00',
      endTime: '18:00',
      role: 'Product Manager',
      location: 'Main Office',
      status: 'scheduled'
    },
    {
      id: '19',
      workerId: '9',
      date: getDate(1), // Tuesday
      startTime: '10:00',
      endTime: '19:00',
      role: 'QA Engineer',
      location: 'Testing Lab',
      status: 'completed'
    },
    {
      id: '20',
      workerId: '10',
      date: getDate(1), // Tuesday
      startTime: '09:00',
      endTime: '18:00',
      role: 'Full Stack Developer',
      location: 'Main Office',
      status: 'scheduled'
    },
    // Additional Tuesday shifts
    {
      id: '61',
      workerId: '13',
      date: getDate(1), // Tuesday
      startTime: '10:00',
      endTime: '19:00',
      role: 'Content Writer',
      location: 'Remote',
      status: 'confirmed'
    },
    {
      id: '62',
      workerId: '15',
      date: getDate(1), // Tuesday
      startTime: '09:00',
      endTime: '18:00',
      role: 'HR Specialist',
      location: 'Main Office',
      status: 'scheduled'
    },
    {
      id: '63',
      workerId: '19',
      date: getDate(1), // Tuesday
      startTime: '09:00',
      endTime: '18:00',
      role: 'Business Analyst',
      location: 'Main Office',
      status: 'completed'
    },
    // Wednesday shifts
    {
      id: '21',
      workerId: '1',
      date: getDate(2), // Wednesday
      startTime: '09:00',
      endTime: '17:00',
      role: 'Senior Developer',
      location: 'Main Office',
      status: 'confirmed'
    },
    {
      id: '22',
      workerId: '2',
      date: getDate(2), // Wednesday
      startTime: '08:00',
      endTime: '16:00',
      role: 'UX Designer',
      location: 'Main Office',
      status: 'scheduled'
    },
    {
      id: '23',
      workerId: '3',
      date: getDate(2), // Wednesday
      startTime: '09:00',
      endTime: '18:00',
      role: 'Project Manager',
      location: 'Main Office',
      status: 'completed'
    },
    {
      id: '24',
      workerId: '4',
      date: getDate(2), // Wednesday
      startTime: '10:00',
      endTime: '19:00',
      role: 'Frontend Developer',
      location: 'Remote',
      status: 'scheduled'
    },
    {
      id: '25',
      workerId: '5',
      date: getDate(2), // Wednesday
      startTime: '09:00',
      endTime: '18:00',
      role: 'Backend Developer',
      location: 'Main Office',
      status: 'confirmed'
    },
    {
      id: '26',
      workerId: '6',
      date: getDate(2), // Wednesday
      startTime: '08:00',
      endTime: '17:00',
      role: 'DevOps Engineer',
      location: 'Data Center',
      status: 'cancelled'
    },
    {
      id: '27',
      workerId: '7',
      date: getDate(2), // Wednesday
      startTime: '09:00',
      endTime: '18:00',
      role: 'UI Designer',
      location: 'Main Office',
      status: 'scheduled'
    },
    {
      id: '28',
      workerId: '8',
      date: getDate(2), // Wednesday
      startTime: '09:00',
      endTime: '18:00',
      role: 'Product Manager',
      location: 'Main Office',
      status: 'completed'
    },
    {
      id: '29',
      workerId: '9',
      date: getDate(2), // Wednesday
      startTime: '10:00',
      endTime: '19:00',
      role: 'QA Engineer',
      location: 'Testing Lab',
      status: 'scheduled'
    },
    {
      id: '30',
      workerId: '10',
      date: getDate(2), // Wednesday
      startTime: '09:00',
      endTime: '18:00',
      role: 'Full Stack Developer',
      location: 'Main Office',
      status: 'confirmed'
    },
    // Thursday shifts
    {
      id: '31',
      workerId: '1',
      date: getDate(3), // Thursday
      startTime: '09:00',
      endTime: '17:00',
      role: 'Senior Developer',
      location: 'Main Office',
      status: 'scheduled'
    },
    {
      id: '32',
      workerId: '2',
      date: getDate(3), // Thursday
      startTime: '08:00',
      endTime: '16:00',
      role: 'UX Designer',
      location: 'Main Office',
      status: 'completed'
    },
    {
      id: '33',
      workerId: '3',
      date: getDate(3), // Thursday
      startTime: '09:00',
      endTime: '18:00',
      role: 'Project Manager',
      location: 'Main Office',
      status: 'scheduled'
    },
    {
      id: '34',
      workerId: '4',
      date: getDate(3), // Thursday
      startTime: '10:00',
      endTime: '19:00',
      role: 'Frontend Developer',
      location: 'Remote',
      status: 'confirmed'
    },
    {
      id: '35',
      workerId: '5',
      date: getDate(3), // Thursday
      startTime: '09:00',
      endTime: '18:00',
      role: 'Backend Developer',
      location: 'Main Office',
      status: 'scheduled'
    },
    {
      id: '36',
      workerId: '6',
      date: getDate(3), // Thursday
      startTime: '08:00',
      endTime: '17:00',
      role: 'DevOps Engineer',
      location: 'Data Center',
      status: 'completed'
    },
    {
      id: '37',
      workerId: '7',
      date: getDate(3), // Thursday
      startTime: '09:00',
      endTime: '18:00',
      role: 'UI Designer',
      location: 'Main Office',
      status: 'cancelled'
    },
    {
      id: '38',
      workerId: '8',
      date: getDate(3), // Thursday
      startTime: '09:00',
      endTime: '18:00',
      role: 'Product Manager',
      location: 'Main Office',
      status: 'scheduled'
    },
    {
      id: '39',
      workerId: '9',
      date: getDate(3), // Thursday
      startTime: '10:00',
      endTime: '19:00',
      role: 'QA Engineer',
      location: 'Testing Lab',
      status: 'confirmed'
    },
    {
      id: '40',
      workerId: '10',
      date: getDate(3), // Thursday
      startTime: '09:00',
      endTime: '18:00',
      role: 'Full Stack Developer',
      location: 'Main Office',
      status: 'scheduled'
    },
    // Friday shifts
    {
      id: '41',
      workerId: '1',
      date: getDate(4), // Friday
      startTime: '09:00',
      endTime: '17:00',
      role: 'Senior Developer',
      location: 'Main Office',
      status: 'confirmed'
    },
    {
      id: '42',
      workerId: '2',
      date: getDate(4), // Friday
      startTime: '08:00',
      endTime: '16:00',
      role: 'UX Designer',
      location: 'Main Office',
      status: 'scheduled'
    },
    {
      id: '43',
      workerId: '3',
      date: getDate(4), // Friday
      startTime: '09:00',
      endTime: '18:00',
      role: 'Project Manager',
      location: 'Main Office',
      status: 'completed'
    },
    {
      id: '44',
      workerId: '4',
      date: getDate(4), // Friday
      startTime: '10:00',
      endTime: '19:00',
      role: 'Frontend Developer',
      location: 'Remote',
      status: 'scheduled'
    },
    {
      id: '45',
      workerId: '5',
      date: getDate(4), // Friday
      startTime: '09:00',
      endTime: '18:00',
      role: 'Backend Developer',
      location: 'Main Office',
      status: 'confirmed'
    },
    {
      id: '46',
      workerId: '6',
      date: getDate(4), // Friday
      startTime: '08:00',
      endTime: '17:00',
      role: 'DevOps Engineer',
      location: 'Data Center',
      status: 'scheduled'
    },
    {
      id: '47',
      workerId: '7',
      date: getDate(4), // Friday
      startTime: '09:00',
      endTime: '18:00',
      role: 'UI Designer',
      location: 'Main Office',
      status: 'completed'
    },
    {
      id: '48',
      workerId: '8',
      date: getDate(4), // Friday
      startTime: '09:00',
      endTime: '18:00',
      role: 'Product Manager',
      location: 'Main Office',
      status: 'scheduled'
    },
    {
      id: '49',
      workerId: '9',
      date: getDate(4), // Friday
      startTime: '10:00',
      endTime: '19:00',
      role: 'QA Engineer',
      location: 'Testing Lab',
      status: 'confirmed'
    },
    {
      id: '50',
      workerId: '10',
      date: getDate(4), // Friday
      startTime: '09:00',
      endTime: '18:00',
      role: 'Full Stack Developer',
      location: 'Main Office',
      status: 'scheduled'
    },
    // Saturday shifts (some employees work weekends)
    {
      id: '51',
      workerId: '1',
      date: getDate(5), // Saturday
      startTime: '10:00',
      endTime: '16:00',
      role: 'Senior Developer',
      location: 'Remote',
      status: 'scheduled'
    },
    {
      id: '52',
      workerId: '6',
      date: getDate(5), // Saturday
      startTime: '09:00',
      endTime: '15:00',
      role: 'DevOps Engineer',
      location: 'Data Center',
      status: 'confirmed'
    },
    {
      id: '53',
      workerId: '18',
      date: getDate(5), // Saturday
      startTime: '08:00',
      endTime: '14:00',
      role: 'System Administrator',
      location: 'Main Office',
      status: 'scheduled'
    },
    // Sunday shifts
    {
      id: '54',
      workerId: '6',
      date: getDate(6), // Sunday
      startTime: '10:00',
      endTime: '16:00',
      role: 'DevOps Engineer',
      location: 'Data Center',
      status: 'confirmed'
    },
    {
      id: '55',
      workerId: '22',
      date: getDate(6), // Sunday
      startTime: '09:00',
      endTime: '15:00',
      role: 'Security Engineer',
      location: 'Main Office',
      status: 'scheduled'
    }
  ];

  // Clear all filters
  const clearAllFilters = () => {
    setSelectedDepartment([]);
    setSelectedRole([]);
    setSelectedStatus([]);
    setSearchTerm('');
    setDepartmentSearchTerm('');
    setRoleSearchTerm('');
    setStatusSearchTerm('');
    setCurrentPage(1); // Reset to first page when clearing filters
  };

  // Handle sorting
  const handleSort = (field: typeof sortBy) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  // Select All functions for each filter
  const handleDepartmentSelectAll = () => {
    const allDepartments = getFilteredDepartmentOptions();
    setSelectedDepartment(allDepartments);
  };

  const handleRoleSelectAll = () => {
    const allRoles = getFilteredRoleOptions();
    setSelectedRole(allRoles);
  };

  const handleStatusSelectAll = () => {
    const allStatuses = getFilteredStatusOptions();
    setSelectedStatus(allStatuses);
  };

  // Helper functions for multi-select
  const handleDepartmentToggle = (department: string) => {
    setSelectedDepartment(prev => 
      prev.includes(department) 
        ? prev.filter(d => d !== department)
        : [...prev, department]
    );
  };

  const handleRoleToggle = (role: string) => {
    setSelectedRole(prev => 
      prev.includes(role) 
        ? prev.filter(r => r !== role)
        : [...prev, role]
    );
  };

  const handleStatusToggle = (status: string) => {
    setSelectedStatus(prev => 
      prev.includes(status) 
        ? prev.filter(s => s !== status)
        : [...prev, status]
    );
  };

  // Filter options based on search terms
  const getFilteredDepartmentOptions = () => {
    const departments = [...new Set(employees.map(e => e.department))];
    return departments.filter(dept => 
      dept.toLowerCase().includes(departmentSearchTerm.toLowerCase())
    );
  };

  const getFilteredRoleOptions = () => {
    const roles = [...new Set(employees.map(e => e.role))];
    return roles.filter(role => 
      role.toLowerCase().includes(roleSearchTerm.toLowerCase())
    );
  };

  const getFilteredStatusOptions = () => {
    const statuses = ['confirmed', 'pending', 'cancelled'];
    return statuses.filter(status => 
      status.toLowerCase().includes(statusSearchTerm.toLowerCase())
    );
  };

  const filteredEmployees = useMemo(() => {
    const filtered = employees.filter(employee => {
      const matchesSearch = employee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      employee.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           employee.department.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesDepartment = selectedDepartment.length === 0 || selectedDepartment.includes(employee.department);
      const matchesRole = selectedRole.length === 0 || selectedRole.includes(employee.role);
      
      return matchesSearch && matchesDepartment && matchesRole;
    });

    // Apply sorting
    return filtered.sort((a, b) => {
      let aValue: string;
      let bValue: string;

      switch (sortBy) {
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case 'department':
          aValue = a.department.toLowerCase();
          bValue = b.department.toLowerCase();
          break;
        case 'role':
          aValue = a.role.toLowerCase();
          bValue = b.role.toLowerCase();
          break;
        default:
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
      }

      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [employees, searchTerm, selectedDepartment, selectedRole, sortBy, sortOrder]);

  // Pagination calculations
  const totalItems = filteredEmployees.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedEmployees = filteredEmployees.slice(startIndex, endIndex);

  const getWeekDates = (date: Date) => {
    const start = new Date(date);
    const day = start.getDay();
    const diff = start.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
    start.setDate(diff);
    
    const week = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(start);
      day.setDate(start.getDate() + i);
      week.push(day);
    }
    return week;
  };

  const weekDates = getWeekDates(currentDate);

  const navigateWeek = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    newDate.setDate(currentDate.getDate() + (direction === 'next' ? 7 : -7));
    setCurrentDate(newDate);
  };

  const goToCurrentWeek = () => {
    setCurrentDate(new Date());
  };

  const getWeekRange = () => {
    const start = weekDates[0];
    const end = weekDates[6];
    if (!start || !end) return '';
    return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  };

  const getShiftsForDate = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    return shifts.filter(shift => shift.date === dateStr);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'bg-blue-50 text-status-blue';
      case 'confirmed': return 'bg-green-50 text-status-green';
      case 'completed': return 'bg-green-50 text-status-green';
      case 'cancelled': return 'bg-red-50 text-status-red';
      default: return 'bg-gray-50 text-status-gray';
    }
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground mb-1">Schedule</h1>
          <p className="text-xs text-muted-foreground">Schedule and manage workers shifts efficiently</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <Users className="h-5 w-5 text-teal-600" />
            <div className="text-2xl font-bold text-gray-900">{employees.length}</div>
              <div className="text-sm text-muted-foreground">Total Employees</div>
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <Calendar className="h-5 w-5 text-blue-600" />
            <div className="text-2xl font-bold text-gray-900">{shifts.length}</div>
              <div className="text-sm text-muted-foreground">Scheduled Shifts</div>
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <div className="text-2xl font-bold text-gray-900">
                {shifts.filter(s => s.status === 'confirmed').length}
              </div>
              <div className="text-sm text-muted-foreground">Confirmed</div>
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <div className="text-2xl font-bold text-gray-900">0</div>
              <div className="text-sm text-muted-foreground">Conflicts</div>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="mb-4">
        <div className={`bg-white border border-gray-200 py-6 px-6 ${
          showFilters ? 'rounded-t-lg' : 'rounded-lg'
        }`}>
          <div className="flex items-center justify-between gap-3">
            {/* Search Bar */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search employees by name, email, job title, or employee ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1 border border-gray-200 rounded text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50"
                aria-label="Search employees"
                id="employee-search"
              />
            </div>
            
            <div className="flex items-center gap-2">
              {/* Clear Filters Button - Only show when filters are active */}
              {(selectedDepartment.length > 0 || selectedRole.length > 0 || selectedStatus.length > 0) && (
              <button
                  onClick={clearAllFilters}
                  className="flex items-center gap-2 px-2 py-1 border border-gray-300 rounded transition-colors text-sm bg-white text-gray-700 hover:bg-gray-50"
                  title="Clear all active filters"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Clear filters
                </button>
              )}

              {/* Filters Button */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 px-2 py-1 border border-gray-300 rounded transition-colors text-sm ${
                  showFilters ? 'bg-gray-300 text-black' : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Filter style={{ width: '14px', height: '14px' }} />
                Filters
              </button>

            </div>
          </div>
        </div>
        
        {/* Advanced Filters */}
        {showFilters && (
          <div className="bg-white border-l border-r border-b border-gray-200 rounded-b-lg py-6 px-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
              {/* Department Multi-Select */}
              <div className="relative dropdown-container">
                <div className="px-3 py-1 border border-gray-200 rounded text-sm bg-white min-h-[32px] flex items-center justify-between cursor-pointer hover:bg-gray-50" 
                     onClick={() => setShowDepartmentDropdown(!showDepartmentDropdown)}>
                  <span className="text-gray-700">
                    {selectedDepartment.length === 0 ? 'All Departments' : 
                     selectedDepartment.length === 1 ? selectedDepartment[0] :
                     `${selectedDepartment.length} selected`}
                  </span>
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
              </div>
                {showDepartmentDropdown && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto">
                    <div className="p-2 border-b border-gray-100">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="Search departments..."
                          value={departmentSearchTerm}
                          onChange={(e) => setDepartmentSearchTerm(e.target.value)}
                          className="flex-1 px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-primary/20 focus:border-primary/50"
                          onClick={(e) => e.stopPropagation()}
                        />
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDepartmentSelectAll();
                          }}
                          className="text-xs text-blue-600 hover:text-blue-800 whitespace-nowrap"
                        >
                          Select All
                        </button>
                        {selectedDepartment.length > 0 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedDepartment([]);
                            }}
                            className="text-xs text-gray-500 hover:text-gray-700 whitespace-nowrap"
                          >
                            Clear ({selectedDepartment.length})
                          </button>
                        )}
              </div>
              </div>
                    <div className="py-1">
                      {getFilteredDepartmentOptions().map((department) => (
                        <label key={department} className="flex items-center px-3 py-1 hover:bg-gray-50 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedDepartment.includes(department)}
                            onChange={() => handleDepartmentToggle(department)}
                            className="mr-2 rounded border-gray-300 text-primary focus:ring-primary/20"
                          />
                          <span className="text-sm text-gray-700">{department}</span>
                        </label>
                      ))}
            </div>
          </div>
        )}
      </div>

              {/* Role Multi-Select */}
              <div className="relative dropdown-container">
                <div className="px-3 py-1 border border-gray-200 rounded text-sm bg-white min-h-[32px] flex items-center justify-between cursor-pointer hover:bg-gray-50" 
                     onClick={() => setShowRoleDropdown(!showRoleDropdown)}>
                  <span className="text-gray-700">
                    {selectedRole.length === 0 ? 'All Roles' : 
                     selectedRole.length === 1 ? selectedRole[0] :
                     `${selectedRole.length} selected`}
                  </span>
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
                {showRoleDropdown && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto">
                    <div className="p-2 border-b border-gray-100">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="Search roles..."
                          value={roleSearchTerm}
                          onChange={(e) => setRoleSearchTerm(e.target.value)}
                          className="flex-1 px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-primary/20 focus:border-primary/50"
                          onClick={(e) => e.stopPropagation()}
                        />
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRoleSelectAll();
                          }}
                          className="text-xs text-blue-600 hover:text-blue-800 whitespace-nowrap"
                        >
                          Select All
                        </button>
                        {selectedRole.length > 0 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedRole([]);
                            }}
                            className="text-xs text-gray-500 hover:text-gray-700 whitespace-nowrap"
                          >
                            Clear ({selectedRole.length})
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="py-1">
                      {getFilteredRoleOptions().map((role) => (
                        <label key={role} className="flex items-center px-3 py-1 hover:bg-gray-50 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedRole.includes(role)}
                            onChange={() => handleRoleToggle(role)}
                            className="mr-2 rounded border-gray-300 text-primary focus:ring-primary/20"
                          />
                          <span className="text-sm text-gray-700">{role}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Status Multi-Select */}
              <div className="relative dropdown-container">
                <div className="px-3 py-1 border border-gray-200 rounded text-sm bg-white min-h-[32px] flex items-center justify-between cursor-pointer hover:bg-gray-50" 
                     onClick={() => setShowStatusDropdown(!showStatusDropdown)}>
                  <span className="text-gray-700">
                    {selectedStatus.length === 0 ? 'All Statuses' : 
                     selectedStatus.length === 1 ? (selectedStatus[0] || '').replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase()) :
                     `${selectedStatus.length} selected`}
                  </span>
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
                {showStatusDropdown && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto">
                    <div className="p-2 border-b border-gray-100">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="Search statuses..."
                          value={statusSearchTerm}
                          onChange={(e) => setStatusSearchTerm(e.target.value)}
                          className="flex-1 px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-primary/20 focus:border-primary/50"
                          onClick={(e) => e.stopPropagation()}
                        />
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStatusSelectAll();
                          }}
                          className="text-xs text-blue-600 hover:text-blue-800 whitespace-nowrap"
                        >
                          Select All
                        </button>
                        {selectedStatus.length > 0 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedStatus([]);
                            }}
                            className="text-xs text-gray-500 hover:text-gray-700 whitespace-nowrap"
                          >
                            Clear ({selectedStatus.length})
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="py-1">
                      {getFilteredStatusOptions().map((status) => (
                        <label key={status} className="flex items-center px-3 py-1 hover:bg-gray-50 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedStatus.includes(status)}
                            onChange={() => handleStatusToggle(status)}
                            className="mr-2 rounded border-gray-300 text-primary focus:ring-primary/20"
                          />
                          <span className="text-sm text-gray-700 capitalize">{status}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-between items-center">
              <button 
                onClick={clearAllFilters}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                Clear all filters
              </button>
              <div className="flex gap-3 items-center">
                <span className="text-xs text-gray-500">Sort by:</span>
                <button 
                  onClick={() => handleSort('name')}
                  className={`text-xs hover:text-gray-900 flex items-center gap-1 ${
                    sortBy === 'name' ? 'text-gray-900 font-medium' : 'text-gray-600'
                  }`}
                >
                  Name
                  {sortBy === 'name' && (sortOrder === 'asc' ? <SortAsc className="w-3 h-3" /> : <SortDesc className="w-3 h-3" />)}
                </button>
                <button 
                  onClick={() => handleSort('department')}
                  className={`text-xs hover:text-gray-900 flex items-center gap-1 ${
                    sortBy === 'department' ? 'text-gray-900 font-medium' : 'text-gray-600'
                  }`}
                >
                  Department
                  {sortBy === 'department' && (sortOrder === 'asc' ? <SortAsc className="w-3 h-3" /> : <SortDesc className="w-3 h-3" />)}
                </button>
                <button 
                  onClick={() => handleSort('role')}
                  className={`text-xs hover:text-gray-900 flex items-center gap-1 ${
                    sortBy === 'role' ? 'text-gray-900 font-medium' : 'text-gray-600'
                  }`}
                >
                  Role
                  {sortBy === 'role' && (sortOrder === 'asc' ? <SortAsc className="w-3 h-3" /> : <SortDesc className="w-3 h-3" />)}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Week Navigation */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigateWeek('prev')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Previous week"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="text-center">
              <h3 className="text-lg font-semibold text-gray-900">{getWeekRange()}</h3>
              <p className="text-sm text-gray-500">Week of {weekDates[0]?.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) || ''}</p>
            </div>
            <button
              onClick={() => navigateWeek('next')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Next week"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          <button
              onClick={goToCurrentWeek}
              className="px-2 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 transition-colors"
            aria-label="Go to current week"
          >
              This Week
          </button>
          </div>
          
          {/* Action Buttons */}
          <div className="flex items-center gap-2 pr-2">
            {/* Actions Dropdown */}
            <div className="relative dropdown-container">
              <button
                onClick={() => {
                  setShowActionsDropdown(!showActionsDropdown);
                  setShowAddDropdown(false); // Close Add dropdown when opening Actions
                }}
                className="flex items-center gap-2 px-2 py-1 border border-gray-300 rounded text-sm bg-white text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Actions
                <ChevronDown className="w-4 h-4" />
              </button>
              {showActionsDropdown && (
                <div className="absolute right-0 top-full mt-1 w-56 bg-white border border-gray-200 rounded shadow-lg z-10">
                  <div className="py-1">
                    {/* Week actions */}
                    <div className="px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Week actions
                    </div>
                    <button className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                      <Copy className="w-4 h-4" />
                      Copy previous week
                    </button>
                    <button className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                      <Wand2 className="w-4 h-4" />
                      Auto assign week
                    </button>
                    <button className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                      <Minus className="w-4 h-4" />
                      Clear week
                    </button>
                    <button className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                      <EyeOff className="w-4 h-4" />
                      Unpublish week
                    </button>
                    <button className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                      <UserX className="w-4 h-4" />
                      Unassign week
                    </button>
                    <button className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                      <Download className="w-4 h-4" />
                      Export week
                    </button>
                    <button className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                      <Printer className="w-4 h-4" />
                      Print week
                    </button>
                    
                    {/* Divider */}
                    <div className="border-t border-gray-100 my-1"></div>
                    
                    {/* Templates */}
                    <div className="px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Templates
                    </div>
                    <button className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                      <Download className="w-4 h-4" />
                      Save week as template
                    </button>
                    <button className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                      <Upload className="w-4 h-4" />
                      Load week template
                    </button>
                    
                    {/* Divider */}
                    <div className="border-t border-gray-100 my-1"></div>
                    
                    {/* Shareable links */}
                    <div className="px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Shareable links
                    </div>
                    <button className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                      <Share2 className="w-4 h-4" />
                      Share schedule
                    </button>
                    <button className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                      <Menu className="w-4 h-4" />
                      Manage shared links
                    </button>
                  </div>
                </div>
              )}
            </div>
            
            {/* Add Dropdown */}
            <div className="relative dropdown-container">
              <button
                onClick={() => {
                  setShowAddDropdown(!showAddDropdown);
                  setShowActionsDropdown(false); // Close Actions dropdown when opening Add
                }}
                className="flex items-center gap-2 px-2 py-1 border border-gray-300 rounded text-sm bg-white text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Add
                <ChevronDown className="w-4 h-4" />
              </button>
              {showAddDropdown && (
                <div className="absolute right-0 top-full mt-1 w-56 bg-white border border-gray-200 rounded shadow-lg z-10">
                  <div className="py-1">
                    {/* Shifts section */}
                    <button className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                      <Plus className="w-4 h-4" />
                      Add single shift
                    </button>
                    <button className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                      <Plus className="w-4 h-4" />
                      Add multiple shifts
                    </button>
                    <button className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                      <FileSpreadsheet className="w-4 h-4" />
                      Import shifts from Excel
                    </button>
                    <button className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                      <Copy className="w-4 h-4" />
                      Add from shift templates
                    </button>
                    
                    {/* Divider */}
                    <div className="border-t border-gray-100 my-1"></div>
                    
                    {/* Time off section */}
                    <button className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                      <CalendarX className="w-4 h-4" />
                      Add unavailability
                    </button>
                    <button className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                      <CalendarX className="w-4 h-4" />
                      Add time off
                    </button>
                  </div>
                </div>
              )}
            </div>
            
            {/* Publish Button */}
            <button
              className="flex items-center gap-2 px-2 py-1 rounded text-sm text-white transition-colors"
              style={{ backgroundColor: 'var(--primary-brand-hex)' }}
            >
              <span>Publish (4)</span>
              <div className="w-px h-4 bg-white/30"></div>
              <Bell className="w-4 h-4" />
            </button>
          </div>
        </div>
        </div>

      {/* Calendar */}
      <div className="bg-white border border-gray-200 rounded-lg mb-4 overflow-hidden">
        {/* Week View */}
        {viewMode === 'week' && (
          <div>
            {/* Header Row */}
            <div className="flex border-b border-gray-200">
            {/* Employee Column Header */}
              <div className="w-64 p-3 pl-6 border-r border-gray-200 bg-gray-50">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8"></div>
              <span className="text-sm font-medium text-gray-700">Employee</span>
                </div>
            </div>
            
            {/* Day Headers */}
            {weekDates.map((date, index) => (
                <div key={index} className={`flex-1 p-3 bg-gray-50 flex items-center justify-center ${index < weekDates.length - 1 ? 'border-r border-gray-200' : ''}`}>
                  <div className="flex items-center justify-center gap-1">
                <div className="text-sm font-medium text-gray-700">
                  {date.toLocaleDateString('en-US', { weekday: 'short' })}
                </div>
                    <div className="text-sm text-gray-500">
                  {date.getDate()}
                    </div>
                </div>
              </div>
            ))}
            </div>
            
            {/* Employee Rows */}
            {paginatedEmployees.map((employee, employeeIndex) => (
              <div key={employee.id} className="flex">
                {/* Employee Info */}
                <div className={`w-64 p-3 pl-6 border-r border-gray-200 flex items-center gap-3 ${employeeIndex < paginatedEmployees.length - 1 ? 'border-b border-gray-200' : ''}`}>
                  <div className="relative">
                    <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-white text-sm font-medium">
                      {generateAvatarInitials(employee.name.split(' ')[0] || '', employee.name.split(' ')[1] || '')}
                    </div>
                    <div 
                      className={`absolute -bottom-0.5 -right-0.5 ${getDotSize('sm')} rounded-full border border-white`}
                      style={{ backgroundColor: getCurrentStatusDotColor(employee.current_status || mapStatusToCurrentStatus(employee.status)) }}>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">
                      {employee.name}
                    </div>
                    <div className="text-xs text-gray-500 truncate">
                      {employee.role}
                    </div>
                  </div>
                </div>
                
                {/* Day Cells */}
                {weekDates.map((date, dayIndex) => {
                  const dayShifts = getShiftsForDate(date).filter(shift => shift.workerId === employee.id);
                  return (
                      <div key={dayIndex} className={`group flex-1 min-h-[60px] relative ${dayIndex < weekDates.length - 1 ? 'border-r border-gray-200' : ''} ${employeeIndex < paginatedEmployees.length - 1 ? 'border-b border-gray-200' : ''}`}>
                      {dayShifts.length > 0 ? (
                        <>
                          {dayShifts.map((shift, shiftIndex) => (
                              <div
                                key={shift.id}
                                className={`absolute text-xs cursor-pointer transition-all duration-200 flex flex-col justify-center group-hover:left-6 ${getStatusColor(shift.status)} ${
                                  dayShifts.length > 1 
                                    ? shiftIndex === 0 
                                      ? 'top-0 bottom-1/2 border-b border-gray-300 left-0 right-0' 
                                      : 'top-1/2 bottom-0 left-0 right-0'
                                    : 'inset-0'
                                }`}
                                onClick={() => setSelectedEmployee(employee.id)}
                              style={{ 
                                borderLeft: '3px solid',
                                borderLeftColor: shift.status === 'scheduled' ? 'var(--status-blue)' : 
                                                shift.status === 'confirmed' ? 'var(--status-green)' : 
                                                shift.status === 'completed' ? 'var(--status-green)' : 
                                                shift.status === 'cancelled' ? 'var(--status-red)' : 'var(--status-gray)'
                              }}
                            >
                              <div className="px-2">
                                <div className="font-medium text-xs leading-tight truncate">{shift.role}</div>
                                <div className="text-xs opacity-75 leading-tight flex items-center gap-1">
                                  <Clock className="w-2.5 h-2.5" />
                                  {shift.startTime} – {shift.endTime}
                                </div>
                              </div>
                            </div>
                          ))}
                          {/* Add button that appears on hover */}
                          <button 
                            className="absolute top-1/2 left-1 transform -translate-y-1/2 w-4 h-4 bg-white border border-gray-200 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-gray-50"
                            onClick={() => {
                              // TODO: Add shift functionality
                              console.log('Add shift for', employee.name, 'on', date.toDateString());
                            }}
                            aria-label={`Add shift for ${employee.name}`}
                          >
                            <Plus className="w-2.5 h-2.5 text-gray-400" />
                          </button>
                        </>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <button 
                            className="opacity-0 group-hover:opacity-100 w-6 h-6 border border-gray-200 rounded flex items-center justify-center hover:bg-gray-50 transition-all duration-200"
                            onClick={() => {
                              // TODO: Add shift functionality
                              console.log('Add shift for', employee.name, 'on', date.toDateString());
                            }}
                            aria-label={`Add shift for ${employee.name}`}
                          >
                            <Plus className="w-3 h-3 text-gray-400" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      <div className="bg-white border border-gray-200 rounded-lg py-6 px-6">
              <div className="flex items-center justify-between">
          {/* Items Per Page Selector */}
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
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
            <span className="text-xs text-gray-600">
              Showing {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems}
            </span>
                  </div>
          
          {/* Page Navigation */}
          {totalPages > 1 && (
            <div className="flex items-center gap-3">
              {/* Previous Button */}
                  <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className={`flex items-center gap-1 px-2 py-1 border rounded text-xs transition-colors ${
                  currentPage === 1
                    ? 'border-gray-200 text-gray-400 cursor-not-allowed'
                    : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
                aria-label="Go to previous page"
              >
                <ChevronLeft className="w-3 h-3" />
                Previous
                  </button>

              {/* Page Numbers */}
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
                      aria-label={`Go to page ${pageNum}`}
                    >
                      {pageNum}
                  </button>
                  );
                })}
              </div>

              {/* Next Button */}
                  <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className={`flex items-center gap-1 px-2 py-1 border rounded text-xs transition-colors ${
                  currentPage === totalPages
                    ? 'border-gray-200 text-gray-400 cursor-not-allowed'
                    : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
                aria-label="Go to next page"
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
