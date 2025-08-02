import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Timer, Trophy, Users, ArrowRight, Star } from "lucide-react";

// Demo data - simulated combine results
const DEMO_PLAYERS = [
  { id: 1, name: "Alex Johnson", number: 12, fortyYardDash: 4.38, vertical: 36, ranking: 1 },
  { id: 2, name: "Jordan Smith", number: 7, fortyYardDash: 4.52, vertical: 34, ranking: 2 },
  { id: 3, name: "Taylor Brown", number: 23, fortyYardDash: 4.67, vertical: 32, ranking: 3 },
  { id: 4, name: "Morgan Davis", number: 15, fortyYardDash: null, vertical: null, ranking: null }, // Ready for demo
];

const DRILLS = [
  { key: "fortyYardDash", label: "40-Yard Dash", unit: "sec", lowerIsBetter: true },
  { key: "vertical", label: "Vertical Jump", unit: "in", lowerIsBetter: false },
];

export default function Demo() {
  const navigate = useNavigate();
  const [demoStep, setDemoStep] = useState(1);
  const [selectedDrill, setSelectedDrill] = useState("fortyYardDash");
  const [newTime, setNewTime] = useState("");
  const [showScorecard, setShowScorecard] = useState(false);
  const [players, setPlayers] = useState(DEMO_PLAYERS);

  const targetPlayer = players.find(p => p.id === 4);

  const handleTimeEntry = () => {
    if (!newTime || isNaN(newTime)) return;
    
    // Update the demo player with the new time
    const updatedPlayers = players.map(p => 
      p.id === 4 
        ? { ...p, fortyYardDash: parseFloat(newTime), ranking: 1 } // Make them #1 for demo impact
        : { ...p, ranking: p.ranking ? p.ranking + 1 : p.ranking } // Push others down
    );
    
    setPlayers(updatedPlayers);
    setShowScorecard(true);
    setDemoStep(3);
  };

  const resetDemo = () => {
    setDemoStep(1);
    setNewTime("");
    setShowScorecard(false);
    setPlayers(DEMO_PLAYERS);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-cyan-50 to-blue-100">
      <div className="max-w-md mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              🏃‍♂️ WooCombine Demo
            </h1>
            <p className="text-gray-600 text-sm">
              Experience instant digital combine tracking
            </p>
          </div>
        </div>

        {/* Demo Flow */}
        {demoStep === 1 && (
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Timer className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">
                Traditional Way: Clipboards & Calculators
              </h2>
              <p className="text-gray-600 text-sm mb-4">
                Stop struggling with paper forms and manual ranking calculations
              </p>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                <p className="text-red-700 text-sm">
                  ❌ Paper gets lost<br/>
                  ❌ Manual calculations take forever<br/>
                  ❌ Parents can't see results instantly
                </p>
              </div>
            </div>
            
            <button
              onClick={() => setDemoStep(2)}
              className="w-full bg-cyan-600 hover:bg-cyan-700 text-white font-semibold py-4 rounded-xl transition-all duration-200 flex items-center justify-center gap-2"
            >
              See The Better Way <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        )}

        {demoStep === 2 && (
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-cyan-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Star className="w-8 h-8 text-cyan-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">
                WooCombine Way: Instant Digital
              </h2>
              <p className="text-gray-600 text-sm mb-4">
                Try tracking a 40-yard dash in real-time
              </p>
            </div>

            {/* Simulated Live Entry Interface */}
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">Player #15</span>
                  <span className="text-gray-600">{targetPlayer?.name}</span>
                </div>
                <div className="text-sm text-gray-500">Ready for 40-Yard Dash</div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Enter Time (seconds)
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="4.50"
                  value={newTime}
                  onChange={(e) => setNewTime(e.target.value)}
                  className="w-full p-3 border-2 border-gray-300 rounded-lg text-center text-xl font-mono"
                  autoFocus
                />
              </div>

              <button
                onClick={handleTimeEntry}
                disabled={!newTime}
                className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white font-semibold py-4 rounded-xl transition-all duration-200 flex items-center justify-center gap-2"
              >
                📱 Submit & See Magic
              </button>
            </div>
          </div>
        )}

        {demoStep === 3 && showScorecard && (
          <div className="space-y-6">
            {/* Instant Scorecard */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <div className="text-center mb-4">
                <div className="w-16 h-16 bg-gold-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Trophy className="w-8 h-8 text-yellow-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">
                  ⚡ Instant Digital Scorecard
                </h2>
                <p className="text-green-600 font-semibold">
                  Generated in under 1 second!
                </p>
              </div>

              <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border-2 border-yellow-200 rounded-xl p-4 mb-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-900">#{targetPlayer?.ranking}</div>
                  <div className="text-lg font-semibold text-gray-800">{targetPlayer?.name}</div>
                  <div className="text-sm text-gray-600">Player #{targetPlayer?.number}</div>
                  <div className="mt-2 text-xl font-mono text-cyan-600">
                    {newTime}s (40-Yard Dash)
                  </div>
                </div>
              </div>
            </div>

            {/* Live Rankings */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Users className="w-5 h-5" />
                Live Rankings Updated
              </h3>
              
              <div className="space-y-2">
                {players
                  .filter(p => p.fortyYardDash)
                  .sort((a, b) => a.fortyYardDash - b.fortyYardDash)
                  .slice(0, 4)
                  .map((player, index) => (
                    <div 
                      key={player.id}
                      className={`flex items-center justify-between p-3 rounded-lg ${
                        player.id === 4 ? 'bg-yellow-50 border-2 border-yellow-300' : 'bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="text-lg font-bold text-gray-900">
                          #{index + 1}
                        </div>
                        <div>
                          <div className="font-medium">{player.name}</div>
                          <div className="text-sm text-gray-500">#{player.number}</div>
                        </div>
                      </div>
                      <div className="text-lg font-mono text-cyan-600">
                        {player.fortyYardDash}s
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            {/* Value Proposition */}
            <div className="bg-gradient-to-r from-cyan-500 to-blue-600 rounded-2xl shadow-lg p-6 text-white text-center">
              <h3 className="text-lg font-bold mb-3">
                ✅ What Just Happened:
              </h3>
              <div className="space-y-2 text-sm mb-4">
                <p>✅ Instant digital scorecard created</p>
                <p>✅ Live rankings automatically updated</p>
                <p>✅ No calculators or paper needed</p>
                <p>✅ Parents can see results immediately</p>
              </div>
              
              <div className="space-y-3">
                <button
                  onClick={() => navigate("/signup")}
                  className="w-full bg-white text-cyan-600 font-semibold py-3 rounded-xl hover:bg-gray-50 transition-all duration-200"
                >
                  🚀 Start Your Free Trial
                </button>
                
                <button
                  onClick={resetDemo}
                  className="w-full border-2 border-white text-white font-medium py-2 rounded-xl hover:bg-white/10 transition-all duration-200"
                >
                  🔄 Try Demo Again
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center mt-6">
          <button
            onClick={() => navigate("/welcome")}
            className="text-cyan-600 hover:text-cyan-800 font-medium text-sm transition-colors"
          >
            ← Back to Welcome
          </button>
        </div>
      </div>
    </div>
  );
}