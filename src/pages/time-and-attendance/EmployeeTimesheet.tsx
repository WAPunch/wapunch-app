import { useEffect, useState, useMemo } from 'react';
import { useSubmoduleNav } from '../../hooks/useSubmoduleNav';
import { 
  Clock, 
  Calendar, 
  ChevronLeft, 
  ChevronRight,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock as ClockIcon,
  ArrowLeft,
  User,
  MapPin,
  Building,
  Flag,
  MessageSquare,
  MoreVertical
} from 'lucide-react';
import { router } from '../../lib/router';

interface TimeEntry {
  id: string;
  clockIn: string;
  clockOut: string | null;
  project: string;
  activity: string;
  hours: number;
  notes?: string;
}

interface Session {
  id: string;
  type: 'work' | 'transfer' | 'break' | 'leave' | 'custom';
  startTime: string;
  endTime: string | null;
  duration: number; // in hours
  location: string;
  description: string;
  notes?: string;
}

interface DailyAttendance {
  date: string;
  timeEntries: TimeEntry[];
  sessions: Session[];
  totalHours: number;
  status: 'present' | 'absent' | 'late' | 'partial' | 'on-break' | 'on-leave';
  location: string;
  notes?: string;
}

interface Employee {
  id: string;
  employeeId: string;
  employeeName: string;
  role: string;
  department: string;
  email: string;
  location: string;
  avatar?: string;
  phone?: string;
  status?: string;
}

export default function EmployeeTimesheet() {
  const { setBreadcrumbs, clearSubmoduleNav } = useSubmoduleNav();
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [weeklyAttendance, setWeeklyAttendance] = useState<DailyAttendance[]>([]);
  const [employeeList, setEmployeeList] = useState<Employee[]>([]);
  const [currentEmployeeIndex, setCurrentEmployeeIndex] = useState(0);

  // Mock employee list (in a real app, this would come from an API)
  const mockEmployees: Employee[] = [
    {
      id: '1',
      employeeId: '1',
      employeeName: 'John Doe',
      role: 'Software Engineer',
      department: 'Engineering',
      email: 'john.doe@company.com',
      phone: '+1 (555) 123-4567',
      location: 'San Francisco, CA',
      status: 'present',
      avatar: undefined
    },
    {
      id: '2',
      employeeId: '2',
      employeeName: 'Jane Smith',
      role: 'Product Manager',
      department: 'Product',
      email: 'jane.smith@company.com',
      phone: '+1 (555) 234-5678',
      location: 'New York, NY',
      status: 'present',
      avatar: undefined
    },
    {
      id: '3',
      employeeId: '3',
      employeeName: 'Mike Johnson',
      role: 'UX Designer',
      department: 'Design',
      email: 'mike.johnson@company.com',
      phone: '+1 (555) 345-6789',
      location: 'Seattle, WA',
      status: 'on-break',
      avatar: undefined
    },
    {
      id: '4',
      employeeId: '4',
      employeeName: 'Sarah Wilson',
      role: 'Marketing Specialist',
      department: 'Marketing',
      email: 'sarah.wilson@company.com',
      phone: '+1 (555) 456-7890',
      location: 'Austin, TX',
      status: 'present',
      avatar: undefined
    },
    {
      id: '5',
      employeeId: '5',
      employeeName: 'David Brown',
      role: 'DevOps Engineer',
      department: 'Engineering',
      email: 'david.brown@company.com',
      phone: '+1 (555) 567-8901',
      location: 'Portland, OR',
      status: 'absent',
      avatar: undefined
    }
  ];

  // Employee navigation functions
  const goToPreviousEmployee = () => {
    if (currentEmployeeIndex > 0) {
      const newIndex = currentEmployeeIndex - 1;
      const prevEmployee = employeeList[newIndex];
      if (prevEmployee) {
        setCurrentEmployeeIndex(newIndex);
        setEmployee(prevEmployee);
      }
    }
  };

  const goToNextEmployee = () => {
    if (currentEmployeeIndex < employeeList.length - 1) {
      const newIndex = currentEmployeeIndex + 1;
      const nextEmployee = employeeList[newIndex];
      if (nextEmployee) {
        setCurrentEmployeeIndex(newIndex);
        setEmployee(nextEmployee);
      }
    }
  };

  useEffect(() => {
    // Clear submodule navigation and set breadcrumbs
    clearSubmoduleNav();
    
    // Initialize employee list
    setEmployeeList(mockEmployees);
    
    // Load employee data from sessionStorage
    const selectedEmployeeData = sessionStorage.getItem('selectedEmployee');
    if (selectedEmployeeData) {
      try {
        const parsedEmployee = JSON.parse(selectedEmployeeData);
        const mappedEmployee: Employee = {
          id: parsedEmployee.id,
          employeeId: parsedEmployee.employeeId,
          employeeName: parsedEmployee.employeeName,
          role: parsedEmployee.role,
          department: parsedEmployee.department,
          email: parsedEmployee.email || `${parsedEmployee.employeeName.toLowerCase().replace(' ', '.')}@company.com`,
          location: parsedEmployee.location || 'Office'
        };
        setEmployee(mappedEmployee);
        
        // Find the index of the current employee in the list
        const employeeIndex = mockEmployees.findIndex(emp => emp.id === mappedEmployee.id);
        if (employeeIndex !== -1) {
          setCurrentEmployeeIndex(employeeIndex);
        }
        
        // Set breadcrumbs
        const slug = mappedEmployee.employeeName.toLowerCase().replace(/\s+/g, '-');
        setBreadcrumbs([
          { label: 'Time & Attendance' },
          { label: 'Team Attendance', href: '/time-and-attendance/team-attendance' },
          { label: mappedEmployee.employeeName }
        ]);
      } catch (error) {
        console.error('Error parsing employee data:', error);
        // Fallback employee data
        const fallbackEmployee: Employee = {
          id: '1',
          employeeId: '1',
          employeeName: 'John Doe',
          role: 'Software Developer',
          department: 'Engineering',
          email: 'john.doe@company.com',
          location: 'Office'
        };
        setEmployee(fallbackEmployee);
        setCurrentEmployeeIndex(0);
        setBreadcrumbs([
          { label: 'Time & Attendance' },
          { label: 'Team Attendance', href: '/time-and-attendance/team-attendance' },
          { label: 'John Doe' }
        ]);
      }
    } else {
      // No employee in sessionStorage, use first employee
      const firstEmployee = mockEmployees[0];
      if (firstEmployee) {
        setEmployee(firstEmployee);
        setCurrentEmployeeIndex(0);
        setBreadcrumbs([
          { label: 'Time & Attendance' },
          { label: 'Team Attendance', href: '/time-and-attendance/team-attendance' },
          { label: firstEmployee.employeeName }
        ]);
      }
    }
  }, [setBreadcrumbs, clearSubmoduleNav]);

  // Generate weekly attendance data
  useEffect(() => {
    if (employee) {
      const weekData = generateWeeklyAttendance(employee, currentWeek);
      setWeeklyAttendance(weekData);
    }
  }, [employee, currentWeek]);

  const generateWeeklyAttendance = (emp: Employee, weekStart: Date): DailyAttendance[] => {
    const weekDates = getWeekDates(weekStart);
    const mockData: DailyAttendance[] = [];

    weekDates.forEach((date, index) => {
      const dayOfWeek = date.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      
      if (isWeekend) {
        const dateStr = date.toISOString().split('T')[0];
        if (dateStr) {
          mockData.push({
            date: dateStr,
            timeEntries: [],
            sessions: [],
            totalHours: 0,
            status: 'on-leave',
            location: emp.location,
            notes: 'Weekend'
          });
        }
      } else {
        // Generate mock time entries and sessions for weekdays
        const timeEntries: TimeEntry[] = [];
        const sessions: Session[] = [];
        let totalHours = 0;
        let status: DailyAttendance['status'] = 'present';

        // Randomly generate 1-3 time entries per day
        const numEntries = Math.floor(Math.random() * 3) + 1;
        const projects = ['Project Alpha', 'Project Beta', 'Project Gamma', 'Project Delta'];
        const activities = ['Development', 'Code Review', 'Team Meeting', 'Client Call', 'Documentation', 'Testing'];

        for (let i = 0; i < numEntries; i++) {
          const clockIn = `${8 + Math.floor(Math.random() * 2)}:${Math.floor(Math.random() * 60).toString().padStart(2, '0')}`;
          const hours = 2 + Math.random() * 4; // 2-6 hours per entry
          const clockInHour = parseInt(clockIn.split(':')[0] || '8');
          const clockOut = `${clockInHour + Math.floor(hours)}:${Math.floor((hours % 1) * 60).toString().padStart(2, '0')}`;
          const dateStr = date.toISOString().split('T')[0] || '';
          const projectIndex = Math.floor(Math.random() * projects.length);
          const activityIndex = Math.floor(Math.random() * activities.length);
          
          timeEntries.push({
            id: `${emp.id}-${dateStr}-${i}`,
            clockIn,
            clockOut,
            project: projects[projectIndex] || '',
            activity: activities[activityIndex] || '',
            hours: Math.round(hours * 100) / 100,
            notes: `Entry ${i + 1} for ${date.toLocaleDateString()}`
          });
          
          totalHours += hours;
        }

        // Generate sessions grouped by type: work, custom, transfer, break, leave
        const sessionTypes: Session['type'][] = ['work', 'custom', 'transfer', 'break', 'leave'];
        const descriptions = {
          work: ['Development work', 'Code review', 'Team collaboration', 'Client meeting'],
          transfer: ['Location transfer', 'Department transfer', 'Site visit'],
          break: ['Lunch break', 'Coffee break', 'Rest break'],
          leave: ['Sick leave', 'Personal leave', 'Vacation day'],
          custom: ['Training session', 'Special project', 'Maintenance work']
        };
        
        let sessionCounter = 0;
        
        // Generate sessions grouped by type
        sessionTypes.forEach(sessionType => {
          // Randomly decide how many sessions of this type (0-2 for most types, 0-1 for leave)
          const maxSessions = sessionType === 'leave' ? 1 : 2;
          const numSessionsOfType = Math.floor(Math.random() * (maxSessions + 1));
          
          for (let i = 0; i < numSessionsOfType; i++) {
            const startHour = 8 + Math.floor(Math.random() * 8); // 8 AM to 4 PM
            const startMinute = Math.floor(Math.random() * 60);
            const duration = sessionType === 'leave' ? (Math.random() > 0.5 ? 8 : 4) : (0.5 + Math.random() * 3); // 0.5-3.5 hours, or 4/8 for leave
            
            const startTime = `${startHour.toString().padStart(2, '0')}:${startMinute.toString().padStart(2, '0')}`;
            const endHour = startHour + Math.floor(duration);
            const endMinute = (startMinute + Math.floor((duration % 1) * 60)) % 60;
            const endTime = `${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`;
            
            sessions.push({
              id: `${emp.id}-${date.toISOString().split('T')[0]}-session-${sessionCounter}`,
              type: sessionType,
              startTime,
              endTime,
              duration: Math.round(duration * 100) / 100,
              location: emp.location,
              description: descriptions[sessionType]?.[Math.floor(Math.random() * (descriptions[sessionType]?.length || 1))] || '',
              notes: `${sessionType} session ${i + 1}`
            });
            
            sessionCounter++;
          }
        });

        // Determine status based on total hours
        if (totalHours === 0) {
          status = 'absent';
        } else if (totalHours < 6) {
          status = 'partial';
        } else if (timeEntries[0]?.clockIn && parseInt(timeEntries[0].clockIn.split(':')[0] || '0') > 9) {
          status = 'late';
        }

        const dateStr = date.toISOString().split('T')[0];
        if (dateStr) {
          mockData.push({
            date: dateStr,
            timeEntries,
            sessions,
            totalHours: Math.round(totalHours * 100) / 100,
            status,
            location: emp.location,
            notes: `${numEntries} time entries, ${sessions.length} sessions`
          });
        }
      }
    });

    return mockData;
  };

  const getWeekDates = (date: Date): Date[] => {
    const weekDates: Date[] = [];
    const startOfWeek = new Date(date);
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
    startOfWeek.setDate(diff);
    
    for (let i = 0; i < 7; i++) {
      const weekDate = new Date(startOfWeek);
      weekDate.setDate(startOfWeek.getDate() + i);
      weekDates.push(weekDate);
    }
    
    return weekDates;
  };

  const navigateWeek = (direction: 'prev' | 'next') => {
    const newWeek = new Date(currentWeek);
    newWeek.setDate(currentWeek.getDate() + (direction === 'next' ? 7 : -7));
    setCurrentWeek(newWeek);
  };

  const goToCurrentWeek = () => {
    setCurrentWeek(new Date());
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'present':
        return (
          <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-50 text-status-green">
            Present
          </span>
        );
      case 'absent':
        return (
          <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-50 text-status-red">
            Absent
          </span>
        );
      case 'late':
        return (
          <span className="px-2 py-1 rounded-full text-xs font-medium bg-orange-50 text-status-orange">
            Late
          </span>
        );
      case 'partial':
        return (
          <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-50 text-status-blue">
            Partial
          </span>
        );
      case 'on-break':
        return (
          <span className="px-2 py-1 rounded-full text-xs font-medium bg-purple-50 text-status-purple">
            On Break
          </span>
        );
      case 'on-leave':
        return (
          <span className="px-2 py-1 rounded-full text-xs font-medium bg-neutral-gray text-white">
            On Leave
          </span>
        );
      default:
        return (
          <span className="px-2 py-1 rounded-full text-xs font-medium bg-neutral-gray text-white">
            Unknown
          </span>
        );
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'present':
        return <CheckCircle className="w-4 h-4 text-status-green" />;
      case 'absent':
        return <XCircle className="w-4 h-4 text-status-red" />;
      case 'late':
        return <AlertTriangle className="w-4 h-4 text-status-orange" />;
      case 'partial':
        return <ClockIcon className="w-4 h-4 text-status-blue" />;
      case 'on-break':
        return <ClockIcon className="w-4 h-4 text-status-purple" />;
      default:
        return <ClockIcon className="w-4 h-4 text-neutral-gray" />;
    }
  };

  const getSessionAvatarStyle = (sessionType: Session['type']) => {
    switch (sessionType) {
      case 'work':
        return 'bg-green-100 text-status-green border border-green-200';
      case 'transfer':
        return 'bg-blue-100 text-status-blue border border-blue-200';
      case 'break':
        return 'bg-yellow-100 text-status-yellow border border-yellow-200';
      case 'leave':
        return 'bg-purple-100 text-status-purple border border-purple-200';
      case 'custom':
        return 'bg-gray-100 text-status-gray border border-gray-200';
      default:
        return 'bg-gray-100 text-status-gray border border-gray-200';
    }
  };

  const getSessionLabel = (session: Session, allSessions: Session[], currentIndex: number) => {
    const typeLabels = {
      work: 'Work Session',
      transfer: 'Transfer',
      break: 'Break',
      leave: session.duration >= 8 ? 'Leave (Full Day)' : 'Partial Leave',
      custom: 'Custom Session'
    };
    
    // Count how many sessions of the same type have appeared before this one
    const sessionsOfSameType = allSessions.slice(0, currentIndex + 1).filter(s => s.type === session.type);
    const sessionNumber = sessionsOfSameType.length;
    
    return `${typeLabels[session.type]} ${sessionNumber}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const getWeekRange = () => {
    const weekDates = getWeekDates(currentWeek);
    const startDate = weekDates[0];
    const endDate = weekDates[6];
    if (!startDate || !endDate) return '';
    return `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  };

  const totalWeeklyHours = useMemo(() => {
    return weeklyAttendance.reduce((sum, day) => sum + day.totalHours, 0);
  }, [weeklyAttendance]);

  const totalWeeklyOvertime = useMemo(() => {
    return weeklyAttendance.reduce((sum, day) => {
      return sum + day.sessions.reduce((daySum, session) => {
        const overtimeHours = Math.max(0, session.duration - 8);
        return daySum + overtimeHours;
      }, 0);
    }, 0);
  }, [weeklyAttendance]);

  const getDailyOvertime = (day: DailyAttendance) => {
    return day.sessions.reduce((sum: number, session: Session) => {
      const overtimeHours = Math.max(0, session.duration - 8);
      return sum + overtimeHours;
    }, 0);
  };

  const handleBackToTeamAttendance = () => {
    router.navigate('/time-and-attendance/team-attendance');
  };

  if (!employee) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <h2 className="text-2xl font-semibold text-muted-foreground mb-2">No employee selected</h2>
            <p className="text-muted-foreground">Please select an employee to view their timesheet</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center text-white text-lg font-medium">
              {employee.employeeName.split(' ').map(n => n[0]).join('')}
            </div>
            <div>
              <h1 className="text-xl font-semibold text-foreground mb-1">
                {employee.employeeName} - Weekly Timesheet
              </h1>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{employee.role}</span>
                <span>•</span>
                <span>{employee.department}</span>
                <span>•</span>
                <span>{employee.location}</span>
              </div>
            </div>
          </div>
          
          {/* Employee Navigation */}
          <div className="flex items-center gap-3">
            <button
              onClick={goToPreviousEmployee}
              disabled={currentEmployeeIndex === 0}
              className={`flex items-center gap-1 px-2 py-1 border rounded text-xs transition-colors ${
                currentEmployeeIndex === 0
                  ? 'border-gray-200 text-gray-400 cursor-not-allowed'
                  : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
              title="Previous employee"
            >
              <ChevronLeft className="w-3 h-3" />
              Previous
            </button>
            
            <button
              onClick={goToNextEmployee}
              disabled={currentEmployeeIndex === employeeList.length - 1}
              className={`flex items-center gap-1 px-2 py-1 border rounded text-xs transition-colors ${
                currentEmployeeIndex === employeeList.length - 1
                  ? 'border-gray-200 text-gray-400 cursor-not-allowed'
                  : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
              title="Next employee"
            >
              Next
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>

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
              <p className="text-sm text-gray-500">Week of {currentWeek.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
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
          <div className="text-right text-base text-gray-600 pr-2">
            <span className="font-medium text-gray-900">Total Time: </span>
            <span className="font-medium text-primary">{totalWeeklyHours.toFixed(0)}hr</span>
            <span className="mx-3">•</span>
            <span className="font-medium text-gray-900">Overtime: </span>
            <span className="font-medium text-primary">{totalWeeklyOvertime.toFixed(0)}hr</span>
          </div>
        </div>
      </div>

      {/* Weekly Attendance */}
      <div className="space-y-12">
        {weeklyAttendance.map((day) => (
          <div key={day.date} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            {/* Day Header */}
            <div className="bg-white px-6 py-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Calendar className="w-5 h-5 text-gray-500" />
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900">{formatDate(day.date)}</h4>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right text-sm text-gray-500">
                    <span className="font-medium">Total Time: {day.totalHours.toFixed(0)}hr</span>
                    <span className="mx-3">•</span>
                    <span className="font-medium">Overtime: {getDailyOvertime(day).toFixed(0)}hr</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Sessions */}
            <div className="bg-white overflow-hidden">
              {day.sessions.length > 0 ? (
                <div>
                  {/* Group sessions by type */}
                  {(() => {
                    const groupedSessions = day.sessions.reduce((groups, session) => {
                      if (!groups[session.type]) {
                        groups[session.type] = [];
                      }
                      groups[session.type]?.push(session);
                      return groups;
                    }, {} as Record<string, Session[]>);

                    return Object.entries(groupedSessions).map(([sessionType, sessions]) => {
                      const sessionTypeKey = sessionType as Session['type'];
                      
                      return (
                        <div key={sessionType} className={Object.keys(groupedSessions).indexOf(sessionType) > 0 ? 'border-t border-gray-200' : ''}>
                          {/* Table for this session type */}
                          <table className="w-full table-fixed">
                            <thead className="bg-gray-100">
                              <tr>
                                <th className="text-left py-3 px-4 font-medium text-gray-900 text-xs w-80">
                                  {sessionType === 'work' ? 'Work Sessions' :
                                   sessionType === 'custom' ? 'Custom Sessions' :
                                   sessionType === 'transfer' ? 'Transfers' :
                                   sessionType === 'break' ? 'Breaks' :
                                   'Leaves'} ({sessions.length})
                                </th>
                                {sessionTypeKey === 'transfer' ? (
                                  <>
                                    <th className="text-left py-3 px-4 font-medium text-gray-900 text-xs w-min">Location A</th>
                                    <th className="text-left py-3 px-4 font-medium text-gray-900 text-xs w-min">Location B</th>
                                  </>
                                ) : sessionTypeKey === 'break' ? (
                                  <>
                                    <th className="text-left py-3 px-4 font-medium text-gray-900 text-xs">Type</th>
                                    <th className="text-left py-3 px-4 font-medium text-gray-900 text-xs">Description</th>
                                  </>
                                ) : (
                                  <>
                                    <th className="text-left py-3 px-4 font-medium text-gray-900 text-xs w-min">Location</th>
                                    <th className="text-left py-3 px-4 font-medium text-gray-900 text-xs">Job</th>
                                  </>
                                )}
                                <th className="text-left py-3 px-2 font-medium text-gray-900 text-xs w-24">Start Time</th>
                                <th className="text-left py-3 px-2 font-medium text-gray-900 text-xs w-24">End Time</th>
                                <th className="text-left py-3 px-2 font-medium text-gray-900 text-xs w-24">Total Time</th>
                                <th className="text-left py-3 px-2 font-medium text-gray-900 text-xs w-24">
                                  {sessionTypeKey === 'transfer' || sessionTypeKey === 'break' ? '' : 'Overtime'}
                                </th>
                                <th className="text-left py-3 px-2 font-medium text-gray-900 text-xs w-12">
                                  <div className="w-4 h-4 rounded-full border border-gray-900 flex items-center justify-center">
                                    <span className="text-[10px] font-medium text-gray-900">M</span>
                                  </div>
                                </th>
                                <th className="text-left py-3 px-2 font-medium text-gray-900 text-xs w-12">
                                  <Flag className="w-4 h-4 inline text-gray-900" />
                                </th>
                                <th className="text-left py-3 px-2 font-medium text-gray-900 text-xs w-20">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                              {sessions.map((session, index) => (
                                <tr key={session.id} className="hover:bg-gray-50 transition-colors">
                                  <td className="py-2 px-4 w-80">
                                    <div className="flex items-center gap-3">
                                      <div className={`w-8 h-8 rounded-full ${getSessionAvatarStyle(session.type)} flex items-center justify-center text-sm font-medium`}>
                                        {index + 1}
                                      </div>
                                      <span className="text-sm text-gray-900">{getSessionLabel(session, sessions, index)}</span>
                                    </div>
                                  </td>
                                  {sessionTypeKey === 'transfer' ? (
                                    <>
                                      <td className="py-2 px-4 w-min">
                                        <span className="text-sm text-gray-900">{session.location || '--'}</span>
                                      </td>
                                      <td className="py-2 px-4 w-min">
                                        <span className="text-sm text-gray-900">{session.description || '--'}</span>
                                      </td>
                                    </>
                                  ) : sessionTypeKey === 'break' ? (
                                    <>
                                      <td className="py-2 px-4">
                                        <span className="text-sm text-gray-900">
                                          {session.description.includes('Lunch') ? 'Paid' : 'Non Paid'}
                                        </span>
                                      </td>
                                      <td className="py-2 px-4">
                                        <span className="text-sm text-gray-900">{session.description}</span>
                                      </td>
                                    </>
                                  ) : (
                                    <>
                                      <td className="py-2 px-4 w-min">
                                        <span className="text-sm text-gray-900">{session.location || '--'}</span>
                                      </td>
                                      <td className="py-2 px-4">
                                        <span className="text-sm text-gray-900">{session.description}</span>
                                      </td>
                                    </>
                                  )}
                                  <td className="py-2 px-2 w-24">
                                    <span className="text-sm text-gray-900">{session.startTime}</span>
                                  </td>
                                  <td className="py-2 px-2 w-24">
                                    <span className="text-sm text-gray-900">{session.endTime || '--'}</span>
                                  </td>
                                  <td className="py-2 px-2 w-24">
                                    <span className="text-sm font-medium text-gray-900">{session.duration.toFixed(2)}h</span>
                                  </td>
                                  <td className="py-2 px-2 w-24">
                                    {sessionTypeKey === 'transfer' || sessionTypeKey === 'break' ? (
                                      <span className="text-sm text-gray-400">--</span>
                                    ) : (
                                      (() => {
                                        const overtimeHours = Math.max(0, session.duration - 8);
                                        return overtimeHours > 0 ? (
                                          <span className="text-sm font-medium text-status-orange">{overtimeHours.toFixed(2)}h</span>
                                        ) : (
                                          <span className="text-sm text-gray-400">--</span>
                                        );
                                      })()
                                    )}
                                  </td>
                                  <td className="py-2 px-2 w-12">
                                    <div className="w-4 h-4 rounded-full border border-gray-900 flex items-center justify-center">
                                      <span className="text-[10px] font-medium text-gray-900">M</span>
                                    </div>
                                  </td>
                                  <td className="py-2 px-2 w-12">
                                    <Flag className="w-4 h-4 text-gray-400" />
                                  </td>
                                  <td className="py-2 px-2 w-20">
                                    <div className="flex items-center">
                                      <button className="p-1 text-gray-400 hover:text-gray-600 transition-colors">
                                        <MessageSquare className="w-4 h-4" />
                                      </button>
                                      <button className="p-1 text-gray-400 hover:text-gray-600 transition-colors">
                                        <MoreVertical className="w-4 h-4" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      );
                    });
                  })()}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Clock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">No sessions for this day</p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
