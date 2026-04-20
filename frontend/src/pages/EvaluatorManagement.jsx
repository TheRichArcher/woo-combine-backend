import React, { useEffect } from 'react';
import EvaluatorManagement from '../components/EvaluatorManagement';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const EvaluatorManagementPage = () => {
  const { userRole } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (userRole === 'viewer') {
      navigate('/live-standings', { replace: true });
    }
  }, [navigate, userRole]);

  if (userRole === 'viewer') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white border border-gray-200 rounded-2xl shadow-sm p-6 text-center">
          <p className="text-sm font-medium text-gray-700">This section is only available to event organizers</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <EvaluatorManagement />
    </div>
  );
};

export default EvaluatorManagementPage;