// ── ChatInput ───────────────────────────────────────────────────
// Enhanced chat input with shortcut autocomplete and secure input.

import React, { useState, useCallback, useRef, useEffect } from 'react';
import type { ShortcutType, AutocompleteSuggestion, SessionContext, NodeTarget, ToolTarget } from '../../../../../aros-ai/shortcuts/types.js';
import { getSuggestions } from '../../../../../aros-ai/shortcuts/autocomplete.js';
import { handleShortcuts } from '../../../../../aros-ai/shortcuts/handler.js';
import { processMessage } from '../../../../../security/input-handler.js';

// ── Types ───────────────────────────────────────────────────────

interface ChatInputProps {
  context: SessionContext;
  onSend: (message: string, meta: ChatInputMeta) => void;
}

interface ChatInputMeta {
  routeTo?: string;
  activeTool?: ToolTarget;
  activeNode?: NodeTarget;
  secureFields?: Array<{ name: string; value: string }>;
  hasSecureContent: boolean;
}

// ── Component ───────────────────────────────────────────────────

export function ChatInput({ context, onSend }: ChatInputProps) {
  const [value, setValue] = useState('');
  const [suggestions, setSuggestions] = useState<AutocompleteSuggestion[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showPopup, setShowPopup] = useState(false);
  const [activeNode, setActiveNode] = useState<NodeTarget | undefined>(context.activeNode);
  const [activeTool, setActiveTool] = useState<ToolTarget | undefined>(context.activeTool);
  const [hasSecure, setHasSecure] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Detect shortcut triggers and secure content
  useEffect(() => {
    const lastWord = value.split(/\s/).pop() ?? '';
    setHasSecure(value.includes('*'));

    if (lastWord.length < 2) {
      setShowPopup(false);
      return;
    }

    let type: ShortcutType | null = null;
    let partial = '';

    if (lastWord.startsWith('@')) {
      type = 'mention';
      partial = lastWord.slice(1);
    } else if (lastWord.startsWith('/')) {
      type = 'tool';
      partial = lastWord.slice(1);
    } else if (lastWord.startsWith('#')) {
      type = 'node';
      partial = lastWord.slice(1);
    }

    if (type && partial.length > 0) {
      const results = getSuggestions(partial, type, {
        mentions: context.mentions,
        tools: context.tools,
        nodes: context.nodes,
      });
      setSuggestions(results);
      setSelectedIndex(0);
      setShowPopup(results.length > 0);
    } else {
      setShowPopup(false);
    }
  }, [value, context]);

  // Apply autocomplete selection
  const applySuggestion = useCallback(
    (suggestion: AutocompleteSuggestion) => {
      const words = value.split(/\s/);
      words[words.length - 1] = suggestion.label;
      setValue(words.join(' ') + ' ');
      setShowPopup(false);
      inputRef.current?.focus();
    },
    [value],
  );

  // Keyboard handling
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (showPopup) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSelectedIndex((i) => Math.min(i + 1, suggestions.length - 1));
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSelectedIndex((i) => Math.max(i - 1, 0));
          return;
        }
        if (e.key === 'Enter' || e.key === 'Tab') {
          if (suggestions[selectedIndex]) {
            e.preventDefault();
            applySuggestion(suggestions[selectedIndex]);
            return;
          }
        }
        if (e.key === 'Escape') {
          setShowPopup(false);
          return;
        }
      }

      // Submit: Enter (no shift)
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        submit();
      }
    },
    [showPopup, suggestions, selectedIndex, applySuggestion],
  );

  // Submit message
  const submit = useCallback(() => {
    if (!value.trim()) return;

    const result = handleShortcuts(value, context);
    const processed = processMessage(value);

    // Update active node/tool from shortcuts
    if (result.activeNode) setActiveNode(result.activeNode);
    if (result.activeTool) setActiveTool(result.activeTool);

    onSend(result.cleanMessage, {
      routeTo: result.routeTo?.name,
      activeTool: result.activeTool ?? activeTool,
      activeNode: result.activeNode ?? activeNode,
      secureFields: processed.secureFields.map((f) => ({ name: f.name, value: f.value })),
      hasSecureContent: processed.secureFields.length > 0,
    });

    setValue('');
    setHasSecure(false);
  }, [value, context, onSend, activeNode, activeTool]);

  return (
    <div className="chat-input-container" style={{ position: 'relative' }}>
      {/* Active badges */}
      <div className="chat-input-badges" style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
        {activeNode && (
          <span className="badge badge-node" style={{ fontSize: 12, padding: '2px 8px', borderRadius: 12, background: '#e0e7ff', color: '#3730a3' }}>
            #{activeNode.name}
          </span>
        )}
        {activeTool && (
          <span className="badge badge-tool" style={{ fontSize: 12, padding: '2px 8px', borderRadius: 12, background: '#ecfdf5', color: '#065f46' }}>
            /{activeTool.name}
          </span>
        )}
        {hasSecure && (
          <span className="badge badge-secure" style={{ fontSize: 12, padding: '2px 8px', borderRadius: 12, background: '#fef3c7', color: '#92400e' }}>
            🔒 Secure content
          </span>
        )}
      </div>

      {/* Autocomplete popup */}
      {showPopup && (
        <div
          className="autocomplete-popup"
          style={{
            position: 'absolute',
            bottom: '100%',
            left: 0,
            right: 0,
            background: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: 8,
            boxShadow: '0 -4px 12px rgba(0,0,0,0.1)',
            marginBottom: 4,
            maxHeight: 200,
            overflow: 'auto',
          }}
        >
          {suggestions.map((s, i) => (
            <div
              key={s.value}
              className={`autocomplete-item ${i === selectedIndex ? 'selected' : ''}`}
              style={{
                padding: '8px 12px',
                cursor: 'pointer',
                background: i === selectedIndex ? '#f3f4f6' : 'transparent',
                display: 'flex',
                justifyContent: 'space-between',
              }}
              onMouseDown={() => applySuggestion(s)}
              onMouseEnter={() => setSelectedIndex(i)}
            >
              <span style={{ fontWeight: 500 }}>{s.label}</span>
              {s.description && (
                <span style={{ color: '#9ca3af', fontSize: 12 }}>{s.description}</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Input */}
      <textarea
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Message AROS... (@ mention, / tool, # node, * secure)"
        rows={1}
        style={{
          width: '100%',
          resize: 'none',
          padding: '10px 12px',
          borderRadius: 8,
          border: '1px solid #e5e7eb',
          fontSize: 14,
          outline: 'none',
        }}
      />
    </div>
  );
}
