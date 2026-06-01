import { X, Download, FileText } from 'lucide-react';
import { motion } from 'motion/react';
import { NotePlan } from '../types';

interface Props {
  note: NotePlan;
  onClose: () => void;
}

function getMimeType(dataUrl: string): string {
  // data:<mime>;base64,...
  return dataUrl.split(';')[0].split(':')[1] ?? '';
}

export function NoteViewerModal({ note, onClose }: Props) {
  const mime = getMimeType(note.driveUrl);
  const isPdf = mime === 'application/pdf';
  const isImage = mime.startsWith('image/');
  const canPreview = isPdf || isImage;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 20 }}
        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        className="w-full max-w-4xl bg-white rounded-3xl shadow-2xl border border-border-strong overflow-hidden flex flex-col"
        style={{ maxHeight: 'calc(100vh - 2rem)' }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border-strong shrink-0">
          <div className="w-8 h-8 rounded-xl bg-violet-50 border border-violet-200 flex items-center justify-center shrink-0">
            <FileText className="w-4 h-4 text-violet-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-primary truncate">{note.title}</p>
            <p className="text-[11px] text-text-muted">{mime || 'Local file'}</p>
          </div>
          <a
            href={note.driveUrl}
            download={note.title}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-canvas border border-border-strong text-xs font-medium text-text-secondary hover:text-primary transition-colors shrink-0"
          >
            <Download className="w-3.5 h-3.5" /> Download
          </a>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl bg-canvas border border-border-strong text-text-muted hover:text-primary transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto min-h-0 bg-canvas">
          {isPdf && (
            <iframe
              src={note.driveUrl}
              className="w-full h-full border-none"
              style={{ minHeight: '70vh' }}
              title={note.title}
            />
          )}
          {isImage && (
            <div className="flex items-center justify-center p-6 min-h-[60vh]">
              <img
                src={note.driveUrl}
                alt={note.title}
                className="max-w-full max-h-[75vh] object-contain rounded-xl shadow-md"
              />
            </div>
          )}
          {!canPreview && (
            <div className="flex flex-col items-center justify-center gap-4 p-12 min-h-[40vh] text-center">
              <div className="w-16 h-16 rounded-2xl bg-violet-50 border border-violet-200 flex items-center justify-center">
                <FileText className="w-8 h-8 text-violet-400" />
              </div>
              <div>
                <p className="font-semibold text-primary mb-1">Preview not available</p>
                <p className="text-sm text-text-muted">
                  This file type ({mime || 'unknown'}) can't be previewed in the browser.<br />
                  Use the Download button above to open it in the appropriate app.
                </p>
              </div>
              <a
                href={note.driveUrl}
                download={note.title}
                className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-primary/90 transition-all shadow-sm"
              >
                <Download className="w-4 h-4" /> Download file
              </a>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
