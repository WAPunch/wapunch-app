import { useEffect } from 'react';
import { useSubmoduleNav } from '../../hooks/useSubmoduleNav';
import { Calendar } from 'lucide-react';

export default function TimeOff() {
  const { registerSubmodules } = useSubmoduleNav();

  useEffect(() => {
      registerSubmodules('Schedule', [
        { id: 'schedule', label: 'Schedule', href: '/schedule/schedule', icon: Calendar },
        { id: 'time-off', label: 'Time Off', href: '/schedule/time-off', icon: Calendar },
      ]);
  }, [registerSubmodules]);

  return (
    <div className="p-6">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
          <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">Time Off</h2>
          <p className="text-gray-600">Coming soon</p>
        </div>
      </div>
    </div>
  );
}

