# Task Completion Checklist

When completing a coding task:

1. **Code Quality**
   - Run `npm run type-check` to ensure no TypeScript errors
   - Run `npm run lint` to check for linting issues
   - Run `npm run format` to format code properly

2. **Testing**
   - Write unit tests for new services/methods
   - Run `npm test` to ensure all tests pass
   - Run specific tests for modified code: `npm test -- --testPathPattern="filename"`
   - Aim for high test coverage

3. **Documentation**
   - Add JSDoc comments for public methods
   - Update any relevant documentation if behavior changes
   - Ensure error messages are clear and helpful

4. **Integration**
   - Ensure new services are properly initialized in Bot.initializeServices()
   - Check that all dependencies are injected correctly
   - Verify Discord client integration if needed

5. **Error Handling**
   - All async operations wrapped in try-catch
   - Proper error logging with winston logger
   - User-friendly error messages in Discord embeds

6. **Security**
   - Permission checks for sensitive operations
   - Input validation for all user inputs
   - Audit logging for significant actions