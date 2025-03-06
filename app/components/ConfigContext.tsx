'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

interface AppConfig {
  temporalHostPort: string;
  temporalNamespace: string;
  temporalWebUI: string;
  isLoading: boolean;
  error: string | null;
}

const defaultConfig: AppConfig = {
  temporalHostPort: 'localhost:7233',
  temporalNamespace: 'default',
  temporalWebUI: 'http://localhost:8233',
  isLoading: true,
  error: null
};

const ConfigContext = createContext<AppConfig>(defaultConfig);

export function useAppConfig() {
  return useContext(ConfigContext);
}

export function ConfigProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<AppConfig>(defaultConfig);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const response = await fetch('/api/v1/config');
        if (!response.ok) {
          throw new Error('Failed to fetch configuration');
        }
        const data = await response.json();
        setConfig({
          temporalHostPort: data.hostPort || defaultConfig.temporalHostPort,
          temporalNamespace: data.namespace || defaultConfig.temporalNamespace,
          temporalWebUI: data.webUI || defaultConfig.temporalWebUI,
          isLoading: false,
          error: null
        });
      } catch (error) {
        console.error('Error fetching configuration:', error);
        setConfig({
          ...defaultConfig,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    };

    fetchConfig();
  }, []);

  return (
    <ConfigContext.Provider value={config}>
      {children}
    </ConfigContext.Provider>
  );
}