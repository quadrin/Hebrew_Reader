import { useEffect, useRef } from "react";

/* What every sheet and overlay owes the person who opened it: Escape closes
   it, the page behind it stops scrolling, focus lands inside it, and when it
   closes focus goes back to whatever opened it. One hook, so each of the
   app's dozen sheets gets all four rather than whichever it remembered.

   Returns a ref for the dialog's container. The container should carry
   role="dialog" and aria-modal="true"; the hook adds tabIndex so it can take
   focus itself when it holds nothing focusable. */
let locks = 0;
export function useDialog(open, onClose) {
  const ref = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement;
    const el = ref.current;

    /* scroll lock — counted, because two sheets can stack */
    locks += 1;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    /* focus the first control, or the sheet itself */
    if (el) {
      if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "-1");
      const first = el.querySelector(
        'input:not([type=hidden]):not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      );
      /* an input first would open the keyboard on a phone before anything
         has been read, so a sheet with a text field focuses the sheet */
      const target = first && !/^(INPUT|TEXTAREA|SELECT)$/.test(first.tagName) ? first : el;
      requestAnimationFrame(() => target.focus?.({ preventScroll: true }));
    }

    const onKey = (e) => {
      if (e.key !== "Escape") return;
      /* the topmost dialog handles it, the ones under it stay put */
      const dialogs = document.querySelectorAll('[role="dialog"]');
      if (dialogs.length && dialogs[dialogs.length - 1] !== el) return;
      e.stopPropagation();
      closeRef.current?.();
    };
    document.addEventListener("keydown", onKey);

    return () => {
      document.removeEventListener("keydown", onKey);
      locks -= 1;
      if (locks === 0) document.body.style.overflow = prevOverflow;
      if (opener && typeof opener.focus === "function" && document.contains(opener)) {
        opener.focus({ preventScroll: true });
      }
    };
  }, [open]);

  return ref;
}
