import React, { useState, useEffect } from "react";
import { Upload, X, ExternalLink } from "lucide-react";
import "./QuestionImageManager.css";

// -------------------------------------------------------------
// Component dedicated to rendering a preview for a single File
// This ensures that createObjectURL and revokeObjectURL are 
// strictly bound to the mount/unmount lifecycle of the preview.
// It also avoids race conditions with array states.
// -------------------------------------------------------------
const LocalFilePreview: React.FC<{
  file: File;
  onRemove: () => void;
}> = ({ file, onRemove }) => {
  const [url, setUrl] = useState<string>("");

  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [file]);

  if (!url) return null;

  return (
    <div className="questions-media-preview-wrapper">
      <img src={url} alt={`New upload preview`} className="questions-media-preview" />
      <div className="questions-media-actions" style={{ justifyContent: 'flex-end' }}>
        <button
          type="button"
          className="questions-remove-media-btn"
          onClick={onRemove}
          title="Remove Image"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

// -------------------------------------------------------------
// Main Image Manager Component
// -------------------------------------------------------------
interface QuestionImageManagerProps {
  imageUrls: string[];
  onChangeImageUrls: (urls: string[]) => void;
  newFiles: File[];
  onChangeNewFiles: (files: File[]) => void;
}

const QuestionImageManager: React.FC<QuestionImageManagerProps> = ({
  imageUrls,
  onChangeImageUrls,
  newFiles,
  onChangeNewFiles,
}) => {

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    onChangeNewFiles([...newFiles, ...Array.from(files)]);
    if (e.target) e.target.value = ""; 
  };

  const handleRemoveExisting = (urlToRemove: string) => {
    onChangeImageUrls(imageUrls.filter(url => url !== urlToRemove));
  };

  const handleRemoveNew = (indexToRemove: number) => {
    onChangeNewFiles(newFiles.filter((_, idx) => idx !== indexToRemove));
  };

  // Safely filter existing image URLs so bad data doesn't render broken icons
  const validImageUrls = (imageUrls || []).filter(url => url && typeof url === 'string');
  const hasImages = validImageUrls.length > 0 || newFiles.length > 0;

  return (
    <div className="questions-image-manager">
      <label className="questions-form-label">
        Reference Images (Optional)
      </label>

      {hasImages && (
        <div className="questions-image-grid">
          {/* External existing images from DB */}
          {validImageUrls.map((url, index) => (
            <div key={`existing-${index}-${url}`} className="questions-media-preview-wrapper">
              <img src={url} alt={`Existing upload ${index + 1}`} className="questions-media-preview" />
              <div className="questions-media-actions">
                <a 
                  href={url} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="questions-view-media-btn" 
                  title="View Image"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
                <button
                  type="button"
                  className="questions-remove-media-btn"
                  onClick={() => handleRemoveExisting(url)}
                  title="Remove Image"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
          
          {/* New files to be uploaded */}
          {newFiles.map((file, index) => (
            <LocalFilePreview 
              key={`new-${index}-${file.name}`} 
              file={file} 
              onRemove={() => handleRemoveNew(index)} 
            />
          ))}
        </div>
      )}

      <div className="questions-media-upload-container">
        <input
          type="file"
          accept="image/*"
          multiple
          className="questions-media-upload-input"
          onChange={handleFileUpload}
        />
        <Upload className="h-8 w-8 text-accent mx-auto mb-2 opacity-80" />
        <p className="text-sm text-secondary">
          Click or drag files to upload
        </p>
      </div>
    </div>
  );
};

export default QuestionImageManager;
