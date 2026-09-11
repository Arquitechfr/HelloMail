"use client";

import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { useSearchContacts } from "@/lib/queries/contacts";
import type { Contact } from "@/lib/api-types";

interface ContactAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  id?: string;
  required?: boolean;
}

export function ContactAutocomplete({
  value,
  onChange,
  placeholder,
  id,
  required,
}: ContactAutocompleteProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  // Extrait le dernier fragment en cours de saisie (après la dernière virgule).
  const lastFragment = value.split(",").pop()?.trim() ?? "";
  const [debouncedFragment, setDebouncedFragment] = useState(lastFragment);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce 300ms — évite une requête /api/contacts/search par frappe.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedFragment(lastFragment), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [lastFragment]);

  const { data } = useSearchContacts(
    debouncedFragment,
    showSuggestions && debouncedFragment.length >= 2,
  );

  const suggestions = data?.contacts ?? [];

  // Ferme les suggestions au clic extérieur.
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelect = (contact: Contact) => {
    const parts = value.split(",").map((s) => s.trim()).filter(Boolean);
    // Remplace le dernier fragment par l'email du contact sélectionné.
    if (parts.length > 0) {
      parts[parts.length - 1] = contact.email;
    } else {
      parts.push(contact.email);
    }
    onChange(parts.join(", "));
    setShowSuggestions(false);
    setActiveIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      handleSelect(suggestions[activeIndex]);
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
      setActiveIndex(-1);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <Input
        id={id}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setShowSuggestions(true);
          setActiveIndex(-1);
        }}
        onFocus={() => setShowSuggestions(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        required={required}
      />
      {showSuggestions && suggestions.length > 0 && (
        <div className="glass-strong absolute z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-border shadow-lg">
          {suggestions.map((contact, index) => (
            <button
              key={contact.id}
              type="button"
              onClick={() => handleSelect(contact)}
              className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted ${index === activeIndex ? "bg-muted" : ""}`}
            >
              <div className="flex flex-col">
                <span className="font-medium">{contact.name}</span>
                <span className="text-xs text-muted-foreground">{contact.email}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
