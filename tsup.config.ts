import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  // Copy the template file to the dist directory
  onSuccess: async () => {
    const { copyFileSync, mkdirSync } = await import('fs')
    const { join, dirname } = await import('path')
    
    try {
      // Ensure the dist/src directory exists
      mkdirSync(join('dist', 'src'), { recursive: true })
      
      // Copy the template file
      copyFileSync(
        join('src', 'template.ts'),
        join('dist', 'src', 'template.ts')
      )
      
      console.log('✅ Template file copied to dist/src/template.ts')
    } catch (error) {
      console.error('❌ Failed to copy template file:', error)
    }
  }
})