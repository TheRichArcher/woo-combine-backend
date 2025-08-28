/**
 * Unified layout for all authenticated pages in WooCombine
 * 
 * Features:
 * - Consistent spacing and typography
 * - Mobile-first responsive design
 * - Optional breadcrumb navigation
 * - Standardized card patterns
 * - Proper scroll behavior
 * 
 * @param title - Page title (displayed in header)
 * @param subtitle - Optional subtitle or description
 * @param breadcrumbs - Array of breadcrumb items [{label: string, href?: string}]
 * @param actions - Optional action buttons for page header
 * @param maxWidth - Container max width ('sm', 'md', 'lg', 'xl', 'full')
 * @param showEventSelector - Whether to show event selection context
 * @param children - Page content
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Calendar } from 'lucide-react';
import Navigation from '../Navigation';
import { useEvent } from '../../context/EventContext';
import { parseISO, isValid, format } from 'date-fns';

export default function AppLayout({ 
  title,
  subtitle,
  breadcrumbs = [],
  actions,
  maxWidth = 'lg',
  showEventSelector = true,
  children 
}) {
  const { selectedEvent } = useEvent();

  const maxWidthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md', 
    lg: 'max-w-4xl',
    xl: 'max-w-6xl',
    full: 'max-w-full'
  };

  const formatEventDate = (date) => {
    if (!date) return 'Date TBD';
    const parsed = parseISO(date);
    return isValid(parsed) ? format(parsed, 'MM/dd/yyyy') : 'Date TBD';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      
      <main className="pt-4 pb-8">
        <div className={`mx-auto px-4 sm:px-6 ${maxWidthClasses[maxWidth]}`}>
          
          {/* Breadcrumbs */}
          {breadcrumbs.length > 0 && (
            <nav className="mb-4">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                {breadcrumbs.map((crumb, index) => (
                  <React.Fragment key={index}>
                    {index > 0 && <ChevronRight className="w-4 h-4 text-gray-400" />}
                    {crumb.href ? (
                      <Link 
                        to={crumb.href}
                        className="hover:text-cmf-primary transition-colors"
                      >
                        {crumb.label}
                      </Link>
                    ) : (
                      <span className={index === breadcrumbs.length - 1 ? 'text-gray-900 font-medium' : ''}>
                        {crumb.label}
                      </span>
                    )}
                  </React.Fragment>
                ))}
              </div>
            </nav>
          )}

          {/* Event Context Banner */}
          {showEventSelector && selectedEvent && (
            <div className="mb-6 bg-white rounded-xl shadow-sm border border-cmf-primary/20 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-cmf-primary/10 rounded-full flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-cmf-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{selectedEvent.name}</h3>
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <span>📅 {formatEventDate(selectedEvent.date)}</span>
                      {selectedEvent.location && (
                        <span>📍 {selectedEvent.location}</span>
                      )}
                    </div>
                  </div>
                </div>
                <Link
                  to="/select-league"
                  className="text-sm text-cmf-primary hover:text-cmf-secondary font-medium"
                >
                  Switch Event
                </Link>
              </div>
            </div>
          )}

          {/* Page Header */}
          {(title || actions) && (
            <div className="mb-6">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-start justify-between">
                  <div>
                    {title && (
                      <h1 className="text-2xl font-bold text-gray-900 mb-2">
                        {title}
                      </h1>
                    )}
                    {subtitle && (
                      <p className="text-gray-600">
                        {subtitle}
                      </p>
                    )}
                  </div>
                  {actions && (
                    <div className="flex items-center gap-3">
                      {actions}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Page Content */}
          <div className="space-y-6">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
} 