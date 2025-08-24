# NOTE: This project is under heavy development and is not ready for production use yet.

# workerd-mock-fetch

[![npm version](https://badge.fury.io/js/workerd-mock-fetch.svg)](https://badge.fury.io/js/workerd-mock-fetch)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A Vitest plugin that provides a fetch-like API for testing React Router applications on Cloudflare Workers/workerd runtime.

`workerd-mock-fetch` bypass Cloudflare's `SELF.fetch` by calling the right React Router route and method (action or loader). It reduces testing time down to a few milliseconds by avoiding the HTTP layer, making it ideal for unit testing.

## Features

- 🚀 **Fetch-like API** - Test your routes with `workerdFetch()` just like the native fetch
- 🎯 **React Router focused** - Specifically designed for React Router v7+ applications
- 🔄 **Auto-imports** - No need to manually import testing utilities
- 🎯 **Type Safe** - Full TypeScript support with proper type inference
- 🛣️ **Smart Routing** - Automatically resolves routes and handlers
- 📦 **Zero Config** - Works out of the box with sensible defaults
- 🧪 **Cloudflare Workers** - Built specifically for workerd runtime
- 🔍 **Great DX** - Helpful error messages and debugging information

## Installation

```bash
npm install -D workerd-mock-fetch
# or
pnpm add -D workerd-mock-fetch
# or
yarn add -D workerd-mock-fetch
```

## Quick Start

### Setup

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import { workerdMockFetch } from 'workerd-mock-fetch'
import routes from './app/routes'

export default defineConfig({
  plugins: [
    workerdMockFetch({
      routes
    })
  ]
})
```

### Alternative: Routes File Path

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import { workerdMockFetch } from 'workerd-mock-fetch'

export default defineConfig({
  plugins: [
    workerdMockFetch({
      routesPath: './app/routes.ts'
    })
  ]
})
```

### Write Tests

```ts
// No imports needed! workerdFetch is auto-imported
import { expect, it, describe } from 'vitest'

describe('API Routes', () => {
  it('should test healthcheck', async () => {
    const response = await workerdFetch('/api/healthcheck')
    
    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data).toBe('OK')
  })

  it('should handle POST requests', async () => {
    const response = await workerdFetch('/api/users', {
      method: 'POST',
      body: JSON.stringify({ name: 'John Doe' }),
      headers: { 'Content-Type': 'application/json' }
    })
    
    expect(response.status).toBe(201)
  })

  it('should handle FormData', async () => {
    const formData = createFormData({
      email: 'test@example.com',
      password: 'secret'
    })
    
    const response = await workerdFetch('/api/auth/login', {
      method: 'POST',
      body: formData
    })
    
    expect(response.status).toBe(302)
  })
})
```

## API Reference

### `workerdFetch(input, init?)`

The main testing function with a fetch-like API.

```ts
function workerdFetch(
  input: string | Request,
  init?: WorkerdRequestInit
): Promise<Response>
```

#### Parameters

- **`input`** - URL string or Request object
- **`init`** - Request options (extends standard RequestInit)
  - `method?` - HTTP method ('GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS')
  - `body?` - Request body (FormData, string, or object)
  - `headers?` - Request headers
  - `params?` - Route parameters for dynamic routes

#### Examples

```ts
// GET request
const response = await workerdFetch('/api/users')

// POST with JSON
const response = await workerdFetch('/api/users', {
  method: 'POST',
  body: JSON.stringify({ name: 'John' }),
  headers: { 'Content-Type': 'application/json' }
})

// POST with FormData
const formData = createFormData({ email: 'test@example.com' })
const response = await workerdFetch('/api/auth/login', {
  method: 'POST',
  body: formData
})

// Dynamic routes with parameters
const response = await workerdFetch('/api/users/123', {
  params: { id: '123' }
})

// All HTTP methods
await workerdFetch('/api/users/123', { method: 'PUT' })
await workerdFetch('/api/users/123', { method: 'PATCH' })
await workerdFetch('/api/users/123', { method: 'DELETE' })
```

### Helper Functions

#### `createFormData(data)`

Creates FormData from an object.

```ts
const formData = createFormData({
  email: 'test@example.com',
  password: 'secret',
  file: new File(['content'], 'test.txt')
})
```

#### `seedDatabase(table, data)`

Utility for seeding test data.

```ts
await seedDatabase('users', [
  { email: 'test@example.com', password: 'hashed' },
  { email: 'admin@example.com', password: 'admin' }
])
```

## Configuration

### Plugin Options

```ts
interface WorkerdMockFetchOptions {
  // React Router configuration
  routes?: RouteConfigEntry[] | (() => RouteConfigEntry[]) | (() => Promise<RouteConfigEntry[]>)
  routesPath?: string // Alternative: path to routes file
  
  // Auto-import helpers (default: true)
  autoImport?: boolean
  
  // Custom function name (default: "workerdFetch")
  fetchFunctionName?: string
  
  // Environment import name (default: "env")
  envImport?: string
  
  // Base URL for requests (default: "https://example.com")
  baseUrl?: string
}
```

### Configuration Examples

```ts
// vitest.config.ts
export default defineConfig({
  plugins: [
    workerdMockFetch({
      // Option 1: Direct routes
      routes: routesConfig,
      
      // Option 2: Routes file path
      routesPath: './app/routes.ts',
      
      // Option 3: Async routes loader
      routes: async () => {
        const { routes } = await import('./app/routes')
        return routes
      }
    })
  ]
})
```

## React Router Integration

### Route Handler Example

```ts
// app/routes/api.users.$id.ts
import type { LoaderFunctionArgs, ActionFunctionArgs } from 'react-router'

export async function loader({ params, context }: LoaderFunctionArgs) {
  const { id } = params
  const user = await context.cloudflare.env.DB
    .prepare('SELECT * FROM users WHERE id = ?')
    .bind(id)
    .first()
    
  return { data: user }
}

export async function action({ request, params, context }: ActionFunctionArgs) {
  const { id } = params
  const userData = await request.json()
  
  if (request.method === 'PUT') {
    await context.cloudflare.env.DB
      .prepare('UPDATE users SET name = ?, email = ? WHERE id = ?')
      .bind(userData.name, userData.email, id)
      .run()
      
    return { data: { id, ...userData } }
  }
  
  if (request.method === 'DELETE') {
    await context.cloudflare.env.DB
      .prepare('DELETE FROM users WHERE id = ?')
      .bind(id)
      .run()
      
    return new Response(null, { status: 204 })
  }
}
```

## Testing Examples

### Authentication Flow

```ts
describe('Authentication', () => {
  beforeEach(async () => {
    await seedDatabase('users', [
      { email: 'test@example.com', password: 'hashed_password' }
    ])
  })

  it('should login with valid credentials', async () => {
    const response = await workerdFetch('/api/auth/login', {
      method: 'POST',
      body: createFormData({
        email: 'test@example.com',
        password: 'password'
      })
    })
    
    expect(response.status).toBe(302)
    expect(response.headers.get('set-cookie')).toContain('session=')
  })

  it('should reject invalid credentials', async () => {
    const response = await workerdFetch('/api/auth/login', {
      method: 'POST',
      body: createFormData({
        email: 'test@example.com',
        password: 'wrong'
      })
    })
    
    expect(response.status).toBe(401)
  })
})
```

### CRUD Operations

```ts
describe('User CRUD', () => {
  it('should create a user', async () => {
    const userData = { name: 'John Doe', email: 'john@example.com' }
    
    const response = await workerdFetch('/api/users', {
      method: 'POST',
      body: JSON.stringify(userData),
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': 'Bearer token'
      }
    })
    
    expect(response.status).toBe(201)
    const user = await response.json()
    expect(user.name).toBe('John Doe')
  })

  it('should get a user by ID', async () => {
    const response = await workerdFetch('/api/users/123')
    
    expect(response.status).toBe(200)
    const user = await response.json()
    expect(user.id).toBe('123')
  })

  it('should update a user', async () => {
    const response = await workerdFetch('/api/users/123', {
      method: 'PATCH',
      body: JSON.stringify({ name: 'Jane Doe' }),
      headers: { 'Content-Type': 'application/json' }
    })
    
    expect(response.status).toBe(200)
  })

  it('should delete a user', async () => {
    const response = await workerdFetch('/api/users/123', {
      method: 'DELETE'
    })
    
    expect(response.status).toBe(204)
  })
})
```

### File Uploads

```ts
describe('File Upload', () => {
  it('should handle file uploads', async () => {
    const file = new File(['test content'], 'test.txt', { 
      type: 'text/plain' 
    })
    
    const response = await workerdFetch('/api/upload', {
      method: 'POST',
      body: createFormData({
        title: 'Test Upload',
        description: 'A test file',
        file: file
      })
    })
    
    expect(response.status).toBe(200)
    const result = await response.json()
    expect(result.filename).toBe('test.txt')
  })
})
```

### Testing with Route Parameters

```ts
describe('Dynamic Routes', () => {
  it('should handle route parameters', async () => {
    // Route: /api/users/:userId/posts/:postId
    const response = await workerdFetch('/api/users/123/posts/456', {
      params: { 
        userId: '123', 
        postId: '456' 
      }
    })
    
    expect(response.status).toBe(200)
    const post = await response.json()
    expect(post.userId).toBe('123')
    expect(post.id).toBe('456')
  })
})
```

## Cloudflare Workers Integration

### With @cloudflare/vitest-pool-workers

```ts
// vitest.config.ts
import { defineWorkersProject } from '@cloudflare/vitest-pool-workers/config'
import { workerdMockFetch } from 'workerd-mock-fetch'
import routes from './app/routes'

export default defineWorkersProject({
  plugins: [
    workerdMockFetch({
      routes
    })
  ],
  test: {
    poolOptions: {
      workers: {
        wrangler: { configPath: './wrangler.toml' },
        miniflare: {
          d1Databases: ['DB'],
          kvNamespaces: ['KV'],
          r2Buckets: ['BUCKET']
        }
      }
    }
  }
})
```

### Custom Environment Setup

```ts
// vitest.config.ts
export default defineConfig({
  plugins: [
    workerdMockFetch({
      routes,
      envImport: 'testEnv' // Use custom environment import
    })
  ]
})

// In your test setup file
import { testEnv } from 'cloudflare:test'
// workerdFetch will automatically use testEnv.DB, testEnv.KV, etc.
```

## Advanced Configuration

```ts
// vitest.config.ts
export default defineConfig({
  plugins: [
    workerdMockFetch({
      routes,
      
      // Customization
      fetchFunctionName: 'mockFetch',     // Custom function name
      envImport: 'testEnv',               // Custom env import
      baseUrl: 'https://myapp.com',       // Custom base URL  
      autoImport: false,                  // Disable auto-import
    })
  ]
})
```

## Migration Guide

### From Manual Testing

**Before:**
```ts
it('should login', async () => {
  const formData = new FormData()
  formData.append('email', 'test@example.com')
  
  // Using SELF.fetch - goes through the full HTTP layer
  const response = await SELF.fetch('https://example.com/api/auth/login', {
    method: 'POST',
    body: formData
  })
  
  expect(response.status).toBe(302)
})
```

**After:**
```ts
it('should login', async () => {
  const response = await workerdFetch('/api/auth/login', {
    method: 'POST',
    body: createFormData({ email: 'test@example.com' })
  })
  
  expect(response.status).toBe(302)
})
```

## Roadmap

We're planning to expand support for additional frameworks in future versions:

### 🛣️ Future Framework Support

- **🔥 Hono** - Modern web framework support
  - Direct Hono app integration
  - Middleware testing support
  - Context and environment handling

- **⚙️ Custom Routers** - Flexible route configuration
  - Manual route definitions
  - Custom handler patterns
  - Flexible calling conventions

- **🔧 Advanced Features**
  - WebSocket testing support
  - Streaming response testing
  - Advanced middleware testing

**Current Focus:** We're concentrating on making React Router support as robust and feature-complete as possible before expanding to other frameworks.

## Troubleshooting

### Common Issues

**Route not found error:**
```
Error: Could not find route for path: /api/users
```
- Verify your routes configuration is correct
- Check that the route path matches exactly (including leading slash)
- Ensure your route files exist and are properly exported

**Handler not found error:**
```
Error: No action found for route: /api/users (method: POST)
```
- Ensure your route file exports the correct handler (`loader` for GET, `action` for POST/PUT/etc.)
- Check that your handler function is properly exported

**Import error:**
```
Error: Failed to import route module: ~/routes/api/users.ts
```
- Verify the route file exists at the specified path
- Check for syntax errors in the route file
- Ensure all dependencies are properly installed and imported

### Debug Mode

Enable debug logging:

```ts
// vitest.config.ts
export default defineConfig({
  plugins: [
    workerdMockFetch({
      routes
      // The plugin will log route loading information
    })
  ],
  logLevel: 'info' // Enable Vite logging
})
```

### React Router Specific Issues

- Make sure you're using React Router v7+ with the new data APIs
- Verify your routes export `loader` (for GET) or `action` (for other methods)
- Check that your route paths match your file structure

## Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup

```bash
git clone https://github.com/aloysb/workerd-mock-fetch.git
cd workerd-mock-fetch
pnpm install
pnpm dev
```

### Running Tests

```bash
pnpm test
pnpm test:coverage
pnpm test:ui
```

## License

MIT © [Aloys Berger]

## Related Projects

- [Vitest](https://vitest.dev/) - Fast unit test framework
- [React Router](https://reactrouter.com/) - Client side routing
- [Cloudflare Workers](https://workers.cloudflare.com/) - Serverless platform
- [@cloudflare/vitest-pool-workers](https://github.com/cloudflare/workers-sdk/tree/main/packages/vitest-pool-workers) - Vitest pool for Workers

---

**Happy Testing! 🚀**
