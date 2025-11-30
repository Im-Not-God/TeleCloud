import React, { useState, useEffect } from 'react';
import { X, Loader2, Download, FileText } from 'lucide-react';
import { isFilePreviewable } from '../constants';
import { PrismAsyncLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus, coy } from 'react-syntax-highlighter/dist/esm/styles/prism';
import hljs from "highlight.js";
import languageMap from 'language-map';

interface PreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  url: string;
  fileName: string;
  mimeType: string;
}

export const PreviewModal: React.FC<PreviewModalProps> = ({ isOpen, onClose, url, fileName, mimeType }) => {
   const [isLoading, setIsLoading] = useState(true);
   const [textContent, setTextContent] = useState<string | null>(null);
   const [isDark, setIsDark] = useState(document.documentElement.classList.contains('dark'));

   // Listen for dark mode changes
   useEffect(() => {
      const observer = new MutationObserver(() => {
         setIsDark(document.documentElement.classList.contains('dark'));
      });
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
      return () => observer.disconnect();
   }, []);

   // Determine file type category
   const _isFilePreviewable = isFilePreviewable(fileName, mimeType);
   let isVideo = false;
   let isImage = false;
   let isAudio = false;
   let isPdf = false;
   let isText = false;
  
   switch(_isFilePreviewable.type){
      case "video": isVideo = true; break;
      case "image": isImage = true; break;
      case "audio": isAudio = true; break;
      case "pdf": isPdf = true; break;
      case "text": isText = true; break;
   }

   // Determine Language for Syntax Highlighting
   const getLanguage = (name: string) => {
      const ext = name.split('.').pop()?.toLowerCase();
      let candidates: string[] = [];

      if (ext) {
         candidates = [...new Set(Object.entries(languageMap)
            .filter(([_, info]) => info.extensions?.includes("." + ext))
            .flatMap(([lang, info]) => {
               const base = [lang.toLowerCase()];
               const aliases = (info.aliases || []).map(a => a.toLowerCase());
               return [...base, ...aliases];
            }))];
            // // .map(([lang]) => lang.toLowerCase());
            // return [...new Set(matches)]; // 去重
      }
      // if (ext && extAliasMap[ext]) {
      //    candidates = extAliasMap[ext]; // linguist 自动处理扩展名 + alias
      //    console.log('candi:',candidates);
      // }


      // 自动检测（带候选语言）
      const result = candidates.length
         ? hljs.highlightAuto(textContent,candidates).language
         : hljs.highlightAuto(textContent).language;
      
      console.log("lang: ", result);

      // Prism supportedLanguages
      const prismSupported = SyntaxHighlighter.supportedLanguages;
      if (prismSupported.includes(result)) {
         return result;
      }
      
      const aliases: { [key: string]: string } = {
         'c#': 'csharp'
      };
      return aliases[result || ''] || result || 'text';
   };

   useEffect(() => {
      if (!isOpen || !isText) {
         if (!isText && !isImage && isOpen) {
            setTimeout(() => setIsLoading(false), 100);
         }
         return;
      }

      setIsLoading(true);
      setTextContent(null);

      const abortController = new AbortController();
      
      // Fetch text content
      fetch(url, { signal: abortController.signal })
         .then(res => {
            if (!res.ok) throw new Error("Failed to load text");
            return res.text();
         })
         .then(text => {
            // Limit preview size to avoid browser crash on huge logs
            if (text.length > 500000) {
               setTextContent(text.substring(0, 500000) + "\n\n...[File truncated for preview]...");
            } else {
               setTextContent(text);
            }
         })
         .catch(err => {
            if(err.name !== 'AbortError'){
               console.error(err);
               setTextContent("Error loading file content.");
            }
         })
         .finally(() => setIsLoading(false));
      
      return () => abortController.abort();
   }, [isOpen, url, isText]);

   // Close on Escape key
   useEffect(() => {
      const handleEscape = (e: KeyboardEvent) => {
         if (e.key === 'Escape') onClose();
      };
      if (isOpen) {
         document.addEventListener('keydown', handleEscape);
         document.body.style.overflow = 'hidden';
      }
      return () => {
         document.removeEventListener('keydown', handleEscape);
         document.body.style.overflow = '';
      };
   }, [isOpen, onClose]);

   if (!isOpen) return null;

   const handleLoad = () => setIsLoading(false);
   
   const handleBackdropClick = (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
         onClose();
      }
   };

  return (
    <div 
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={handleBackdropClick}
    >
      <div className="relative w-full max-w-5xl h-full max-h-[90vh] flex flex-col">
        {/* Header - Always on top with high z-index */}
        <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-start z-50 pointer-events-none">
           <h3 className="text-white/90 text-sm font-medium bg-black/60 px-3 py-2 rounded-lg backdrop-blur-md pointer-events-auto truncate max-w-[70%] shadow-lg">
             {fileName}
           </h3>
           <div className="flex gap-2 pointer-events-auto">
             <a 
                href={url} 
                download={fileName}
                className="p-2 bg-black/60 text-white/80 hover:text-white hover:bg-black/80 rounded-lg backdrop-blur-md transition-all shadow-lg hover:scale-105"
                title="Download"
                onClick={(e) => e.stopPropagation()}
             >
                <Download className="w-5 h-5" />
             </a>
             <button 
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                }} 
                className="p-2 bg-black/60 text-white/80 hover:text-white hover:bg-black/80 rounded-lg backdrop-blur-md transition-all shadow-lg hover:scale-105"
                title="Close (Esc)"
             >
                <X className="w-5 h-5" />
             </button>
           </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex items-center justify-center overflow-hidden rounded-lg relative bg-black mt-16 shadow-2xl">
           {/* Loading overlay - lower z-index than header */}
           {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center text-white/50 z-10 bg-black/50 backdrop-blur-sm">
                 <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-8 h-8 animate-spin" />
                    <p className="text-sm text-white/70">Loading preview...</p>
                 </div>
              </div>
           )}

           {isVideo && (
             <video 
                src={url} 
                controls 
                autoPlay 
                className="max-w-full max-h-full outline-none" 
                onLoadedData={handleLoad}
                onError={handleLoad}
             />
           )}

           {isImage && (
             <img 
                src={url} 
                alt={fileName} 
                className="max-w-full max-h-full object-contain" 
                onLoad={handleLoad}
                onError={handleLoad}
             />
           )}
           
           {isAudio && (
              <div className="w-full max-w-md bg-white/10 p-8 rounded-2xl backdrop-blur-md shadow-2xl">
                 <div className="text-center mb-6">
                    <div className="w-20 h-20 bg-gradient-to-br from-purple-500/30 to-pink-500/30 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                        <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                        </svg>
                    </div>
                    <p className="text-white font-medium truncate px-4">{fileName}</p>
                 </div>
                 <audio 
                    src={url} 
                    controls 
                    className="w-full" 
                    onLoadedData={handleLoad}
                    onError={handleLoad}
                 />
              </div>
           )}

           {isPdf && (
              <iframe 
                src={url} 
                className="w-full h-full bg-white" 
                onLoad={handleLoad} 
                title="PDF Preview"
              />
           )}

           {isText && (
               <div className="w-full h-full bg-slate-50 dark:bg-slate-900 overflow-auto">
                  {textContent !== null ? (
                     <div className="h-full text-sm">
                        <SyntaxHighlighter
                           language={getLanguage(fileName)}
                           style={isDark ? vscDarkPlus : coy}
                           customStyle={{ 
                              margin: 0, 
                              height: '100%', 
                              borderRadius: 0, 
                              fontSize: '0.875rem',
                              backgroundColor: 'transparent' // Let container bg shine through or usage theme bg
                           }}
                           wrapLongLines={true}
                           showLineNumbers={true}
                        >
                              {textContent}
                        </SyntaxHighlighter>
                     </div>
                  ) : (
                     <div className="h-96 flex items-center justify-center">
                        <Loader2 className="w-8 h-8 animate-spin text-slate-400 dark:text-slate-600" />
                     </div>
                  )}
               </div>
           )}

           {!isVideo && !isImage && !isAudio && !isPdf && !isText && (
              <div className="text-white/70 text-center p-8">
                 <div className="mb-4 flex justify-center">
                    <div className="w-20 h-20 bg-white/10 rounded-full flex items-center justify-center">
                        <FileText className="w-10 h-10 opacity-50" />
                    </div>
                 </div>
                 <p className="text-lg mb-2">Preview not available</p>
                 <p className="text-sm text-white/50 mb-4">This file type cannot be previewed in the browser.</p>
                 <a 
                    href={url} 
                    download={fileName}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
                 >
                    <Download className="w-4 h-4" />
                    Download to view
                 </a>
              </div>
           )}
        </div>
      </div>
    </div>
  );
};