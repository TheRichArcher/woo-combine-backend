import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import CreateLeagueForm from '../components/CreateLeagueForm';
// WelcomeLayout removed to support persistent navigation

export { CreateLeagueForm };

export default function CreateLeague() {
  return (
    <div className="min-h-[calc(100vh-64px)] bg-surface-subtle flex flex-col items-center justify-start pt-8 pb-8 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8 text-center">
        <CreateLeagueForm />
      </div>
    </div>
  );
}
