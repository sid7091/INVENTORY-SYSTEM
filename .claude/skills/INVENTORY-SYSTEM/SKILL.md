```markdown
# INVENTORY-SYSTEM Development Patterns

> Auto-generated skill from repository analysis

## Overview
This skill teaches you the core development patterns and conventions used in the INVENTORY-SYSTEM repository, a TypeScript project built with the Next.js framework. You'll learn how to structure files, write imports and exports, follow commit message patterns, and write tests. This guide also provides suggested commands for common workflows.

## Coding Conventions

### File Naming
- Use **camelCase** for all file names.
  - Example: `inventoryManager.ts`, `userProfilePage.tsx`

### Import Style
- Use **alias imports** for modules.
  - Example:
    ```typescript
    import inventoryService from '@/services/inventoryService';
    import { User } from '@/models/user';
    ```

### Export Style
- Use **default exports** for modules and components.
  - Example:
    ```typescript
    // inventoryManager.ts
    const inventoryManager = { /* ... */ };
    export default inventoryManager;
    ```

### Commit Messages
- Commit messages are **freeform** but often start with a prefix.
- Average commit message length: **46 characters**.
  - Example:
    ```
    fix: correct inventory count update logic
    add new endpoint for product categories
    ```

## Workflows

_No automated workflows detected in this repository._

## Testing Patterns

- **Test Framework:** Unknown (not detected)
- **Test File Pattern:** All test files follow the `*.test.*` pattern.
  - Example: `inventoryManager.test.ts`, `userRoutes.test.tsx`
- **Test Placement:** Tests are typically placed alongside the files they test or in a dedicated `__tests__` directory.

#### Example Test File
```typescript
// inventoryManager.test.ts
import inventoryManager from '@/services/inventoryManager';

describe('inventoryManager', () => {
  it('should add a new item', () => {
    // test logic here
  });
});
```

## Commands

| Command    | Purpose                                 |
|------------|-----------------------------------------|
| /test      | Run all test files (`*.test.*`)         |
| /lint      | Lint the codebase                       |
| /build     | Build the Next.js project               |
| /dev       | Start the Next.js development server    |

```