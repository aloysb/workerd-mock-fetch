# Contributing to workerd-mock-fetch

Thank you for your interest in contributing to workerd-mock-fetch! This guide will help you set up your development environment and understand our development workflow.

## 🚀 Quick Start

### Prerequisites

- **Node.js** >= 18.0.0
- **pnpm** >= 9.0.0 (recommended package manager)
- **Git**

### Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/aloysb/workerd-mock-fetch.git
   cd workerd-mock-fetch
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Start development mode**
   ```bash
   pnpm dev
   ```
   This runs `tsup --watch` to automatically rebuild the plugin when you make changes.

## 📁 Project Structure

```
workerd-mock-fetch/
├── index.ts              # Main plugin source code
├── package.json          # Package configuration
├── README.md            # User documentation
├── CONTRIBUTING.md      # This file
├── dist/                # Built files (auto-generated)
│   ├── index.js         # CommonJS build
│   ├── index.mjs        # ESM build
│   └── index.d.ts       # TypeScript definitions
└── test/                # Test files (to be created)
```

## 🛠 Development Workflow

### Building the Plugin

```bash
# Build once
pnpm build

# Build and watch for changes (development)
pnpm dev

# Check TypeScript types
pnpm typecheck
```

### Testing

Currently, the project is setting up comprehensive testing. Here's the planned structure:

```bash
# Run all tests
pnpm test

# Run tests with UI
pnpm test:ui

# Run tests with coverage
pnpm test:coverage

# Run tests in watch mode
pnpm test:watch
```

### Code Quality

```bash
# Lint the code
pnpm lint

# Fix linting issues automatically
pnpm lint:fix

# Type check
pnpm typecheck
```

## 🧪 Testing the Plugin Locally

### Method 1: Using `npm link`

1. **In the plugin directory:**
   ```bash
   pnpm build
   npm link
   ```

2. **In your test React Router project:**
   ```bash
   npm link workerd-mock-fetch
   ```

3. **Use the plugin in your test project:**
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

### Method 2: Using Relative Path

1. **In your test React Router project:**
   ```bash
   # Install from local path
   npm install ../path/to/workerd-mock-fetch
   ```

### Method 3: Using `pnpm pack` (Recommended)

1. **In the plugin directory:**
   ```bash
   pnpm build
   pnpm pack
   # This creates workerd-mock-fetch-0.1.0.tgz
   ```

2. **In your test project:**
   ```bash
   npm install ../workerd-mock-fetch/workerd-mock-fetch-0.1.0.tgz
   ```

## 🧪 Creating Test Projects

### Basic React Router + Cloudflare Workers Test Setup

Create a minimal test project to verify your changes:

1. **Create test project:**
   ```bash
   mkdir test-project
   cd test-project
   npm init -y
   ```

2. **Install dependencies:**
   ```bash
   npm install -D vitest @cloudflare/vitest-pool-workers
   npm install react-router @react-router/dev
   ```

3. **Create basic routes:**
   ```ts
   // app/routes.ts
   import type { RouteConfigEntry } from "@react-router/dev/routes";

   export const routes: RouteConfigEntry[] = [
     {
       path: "/api/healthcheck",
       file: "./routes/api.healthcheck.ts"
     },
     {
       path: "/api/users/:id",
       file: "./routes/api.users.$id.ts"
     }
   ];

   export default routes;
   ```

4. **Create test routes:**
   ```ts
   // routes/api.healthcheck.ts
   export function loader() {
     return { status: "OK" };
   }

   // routes/api.users.$id.ts
   export function loader({ params }: { params: { id: string } }) {
     return { user: { id: params.id, name: "Test User" } };
   }

   export function action({ request, params }: { request: Request, params: { id: string } }) {
     if (request.method === "PUT") {
       return { user: { id: params.id, name: "Updated User" } };
     }
     return new Response(null, { status: 405 });
   }
   ```

5. **Create vitest config:**
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
     ],
     test: {
       environment: 'node'
     }
   })
   ```

6. **Write tests:**
   ```ts
   // test/api.test.ts
   import { describe, it, expect } from 'vitest'

   describe('API Routes', () => {
     it('should handle healthcheck', async () => {
       const response = await workerdFetch('/api/healthcheck')
       expect(response.status).toBe(200)
       
       const data = await response.json()
       expect(data.status).toBe('OK')
     })

     it('should handle user GET', async () => {
       const response = await workerdFetch('/api/users/123')
       expect(response.status).toBe(200)
       
       const data = await response.json()
       expect(data.user.id).toBe('123')
     })

     it('should handle user PUT', async () => {
       const response = await workerdFetch('/api/users/123', {
         method: 'PUT',
         body: JSON.stringify({ name: 'New Name' }),
         headers: { 'Content-Type': 'application/json' }
       })
       
       expect(response.status).toBe(200)
       const data = await response.json()
       expect(data.user.name).toBe('Updated User')
     })
   })
   ```

## 🐛 Debugging

### Common Issues

1. **TypeScript errors during development:**
   ```bash
   # Make sure types are built
   pnpm build
   
   # Check for type issues
   pnpm typecheck
   ```

2. **Plugin not loading in test project:**
   - Ensure you've built the plugin: `pnpm build`
   - Check that the plugin is properly installed in your test project
   - Verify the vitest config is correct

3. **Auto-imports not working:**
   - Check that `autoImport` is not set to `false`
   - Ensure test files match the pattern (`.test.` or `.spec.`)
   - Verify the virtual module is being generated correctly

### Debug Logging

Add debug logging to the plugin:

```ts
// In index.ts, add console.log statements:
console.log('[workerd-mock-fetch] Routes loaded:', resolvedRoutes?.length);
console.log('[workerd-mock-fetch] Auto-importing for:', id);
```

### Inspect Generated Code

You can inspect the generated virtual module by adding logging:

```ts
// In the load() method:
if (id === 'virtual:workerd-mock-fetch') {
  const code = generateHelperCode({...});
  console.log('Generated code:', code);
  return code;
}
```

## 📝 Code Style

- Use **TypeScript** for all source code
- Follow existing code formatting (we use the default TypeScript/ESLint rules)
- Add **JSDoc comments** for public APIs
- Use **descriptive variable names**
- Keep functions **small and focused**

### Example Code Style

```ts
/**
 * Find a route file by matching the target path in the route configuration
 */
function findRouteFile(
  targetPath: string,
  routeConfig: RouteConfigEntry[] = routes,
  parentPath = "",
): { file: string; routePath: string } | null {
  // Implementation...
}
```

## 🚦 Testing Guidelines

### What to Test

1. **Plugin Configuration:**
   - Routes loading from different sources (direct, file path, async)
   - Error handling for invalid configurations
   - Different plugin options

2. **Route Resolution:**
   - Static routes matching
   - Dynamic routes with parameters
   - Nested routes
   - Edge cases (trailing slashes, empty paths)

3. **Request Handling:**
   - Different HTTP methods
   - Request body parsing (JSON, FormData)
   - Headers handling
   - Query parameters

4. **Response Handling:**
   - Response object creation
   - Data serialization
   - Error responses
   - React Router specific response formats

### Test Structure

```ts
describe('workerdMockFetch Plugin', () => {
  describe('Configuration', () => {
    it('should load routes from direct config', () => {
      // Test implementation
    });
    
    it('should load routes from file path', () => {
      // Test implementation
    });
  });

  describe('Route Resolution', () => {
    it('should match static routes', () => {
      // Test implementation
    });
    
    it('should match dynamic routes', () => {
      // Test implementation
    });
  });
});
```

## 📦 Release Process

1. **Update version:**
   ```bash
   pnpm changeset
   # Follow the prompts to describe your changes
   ```

2. **Build and test:**
   ```bash
   pnpm build
   pnpm test
   pnpm typecheck
   pnpm lint
   ```

3. **Version and publish:**
   ```bash
   pnpm version  # This applies changesets
   pnpm release  # Build and publish
   ```

## 🤝 Contributing Guidelines

### Before You Submit

- [ ] All tests pass (`pnpm test`)
- [ ] Code is properly typed (`pnpm typecheck`)
- [ ] Code follows style guidelines (`pnpm lint`)
- [ ] Documentation is updated if needed
- [ ] You've tested your changes with a real React Router project

### Pull Request Process

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Make** your changes
4. **Test** thoroughly
5. **Commit** with clear messages
6. **Push** to your fork
7. **Submit** a pull request

### Commit Messages

Use clear, descriptive commit messages:

```bash
# Good
git commit -m "feat: add support for nested route parameters"
git commit -m "fix: handle empty route paths correctly"
git commit -m "docs: update API examples for new features"

# Less good
git commit -m "fix stuff"
git commit -m "update"
```

## ❓ Getting Help

- **Issues**: Open an issue on GitHub for bugs or feature requests
- **Discussions**: Use GitHub Discussions for questions and ideas
- **Discord/Slack**: (Add community links if available)

## 📄 License

By contributing to workerd-mock-fetch, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to workerd-mock-fetch! 🚀