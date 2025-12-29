import { useEffect } from 'react';
import { useSubmoduleNav } from '../../hooks/useSubmoduleNav';
import { Flag, Users, Calendar, Clock } from 'lucide-react';

const AttendanceFlags = () => {
  const { registerSubmodules } = useSubmoduleNav();

  useEffect(() => {
    registerSubmodules('Time & Attendance', [
      { id: 'whos-working', label: "Who's Working", href: '/time-and-attendance/whos-working', icon: Users },
      { id: 'team-attendance', label: 'Team Attendance', href: '/time-and-attendance/team-attendance', icon: Clock },
      { id: 'team-attendance3', label: 'Team Attendance 3', href: '/time-and-attendance/team-attendance3', icon: Clock },
      { id: 'attendance-flags', label: 'Attendance Flags', href: '/time-and-attendance/attendance-flags', icon: Flag }
    ]);
  }, [registerSubmodules]);

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Attendance Flags</h1>
        <p className="text-gray-600 mt-1">Manage and analyze attendance flags and incidents</p>
      </div>

      <div className="flex flex-col items-center justify-center min-h-[400px] bg-white rounded-lg border border-gray-200">
        <div className="text-center">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Flag className="w-8 h-8 text-blue-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Coming Soon</h2>
          <p className="text-gray-600 max-w-md">
            The Attendance Flags module is currently under development. This feature will allow you to:
          </p>
          <ul className="text-left text-gray-600 max-w-md mt-4 space-y-2">
            <li className="flex items-center">
              <div className="w-2 h-2 bg-blue-600 rounded-full mr-3"></div>
              View and manage all attendance flags
            </li>
            <li className="flex items-center">
              <div className="w-2 h-2 bg-blue-600 rounded-full mr-3"></div>
              Analyze flag patterns and trends
            </li>
            <li className="flex items-center">
              <div className="w-2 h-2 bg-blue-600 rounded-full mr-3"></div>
              Set up automated flag rules
            </li>
            <li className="flex items-center">
              <div className="w-2 h-2 bg-blue-600 rounded-full mr-3"></div>
              Generate flag reports and insights
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default AttendanceFlags;
