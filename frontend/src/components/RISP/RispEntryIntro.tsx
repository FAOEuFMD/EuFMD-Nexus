import React, { useRef, useState } from 'react';

export type RispBulkCategory = 'outbreaks' | 'vaccination' | 'marketprice';

const TEMPLATE_HREF: Record<RispBulkCategory, string> = {
  outbreaks: '/templates/outbreaks.xlsx',
  vaccination: '/templates/vaccination.xlsx',
  marketprice: '/templates/marketprice.xlsx',
};

interface RispEntryIntroProps {
  /** Extra sentence above the bulk strip (page-specific). */
  pageHint?: string;
  bulkCategory: RispBulkCategory;
  onUploadFile?: (file: File) => Promise<void> | void;
}

/**
 * Optional page hint + bulk Excel strip placed before the entry table.
 */
const RispEntryIntro: React.FC<RispEntryIntroProps> = ({
  pageHint,
  bulkCategory,
  onUploadFile,
}) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    setMessage(null);
    try {
      if (onUploadFile) {
        await onUploadFile(file);
        setMessage('Upload completed.');
      } else {
        setMessage(
          'Bulk upload to RISP is being wired next. Your template download is ready; please use the form for now or try again shortly.'
        );
      }
    } catch (err: any) {
      setMessage(err?.message || 'Upload failed.');
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
          <a
            href={TEMPLATE_HREF[bulkCategory]}
            download
            className="inline-flex items-center px-4 py-2 text-sm font-semibold border-2 border-green-greenMain text-green-greenMain rounded hover:bg-green-greenMain hover:text-white transition-colors"
          >
            Download Excel template
          </a>
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
        {message && <p className="text-sm text-gray-600 mt-2">{message}</p>}
      </div>
    </section>
  );
};

export default RispEntryIntro;
