---
name: role-security-auditor
description: Load for security audits or OWASP Top 10 assessment. Provides vulnerability scanning with severity levels.
license: MIT
compatibility: opencode
metadata:
  role: security-expert
  focus: security
---

**Provides:** OWASP Top 10 vulnerability scanning, severity assessment, and remediation guidance.

**Reference:** `standards-security` for detailed secure coding patterns.

## Severity Levels

- **Critical:** Immediate risk (unauthorized access, code execution, credential leaks). Block deployment.
- **High:** Significant weakness (missing input validation, weak passwords, no rate limiting). Fix within 1-2 days.
- **Medium:** Moderate risk requiring specific conditions (missing security headers, outdated deps). Fix within 1-2 weeks.
- **Low:** Minor concern, best practice improvement. Fix when convenient.

## OWASP Top 10 Audit Checklist

### 1. Injection (SQL, NoSQL, Command)
- [ ] All queries use parameterized statements / ORM query builders
- [ ] No string concatenation in queries with user input
- [ ] No `exec`, `eval`, or dynamic execution of user input

### 2. Broken Authentication
- [ ] Passwords hashed with bcrypt/Argon2 (12+ rounds)
- [ ] Rate limiting on login (e.g., 5 attempts per 15 min)
- [ ] Session tokens random and unpredictable
- [ ] Sessions expire after inactivity, logout invalidates them
- [ ] HTTP-only, Secure, SameSite cookies

### 3. Sensitive Data Exposure
- [ ] All traffic uses HTTPS/TLS
- [ ] Sensitive data encrypted at rest
- [ ] No sensitive data in logs or error messages
- [ ] Secrets in environment variables, not in code

### 4. Broken Access Control
- [ ] Authorization checked on every endpoint
- [ ] Users can only access their own resources
- [ ] Admin functions properly restricted
- [ ] CORS properly configured

### 5. Security Misconfiguration
- [ ] Default credentials changed
- [ ] Debug mode disabled in production
- [ ] Security headers set (CSP, HSTS, X-Frame-Options, X-Content-Type-Options)
- [ ] Unnecessary features disabled

### 6. XSS
- [ ] All user input encoded before display
- [ ] CSP headers configured
- [ ] No innerHTML with user data
- [ ] Rich text properly sanitized

### 7. Insecure Deserialization
- [ ] No deserialization of untrusted data (no pickle/eval on user input)
- [ ] Use JSON for data exchange

### 8. Known Vulnerabilities
- [ ] Dependencies scanned regularly (npm audit, Snyk, Dependabot)
- [ ] No critical/high CVEs in dependencies

### 9. Insufficient Logging
- [ ] Authentication events logged (success and failure)
- [ ] Authorization failures logged
- [ ] Alerting configured for anomalies
- [ ] Logs protected from tampering

### 10. XXE
- [ ] XML external entity processing disabled
- [ ] Prefer JSON over XML when possible

## Audit Process

1. **Identify sensitive operations:** auth, password handling, sessions, PII, file uploads, database queries, external APIs
2. **Review input validation:** All inputs validated (type, length, format), server-side validation, whitelist approach
3. **Review auth/authz:** Strong password requirements, proper hashing, rate limiting, RBAC, resource ownership checks
4. **Review data protection:** Encryption at rest/transit, no secrets in code, no PII in logs
5. **Review dependencies:** Up to date, no known CVEs, security headers configured

## Report Format

```markdown
## Security Review: {Component}

**Assessment:** Approved / Needs Fixes / Critical Issues

### Critical Issues
- **File:Line** - Issue description. **Fix:** Specific remediation.

### High Issues
- **File:Line** - Issue description. **Fix:** Specific remediation.

### Medium/Low Issues
- **File:Line** - Issue. **Fix:** Remediation.

### Positive Observations
- What's done well

**Overall Risk Level:** Critical / High / Medium / Low
```
