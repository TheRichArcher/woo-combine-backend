import React from 'react';
import { Upload, FileText, AlertTriangle, AlertCircle, Download, Loader2, ChevronRight, Info, Clock, Link } from 'lucide-react';

export default function FileUploadStep(props) {
  const { showModeSwitch, importMode, setImportMode, isDragging, fileInputRef, handleDragEnter, handleDragLeave, handleDragOver, handleDrop, files, setFiles, method, setMethod, url, setUrl, text, setText, placeholderText, supportedColumnsText, handleDownloadTemplate, isDownloadingTemplate, fetchHistory, onClose, handleParse, schemaError, error } = props;
  return (
    <div className="space-y-6">
      {/* Import Mode Selection */}
      {showModeSwitch && (
      <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
        <label className="block text-sm font-medium text-gray-700 mb-2">Import Goal</label>
        <div className="mb-3 p-2 bg-blue-50 border border-blue-100 rounded-lg">
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-blue-800">
              <strong>Choose one mode for this import:</strong> Use the same CSV for both modes if needed. Roster mode creates/updates players; Results mode only updates scores for existing players.
            </p>
          </div>
        </div>
        <div className="flex gap-4">
            <button
                onClick={() => setImportMode('create_or_update')}
                className={`flex-1 py-3 px-4 rounded-lg border-2 text-left flex items-start gap-3 transition-all ${
                    importMode === 'create_or_update'
                    ? 'border-cmf-primary bg-white ring-1 ring-cmf-primary'
                    : 'border-transparent bg-white hover:bg-gray-50'
                }`}
            >
                <div className={`mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center ${
                    importMode === 'create_or_update' ? 'border-cmf-primary' : 'border-gray-400'
                }`}>
                    {importMode === 'create_or_update' && <div className="w-2 h-2 rounded-full bg-cmf-primary" />}
                </div>
                <div>
                    <div className="font-semibold text-gray-900">Import Roster</div>
                    <div className="text-xs text-gray-500 mt-1">Create new players or update existing ones. Best for first imports.</div>
                    <div className="text-xs text-cmf-primary font-medium mt-1">
                        Can also upload scores in the same file.
                    </div>
                </div>
            </button>
            <button
                onClick={() => setImportMode('scores_only')}
                className={`flex-1 py-3 px-4 rounded-lg border-2 text-left flex items-start gap-3 transition-all ${
                    importMode === 'scores_only'
                    ? 'border-cmf-primary bg-white ring-1 ring-cmf-primary'
                    : 'border-transparent bg-white hover:bg-gray-50'
                }`}
            >
                <div className={`mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center ${
                    importMode === 'scores_only' ? 'border-cmf-primary' : 'border-gray-400'
                }`}>
                    {importMode === 'scores_only' && <div className="w-2 h-2 rounded-full bg-cmf-primary" />}
                </div>
                <div>
                    <div className="font-semibold text-gray-900">Import Results</div>
                    <div className="text-xs text-gray-500 mt-1">Match existing roster. Won't create new players.</div>
                    <div className="text-xs text-cmf-primary mt-1 font-medium">
                        Only updates scores for players already in your event.
                    </div>
                </div>
            </button>
        </div>
      </div>
      )}

      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* SCORES ONLY WARNING - Placed above actions */}
        {importMode === 'scores_only' && (
            <div className="col-span-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800 font-bold text-center shadow-sm mb-2">
                Won't create players. Unmatched rows will error.
            </div>
        )}
      </div>

      {/* PRIMARY DROPZONE - Always visible, large tile */}
      <div 
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer mb-4 ${
          isDragging 
            ? 'border-cmf-primary bg-blue-50 scale-[1.02]' 
            : 'border-gray-300 hover:bg-gray-50 hover:border-cmf-primary/50'
        }`}
        onClick={() => fileInputRef.current?.click()}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
          accept=".csv,.xlsx,.xls"
          multiple
        />
        <Upload className="w-12 h-12 text-gray-400 mx-auto mb-3" />
        {files.length > 0 ? (
          <div>
            <p className="font-medium text-cmf-primary text-lg">
              {files.length === 1 ? files[0].name : `${files.length} files selected`}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              {(files.reduce((total, currentFile) => total + currentFile.size, 0) / 1024).toFixed(1)} KB total
            </p>
            {files.length > 1 && (
              <p className="text-xs text-gray-500 mt-2 truncate max-w-[320px] mx-auto">
                {files.map((currentFile) => currentFile.name).join(', ')}
              </p>
            )}
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setFiles([]);
              }}
              className="mt-3 text-xs text-gray-500 hover:text-gray-700 underline"
            >
              Choose different file(s)
            </button>
          </div>
        ) : (
          <div>
            <p className="font-semibold text-gray-900 text-lg mb-1">
              {isDragging ? "Drop to upload" : "Click to choose files or drag & drop"}
            </p>
            <p className="text-sm text-gray-500">
              {isDragging ? "Release to upload your files" : "Supports CSV, Excel (.xlsx, .xls)"}
            </p>
          </div>
        )}
      </div>

      {/* ALTERNATIVE METHODS - Smaller secondary options */}
      <div className="mb-4">
        <p className="text-xs text-gray-500 mb-2 text-center">Or use alternative method:</p>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setMethod('sheets')}
            className="p-2 rounded-lg border border-gray-200 hover:border-cmf-primary hover:bg-blue-50 transition-all flex flex-col items-center gap-1 text-gray-600 hover:text-cmf-primary"
          >
            <Link className="w-4 h-4" />
            <span className="text-xs font-medium">Google Sheets</span>
          </button>
          <button
            onClick={() => setMethod('text')}
            className="p-2 rounded-lg border border-gray-200 hover:border-cmf-primary hover:bg-blue-50 transition-all flex flex-col items-center gap-1 text-gray-600 hover:text-cmf-primary"
          >
            <FileText className="w-4 h-4" />
            <span className="text-xs font-medium">Copy & Paste</span>
          </button>
        </div>
      </div>

      {/* Show alternative method input if selected */}
      {method === 'sheets' && (
        <div className="mb-4">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://docs.google.com/spreadsheets/d/..."
            className="w-full p-4 rounded-xl border-2 border-cmf-primary focus:ring-2 focus:ring-cmf-primary focus:border-transparent"
          />
          <p className="text-xs text-gray-500 mt-2">
            Paste a public Google Sheet link. Make sure "Anyone with the link" can view.
          </p>
        </div>
      )}
      
      {method === 'text' && (
        <div className="mb-4">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={placeholderText}
            className="w-full h-48 p-4 rounded-xl border-2 border-cmf-primary focus:ring-2 focus:ring-cmf-primary focus:border-transparent font-mono text-sm"
          />
          <p className="text-xs text-gray-500 mt-2">
            {supportedColumnsText}
          </p>
        </div>
      )}

      <div className="flex items-center justify-between pt-2">
        <div className="flex gap-4">
            <button
                onClick={handleDownloadTemplate}
                disabled={isDownloadingTemplate}
                className="text-sm text-cmf-primary hover:text-cmf-secondary font-medium flex items-center gap-2"
            >
                {isDownloadingTemplate ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                {isDownloadingTemplate ? 'Downloading...' : 'Template'}
            </button>
            <button
                onClick={fetchHistory}
                className="text-sm text-gray-600 hover:text-gray-900 font-medium flex items-center gap-2"
            >
                <Clock className="w-4 h-4" /> History
            </button>
        </div>

        <div className="flex gap-3">
            <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium"
            >
            Cancel
            </button>
            <button
            onClick={() => handleParse()}
            disabled={
              (method === 'file' && files.length === 0) || 
              (method === 'text' && !text.trim()) || 
              (method === 'sheets' && !url.trim()) ||
              !!schemaError
            }
            className="px-6 py-2 bg-cmf-primary text-white rounded-lg font-medium hover:bg-cmf-secondary disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
            Review Data <ChevronRight className="w-4 h-4" />
            </button>
        </div>
      </div>
      
      {error && (
        <div className="flex items-start gap-3 p-3 bg-red-50 text-red-700 rounded-lg text-sm mt-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>{error}</div>
        </div>
      )}

      {schemaError && (
        <div className="flex items-start gap-3 p-3 bg-red-100 text-red-800 rounded-lg text-sm mt-2 border border-red-200">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <strong>Configuration Error:</strong> {schemaError}
          </div>
        </div>
      )}
    </div>
  );
}
