
export interface SystemMaintenanceSettings {
  // Cache Management
  cache: {
    enableCache: boolean;
    autoClean: boolean;
    cleanInterval: number; // in hours
    enableWarming: boolean;
    warmingStrategies: string[];
    distributed: {
      enabled: boolean;
      nodes: string[];
      strategy: 'hash' | 'random' | 'round-robin';
    };
  };
  
  // Database Maintenance
  database: {
    connectionPool: {
      minSize: number;
      maxSize: number;
      idleTimeout: number;
    };
    slowQuery: {
      enabled: boolean;
      threshold: number; // in ms
      logFile: string;
    };
    indexOptimization: {
      autoAnalyze: boolean;
      recommendations: boolean;
    };
  };
  
  // System Optimization
  optimization: {
    imageCompression: {
      enabled: boolean;
      quality: number; // 1-100
      format: 'original' | 'webp' | 'jpeg';
    };
    cdn: {
      enabled: boolean;
      domain: string;
      versionControl: boolean;
    };
    pageLoad: {
      lazyLoad: boolean;
      prefetch: boolean;
      minify: boolean;
    };
  };
}
