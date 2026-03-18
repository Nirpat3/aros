// ── SecureField Component ───────────────────────────────────────
// Controlled input that auto-masks when * is typed as first character.

import React, { useState, useCallback, useRef } from 'react';
import { encryptValue, maskValue } from './input-handler.js';

// ── Types ───────────────────────────────────────────────────────

interface SecureFieldProps {
  /** Field name for form binding */
  name: string;
  /** Placeholder text */
  placeholder?: string;
  /** Always mask (for password fields that don't need * prefix) */
  alwaysSecure?: boolean;
  /** Callback with secure output — never emits plain text after * prefix */
  onChange: (result: SecureFieldResult) => void;
  /** Optional className */
  className?: string;
}

export interface SecureFieldResult {
  displayValue: string;
  encryptedValue: string;
  isSecure: boolean;
}

// ── Component ───────────────────────────────────────────────────

export function SecureField({
  name,
  placeholder = 'Type * to encrypt your input',
  alwaysSecure = false,
  onChange,
  className,
}: SecureFieldProps) {
  const [isSecure, setIsSecure] = useState(alwaysSecure);
  const [display, setDisplay] = useState('');
  const plainRef = useRef('');

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;

      if (alwaysSecure) {
        // Always-secure mode: mask everything
        plainRef.current = raw;
        const masked = maskValue(raw);
        setDisplay(masked);
        onChange({
          displayValue: masked,
          encryptedValue: raw.length > 0 ? encryptValue(raw) : '',
          isSecure: true,
        });
        return;
      }

      if (raw.startsWith('*') && !isSecure) {
        // Entering secure mode
        setIsSecure(true);
        const plain = raw.slice(1);
        plainRef.current = plain;
        const masked = maskValue(plain);
        setDisplay(masked);
        onChange({
          displayValue: masked,
          encryptedValue: plain.length > 0 ? encryptValue(plain) : '',
          isSecure: true,
        });
        return;
      }

      if (isSecure && !alwaysSecure) {
        // In secure mode: track plain text internally, show mask
        // Determine what changed — user typed or deleted
        const prevLen = plainRef.current.length;
        if (raw.length > display.length) {
          // Character added
          const added = raw.slice(display.length);
          plainRef.current += added;
        } else if (raw.length < display.length) {
          // Character removed
          plainRef.current = plainRef.current.slice(0, raw.length);
        }

        const masked = maskValue(plainRef.current);
        setDisplay(masked);
        onChange({
          displayValue: masked,
          encryptedValue: plainRef.current.length > 0 ? encryptValue(plainRef.current) : '',
          isSecure: true,
        });
        return;
      }

      // Normal mode: no encryption
      plainRef.current = raw;
      setDisplay(raw);
      onChange({ displayValue: raw, encryptedValue: '', isSecure: false });
    },
    [isSecure, alwaysSecure, display, onChange],
  );

  return (
    <div className={`secure-field-wrapper ${className ?? ''}`} style={{ position: 'relative' }}>
      <input
        type={isSecure ? 'password' : 'text'}
        name={name}
        value={isSecure ? display : plainRef.current}
        onChange={handleChange}
        placeholder={placeholder}
        autoComplete="off"
        className="secure-field-input"
      />
      {isSecure && (
        <span
          className="secure-field-lock"
          style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)' }}
          aria-label="Encrypted"
        >
          🔒
        </span>
      )}
    </div>
  );
}
