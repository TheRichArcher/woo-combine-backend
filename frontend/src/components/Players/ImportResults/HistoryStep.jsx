import React from 'react';

export default function HistoryStep({ setStep, loadingHistory, importHistory }) {
  return (
      <div className="space-y-4 h-full flex flex-col">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium">Import History</h3>
            <button onClick={() => setStep('input')} className="text-sm text-cmf-primary hover:underline">Back</button>
          </div>
          
          <div className="overflow-y-auto flex-1 border rounded-xl divide-y">
              {loadingHistory && <div className="p-8 text-center text-gray-500">Loading history...</div>}
              {!loadingHistory && importHistory.length === 0 && (
                  <div className="p-8 text-center text-gray-500">No import history found.</div>
              )}
              {importHistory.map((item) => (
                  <div key={item.id} className="p-4 hover:bg-gray-50">
                      <div className="flex justify-between mb-1">
                          <span className="font-medium text-gray-900">{new Date(item.timestamp).toLocaleString()}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${item.type === 'revert' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                              {item.type === 'revert' ? 'Reverted' : 'Imported'}
                          </span>
                      </div>
                      <div className="flex gap-4 text-sm text-gray-500">
                          <span>{item.rows_imported ?? item.restored} Rows</span>
                          <span>{item.filename || item.method}</span>
                          <span>User: {item.user_id.slice(0, 6)}...</span>
                      </div>
                  </div>
              ))}
          </div>
      </div>
  );
}
