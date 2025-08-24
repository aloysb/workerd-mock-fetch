import * as path from "path";
import type { RouteConfigEntry } from "@react-router/dev/routes";
import type { UNSAFE_DataWithResponseInit } from "react-router";
import { __ENV_IMPORT__ } from "cloudflare:test";

// Injected routes from plugin
const routes = __ROUTES_CONFIG__;

// Types for the workerdFetch function
export interface WorkerdRequestInit extends Omit<RequestInit, 'method'> {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';
  params?: Record<string, string>;
}

interface RouteHandler {
  loader?: (args: any) => any;
  action?: (args: any) => any;
}

interface TestContext {
  cloudflare: {
    env: any;
    ctx: ExecutionContext;
  };
  params?: Record<string, string>;
}

/**
 * Find a route file by matching the target path in the route configuration
 */
function findRouteFile(
  targetPath: string,
  routeConfig: RouteConfigEntry[] = routes,
  parentPath = "",
): { file: string; routePath: string } | null {
  for (const route of routeConfig) {
    // Construct the full path by combining parent path with current route path
    const fullPath = path.posix.join(parentPath, route.path || "").replace(/\/$/, '') || "/";
    
    // Normalize paths for comparison (remove trailing slashes)
    const normalizedFullPath = fullPath === "/" ? "/" : fullPath.replace(/\/$/, '');
    const normalizedTargetPath = targetPath === "/" ? "/" : targetPath.replace(/\/$/, '');
    
    // Check if this route matches the target path or if it's a dynamic route
    if (normalizedFullPath === normalizedTargetPath || matchesDynamicRoute(normalizedFullPath, normalizedTargetPath)) {
      return { file: route.file, routePath: normalizedFullPath };
    }
    
    // Recursively search in children with the current full path as parent
    if (route.children) {
      const result = findRouteFile(targetPath, route.children, fullPath);
      if (result) return result;
    }
  }
  return null;
}

/**
 * Check if a target path matches a dynamic route pattern
 */
function matchesDynamicRoute(routePath: string, targetPath: string): boolean {
  const routeSegments = routePath.split('/').filter(Boolean);
  const targetSegments = targetPath.split('/').filter(Boolean);
  
  if (routeSegments.length !== targetSegments.length) {
    return false;
  }
  
  for (let i = 0; i < routeSegments.length; i++) {
    const routeSegment = routeSegments[i];
    const targetSegment = targetSegments[i];
    
    // If it's a dynamic segment (:param), it matches any value
    if (routeSegment?.startsWith(':')) {
      continue;
    }
    
    // Otherwise, segments must match exactly
    if (routeSegment !== targetSegment) {
      return false;
    }
  }
  
  return true;
}

/**
 * Extract route parameters from a path with dynamic segments
 */
function extractParams(routePath: string, actualPath: string): Record<string, string> {
  const routeSegments = routePath.split('/').filter(Boolean);
  const pathSegments = actualPath.split('/').filter(Boolean);
  const params: Record<string, string> = {};
  
  for (let i = 0; i < routeSegments.length; i++) {
    const routeSegment = routeSegments[i];
    const pathSegment = pathSegments[i];
    
    if (routeSegment?.startsWith(':')) {
      const paramName = routeSegment.slice(1);
      params[paramName] = pathSegment || '';
    }
  }
  
  return params;
}

/**
 * Convert DataWithResponseInit to a proper Response object
 */
function convertToResponse(data: any): Response {
  if (data instanceof Response) {
    return data;
  }
  
  // Handle UNSAFE_DataWithResponseInit
  if (data && typeof data === 'object' && 'init' in data) {
    const responseData = data as UNSAFE_DataWithResponseInit<any>;
    const body = responseData.data !== undefined ? JSON.stringify(responseData.data) : undefined;
    
    return new Response(body, {
      status: responseData.init?.status || 200,
      statusText: responseData.init?.statusText,
      headers: responseData.init?.headers,
    });
  }
  
  // Handle plain data
  const body = data !== undefined ? JSON.stringify(data) : undefined;
  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

/**
 * Create a test context with Cloudflare environment
 */
function createTestContext(params: Record<string, string> = {}): TestContext {
  return {
    cloudflare: {
      env: __ENV_IMPORT__,
      ctx: {} as ExecutionContext,
    },
    params,
  };
}

/**
 * workerdFetch - A fetch-like function for testing React Router handlers in Cloudflare Workers
 * 
 * @param input - URL string or Request object
 * @param init - Request options similar to fetch, with additional params option
 * @returns Promise<Response>
 * 
 * @example
 * ```ts
 * // GET request
 * const response = await workerdFetch('/api/healthcheck');
 * 
 * // POST with JSON
 * const response = await workerdFetch('/api/users', {
 *   method: 'POST',
 *   body: JSON.stringify({ name: 'John' }),
 *   headers: { 'Content-Type': 'application/json' }
 * });
 * 
 * // POST with FormData
 * const formData = createFormData({ email: 'test@example.com' });
 * const response = await workerdFetch('/api/auth/login', {
 *   method: 'POST',
 *   body: formData
 * });
 * 
 * // With route parameters
 * const response = await workerdFetch('/api/users/123', {
 *   params: { id: '123' }
 * });
 * ```
 */
export async function __FETCH_FUNCTION_NAME__(
  input: string | Request,
  init: WorkerdRequestInit = {}
): Promise<Response> {
  // Parse input to get URL and method
  let url: string;
  let method: string;
  
  if (typeof input === 'string') {
    url = input;
    method = init.method || 'GET';
  } else {
    url = new URL(input.url).pathname;
    method = input.method || init.method || 'GET';
  }
  
  // Extract path from URL (remove query params for route matching)
  const targetPath = url.split('?')[0] || '/';
  
  const {
    params: additionalParams = {},
    ...requestInit
  } = init;
  
  // Find the route file and route path
  const routeInfo = findRouteFile(targetPath);
  if (!routeInfo) {
    const availableRoutes = extractAllRoutePaths(routes);
    throw new Error(`Could not find route for path: ${targetPath}. Available routes: ${availableRoutes.join(', ')}`);
  }
  
  // Import the route module
  const routePath = path.join("~", routeInfo.file);
  let mod: RouteHandler;
  
  try {
    mod = await import(routePath);
  } catch (error) {
    throw new Error(`Failed to import route module: ${routePath}. Error: ${error}`);
  }
  
  // Determine which handler to use based on method
  const isGetMethod = method === 'GET' || method === 'HEAD';
  const handler = isGetMethod ? mod.loader : mod.action;
  
  if (!handler) {
    const availableExports = Object.keys(mod).join(', ');
    throw new Error(
      `No ${isGetMethod ? 'loader' : 'action'} found for route: ${targetPath} (method: ${method}). Available exports: ${availableExports}`
    );
  }
  
  // Create request object
  let request: Request;
  if (typeof input === 'string') {
    request = new Request(`__BASE_URL__${url}`, {
      method,
      ...requestInit,
    });
  } else {
    // Clone the existing request with new options
    request = new Request(input, {
      method,
      ...requestInit,
    });
  }
  
  // Extract route parameters and merge with additional params
  const routeParams = extractParams(routeInfo.routePath, targetPath);
  const allParams = { ...routeParams, ...additionalParams };
  
  // Create context
  const context = createTestContext(allParams);
  
  // Call the handler
  const result = await handler({
    request,
    params: allParams,
    context,
  });
  
  // Convert result to Response
  return convertToResponse(result);
}

/**
 * Extract all route paths for error messages
 */
function extractAllRoutePaths(routeConfig: RouteConfigEntry[], parentPath = ""): string[] {
  const paths: string[] = [];
  
  for (const route of routeConfig) {
    const fullPath = path.posix.join(parentPath, route.path || "").replace(/\/$/, '') || "/";
    paths.push(fullPath);
    
    if (route.children) {
      paths.push(...extractAllRoutePaths(route.children, fullPath));
    }
  }
  
  return paths.sort();
}

/**
 * Utility function to create FormData for testing
 * 
 * @example
 * ```ts
 * const formData = createFormData({
 *   email: 'test@example.com',
 *   password: 'secret',
 *   file: new File(['content'], 'test.txt')
 * });
 * ```
 */
export function createFormData(data: Record<string, string | File | Blob>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(data)) {
    formData.append(key, value);
  }
  return formData;
}

/**
 * Utility function for database seeding in tests
 * 
 * @example
 * ```ts
 * await seedDatabase('users', [
 *   { email: 'test@example.com', password: 'hashed' }
 * ]);
 * ```
 */
export async function seedDatabase(table: string, data: Record<string, any>[]): Promise<void> {
  try {
    // Clear existing data
    await __ENV_IMPORT__.DB.prepare(`DELETE FROM ${table}`).run();
    
    // Insert new data
    for (const row of data) {
      const keys = Object.keys(row);
      const values = Object.values(row);
      const placeholders = keys.map(() => '?').join(', ');
      const query = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`;
      
      await __ENV_IMPORT__.DB.prepare(query).bind(...values).run();
    }
  } catch (error) {
    console.error(`Failed to seed ${table} table`, error);
    throw error;
  }
}

// Legacy aliases for backward compatibility
export const testRoute = __FETCH_FUNCTION_NAME__;
export const testGet = (path: string, init?: Omit<WorkerdRequestInit, 'method'>) => 
  __FETCH_FUNCTION_NAME__(path, { ...init, method: 'GET' });
export const testPost = (path: string, init?: Omit<WorkerdRequestInit, 'method'>) => 
  __FETCH_FUNCTION_NAME__(path, { ...init, method: 'POST' });
export const testPut = (path: string, init?: Omit<WorkerdRequestInit, 'method'>) => 
  __FETCH_FUNCTION_NAME__(path, { ...init, method: 'PUT' });
export const testPatch = (path: string, init?: Omit<WorkerdRequestInit, 'method'>) => 
  __FETCH_FUNCTION_NAME__(path, { ...init, method: 'PATCH' });
export const testDelete = (path: string, init?: Omit<WorkerdRequestInit, 'method'>) => 
  __FETCH_FUNCTION_NAME__(path, { ...init, method: 'DELETE' });

// Backward compatibility
export const seedUser = async (email: string, password: string) => {
  return seedDatabase('users', [{ email, password }]);
};