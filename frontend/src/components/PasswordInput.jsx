import { useState, forwardRef } from 'react';

/**
 * Password input with a show/hide (eye) toggle.
 * Works both controlled (value/onChange) and uncontrolled (ref) — so it's
 * safe with the autofill-friendly ref-based login form too.
 */
const PasswordInput = forwardRef(function PasswordInput({ className = '', ...props }, ref) {
  const [show, setShow] = useState(false);
  return (
    <div className="pw-wrap">
      <input
        ref={ref}
        type={show ? 'text' : 'password'}
        className={`form-control ${className}`}
        {...props}
      />
      <button
        type="button"
        className="pw-toggle"
        onClick={() => setShow((s) => !s)}
        tabIndex={-1}
        aria-label={show ? 'Hide password' : 'Show password'}
        title={show ? 'Hide password' : 'Show password'}
      >
        <i className={`bi bi-${show ? 'eye-slash' : 'eye'}`} />
      </button>
    </div>
  );
});

export default PasswordInput;
