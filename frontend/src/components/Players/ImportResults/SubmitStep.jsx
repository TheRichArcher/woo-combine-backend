import React from 'react';
import { Loader2, Check, AlertCircle, AlertTriangle, FileText, Database, RotateCcw } from 'lucide-react';

export default function SubmitStep({ step, importSummary, selectedEvent, onSuccess, onClose, handleDownloadPDF, isDownloadingPdf, undoLog, handleUndo, undoing, undoTimer }) {
  if (step === 'parsing') {
    return (
      <div className="text-center py-12">
        <Loader2 className="w-12 h-12 text-cmf-primary animate-spin mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900">Analyzing Data...</h3>
        <p className="text-gray-500">Mapping columns and validating scores</p>
      </div>
    );
  }

  if (step === 'submitting') {
    return (
      <div className="text-center py-12">
        <Loader2 className="w-12 h-12 text-green-600 animate-spin mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900">Importing...</h3>
        <p className="text-gray-500">Saving players and drill results</p>
      </div>
    );
  }

  if (step !== 'success') return null;

  const isRosterOnlyOutcome = (importSummary?.scores ?? 0) === 0 && (importSummary?.players ?? 0) > 0;
  const hasFailures = (importSummary?.scores ?? 0) === 0 && (importSummary?.players ?? 0) === 0 && ((importSummary?.errors?.length ?? 0) > 0);

  return (
    <div className="text-center py-12">
      <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
          hasFailures
          ? 'bg-red-100 text-red-600'
          : 'bg-green-100 text-green-600'
      }`}>
        {hasFailures ? <AlertCircle className="w-8 h-8" /> : <Check className="w-8 h-8" />}
      </div>

      <h3 className="text-2xl font-bold text-gray-900 mb-2">
          {hasFailures ? 'Import Failed' : isRosterOnlyOutcome ? 'Roster Imported' : 'Import Complete!'}
      </h3>

      {importSummary && isRosterOnlyOutcome && (
          <div className="mb-4 text-gray-600 font-medium">
              {importSummary.created !== undefined ? (
                  <p>
                      {importSummary.created + importSummary.updated} players {importSummary.created > 0 ? 'added/updated' : 'updated'}
                      {importSummary.rejected > 0 && `. ${importSummary.rejected} ${importSummary.rejected === 1 ? 'row' : 'rows'} skipped`}.
                  </p>
              ) : (
                  <p>
                      {importSummary.players} players added
                      {importSummary.rejected > 0 && `. ${importSummary.rejected} ${importSummary.rejected === 1 ? 'row' : 'rows'} skipped`}.
                  </p>
              )}
          </div>
      )}

      {importSummary && !isRosterOnlyOutcome && (
          <div className="mb-4 text-gray-600 font-medium bg-gray-50 p-3 rounded-lg border border-gray-200">
              <div className="flex justify-center gap-6">
                  {importSummary.created !== undefined ? (
                      <>
                        <div className="text-center"><div className="text-2xl font-bold text-gray-800">{importSummary.created}</div><div className="text-xs uppercase tracking-wide text-gray-500">New</div></div>
                        <div className="w-px bg-gray-300"></div>
                        <div className="text-center"><div className="text-2xl font-bold text-blue-600">{importSummary.updated}</div><div className="text-xs uppercase tracking-wide text-gray-500">Updated</div></div>
                      </>
                  ) : (
                      <div className="text-center"><div className="text-2xl font-bold text-gray-800">{importSummary.players}</div><div className="text-xs uppercase tracking-wide text-gray-500">Players Added</div></div>
                  )}
                  <div className="w-px bg-gray-300"></div>
                  <div className="text-center"><div className="text-2xl font-bold text-cmf-primary">{importSummary.scores}</div><div className="text-xs uppercase tracking-wide text-gray-500">Scores</div></div>
                  {importSummary.rejected !== undefined && importSummary.rejected > 0 && (
                      <><div className="w-px bg-gray-300"></div><div className="text-center"><div className="text-2xl font-bold text-yellow-600">{importSummary.rejected}</div><div className="text-xs uppercase tracking-wide text-gray-500">Skipped</div></div></>
                  )}
              </div>
          </div>
      )}

      {isRosterOnlyOutcome && <div className="max-w-md mx-auto mb-4"><p className="text-sm text-gray-500 italic">Scores were not imported (roster-only import).</p></div>}

      {importSummary?.errors?.length > 0 && (() => {
          const duplicateErrors = importSummary.errors.filter(e => e.message?.includes('Duplicate:'));
          const otherErrors = importSummary.errors.filter(e => !e.message?.includes('Duplicate:'));
          return (
              <div className="max-w-md mx-auto space-y-3 mb-4">
                  {duplicateErrors.length > 0 && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-left">
                          <div className="flex items-start gap-3"><AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" /><div className="text-sm text-yellow-800 flex-1">
                              <p className="font-bold mb-1">{duplicateErrors.length} row{duplicateErrors.length !== 1 ? 's' : ''} skipped (duplicates)</p>
                              <details className="mt-2"><summary className="text-xs text-yellow-700 cursor-pointer hover:text-yellow-900 font-medium">View details →</summary>
                                  <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                                      {duplicateErrors.slice(0, 10).map((e, idx) => (<div key={idx} className="text-xs bg-white rounded p-2 border border-yellow-200"><span className="font-mono text-yellow-700">Row {e.row}:</span><span className="text-gray-700 ml-1">{e.message?.split('→')[0]}</span></div>))}
                                      {duplicateErrors.length > 10 && (<div className="text-xs text-gray-500 text-center mt-1">... and {duplicateErrors.length - 10} more</div>)}
                                  </div>
                              </details>
                          </div></div>
                      </div>
                  )}
                  {otherErrors.length > 0 && (
                      <div className={`${isRosterOnlyOutcome ? 'bg-blue-50 border-blue-200' : 'bg-red-50 border-red-200'} border rounded-lg p-4 text-left`}>
                          <div className="flex items-start gap-3"><AlertCircle className={`w-5 h-5 ${isRosterOnlyOutcome ? 'text-blue-600' : 'text-red-600'} mt-0.5 flex-shrink-0`} /><div className={`text-sm ${isRosterOnlyOutcome ? 'text-blue-800' : 'text-red-800'}`}>
                              <p className="font-bold mb-1">{isRosterOnlyOutcome ? `${otherErrors.length} row${otherErrors.length !== 1 ? 's' : ''} skipped:` : `Encountered ${otherErrors.length} error${otherErrors.length !== 1 ? 's' : ''} during import:`}</p>
                              <ul className="list-disc pl-4 space-y-1 text-xs max-h-32 overflow-y-auto">
                                  {otherErrors.slice(0, 10).map((e, idx) => (<li key={idx}>Row {e.row}: {e.message}</li>))}
                                  {otherErrors.length > 10 && (<li>...and {otherErrors.length - 10} more.</li>)}
                              </ul>
                          </div></div>
                      </div>
                  )}
              </div>
          );
      })()}

      <p className="text-gray-500 mb-1">Results have been added to your event.</p>
      {selectedEvent?.name && (<div className="inline-flex items-center gap-2 bg-gray-100 px-3 py-1 rounded-full text-sm font-medium text-gray-700 mb-2"><Database className="w-3 h-3" /> {selectedEvent.name}</div>)}

      <div className="flex flex-col items-center gap-3 mt-8">
           <button onClick={() => { onSuccess?.(false); onClose(); }} className="w-full max-w-md px-8 py-4 bg-cmf-primary text-white rounded-lg font-semibold hover:bg-cmf-secondary shadow-lg hover:shadow-xl transition-all text-lg">Continue</button>
           <div className="flex justify-center gap-3 w-full max-w-md">
               <button onClick={() => { onSuccess?.(false); onClose(); window.location.href = '/players'; }} className="flex-1 px-4 py-2 bg-white border-2 border-cmf-primary text-cmf-primary rounded-lg font-medium hover:bg-blue-50 transition-all">View Rankings</button>
               <button onClick={handleDownloadPDF} disabled={isDownloadingPdf} className="flex-1 px-4 py-2 bg-white border-2 border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 flex items-center justify-center gap-2 transition-all">
                   {isDownloadingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                   {isDownloadingPdf ? 'Downloading...' : 'Download PDF'}
               </button>
           </div>
      </div>

      {undoLog && (
          <div className="mt-8 pt-6 border-t border-gray-200 max-w-md mx-auto">
              <button onClick={handleUndo} disabled={undoing} className="text-sm text-gray-500 hover:text-gray-700 flex items-center justify-center gap-2 mx-auto transition-colors">
                  {undoing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
                  Undo this import ({undoTimer}s)
              </button>
          </div>
      )}
    </div>
  );
}
