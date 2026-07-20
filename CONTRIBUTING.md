# Contributing to Kokecore

Thank you for your interest in contributing to Kokecore!

## Development Setup

```bash
# Clone the repository
git clone https://github.com/j-a-a-s/kokecore.git
cd kokecore

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test
```

## Code Style

- Use TypeScript strict mode
- Follow ESLint rules
- Format code with Prettier
- Write tests for new features
- Update documentation

## Commit Messages

Follow conventional commits:

- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `style:` Code style changes (formatting)
- `refactor:` Code refactoring
- `test:` Test changes
- `chore:` Build process or auxiliary tool changes

## Pull Request Process

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Update documentation
6. Submit a pull request

## Testing

All packages must have:

- Unit tests for core functionality
- Integration tests for external dependencies
- > 80% code coverage
- No failing tests

## Release Process

Releases are automated using Changesets:

1. Add a changeset for your changes: `pnpm changeset`
2. Submit your PR
3. Maintainers will version and publish
