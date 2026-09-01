import { useDialog } from "../useDialog.js";

/* The bottom sheet every card on the path rises out of. The scrim closes it,
   the panel does not, and — through useDialog — so do Escape, and closing
   hands focus back to what opened it while the page under it holds still. */
export default function Sheet({ onClose, className = "", label, children, style }) {
  const ref = useDialog(true, onClose);
  return (
    <div className="d-sheet" onClick={onClose}>
      <div
        ref={ref}
        className={`d-sheet-inner ${className}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        style={style}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
