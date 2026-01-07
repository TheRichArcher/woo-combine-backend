import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useEvent } from "../context/EventContext";
import { useAuth } from "../context/AuthContext";
import { usePlayerDetails } from "../context/PlayerDetailsContext";
import EventSelector from "../components/EventSelector";
import CreateEventModal from "../components/CreateEventModal";
import EditEventModal from "../components/EditEventModal";
import api from '../lib/api';
import { withCache } from '../utils/dataCache';
import { debounce } from '../utils/debounce';
import { Settings, ChevronDown, Users, BarChart3, CheckCircle, Clock, Target, TrendingUp, Plus, ChevronRight, Calendar, ClipboardList, Shield, Share2, Edit, Upload, Activity, Trophy } from 'lucide-react';
import { useNavigate, Link } from "react-router-dom";
import CreateLeagueForm from '../components/CreateLeagueForm';
import { playerLogger, rankingLogger } from '../utils/logger';
import { useDrills } from '../hooks/useDrills';
import { useOptimizedWeights } from '../hooks/useOptimizedWeights';
import LoadingScreen from "../components/LoadingScreen";
import LeagueFallback from "../context/LeagueFallback"; // CRITICAL FIX: Import LeagueFallback directly
import * as Sentry from '@sentry/react';

// Debug Log for troubleshooting production undefined component error
console.debug('[CoachDashboard] Component Check:', { 
  CreateLeagueForm, 
  EventSelector, 
  CreateEventModal,
  LoadingScreen,
  LeagueFallback // Add to debug check
});

const CoachDashboard = React.memo(function CoachDashboard() {
  const { selectedEvent, noLeague, setEvents, setSelectedEvent, events } = useEvent();
  const { user, selectedLeagueId, userRole, leagues } = useAuth();
  const { openDetails } = usePlayerDetails();
  
  // Define constant for 'All Players'
  const AGE_GROUP_ALL = { id: "ALL", label: "All Players" };

  // Initialize with 'ALL' or persisted value for this event
  const [selectedAgeGroupId, setSelectedAgeGroupId] = useState(() => {
    if (!selectedEvent?.id) return "ALL";
    const saved = localStorage.getItem(`coach_dashboard_age_group_${selectedEvent.id}`);
    // Safety check: if saved looks like JSON object or is invalid, reset to ALL
    if (saved && (saved.startsWith('{') || saved === "[object Object]")) return "ALL";
    return saved || "ALL";
  });

  const [rankings, setRankings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [playersLoading, setPlayersLoading] = useState(true); // Gating state
  const [error, setError] = useState(null);
  const [players, setPlayers] = useState([]); // for age group list only
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditEventModal, setShowEditEventModal] = useState(false);
  const navigate = useNavigate(); // ADDED: Hook for navigation
  
  // Calculate completion metrics for Next Action CTA
  const totalScoresCount = useMemo(() => {
    return players.reduce((sum, p) => sum + (p.composite_score > 0 ? 1 : 0), 0);
  }, [players]);
  
  const completionRate = useMemo(() => {
    if (players.length === 0) return 0;
    return (totalScoresCount / players.length) * 100;
  }, [players.length, totalScoresCount]);
  
  const hasExactlyOneEvent = Array.isArray(events) && events.length === 1;
  
  // Track if user has dismissed the helper (one-time per session)
  const [helperDismissed, setHelperDismissed] = useState(false);

  // Derive current league for display
  const currentLeague = leagues.find(l => l.id === selectedLeagueId);
  
  // Update local storage when selection changes
  useEffect(() => {
    if (selectedEvent?.id && selectedAgeGroupId) {
      localStorage.setItem(`coach_dashboard_age_group_${selectedEvent.id}`, selectedAgeGroupId);
    }
  }, [selectedAgeGroupId, selectedEvent?.id]);

  // Reset to saved preference or ALL when event changes
  useEffect(() => {
    if (selectedEvent?.id) {
      const saved = localStorage.getItem(`coach_dashboard_age_group_${selectedEvent.id}`);
      // Safety check for clean strings only
      if (saved && !saved.startsWith('{') && saved !== "[object Object]") {
        setSelectedAgeGroupId(saved);
      } else {
        setSelectedAgeGroupId("ALL");
      }
    }
  }, [selectedEvent?.id]);
  
  const handleEventCreated = (newEvent) => {
    setEvents(prev => [newEvent, ...prev]);
    setSelectedEvent(newEvent);
    setShowCreateModal(false);
  };
  
  // Unified Drills Hook
  const { drills: allDrills, presets: currentPresets, loading: drillsLoading } = useDrills(selectedEvent);
  
  // Use shared optimized weights hook (handles 0-100 scale, persistence, and presets)
  const {
    sliderWeights, // 0-100 scale
    activePreset,
    handleWeightChange,
    applyPreset
  } = useOptimizedWeights(players, allDrills, currentPresets);

  // Cached players fetcher for dashboard (TTL 60s)
  const cachedFetchPlayers = useMemo(() => withCache(
    async (eventId) => {
      const { data } = await api.get(`/players?event_id=${eventId}`);
      return Array.isArray(data) ? data : [];
    },
    'players',
    60 * 1000
  ), []);

  // Fetch all players to get available age groups
  useEffect(() => {
    async function fetchPlayers() {
      if (!selectedEvent || !user || !selectedLeagueId) {
        setPlayersLoading(false);
        return;
      }
      try {
        setPlayersLoading(true);
        const data = await cachedFetchPlayers(selectedEvent.id);
        setPlayers(data);
      } catch (error) {
        if (error.response?.status === 404) {
          // 404 means no players found yet - normal for new events
          setPlayers([]);
        } else {
          // Other errors are actual problems
          playerLogger.error('Players fetch error', error);
          setPlayers([]);
        }
      } finally {
        setPlayersLoading(false);
      }
    }
    fetchPlayers();
  }, [selectedEvent, user, selectedLeagueId]);

  const ageGroups = useMemo(() => {
    const groups = [...new Set(players.map(p => p.age_group))].filter(Boolean).sort();
    return [
      AGE_GROUP_ALL,
      ...groups.map(g => ({ id: g, label: g }))
    ];
  }, [players]);

  // Derive selected label safely
  const selectedOption = ageGroups.find(o => o.id === selectedAgeGroupId) || AGE_GROUP_ALL;
  const selectedLabel = selectedOption.label;

  // Auto-update rankings when weights or age group changes
  useEffect(() => {
    const cachedFetchRankings = withCache(
      async (paramsString) => {
        const res = await api.get(`/rankings?${paramsString}`);
        return res.data || [];
      },
      'rankings',
      15 * 1000
    );

    const updateRankings = async () => {
      if (!user || !selectedLeagueId || !selectedEvent) {
        setRankings([]);
        return;
      }
      
      try {
        // Clear previous error and loading state
        setLoading(true);
        setError(null);
        
        const params = new URLSearchParams({ 
          event_id: selectedEvent.id 
        });
        
        // Add age group filter if not ALL
        if (selectedAgeGroupId && selectedAgeGroupId !== "ALL") {
          params.append("age_group", selectedAgeGroupId);
        }
        
        // Add weight parameters - use dynamic keys from sliderWeights
        if (Object.keys(sliderWeights).length > 0) {
          Object.entries(sliderWeights).forEach(([key, val]) => {
             params.append(`weight_${key}`, val);
          });
        }

        const data = await cachedFetchRankings(params.toString());
        // Debugging logs
        console.log("API rankings raw:", data);
        const rankingsArray = Array.isArray(data) ? data : (data?.rankings || []);
        console.log("Rankings to store:", rankingsArray);
        if (rankingsArray.length > 0) {
            console.log("First ranking item structure:", rankingsArray[0]);
        }
        
        // Ensure data is always an array
        setRankings(rankingsArray);
      } catch (err) {
        if (err.response?.status === 404) {
          setError(null);
          setRankings([]);
        } else {
          rankingLogger.error('Rankings fetch error', err);
          setError(err.message);
        }
      } finally {
        setLoading(false);
      }
    };

    // Debounce the API call to avoid too many requests (250ms)
    const debounced = debounce(updateRankings, 250);
    debounced();
    return () => {};
  }, [selectedAgeGroupId, sliderWeights, user, selectedLeagueId, selectedEvent]);

  // CSV Export logic
  const handleExportCsv = () => {
    if (rankings.length === 0) return;
    let csv = 'Rank,Name,Player Number,Age Group,Composite Score\n';
    rankings.forEach(player => {
      const ageGroup = players.find(p => p.id === player.player_id)?.age_group || '';
      csv += `${player.rank},"${player.name}",${player.number},"${ageGroup}",${player.composite_score.toFixed(2)}\n`;
    });
    const eventDate = selectedEvent ? new Date(selectedEvent.date).toISOString().slice(0,10) : 'event';
    const groupLabel = selectedAgeGroupId === "ALL" ? "All_Players" : selectedAgeGroupId;
    const filename = `rankings_${groupLabel}_${eventDate}.csv`;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Format event date
  const formattedDate = selectedEvent && selectedEvent.date && !isNaN(Date.parse(selectedEvent.date)) ? new Date(selectedEvent.date).toLocaleDateString() : 'Date not set';

  // Scroll to import section if hash is present
  useEffect(() => {
    const anchor = window.location.hash;
    if (anchor && !playersLoading) {
      const el = document.querySelector(anchor);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, [playersLoading]);

  if (noLeague) return <LeagueFallback />;

  // Boot Gate: Show loading while fetching players to prevent empty state flash
  if (playersLoading) {
    return (
      <LoadingScreen 
        title="Loading Dashboard..." 
        subtitle="Analyzing player data" 
        size="medium" 
      />
    );
  }

  // If no players, show onboarding/fallback actions
  if (players.length === 0) {
    // If user has no leagues, show inline CreateLeagueForm
    if (!leagues || leagues.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[40vh] mt-20">
                  <div className="bg-white rounded-2xl shadow-lg p-8 max-w-lg mx-auto text-center border-2 border-cmf-primary/30">
          <h2 className="text-2xl font-bold text-cmf-secondary mb-4">Welcome to Woo-Combine!</h2>
          <p className="text-cmf-secondary mb-2">It looks like you haven't created a league yet. That's totally normal for new organizers!</p>
            <p className="text-gray-700 mb-4">To get started, create your first league below:</p>
            <CreateLeagueForm onCreated={() => navigate('/onboarding/event', { replace: true })} />
          </div>
        </div>
      );
    }
    // For returning users with new empty event: opinionated CTA hierarchy
    // Import is primary CTA (most prominent), other actions secondary/subdued
    // This is a suggestion, not a forced redirect - preserves user control
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] mt-20">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-lg mx-auto text-center border-2 border-cmf-primary/30">
          <h2 className="text-2xl font-bold text-cmf-secondary mb-4">No Players Yet</h2>
          <p className="text-gray-700 mb-4">
            {selectedEvent 
              ? `Your event "${selectedEvent.name}" doesn't have any players yet.`
              : "Select an event to get started."}
          </p>
          <div className="flex flex-col gap-4 items-center">
            {userRole === 'organizer' && selectedEvent ? (
              <>
                {/* PRIMARY CTA: Import Players - most prominent */}
                <Link 
                  to="/players?action=import" 
                  className="bg-cmf-primary text-white font-bold px-8 py-4 rounded-xl shadow-lg hover:bg-cmf-secondary hover:shadow-xl transition-all transform hover:scale-105 w-full max-w-xs text-center text-lg"
                >
                  📥 Import Players
                </Link>
                <p className="text-sm text-gray-600 -mt-2">
                  Recommended: Upload a CSV file to quickly add your roster
                </p>
                
                {/* SECONDARY ACTIONS: subdued styling */}
                <div className="w-full max-w-xs pt-4 mt-4 border-t border-gray-200">
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-3 font-semibold">Other Options</p>
                  <div className="flex flex-col gap-2">
                    <Link 
                      to="/players" 
                      className="text-gray-600 hover:text-cmf-primary text-sm py-2 px-4 rounded-lg hover:bg-gray-50 transition text-center border border-gray-200"
                    >
                      Add Players Manually
                    </Link>
                    <Link 
                      to="/admin-tools" 
                      className="text-gray-600 hover:text-cmf-primary text-sm py-2 px-4 rounded-lg hover:bg-gray-50 transition text-center border border-gray-200"
                    >
                      Event Settings
                    </Link>
                  </div>
                </div>
              </>
            ) : userRole === 'organizer' && !selectedEvent ? (
              <Link to="/admin-tools" className="bg-cmf-primary text-white font-bold px-6 py-3 rounded-lg shadow hover:bg-cmf-secondary transition w-full max-w-xs text-center">
                Select or Create Event
              </Link>
            ) : (
              <span className="text-gray-500">Waiting for organizer to add players.</span>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (noLeague) return <LeagueFallback />;


  return (
    <div className="min-h-screen bg-gray-50 text-cmf-contrast font-sans">
      <div className="max-w-lg mx-auto px-4 sm:px-6 py-8">
        
        {/* League Header */}
        {currentLeague && (
          <div className="mb-4">
            <h1 className="text-2xl font-bold text-gray-900">{currentLeague.name}</h1>
          </div>
        )}

        {/* Events Card */}
        {currentLeague && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Events in this League</h2>
                <div className="text-gray-600 text-sm mb-2">
                  Use events for each camp, tryout, or combine you run under this league.
                </div>
                
                <div className="flex items-center gap-2 text-gray-900 mt-2">
                  <span className="text-cmf-primary">•</span>
                  <span className="font-medium">Current Event:</span>
                  <span className="font-bold">{selectedEvent?.name || 'None Selected'}</span>
                </div>
                
                {/* Empty state context for single event */}
                {hasExactlyOneEvent && (
                  <div className="mt-2 text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded inline-block">
                    You currently have 1 event. Create another when you run your next camp or tryout.
                  </div>
                )}
              </div>
              
              <div className="flex flex-col items-end gap-2">
                {selectedEvent && (
                  <button
                    onClick={() => setShowEditEventModal(true)}
                    className="bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 font-medium px-4 py-2 rounded-lg transition flex items-center gap-2 shadow-sm text-sm whitespace-nowrap"
                  >
                    <Edit className="w-4 h-4" />
                    Edit Event Details
                  </button>
                )}
                
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="bg-cmf-primary hover:bg-cmf-secondary text-white font-medium px-4 py-2 rounded-lg transition flex items-center gap-2 shadow-sm text-sm whitespace-nowrap"
                >
                  <Plus className="w-4 h-4" />
                  Create New Event
                </button>
                
                {/* First-time micro-coach helper */}
                {hasExactlyOneEvent && !helperDismissed && (
                  <div className="relative bg-indigo-600 text-white text-xs px-3 py-2 rounded-lg shadow-lg max-w-xs animate-pulse">
                    <div className="absolute -top-1 right-4 w-2 h-2 bg-indigo-600 transform rotate-45"></div>
                    <div className="flex justify-between items-start gap-2">
                      <span>Need to run another camp under this league? Click 'Create New Event' to start a new one.</span>
                      <button 
                        onClick={() => setHelperDismissed(true)}
                        className="text-indigo-200 hover:text-white font-bold"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <EventSelector />
        
        {/* Contextual Next Action CTA */}
        {selectedEvent && (() => {
          // Determine next action based on event state
          let action = null;
          
          if (players.length === 0) {
            action = {
              label: "Add Players",
              sublabel: "Import your roster to get started",
              icon: Users,
              route: "/admin#player-upload",
              color: "bg-blue-600 hover:bg-blue-700"
            };
          } else if (totalScoresCount === 0) {
            action = {
              label: "Import Results",
              sublabel: `${players.length} players ready for scoring`,
              icon: Upload,
              route: "/players?action=import",
              color: "bg-green-600 hover:bg-green-700",
              secondary: {
                label: "Start Live Entry",
                route: "/live-entry"
              }
            };
          } else if (completionRate < 100) {
            action = {
              label: "Continue Evaluations",
              sublabel: `${Math.round(completionRate)}% complete (${totalScoresCount}/${players.length} players)`,
              icon: Activity,
              route: "/live-entry",
              color: "bg-orange-600 hover:bg-orange-700"
            };
          } else {
            action = {
              label: "View Ranking Preview",
              sublabel: "All players evaluated - analyze results",
              icon: Trophy,
              route: "/players?tab=analyze",
              color: "bg-cmf-primary hover:bg-cmf-secondary",
              secondary: {
                label: "Export Results",
                route: "/players?tab=export"
              }
            };
          }
          
          if (!action) return null;
          
          const ActionIcon = action.icon;
          
          return (
            <div className="mb-6 bg-gradient-to-r from-gray-50 to-white rounded-xl shadow-sm border-2 border-gray-200 p-5">
              <div className="flex items-center gap-2 mb-3">
                <Target className="w-5 h-5 text-cmf-primary" />
                <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Next Action</h3>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => navigate(action.route)}
                  className={`flex-1 ${action.color} text-white font-semibold px-6 py-4 rounded-lg transition shadow-md hover:shadow-lg flex items-center justify-center gap-3 group`}
                >
                  <ActionIcon className="w-5 h-5 group-hover:scale-110 transition-transform" />
                  <div className="text-left">
                    <div className="text-base">{action.label}</div>
                    <div className="text-xs opacity-90 font-normal">{action.sublabel}</div>
                  </div>
                </button>
                
                {action.secondary && (
                  <button
                    onClick={() => navigate(action.secondary.route)}
                    className="sm:w-auto bg-white hover:bg-gray-50 border-2 border-gray-300 text-gray-700 font-medium px-4 py-2 rounded-lg transition flex items-center justify-center gap-2"
                  >
                    {action.secondary.label}
                  </button>
                )}
              </div>
            </div>
          );
        })()}
        
        {/* Primary Navigation Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <button
            onClick={() => navigate('/players')}
            className="flex flex-col items-center justify-center gap-2 p-4 bg-white border border-gray-200 rounded-xl shadow-sm hover:bg-gray-50 transition-colors group"
          >
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg group-hover:bg-blue-100 transition-colors">
              <Users className="w-5 h-5" />
            </div>
            <span className="text-xs font-semibold text-gray-700">Players</span>
          </button>

          <button
            onClick={() => navigate('/schedule')}
            className="flex flex-col items-center justify-center gap-2 p-4 bg-white border border-gray-200 rounded-xl shadow-sm hover:bg-gray-50 transition-colors group"
          >
            <div className="p-2 bg-green-50 text-green-600 rounded-lg group-hover:bg-green-100 transition-colors">
              <Calendar className="w-5 h-5" />
            </div>
            <span className="text-xs font-semibold text-gray-700">Schedule</span>
          </button>

          <button
            onClick={() => navigate('/team-formation')}
            className="flex flex-col items-center justify-center gap-2 p-4 bg-white border border-gray-200 rounded-xl shadow-sm hover:bg-gray-50 transition-colors group"
          >
            <div className="p-2 bg-purple-50 text-purple-600 rounded-lg group-hover:bg-purple-100 transition-colors">
              <Shield className="w-5 h-5" />
            </div>
            <span className="text-xs font-semibold text-gray-700">Teams</span>
          </button>

          <button
            onClick={() => navigate('/scorecards')}
            className="flex flex-col items-center justify-center gap-2 p-4 bg-white border border-gray-200 rounded-xl shadow-sm hover:bg-gray-50 transition-colors group"
          >
            <div className="p-2 bg-orange-50 text-orange-600 rounded-lg group-hover:bg-orange-100 transition-colors">
              <ClipboardList className="w-5 h-5" />
            </div>
            <span className="text-xs font-semibold text-gray-700">Scorecards</span>
          </button>
        </div>

        {/* Quick link to Analytics */}
        <div className="flex justify-end mb-3">
          <Link
            to="/analytics"
            className="inline-flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-lg border border-gray-200 bg-white shadow-sm hover:bg-gray-50"
            aria-label="Open Analytics"
          >
            <BarChart3 className="w-4 h-4 text-cmf-primary" />
            Analytics
          </Link>
        </div>


        {/* Header & Title Block */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex-1">
            <div className="text-xs uppercase font-bold text-gray-500 tracking-wide mb-1">
              {userRole === 'organizer' ? 'Event Dashboard' : 'Coach Dashboard'}
            </div>
            <h1 className="text-lg font-semibold text-gray-900">
              {selectedEvent ? `${selectedEvent.name} – ${formattedDate}` : "No event selected"}
            </h1>
          </div>
          {userRole === 'organizer' && selectedEvent && (
            <button
              onClick={() => setShowEditEventModal(true)}
              className="flex items-center gap-2 px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
              title="Edit event name, date, and location"
            >
              <Edit className="w-4 h-4" />
              <span className="hidden sm:inline">Edit Event</span>
            </button>
          )}
        </div>
        {/* Enhanced Age Group Selector */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-5 h-5 text-cmf-primary" />
            <label className="text-sm font-bold text-gray-700">Select Age Group</label>
          </div>
          
          {/* Dropdown */}
          <div className="relative mb-4">
            <select
              value={selectedAgeGroupId}
              onChange={e => setSelectedAgeGroupId(e.target.value)}
              className="w-full p-3 pr-10 border-2 rounded-lg appearance-none bg-white text-left cursor-pointer transition-all duration-200 border-gray-300 hover:border-gray-400 focus:border-cmf-primary focus:ring-2 focus:ring-cmf-primary/20"
            >
              <option value="">Select Age Group</option>
              {ageGroups.map(opt => {
                const groupPlayers = opt.id === "ALL" 
                  ? players 
                  : players.filter(p => p.age_group === opt.id);
                  
                return (
                  <option key={opt.id} value={opt.id}>
                    {opt.label} ({groupPlayers.length} players)
                  </option>
                );
              })}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
          </div>

          {/* Age Group Preview Card */}
          {selectedAgeGroupId && (
            <div className="bg-gradient-to-br from-brand-light/50 to-brand-primary/5 border-2 border-brand-primary/20 rounded-xl p-4">
              {(() => {
                const groupPlayers = selectedAgeGroupId === "ALL"
                  ? players
                  : players.filter(p => p.age_group === selectedAgeGroupId);
                const completedPlayers = groupPlayers.filter(p => p.composite_score > 0);
                const completionRate = groupPlayers.length > 0 ? (completedPlayers.length / groupPlayers.length * 100) : 0;
                // composite_score already comes normalized in 0-100 range from backend
                const avgScore = completedPlayers.length > 0 ? (completedPlayers.reduce((sum, p) => sum + p.composite_score, 0) / completedPlayers.length) : 0;
                
                // REGRESSION GUARD: Detect if scores are unnormalized (>200 indicates *100 bug reintroduced)
                if (avgScore > 200 && completedPlayers.length > 0) {
                  const errorMsg = `[CoachDashboard] SCALE BUG DETECTED: avgScore=${avgScore.toFixed(1)} (expected 0-100). Check for erroneous *100 multiplication.`;
                  console.error(errorMsg);
                  
                  // In development, throw to catch immediately
                  if (process.env.NODE_ENV === 'development') {
                    throw new Error(`Score scale bug: avgScore=${avgScore.toFixed(1)} exceeds expected 0-100 range`);
                  } else {
                    // In production, send to Sentry for monitoring (wrapped in try/catch to never crash UI)
                    try {
                      Sentry.captureMessage('CoachDashboard score scale regression detected', {
                        level: 'error',
                        extra: {
                          avgScore,
                          completedPlayersCount: completedPlayers.length,
                          eventId: selectedEvent?.id,
                          eventName: selectedEvent?.name,
                          leagueId: selectedLeagueId,
                          selectedAgeGroupId,
                          minScore: Math.min(...completedPlayers.map(p => p.composite_score)),
                          maxScore: Math.max(...completedPlayers.map(p => p.composite_score)),
                        },
                        tags: {
                          component: 'CoachDashboard',
                          bugType: 'score_scale_regression',
                          userRole: userRole,
                        }
                      });
                    } catch (sentryError) {
                      // Failsafe: If Sentry fails, log to console but never crash the UI
                      console.error('[CoachDashboard] Failed to send Sentry alert:', sentryError);
                    }
                  }
                }
                
                return (
                  <>
                    {/* Header */}
                    <div className="flex items-center gap-3 mb-4">
                      <Users className="w-6 h-6 text-brand-primary" />
                      <div className="flex-1">
                        <h4 className="text-lg font-bold text-brand-secondary">{selectedLabel}</h4>
                        <p className="text-sm text-brand-primary">Age Group Analysis</p>
                      </div>
                      <CheckCircle className="w-5 h-5 text-brand-primary" />
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      {/* Player Count */}
                      <div className="bg-white/70 rounded-lg p-3 border border-brand-primary/20">
                        <div className="flex items-center gap-2 mb-1">
                          <Users className="w-4 h-4 text-brand-primary" />
                          <span className="text-sm font-medium text-brand-secondary">Players</span>
                        </div>
                        <div className="text-lg font-bold text-brand-primary">{groupPlayers.length}</div>
                        <div className="text-xs text-brand-primary/80">registered</div>
                      </div>

                      {/* Completion Rate */}
                      <div className="bg-white/70 rounded-lg p-3 border border-brand-primary/20">
                        <div className="flex items-center gap-2 mb-1">
                          <Target className="w-4 h-4 text-brand-primary" />
                          <span className="text-sm font-medium text-brand-secondary">Completion</span>
                        </div>
                        <div className="text-lg font-bold text-brand-primary">{Math.round(completionRate)}%</div>
                        <div className="text-xs text-brand-primary/80">{completedPlayers.length} of {groupPlayers.length}</div>
                      </div>
                    </div>

                    {/* Performance Overview */}
                    {completedPlayers.length > 0 && (
                      <div className="bg-white/70 rounded-lg p-3 border border-brand-primary/20">
                        <div className="flex items-center gap-2 mb-2">
                          <BarChart3 className="w-4 h-4 text-brand-primary" />
                          <span className="text-sm font-medium text-brand-secondary">Performance Overview</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="text-xs text-brand-primary">
                            Avg Score: <span className="font-medium">{avgScore.toFixed(1)}</span>
                          </div>
                          <div className="text-xs text-brand-primary">
                            Range: <span className="font-medium">
                              {Math.min(...completedPlayers.map(p => p.composite_score)).toFixed(1)} - {Math.max(...completedPlayers.map(p => p.composite_score)).toFixed(1)}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Status Indicator */}
                    {completionRate === 100 ? (
                      <div className="mt-3 flex items-center gap-2 text-green-700 bg-green-50 rounded-lg p-2">
                        <CheckCircle className="w-4 h-4" />
                        <span className="text-sm font-medium">All players evaluated</span>
                      </div>
                    ) : completionRate > 0 ? (
                      <div className="mt-3 flex items-center gap-2 text-yellow-700 bg-yellow-50 rounded-lg p-2">
                        <Clock className="w-4 h-4" />
                        <span className="text-sm font-medium">Evaluation in progress</span>
                      </div>
                    ) : (
                      <div className="mt-3 flex items-center gap-2 text-gray-600 bg-gray-50 rounded-lg p-2">
                        <Clock className="w-4 h-4" />
                        <span className="text-sm font-medium">Evaluation not started</span>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          )}
        </div>
        
        {/* Improved Drill Weight Controls */}
        {userRole === 'organizer' && (
          <div className="bg-white shadow-sm border border-gray-200 rounded-2xl p-5 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <Settings className="w-4 h-4 text-cmf-primary" />
              <h2 className="text-sm font-medium text-gray-800">Ranking Priorities</h2>
            </div>
            
            {/* Preset Buttons */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-3">Quick Presets:</label>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(currentPresets).map(([key, preset]) => (
                  <button
                    key={key}
                    onClick={() => applyPreset(key)}
                    className={`p-3 text-left rounded-lg border-2 transition-all ${
                      activePreset === key 
                        ? 'border-cmf-primary bg-cmf-primary/5 text-cmf-primary' 
                        : 'border-gray-200 hover:border-gray-300 text-gray-700'
                    }`}
                  >
                    <div className="font-medium text-sm">{preset.name}</div>
                    <div className="text-xs text-gray-500 mt-1">{preset.description}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Adjustments */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Custom Adjustments:
                {activePreset && currentPresets[activePreset] && (
                  <span className="ml-2 text-xs text-gray-500">
                    (Currently using {currentPresets[activePreset].name})
                  </span>
                )}
              </label>
              
              <div className="space-y-4">
                {allDrills.map(drill => (
                  <div key={drill.key} className="flex items-center justify-between">
                    <div className="flex-1">
                      <label className="block text-sm text-gray-700 mb-1">{drill.label}</label>
                      <div className="flex items-center gap-3">
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={sliderWeights[drill.key] ?? 0}
                          onInput={e => handleWeightChange(drill.key, parseFloat(e.target.value))}
                          onChange={e => handleWeightChange(drill.key, parseFloat(e.target.value))}
                          className="flex-1 accent-cmf-primary h-2 rounded-lg bg-gray-100"
                        />
                        <div className="w-12 text-right">
                          <span className="text-sm font-mono text-cmf-primary">
                            {Math.round(sliderWeights[drill.key] || 0)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="mt-4 text-xs text-gray-500 text-center">
                Rankings update automatically as you adjust priorities
              </div>
            </div>
          </div>
        )}
        
        {/* Rankings Table and Loading/Error States */}
        {loading ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
            <div className="animate-spin inline-block w-6 h-6 border-2 border-gray-300 border-t-cmf-primary rounded-full mb-2"></div>
            <div className="text-gray-500">Updating rankings...</div>
          </div>
        ) : selectedAgeGroupId === "" ? (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 text-center text-gray-500">
            Please select an age group or choose 'All Players' to view rankings.
          </div>
        ) : rankings.length === 0 ? (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-center text-yellow-700">
            No players found for this selection.
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 overflow-hidden">
            <div className="flex flex-col md:flex-row justify-between items-center mb-4 gap-4">
              <h2 className="text-xl font-semibold">
                Rankings ({selectedLabel})
              </h2>
              <button
                onClick={handleExportCsv}
                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-700 text-sm"
                disabled={rankings.length === 0}
              >
                Export as CSV
              </button>
            </div>
            
            {/* Rankings List - Reusing style from Players.jsx */}
            <div className="space-y-1">
              {rankings.map((player, index) => {
                const playerId = player.player_id || player.id;
                // Calculate individual drill rankings safely
                // (Optional: if we want to show drill details in tooltip or extended view later)
                
                const playerAgeGroup = players.find(p => p.id === playerId)?.age_group;
                const score = (player.composite_score || 0).toFixed(1);
                
                return (
                  <div 
                    key={playerId} 
                    className="flex items-center gap-2 p-2 bg-gray-50 hover:bg-gray-100 cursor-pointer transition-colors rounded text-sm border border-transparent hover:border-gray-200"
                    onClick={() => {
                      const fullPlayer = players.find(p => p.id === playerId) || player;
                      openDetails(fullPlayer, {
                          allPlayers: players,
                          sliderWeights: sliderWeights, // Pass weights directly
                          handleWeightChange: handleWeightChange,
                          activePreset,
                          applyPreset,
                          drills: allDrills,
                          presets: currentPresets
                      });
                    }}
                  >
                    <div className={`font-bold w-8 text-center text-lg ${
                      index === 0 ? "text-yellow-500" : 
                      index === 1 ? "text-gray-500" : 
                      index === 2 ? "text-orange-500" : "text-gray-400"
                    }`}>
                      {index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : index + 1}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <span className="font-semibold text-gray-900 truncate text-base">{player.name}</span>
                      </div>
                      <div className="text-xs text-gray-500 flex items-center gap-2">
                         <span className="bg-gray-200 px-1.5 py-0.5 rounded text-gray-700 font-medium">#{player.number || '-'}</span>
                         {selectedAgeGroupId === "ALL" && playerAgeGroup && (
                           <span>• {playerAgeGroup}</span>
                         )}
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <div className="font-mono font-bold text-xl text-cmf-primary">{score}</div>
                      <div className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Score</div>
                    </div>
                    
                    <ChevronRight className="w-4 h-4 text-gray-300 ml-2" />
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
      {/* Create Event Modal */}
      <CreateEventModal 
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={handleEventCreated}
      />
      
      {/* Edit Event Modal */}
      {showEditEventModal && (
        <EditEventModal
          open={showEditEventModal}
          event={selectedEvent}
          onClose={() => setShowEditEventModal(false)}
          onUpdated={(updatedEvent) => {
            setShowEditEventModal(false);
            // Update the events list
            setEvents(prev => prev.map(e => e.id === updatedEvent.id ? updatedEvent : e));
            // Update selected event
            setSelectedEvent(updatedEvent);
          }}
        />
      )}
    </div>
  );
});

export default CoachDashboard; 