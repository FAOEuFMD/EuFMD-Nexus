import React, { useRef, useState } from 'react';
import { apiService } from '../../services/api';

export type RispBulkCategory = 'outbreaks' | 'vaccination' | 'marketprice';

interface RispEntryIntroProps {
  /** Extra sentence above the bulk strip (page-specific). */
  pageHint?: string;
  bulkCategory: RispBulkCategory;
  /** Pre-fill year/quarter columns in the downloaded template. */
  templateYear?: string;
  templateQuarter?: string;
  onUploadFile?: (file: File) => Promise<void> | void;
  /** Called after a successful bulk import (e.g. reload table data). */
  onUploadSuccess?: () => void;
}

/**
 * Optional page hint + bulk Excel strip placed before the entry table.
 */
const RispEntryIntro: React.FC<RispEntryIntroProps> = ({
  pageHint,
  bulkCategory,
  templateYear,
  templateQuarter,
  onUploadFile,
  onUploadSuccess,
}) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<'success' | 'error' | 'info'>('info');
  const [rowErrors, setRowErrors] = useState<{ row: number; error: string }[]>([]);

  const handleDownloadTemplate = async () => {
    setDownloading(true);
    setMessage(null);
    setRowErrors([]);
    try {
      const response = await apiService.risp.downloadTemplate(bulkCategory, {
        year: templateYear,
        quarter: templateQuarter,
      });
      const blob = response.data as Blob;
      const disposition = response.headers?.['content-disposition'] as string | undefined;
      const match = disposition?.match(/filename="?([^"]+)"?/);
      const filename = match?.[1] || `risp_${bulkCategory}_template.xlsx`;
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      setMessageType('error');
      setMessage(err?.response?.data?.detail || err?.message || 'Template download failed.');
    } finally {
      setDownloading(false);
    }
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    setMessage(null);
    setRowErrors([]);
    try {
      if (onUploadFile) {
        await onUploadFile(file);
        setMessageType('success');
        setMessage('Upload completed.');
        onUploadSuccess?.();
      } else {
        const response = await apiService.risp.uploadBulk(bulkCategory, file, {
          year: templateYear,
          quarter: templateQuarter,
        });
        const data = response.data;
        if (data?.success) {
          setMessageType('success');
          setMessage(data.message || 'Upload completed.');
          onUploadSuccess?.();
        } else if (data?.has_errors && Array.isArray(data.errors) && data.errors.length > 0) {
          setMessageType('error');
          setMessage(data.message || 'Some rows failed validation. Nothing was imported.');
          setRowErrors(data.errors);
        } else {
          setMessageType('error');
          setMessage(data?.message || 'Upload failed — no rows were imported.');
        }
      }
    } catch (err: any) {
      setMessageType('error');
      const detail = err?.response?.data?.detail;
      setMessage(
        typeof detail === 'string'
          ? detail
          : err?.message || 'Upload failed.'
      );
    } finally {
      setUploading(false);
    }
  };

  return (
    <section className="mb-6">
      {pageHint && (
        <p className="text-left text-gray-600 mb-4">{pageHint}</p>
      )}

      <div className="border-2 border-dashed border-green-greenMain/40 rounded-lg bg-green-50/40 p-4 mb-2">
        <p className="text-sm text-gray-700 mb-3">
          <strong>How to enter data:</strong> if you have a small number of lines, use the form
          below. If you have a lot of data, download the Excel template, fill it, and use bulk
          upload.
        </p>
        <div className="flex flex-wrap gap-3 items-center">
          <button
            type="button"
            disabled={downloading}
            onClick={handleDownloadTemplate}
            className="inline-flex items-center px-4 py-2 text-sm font-semibold border-2 border-green-greenMain text-green-greenMain rounded hover:bg-green-greenMain hover:text-white transition-colors disabled:opacity-60"
          >
            {downloading ? 'Preparing…' : 'Download Excel template'}
          </button>
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
            className="inline-flex items-center px-4 py-2 text-sm font-semibold bg-green-greenMain text-white rounded hover:opacity-90 disabled:opacity-60"
          >
            {uploading ? 'Uploading…' : 'Bulk upload Excel'}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={handleFile}
          />
        </div>
        {message && (
          <p
            className={`text-sm mt-2 ${
              messageType === 'success'
                ? 'text-green-700'
                : messageType === 'error'
                  ? 'text-red-600'
                  : 'text-gray-600'
            }`}
          >
            {message}
          </p>
        )}
        {rowErrors.length > 0 && (
          <ul className="mt-2 text-sm text-red-600 list-disc pl-5 space-y-1 max-h-40 overflow-y-auto">
            {rowErrors.map((err) => (
              <li key={`${err.row}-${err.error}`}>
                Row {err.row}: {err.error}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
};

export default RispEntryIntro;
