import { useState, useRef } from 'react';
import { Button } from '../ui/button';
import { Upload, X, FileText, Image as ImageIcon, Loader2 } from 'lucide-react';
import { uploadFile } from '../../api';
import { toast } from 'sonner';
import { API_BASE_URL } from '../../config';

interface FileUploadProps {
  onUploadComplete: (url: string, filename: string) => void;
  currentFile?: string;
  label?: string;
  accept?: string;
}

export function FileUpload({ onUploadComplete, currentFile, label = "Subir Archivo", accept = "image/*,application/pdf" }: FileUploadProps) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const { url, filename } = await uploadFile(file);
      onUploadComplete(url, filename);
      toast.success('Archivo subido correctamente');
    } catch (error) {
      console.error(error);
      toast.error('Error al subir archivo');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const fullUrl = currentFile ? (currentFile.startsWith('http') ? currentFile : `${API_BASE_URL}${currentFile}`) : null;

  return (
    <div className="space-y-2">
      <input
        type="file"
        ref={inputRef}
        className="hidden"
        accept={accept}
        onChange={handleFileChange}
        aria-label={label}
      />
      
      {!currentFile ? (
        <Button 
          variant="outline" 
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="w-full border-dashed border-2 h-20 flex flex-col gap-2"
        >
          {uploading ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : (
            <Upload className="h-6 w-6 text-gray-400" />
          )}
          <span>{uploading ? "Subiendo..." : label}</span>
        </Button>
      ) : (
        <div className="relative border rounded-lg p-2 flex items-center gap-3 bg-gray-50">
          <div className="h-10 w-10 bg-gray-200 rounded flex items-center justify-center overflow-hidden">
             {currentFile.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
               <img src={fullUrl || ''} alt="Preview" className="h-full w-full object-cover" />
             ) : (
               <FileText className="h-6 w-6 text-gray-500" />
             )}
          </div>
          <div className="flex-1 min-w-0">
             <p className="text-sm font-medium truncate">{currentFile.split('/').pop()}</p>
             <a href={fullUrl || '#'} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">
               Ver archivo
             </a>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => onUploadComplete('', '')}
            className="h-8 w-8 p-0 text-gray-500 hover:text-red-500"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
