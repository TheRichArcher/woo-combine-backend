import React from 'react';
import { FileSpreadsheet, ChevronRight } from 'lucide-react';

export default function SheetSelectionStep({ sheets, handleParse, setStep }) {
  return (
      <div className="space-y-4">
          <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex items-start gap-3">
              <FileSpreadsheet className="w-6 h-6 text-blue-600 mt-0.5" />
              <div>
                  <h3 className="font-medium text-blue-900">Multiple Sheets Detected</h3>
                  <p className="text-sm text-blue-700">Please select which sheet contains your combine results.</p>
              </div>
          </div>

          <div className="grid grid-cols-1 gap-3">
              {sheets.map((sheet, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleParse(sheet.name)}
                    className="text-left p-4 rounded-xl border hover:border-cmf-primary hover:shadow-sm transition-all bg-white group"
                  >
                      <div className="flex justify-between items-center mb-2">
                          <span className="font-semibold text-gray-900 group-hover:text-cmf-primary">{sheet.name}</span>
                          <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-cmf-primary" />
                      </div>
                      {sheet.preview && (
                          <div className="text-xs text-gray-500 font-mono bg-gray-50 p-2 rounded overflow-hidden whitespace-nowrap">
                              {sheet.preview.map((row, rIdx) => (
                                  <div key={rIdx} className="truncate">{row.join(' | ')}</div>
                              ))}
                          </div>
                      )}
                  </button>
              ))}
          </div>
          <button
            onClick={() => setStep('input')}
            className="text-gray-500 text-sm hover:text-gray-700"
          >
              Cancel and go back
          </button>
      </div>
  );
}
