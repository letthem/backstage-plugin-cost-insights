# Contributing to Cost Insights Plugin

Thank you for your interest in contributing to the Cost Insights plugin! This document provides guidelines and instructions for contributing.

## Code of Conduct

This project adheres to a code of conduct. By participating, you are expected to uphold this code. Please be respectful and constructive in all interactions.

## Getting Started

### Prerequisites

- Node.js 18 or higher
- Yarn 4.4.1 (managed via corepack)
- Git
- A GitHub account

### Setting Up Development Environment

1. **Fork the repository** on GitHub

2. **Clone your fork:**

   ```bash
   git clone https://github.com/YOUR_USERNAME/backstage-plugin-cost-insights.git
   cd backstage-plugin-cost-insights
   ```

3. **Add upstream remote:**

   ```bash
   git remote add upstream https://github.com/letthem/backstage-plugin-cost-insights.git
   ```

4. **Enable Yarn:**

   ```bash
   corepack enable
   corepack prepare yarn@4.4.1 --activate
   ```

5. **Install dependencies:**

   ```bash
   yarn install
   ```

6. **Build the project:**
   ```bash
   yarn build:all
   ```

## Development Workflow

### Creating a Feature Branch

```bash
git checkout -b feature/your-feature-name
```

Use meaningful branch names:

- `feature/add-rds-support`
- `fix/date-filter-bug`
- `docs/update-aws-guide`

### Making Changes

1. **Make your changes** in the appropriate files
2. **Follow code style:**

   - Use TypeScript
   - Follow existing code patterns
   - Use meaningful variable and function names
   - Add comments for complex logic

3. **Format your code:**

   ```bash
   yarn prettier:fix
   ```

4. **Lint your code:**

   ```bash
   yarn lint:all
   ```

5. **Type check:**
   ```bash
   yarn tsc:full
   ```

### Testing Changes

Currently, this project doesn't have comprehensive tests, but we welcome contributions to add them!

If you're adding tests:

```bash
yarn test:all
```

### Committing Changes

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```bash
git commit -m "feat: add RDS cost analysis support"
git commit -m "fix: correct date range calculation"
git commit -m "docs: update AWS setup guide"
```

**Commit Types:**

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

## Pull Request Process

### Before Submitting

1. **Sync with upstream:**

   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

2. **Ensure everything builds:**

   ```bash
   yarn build:all
   ```

3. **Check linting:**

   ```bash
   yarn lint:all
   ```

4. **Update documentation** if needed

### Submitting a Pull Request

1. **Push your branch:**

   ```bash
   git push origin feature/your-feature-name
   ```

2. **Open a Pull Request** on GitHub

   - Use a clear, descriptive title
   - Follow the PR template
   - Reference any related issues
   - Describe what your changes do and why

3. **Respond to feedback:**
   - Address reviewer comments
   - Make requested changes
   - Update your PR with additional commits

### Pull Request Guidelines

- **One feature per PR**: Keep PRs focused on a single feature or fix
- **Write clear descriptions**: Explain what you changed and why
- **Update documentation**: If your changes affect usage, update relevant docs
- **Add examples**: If applicable, add usage examples
- **Keep it small**: Smaller PRs are easier to review and merge

## Code Style Guidelines

### TypeScript

- Use TypeScript for all code
- Define types for function parameters and return values
- Avoid `any` types when possible
- Use interfaces for object shapes

### React Components

- Use functional components with hooks
- Keep components focused and single-purpose
- Extract reusable logic into custom hooks
- Use descriptive prop names

### File Organization

```
src/
├── components/          # React components
│   ├── ComponentName/
│   │   ├── ComponentName.tsx
│   │   └── index.ts
├── hooks/              # Custom React hooks
├── types/              # TypeScript type definitions
└── utils/              # Utility functions
```

### Naming Conventions

- **Components**: PascalCase (e.g., `EC2CostPage.tsx`)
- **Files**: PascalCase for components, camelCase for utilities
- **Variables**: camelCase
- **Constants**: UPPER_SNAKE_CASE
- **Interfaces**: PascalCase with descriptive names

## Documentation

### When to Update Documentation

Update documentation when you:

- Add a new feature
- Change existing functionality
- Fix a bug that affects usage
- Add configuration options

### Documentation Locations

- **README.md**: Main plugin documentation
- **docs/aws-setup.md**: AWS configuration guide
- **docs/configuration.md**: Plugin configuration reference
- **docs/architecture.md**: Technical architecture details
- **Code comments**: Complex logic and algorithms

### Writing Good Documentation

- Use clear, concise language
- Include code examples
- Add screenshots for UI features
- Explain the "why" not just the "how"
- Keep documentation up to date

## Adding New Features

### Feature Proposal

For significant new features:

1. **Open an issue** first to discuss the feature
2. **Get feedback** from maintainers
3. **Design the API** if it affects public interfaces
4. **Implement** after discussion

### Feature Checklist

- [ ] Code implements the feature
- [ ] Code follows project style guidelines
- [ ] Documentation is updated
- [ ] Examples are added (if applicable)
- [ ] Changelog is updated (for significant features)
- [ ] Backward compatibility is maintained

## Reporting Bugs

### Before Reporting

1. **Search existing issues** to avoid duplicates
2. **Try the latest version** to see if it's already fixed
3. **Gather information:**
   - Plugin version
   - Backstage version
   - Node.js version
   - Error messages and stack traces
   - Steps to reproduce

### Bug Report Template

```markdown
**Describe the bug**
A clear description of what the bug is.

**To Reproduce**
Steps to reproduce the behavior:

1. Go to '...'
2. Click on '....'
3. See error

**Expected behavior**
What you expected to happen.

**Screenshots**
If applicable, add screenshots.

**Environment:**

- Plugin version: [e.g. 0.1.0]
- Backstage version: [e.g. 1.45.1]
- Node.js version: [e.g. 18.20.0]
- Browser: [e.g. Chrome 120]

**Additional context**
Any other relevant information.
```

## Release Process (For Maintainers)

1. **Update version** in package.json files
2. **Update CHANGELOG.md**
3. **Commit changes:**
   ```bash
   git commit -m "chore: release v0.2.0"
   ```
4. **Create tag:**
   ```bash
   git tag v0.2.0
   ```
5. **Push tag:**
   ```bash
   git push origin v0.2.0
   ```
6. **GitHub Actions** will automatically publish to NPM

## Getting Help

- **GitHub Discussions**: Ask questions and discuss ideas
- **GitHub Issues**: Report bugs and request features
- **Code Comments**: Ask questions in PR reviews

## License

By contributing, you agree that your contributions will be licensed under the Apache-2.0 License.

## Thank You!

Your contributions make this project better. We appreciate your time and effort!
