# Changelog

## [1.0.3] - 2025-01-02

### Fixed
- **CRITICAL**: Fixed infinite loop in dependency resolution caused by incorrect set difference implementation
- Fixed circular dependency detection in GraphQL fragment processing
- Improved error handling for resolver failures (now fails gracefully instead of crashing)
- Updated integration with latest urql version (removed deprecated `dedupExchange`)

### Added
- **Async Computed Properties**: Support for async resolvers with caching and TTL
- **Enhanced TypeScript Types**: Better type safety with generic entity definitions
- **Circular Dependency Detection**: Proactive detection with detailed error messages
- **Performance Optimizations**: Handles 1000+ items efficiently with proper caching
- **Modern Entity Creator**: `createModernEntity` with enhanced type safety
- **Comprehensive Documentation**: 
  - Integration examples with different urql exchanges
  - Dependency resolution behavior explanation
  - Troubleshooting guide for common issues
  - Error handling examples
- **Enhanced Testing**:
  - Comprehensive integration tests with urql's cache exchange
  - Performance tests for large datasets
  - Tests for complex computed property chains
  - Tests for error handling scenarios
  - Tests for array handling with computed properties
  - Async computed property tests
- **CI/CD Pipeline**: GitHub Actions workflow for automated testing and publishing

### Improved
- **Better Error Messages**: Detailed error messages for circular dependencies and resolution failures
- **More Robust Handling**: Better handling of missing dependencies and edge cases
- **Enhanced TypeScript Support**: Improved type definitions and generic constraints
- **Documentation**: Comprehensive README with examples and troubleshooting
- **Test Coverage**: 45+ tests covering unit, integration, and performance scenarios

### Technical Improvements
- Maximum iteration limit to prevent infinite loops (100 iterations)
- Proactive circular dependency detection using graph analysis
- Enhanced resolver error handling with detailed logging
- Support for complex dependency chains with proper resolution order
- Async computed properties with caching and TTL support
- Modern TypeScript features and better type safety

## [1.0.2] - Previous
- Maintained fork with updated dependencies

## [1.0.1] - Previous  
- Initial fork from original urql-computed-exchange