---
name: standards-security
description: Load for auth, user input, or sensitive data handling. Provides OWASP Top 10 protections and secure coding checklists.
license: MIT
compatibility: opencode
metadata:
  role: standards
  domain: security
  priority: critical
---

# Security Standards

**Core Principles:** Defense in depth, least privilege, fail-safe defaults, zero trust.

## Authentication & Authorization

- Use established libraries for auth (never roll your own crypto)
- Hash passwords with bcrypt/Argon2 (12+ rounds)
- Check permissions at every access point
- Use role-based access control (RBAC)
- Implement session timeout and invalidation

## Input Validation & Sanitization

- Validate all inputs at boundaries (type, length, format)
- Use schema validation libraries (e.g., Zod, Joi, pydantic)
- Use parameterized queries -- never concatenate user input into queries
- Escape output for context (HTML, JavaScript, URL)
- Implement Content-Security-Policy headers

## Data Protection

- Never log sensitive data (passwords, tokens, PII)
- Encrypt sensitive data at rest (AES-256)
- Use TLS/HTTPS for all data in transit
- Store secrets in environment variables, never in code
- Implement data retention policies

## Secure Coding Practices

- **Error handling:** Generic messages to users, detailed logs server-side. Never expose stack traces.
- **Rate limiting:** Protect auth endpoints and APIs from abuse
- **Security headers:** CSP, X-Frame-Options: DENY, X-Content-Type-Options: nosniff, HSTS, X-XSS-Protection
- **CORS:** Restrict to known origins, don't use wildcard in production
- **CSRF:** Include and verify CSRF tokens on state-changing requests
- **File uploads:** Validate type and size, don't trust client-reported MIME type
- **Dependencies:** Audit regularly (npm audit, Snyk), remove unused deps

## API Security

- Validate API keys / bearer tokens on every request
- Configure CORS to allowed origins only
- Rate limit API endpoints
- Never expose internal error details

## Security Testing

- Write tests for SQL injection, XSS, and auth bypass scenarios
- Use static analysis tools (ESLint security plugins, SonarQube)
- Run dependency scanning in CI (npm audit, Snyk, Dependabot)

## Implementation Checklist

- [ ] All user inputs validated and sanitized
- [ ] Authentication required for protected endpoints
- [ ] Authorization checks on every endpoint
- [ ] Sensitive data encrypted at rest and in transit
- [ ] Security headers configured
- [ ] Rate limiting implemented
- [ ] Dependencies audited, no critical CVEs
- [ ] Error messages don't leak sensitive information
- [ ] Security events logged (auth success/failure, authz failures)
- [ ] No secrets in source code
