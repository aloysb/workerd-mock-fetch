// workerd-mock-fetch
// A Vitest plugin that provides a fetch-like API for testing React Router applications on Cloudflare Workers

import type { Plugin } from 'vite';
import type { RouteConfigEntry } from "@react-router/dev/routes";
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

export interface WorkerdMockFetchOptions {
  /**
   * React Router routes configuration
   */
  routes?: RouteConfigEntry[] | (() => RouteConfigEntry[]) | (() => Promise<RouteConfigEntry[]>);
  
  /**
   * Path to the routes file (alternative to routes option)
   * @example "./app/routes.ts"
   */
  routesPath?: string;
  
  /**
   * Whether to auto-import workerdFetch and helpers in test files
   * @default true
   */
  autoImport?: boolean;
  
  /**
   * Custom import name for the main fetch function
   * @default "workerdFetch"
   */
  fetchFunctionName?: string;
  
  /**
   * Environment variable name for the Cloudflare env
   * @default "env"
   */
  envImport?: string;
  
  /**
   * Base URL for requests
   * @default "https://example.com"
   */
  baseUrl?: string;
}

/**
 * workerd-mock-fetch: A Vitest plugin for testing React Router applications on Cloudflare Workers
 * 
 * @example
 * ```ts
 * import { defineConfig } from 'vitest/config'
 * import { workerdMockFetch } from 'workerd-mock-fetch'
 * import routes from './app/routes'
 * 
 * export default defineConfig({
 *   plugins: [
 *     workerdMockFetch({
 *       routes
 *     })
 *   ]
 * })
 * ```
 */
export function workerdMockFetch(options: WorkerdMockFetchOptions = {}): Plugin {
  const {
    routes,
    routesPath,
    autoImport = true,
    fetchFunctionName = 'workerdFetch',
    envImport = 'env',
    baseUrl = 'https://example.com',
  } = options;

  let resolvedRoutes: RouteConfigEntry[] | null = null;

  return {
    name: 'workerd-mock-fetch',
    enforce: 'pre',

    async configResolved(config) {
      // Only apply in test mode
      if (config.command !== 'serve' && !config.test) {
        return;
      }

      // Resolve routes
      if (routesPath) {
        try {
          const routesModule = await import(path.resolve(routesPath));
          resolvedRoutes = routesModule.default || routesModule.routes;
        } catch (error) {
          throw new Error(`[workerd-mock-fetch] Failed to load routes from ${routesPath}: ${error}`);
        }
      } else if (typeof routes === 'function') {
        resolvedRoutes = await routes();
      } else if (routes) {
        resolvedRoutes = routes;
      }

      if (!resolvedRoutes) {
        throw new Error('[workerd-mock-fetch] No routes provided. Please provide either routes object or routesPath.');
      }

      console.log(`[workerd-mock-fetch] Loaded ${resolvedRoutes.length} routes for testing`);
    },

    async transform(code, id) {
      // Only transform test files
      if (!id.includes('.test.') && !id.includes('.spec.')) {
        return;
      }

      // Skip if not a JS/TS file
      if (!id.endsWith('.ts') && !id.endsWith('.js') && !id.endsWith('.tsx') && !id.endsWith('.jsx')) {
        return;
      }

      if (!autoImport) {
        return;
      }

      // Check if the file already imports our helpers
      const hasImport = new RegExp(`from\\s+['"].*workerd-mock-fetch['"]|import.*\\{.*${fetchFunctionName}.*\\}`).test(code);

      if (hasImport) {
        return;
      }

      // Auto-import the testing helpers at the top
      const importStatement = `
// Auto-imported by workerd-mock-fetch
import { 
  ${fetchFunctionName},
  createFormData,
  seedDatabase
} from 'virtual:workerd-mock-fetch';
`;

      return {
        code: importStatement + code,
        map: null,
      };
    },

    resolveId(id) {
      if (id === 'virtual:workerd-mock-fetch') {
        return id;
      }
    },

    load(id) {
      if (id === 'virtual:workerd-mock-fetch') {
        return generateHelperCode({
          routes: resolvedRoutes!,
          fetchFunctionName,
          envImport,
          baseUrl,
        });
      }
    },
  };
}

interface GenerateHelperCodeOptions {
  routes: RouteConfigEntry[];
  fetchFunctionName: string;
  envImport: string;
  baseUrl: string;
}

function generateHelperCode(options: GenerateHelperCodeOptions): string {
  const { routes, fetchFunctionName, envImport, baseUrl } = options;
  
  // Get the directory where this file is located
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  
  // Read the template file
  const templatePath = path.join(__dirname, 'src', 'template.ts');
  let template: string;
  
  try {
    template = fs.readFileSync(templatePath, 'utf-8');
  } catch (error) {
    // Fallback to try from different locations during build/dev
    const fallbackPaths = [
      path.join(__dirname, '..', 'src', 'template.ts'),
      path.join(process.cwd(), 'src', 'template.ts'),
      path.join(process.cwd(), 'template.ts'),
    ];
    
    let templateFound = false;
    for (const fallbackPath of fallbackPaths) {
      try {
        template = fs.readFileSync(fallbackPath, 'utf-8');
        templateFound = true;
        break;
      } catch {
        continue;
      }
    }
    
    if (!templateFound) {
      throw new Error(`[workerd-mock-fetch] Could not find template file. Tried: ${[templatePath, ...fallbackPaths].join(', ')}`);
    }
  }
  
  // Replace template variables
  return template
    .replace(/__ROUTES_CONFIG__/g, JSON.stringify(routes, null, 2))
    .replace(/__FETCH_FUNCTION_NAME__/g, fetchFunctionName)
    .replace(/__ENV_IMPORT__/g, envImport)
    .replace(/__BASE_URL__/g, baseUrl);
}

// Export the plugin as default and named export
export default workerdMockFetch;