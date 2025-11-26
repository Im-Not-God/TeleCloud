
import React, { useState, useEffect } from 'react';
import { X, Loader2, Download } from 'lucide-react';

interface PreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  url: string;
  fileName: string;
  mimeType: string;
}

export const PreviewModal: React.FC<PreviewModalProps> = ({ isOpen, onClose, url, fileName, mimeType }) => {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isOpen) setIsLoading(true);
  }, [isOpen, url]);

  if (!isOpen) return null;

  const isVideo = mimeType.startsWith('video/');
  const isImage = mimeType.startsWith('image/');
  const isAudio = mimeType.startsWith('audio/');
  const isPdf = mimeType.includes('pdf');

  const handleLoad = () => setIsLoading(false);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl h-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-start z-10 pointer-events-none">
           <h3 className="text-white/80 text-sm font-medium bg-black/50 px-3 py-1 rounded backdrop-blur-md pointer-events-auto truncate max-w-[70%]">
             {fileName}
           </h3>
           <div className="flex gap-2 pointer-events-auto">
             <a 
                href={url} 
                download={fileName}
                className="p-2 bg-black/50 text-white/80 hover:text-white hover:bg-black/70 rounded-full backdrop-blur-md transition-colors"
                title="Download Original"
             >
                <Download className="w-5 h-5" />
             </a>
             <button 
                onClick={onClose} 
                className="p-2 bg-black/50 text-white/80 hover:text-white hover:bg-black/70 rounded-full backdrop-blur-md transition-colors"
             >
                <X className="w-5 h-5" />
             </button>
           </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex items-center justify-center overflow-hidden rounded-lg relative bg-black">
           {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center text-white/50">
                 <Loader2 className="w-8 h-8 animate-spin" />
              </div>
           )}

           {isVideo && (
             <video 
                src={url} 
                controls 
                autoPlay 
                className="max-w-full max-h-full outline-none" 
                onLoadedData={handleLoad}
             />
           )}

           {isImage && (
             <img 
                src={url} 
                alt={fileName} 
                className="max-w-full max-h-full object-contain" 
                onLoad={handleLoad}
             />
           )}
           
           {isAudio && (
              <div className="w-full max-w-md bg-white/10 p-6 rounded-2xl backdrop-blur-md">
                 <div className="text-center mb-6">
                    <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                        </svg>
                    </div>
                    <p className="text-white font-medium truncate">{fileName}</p>
                 </div>
                 <audio src={url} controls className="w-full" onLoadedData={handleLoad} />
              </div>
           )}

           {isPdf && (
              <iframe src={url} className="w-full h-full bg-white" onLoad={handleLoad} title="PDF Preview"></iframe>
           )}

           {!isVideo && !isImage && !isAudio && !isPdf && (
              <div className="text-white/60 text-center">
                 <p className="mb-2">Preview not available for this file type.</p>
                 <a href={url} download className="text-telegram-400 hover:underline">Download to view</a>
              </div>
           )}
        </div>
      </div>
    </div>
  );
};
