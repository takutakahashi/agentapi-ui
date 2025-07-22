interface RuntimeConfig {
  VAPID_PUBLIC_KEY?: string;
}

declare global {
  interface Window {
    __RUNTIME_CONFIG__?: RuntimeConfig;
  }
}

export {};