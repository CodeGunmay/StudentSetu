// Renders StudentSetu screens and handles student actions.
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

/** Overlays (sheets, toasts, dialogs) live inside the phone, not the browser. */
export default function Portal({ id = 'overlay-layer', children }) {
  const [host, setHost] = useState(() => document.getElementById(id));
  useEffect(() => {
    if (!host) setHost(document.getElementById(id));
  }, [host, id]);
  if (!host) return null;
  return createPortal(children, host);
}
