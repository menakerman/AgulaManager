import { useState, useEffect, useRef } from 'react';
import type { Attachment } from '../types';
import { api } from '../services/api';

interface FileUploadProps {
  cartId: number;
}

export default function FileUpload({ cartId }: FileUploadProps) {
  const [files, setFiles] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadFiles();
  }, [cartId]);

  const loadFiles = async () => {
    try {
      const data = await api.getFiles(cartId);
      setFiles(data);
    } catch (err) {
      console.error('Failed to load files:', err);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const attachment = await api.uploadFile(cartId, file);
      setFiles([attachment, ...files]);
    } catch (err) {
      console.error('Upload failed:', err);
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleUpload}
          className="hidden"
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="btn-secondary text-sm"
        >
          {uploading ? 'מעלה...' : 'העלאת קובץ'}
        </button>
      </div>

      {files.length > 0 && (
        <div className="space-y-1">
          {files.map((file) => (
            <div key={file.id} className="flex items-center gap-2 text-sm bg-gray-50 dark:bg-gray-700 p-2 rounded">
              <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
              <a
                href={`/api/files/download/${file.filepath}`}
                className="text-primary-600 hover:underline flex-1"
                target="_blank"
                rel="noopener noreferrer"
              >
                {file.filename}
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
