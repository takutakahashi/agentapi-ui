export interface SingleProfileConfig {
  enabled: boolean;
  environmentVariables: Record<string, string>;
}

export function getSingleProfileConfig(): SingleProfileConfig {
  const enabled = process.env.NEXT_PUBLIC_SINGLE_PROFILE === 'true';
  
  if (!enabled) {
    return {
      enabled: false,
      environmentVariables: {}
    };
  }
  
  // Extract environment variables from process.env
  const environmentVariables: Record<string, string> = {};
  
  // Get all environment variables that start with SINGLE_PROFILE_ENV_
  Object.keys(process.env).forEach(key => {
    if (key.startsWith('SINGLE_PROFILE_ENV_')) {
      const envKey = key.replace('SINGLE_PROFILE_ENV_', '');
      const envValue = process.env[key];
      if (envValue) {
        environmentVariables[envKey] = envValue;
      }
    }
  });
  
  return {
    enabled,
    environmentVariables
  };
}

export function isSingleProfileMode(): boolean {
  return process.env.NEXT_PUBLIC_SINGLE_PROFILE === 'true';
}

export function getSingleProfileEnvironmentVariables(): Record<string, string> {
  return getSingleProfileConfig().environmentVariables;
}