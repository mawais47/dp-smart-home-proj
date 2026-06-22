function env(key: keyof ImportMetaEnv, fallback: string): string {
  const value = import.meta.env[key];
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

export const environment = {
  production: true,
  apiBaseUrl: env('NG_APP_API_BASE_URL', 'http://localhost:8080'),
  wsUrl: env('NG_APP_WS_URL', 'ws://localhost:8080/ws'),
};
