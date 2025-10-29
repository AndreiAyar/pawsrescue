'use client';
import { useState } from "react";

interface FileUploadProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  className?: string;
  maxFiles?: number;
  accept?: string;
  onChange?: (files: FileList | null) => void;
  showPreview?: boolean;
}

export function FileUpload({ 
  className, 
  maxFiles = 5, 
  accept = "image/*", 
  onChange,
  showPreview = true,
  ...props 
}: FileUploadProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      const fileArray = Array.from(files).slice(0, maxFiles);
      setSelectedFiles(fileArray);
      onChange?.(files);
    }
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(false);
    
    const files = event.dataTransfer.files;
    if (files) {
      const fileArray = Array.from(files).slice(0, maxFiles);
      setSelectedFiles(fileArray);
      onChange?.(files);
    }
  };

  const removeFile = (index: number) => {
    const newFiles = selectedFiles.filter((_, i) => i !== index);
    setSelectedFiles(newFiles);
    
    // Create new FileList-like object
    const dt = new DataTransfer();
    newFiles.forEach(file => dt.items.add(file));
    onChange?.(dt.files);
  };

  return (
    <div className="w-full">
      {/* Upload Area */}
      <div
        className={
          className +
          ` border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
            isDragOver 
              ? 'border-blue-400 bg-blue-50' 
              : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
          }`
        }
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => document.getElementById('fileInput')?.click()}
      >
        <input
          id="fileInput"
          type="file"
          multiple
          accept={accept}
          onChange={handleFileChange}
          className="hidden"
          {...props}
        />
        
        <div className="flex flex-col items-center">
          <svg
            className="w-8 h-8 text-gray-400 mb-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M12 6v6m0 0v6m0-6h6m-6 0H6"
            />
          </svg>
          <p className="text-sm text-gray-600 mb-1">
            <span className="font-medium">Click to upload</span> or drag and drop
          </p>
          <p className="text-xs text-gray-500">
            PNG, JPG, GIF up to {maxFiles} files
          </p>
        </div>
      </div>

      {/* File Preview */}
      {showPreview && selectedFiles.length > 0 && (
        <div className="mt-4">
          <p className="text-sm font-medium text-gray-700 mb-2">
            Selected files ({selectedFiles.length}/{maxFiles}):
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {selectedFiles.map((file, index) => (
              <div key={index} className="relative group">
                <div className="aspect-square rounded-lg overflow-hidden border border-gray-200">
                  {file.type.startsWith('image/') ? (
                    <img
                      src={URL.createObjectURL(file)}
                      alt={`Preview ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gray-100">
                      <svg className="w-6 h-6 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 0v12h8V4H6z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                </div>
                
                {/* Remove button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile(index);
                  }}
                  className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600 transition-colors opacity-0 group-hover:opacity-100"
                >
                  ×
                </button>
                
                {/* File name */}
                <p className="text-xs text-gray-500 mt-1 truncate">
                  {file.name}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}