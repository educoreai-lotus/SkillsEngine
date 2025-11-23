/**
 * CSV Upload Modal Component
 */

import { useState } from 'react';
import { X, Upload, FileText } from 'lucide-react';
import { api } from '@/lib/api';

/**
 * @param {{onClose: function, isDarkMode: boolean}} props
 */
export default function CSVUploadModal({ onClose, isDarkMode }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile && selectedFile.type === 'text/csv') {
      setFile(selectedFile);
      setError(null);
    } else {
      setError('Please select a valid CSV file');
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a file');
      return;
    }

    try {
      setUploading(true);
      setError(null);
      const response = await api.importCSV(file);
      setResult(response);
    } catch (err) {
      setError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className={`max-w-2xl w-full ${isDarkMode ? 'bg-slate-800' : 'bg-white'} rounded-2xl shadow-3xl overflow-auto`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`p-6 border-b ${isDarkMode ? 'border-slate-700' : 'border-gray-200'}`}>
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold dark:text-gray-100">Upload file</h2>
            <button
              onClick={onClose}
              className="w-6 h-6 flex items-center justify-center text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* File Input */}
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2 dark:text-gray-300">
              Select CSV File
            </label>
            <div className="border-2 border-dashed border-gray-300 dark:border-slate-600 rounded-lg p-6 text-center">
              <input
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
                id="csv-upload"
              />
              <label
                htmlFor="csv-upload"
                className="cursor-pointer flex flex-col items-center gap-2"
              >
                <Upload className="w-8 h-8 text-gray-400" />
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Click to select or drag and drop
                </span>
              </label>
              {file && (
                <div className="mt-4 flex items-center justify-center gap-2">
                  <FileText className="w-5 h-5 text-emerald-600" />
                  <span className="text-sm font-medium dark:text-gray-300">{file.name}</span>
                </div>
              )}
            </div>
          </div>

          {/* CSV instructions / format helper */}
          <div className="mb-6 rounded-lg border border-dashed border-gray-200 dark:border-slate-700 bg-gray-50/60 dark:bg-slate-800/60 p-4 text-left text-sm leading-relaxed">
            <p className="font-semibold mb-2 text-gray-800 dark:text-gray-100">
              CSV format guidelines
            </p>
            <ul className="list-disc list-inside space-y-1 text-gray-700 dark:text-gray-300">
              <li>
                <span className="font-semibold">File type & size</span>: Upload a{' '}
                <span className="font-mono">.csv</span> file only (max ~10&nbsp;MB).
              </li>
              <li>
                <span className="font-semibold">Required columns</span>:{' '}
                <span className="font-mono">name</span> and{' '}
                <span className="font-mono">type</span>.
                The <span className="font-mono">type</span> column should be one of{' '}
                <span className="font-mono">competency</span>,{' '}
                <span className="font-mono">skill</span>, or{' '}
                <span className="font-mono">subskill</span> (not case-sensitive).
              </li>
              <li>
                <span className="font-semibold">Hierarchy</span>: Use the optional{' '}
                <span className="font-mono">parent_id</span> column to link rows in a
                hierarchy: competencies at the top, their skills as children, and
                subskills under skills.
              </li>
              <li>
                <span className="font-semibold">Optional columns</span>: You can add
                a <span className="font-mono">description</span> column to provide
                more details for each competency, skill, or subskill.
              </li>
              <li>
                <span className="font-semibold">Example structure</span> (header row):
                <span className="ml-1 font-mono">
                  name,type,parent_id,description
                </span>
              </li>
              <li>
                <span className="font-semibold">Common issues</span>: Make sure there
                is exactly one header row, no empty required fields, and that values in{' '}
                <span className="font-mono">type</span> are consistent (e.g. do not mix
                "Skill" and "Skills").
              </li>
            </ul>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {/* Result */}
          {result && (
            <div className="mb-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <p className="text-sm font-medium text-green-600 dark:text-green-400 mb-2">
                Upload successful!
              </p>
              <pre className="text-xs overflow-auto">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          )}
          <div className="flex gap-3">
            <button
              onClick={handleUpload}
              disabled={!file || uploading}
              className="flex-1 px-4 py-2 bg-emerald-600 dark:bg-teal-500 text-white rounded-lg hover:bg-emerald-700 dark:hover:bg-teal-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? 'Uploading...' : 'Upload'}
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-slate-600"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

