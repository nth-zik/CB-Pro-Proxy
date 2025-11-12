# Contributing to CB Pro Proxy

Thank you for your interest in contributing to CB Pro Proxy!

## Development Setup

1. **Prerequisites**
   - Node.js 18+
   - npm or yarn
   - Android Studio (for Android development)
   - Xcode (for iOS development, macOS only)

2. **Clone and Install**
   ```bash
   git clone <repository-url>
   cd cbv-vpn-app
   npm install
   ```

3. **Run Development Server**
   ```bash
   npm start
   ```

4. **Build for Android**
   ```bash
   npx expo run:android
   ```

5. **Build for iOS**
   ```bash
   npx expo run:ios
   ```

## Project Structure

```
cbv-vpn-app/
├── src/
│   ├── components/      # Reusable UI components
│   ├── screens/         # Screen components
│   ├── navigation/      # Navigation configuration
│   ├── services/        # Business logic services
│   ├── store/          # State management (Zustand)
│   ├── types/          # TypeScript types
│   ├── native/         # Native module bridges
│   └── hooks/          # Custom React hooks
├── android/            # Android native code
└── ios/               # iOS native code
```

## Coding Standards

### TypeScript
- Use TypeScript for all new code
- Define proper types and interfaces
- Avoid `any` type when possible
- Use type guards for runtime type checking

### React Native
- Use functional components with hooks
- Follow React best practices
- Use meaningful component and variable names
- Keep components small and focused

### Native Code
- **Android**: Follow Kotlin coding conventions
- **iOS**: Follow Swift coding conventions
- Document complex logic
- Handle errors gracefully

### Git Commit Messages
- Use clear, descriptive commit messages
- Format: `type(scope): message`
- Types: feat, fix, docs, style, refactor, test, chore

Examples:
```
feat(vpn): add SOCKS5 authentication support
fix(ui): resolve profile list refresh issue
docs(readme): update installation instructions
```

## Testing

### Unit Tests
```bash
npm test
```

### Integration Tests
```bash
npm run test:integration
```

### Manual Testing
- Test on real devices when possible
- Test both Android and iOS
- Test with different proxy configurations
- Test error scenarios

## Pull Request Process

1. **Fork the repository**
2. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Make your changes**
   - Write clean, documented code
   - Add tests if applicable
   - Update documentation

4. **Commit your changes**
   ```bash
   git commit -m "feat(scope): description"
   ```

5. **Push to your fork**
   ```bash
   git push origin feature/your-feature-name
   ```

6. **Create a Pull Request**
   - Provide a clear description
   - Reference any related issues
   - Include screenshots for UI changes

## Code Review

- All PRs require review before merging
- Address review comments promptly
- Keep PRs focused and reasonably sized
- Ensure CI passes before requesting review

## Areas for Contribution

### High Priority
- iOS Network Extension implementation
- Integration tests
- Performance optimizations
- Bug fixes

### Medium Priority
- UI/UX improvements
- Additional proxy protocols
- IPv6 support
- Documentation improvements

### Low Priority
- Code refactoring
- Additional features
- Localization

## Questions?

- Open an issue for bugs or feature requests
- Use discussions for questions
- Check existing issues before creating new ones

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
