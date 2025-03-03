'use client';

import { useEffect, useState, useRef } from 'react';
import {
  getTimezoneOptions,
  saveToLocalStorage,
  loadFromLocalStorage
} from './utils';
import { TimezoneOption } from "./types";

/**
 * Custom hook for managing timezone state and related UI
 * 
 * Handles:
 * - Loading and saving timezone from localStorage
 * - Managing timezone selector UI visibility
 * - Providing timezone options
 * 
 * @returns Object containing timezone state and timezone management functions
 */
export function useTimezoneManager() {
  // Default timezone for server rendering
  const defaultTimezone: TimezoneOption = { label: 'Local Time', value: 'local', offset: 0 };
  
  // State for timezone and timezone selector
  const [timezone, setTimezone] = useState<TimezoneOption>(defaultTimezone);
  const [showTimezoneSelector, setShowTimezoneSelector] = useState(false);

  // Initialize timezone options and load saved timezone on client side
  useEffect(() => {
    // Set available timezone options
    const tzOptions = getTimezoneOptions();
    
    // Load saved timezone from localStorage
    const savedTzData = loadFromLocalStorage<{value: string, label: string}>('selectedTimezone', null);
    if (savedTzData) {
      const match = tzOptions.find(tz => tz.value === savedTzData.value);
      if (match) setTimezone(match);
    }
  }, []);

  // Save timezone to localStorage whenever it changes
  useEffect(() => {
    saveToLocalStorage('selectedTimezone', {
      value: timezone.value,
      label: timezone.label
    });
  }, [timezone]);
  
  return {
    timezone,
    setTimezone,
    showTimezoneSelector,
    setShowTimezoneSelector,
  };
}

