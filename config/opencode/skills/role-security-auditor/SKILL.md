---
name: role-security-auditor
description: MUST load for security audits or OWASP Top 10 assessment; SHOULD load for auth reviews or sensitive data handling. Provides vulnerability scanning with severity levels.
license: MIT
compatibility: opencode
metadata:
  role: security-expert
  focus: security
---

**Provides:** OWASP Top 10 vulnerability scanning, severity assessment, remediation guidance, and security compliance evaluation.

## Quick Reference

**OWASP Top 10**: Injection, Broken Auth, Sensitive Data Exposure, XXE, Broken Access Control, Security Misconfiguration, XSS, Insecure Deserialization, Known Vulnerabilities, Insufficient Logging

**Critical Checks**: Input validation, auth/authz, secrets management, data encryption, dependency scanning

**Severity Levels**: Critical (🔴 must fix), High (🟠 should fix), Medium (🟡 consider), Low (🔵 nice to have)

**Reference**: `skill:standards-security` for comprehensive guidelines

---

## OWASP Top 10 Vulnerabilities

### 1. Injection (SQL, NoSQL, Command, LDAP)

**What it is:** Untrusted data sent to interpreter as part of command or query

**How to detect:**
- Look for string concatenation in queries
- Check for unsanitized user input in database calls
- Search for `exec`, `eval`, or similar dynamic execution

**How to prevent:**
- Use parameterized queries / prepared statements
- Use ORM query builders (not raw SQL)
- Validate and sanitize all inputs
- Apply principle of least privilege

**Example (vulnerable):**
```javascript
// ❌ Vulnerable to SQL injection
const query = `SELECT * FROM users WHERE email = '${userInput}'`;
```

**Example (secure):**
```javascript
// ✅ Secure with parameterized query
const query = 'SELECT * FROM users WHERE email = ?';
db.execute(query, [userInput]);
```

### 2. Broken Authentication

**What it is:** Improperly implemented authentication allowing attackers to compromise passwords, keys, or session tokens

**How to detect:**
- Passwords stored in plain text or weak encryption
- Weak password requirements
- No rate limiting on login attempts
- Session tokens in URLs
- No session timeout
- Predictable session IDs

**How to prevent:**
- Hash passwords with bcrypt/Argon2 (never plain text)
- Implement strong password policies
- Add rate limiting on authentication endpoints
- Use secure session management (HTTP-only, secure cookies)
- Implement session timeout and invalidation
- Use multi-factor authentication (MFA)

**Checklist:**
- [ ] Passwords hashed with strong algorithm (bcrypt, Argon2)
- [ ] Rate limiting on login (e.g., 5 attempts per 15 min)
- [ ] Session tokens are random, unpredictable
- [ ] Sessions expire after inactivity
- [ ] HTTP-only, secure, SameSite cookies
- [ ] Logout invalidates sessions

### 3. Sensitive Data Exposure

**What it is:** Inadequate protection of sensitive data (PII, credentials, financial data)

**How to detect:**
- Sensitive data in logs
- Data transmitted over HTTP (not HTTPS)
- Weak encryption algorithms
- Unencrypted data at rest
- Sensitive data in source control (.env files)

**How to prevent:**
- Encrypt sensitive data at rest (AES-256)
- Use TLS/HTTPS for data in transit
- Never log sensitive data (passwords, tokens, SSNs, credit cards)
- Use environment variables for secrets
- Implement data classification policies

**Checklist:**
- [ ] All data in transit uses HTTPS/TLS
- [ ] Sensitive data encrypted at rest
- [ ] No sensitive data in logs
- [ ] Secrets in environment variables (not code)
- [ ] Data retention policies enforced

### 4. XML External Entities (XXE)

**What it is:** Vulnerable XML processors that parse untrusted XML with external entity references

**How to detect:**
- XML parsing without disabling external entities
- Processing untrusted XML input
- XML parsers with default configurations

**How to prevent:**
- Disable XML external entity processing
- Use JSON instead of XML when possible
- Validate and sanitize XML input
- Update XML processors to latest versions

### 5. Broken Access Control

**What it is:** Improperly enforced restrictions on authenticated users

**How to detect:**
- Missing authorization checks
- Direct object reference without ownership check
- Privilege escalation possibilities
- CORS misconfiguration

**How to prevent:**
- Deny by default (whitelist, not blacklist)
- Check authorization for every request
- Verify resource ownership before access
- Implement proper RBAC (Role-Based Access Control)

**Checklist:**
- [ ] Authorization checked on every endpoint
- [ ] Users can only access their own resources
- [ ] Admin functions properly restricted
- [ ] No direct object references without checks
- [ ] CORS properly configured

### 6. Security Misconfiguration

**What it is:** Insecure default configurations, incomplete setups, exposed error messages

**How to detect:**
- Default credentials in use
- Unnecessary features enabled
- Detailed error messages to users
- Missing security headers
- Outdated software versions

**How to prevent:**
- Change all default credentials
- Disable unnecessary features
- Generic error messages to users (detailed logs server-side)
- Add security headers (CSP, X-Frame-Options, etc.)
- Keep all software updated

**Security Headers Checklist:**
- [ ] Content-Security-Policy (CSP)
- [ ] X-Frame-Options: DENY
- [ ] X-Content-Type-Options: nosniff
- [ ] Strict-Transport-Security (HSTS)
- [ ] X-XSS-Protection: 1; mode=block

### 7. Cross-Site Scripting (XSS)

**What it is:** Injecting malicious scripts into trusted websites

**How to detect:**
- User input displayed without encoding
- innerHTML used with user data
- Unescaped output in templates
- Missing Content-Security-Policy

**How to prevent:**
- Encode all output (HTML, JavaScript, URL)
- Use textContent instead of innerHTML
- Implement Content-Security-Policy
- Sanitize rich text input (use libraries)
- Use framework protections (React auto-escapes)

**Checklist:**
- [ ] All user input encoded before display
- [ ] CSP headers configured
- [ ] No innerHTML with user data
- [ ] Rich text properly sanitized

### 8. Insecure Deserialization

**What it is:** Untrusted data used to create objects, leading to code execution

**How to detect:**
- Deserializing untrusted data
- Using pickle, eval, unserialize on user input
- Accepting serialized objects from clients

**How to prevent:**
- Don't deserialize untrusted data
- Use JSON for data exchange (not pickle/serialize)
- Implement integrity checks (HMAC)
- Isolate deserialization in low-privilege environments

### 9. Using Components with Known Vulnerabilities

**What it is:** Using libraries/frameworks with known security flaws

**How to detect:**
- Outdated dependencies
- Dependencies with CVEs
- No dependency scanning

**How to prevent:**
- Regularly update dependencies
- Use dependency scanning tools (npm audit, Snyk, Dependabot)
- Monitor security advisories
- Remove unused dependencies

**Checklist:**
- [ ] Dependencies scanned regularly
- [ ] No critical/high CVEs in dependencies
- [ ] Automated dependency updates
- [ ] Only necessary dependencies included

### 10. Insufficient Logging & Monitoring

**What it is:** Inadequate logging and monitoring allowing breaches to go undetected

**How to detect:**
- No logging of authentication events
- Missing audit trails
- No alerting on suspicious activity
- Logs not reviewed

**How to prevent:**
- Log all authentication events (success and failure)
- Log authorization failures
- Log input validation failures
- Implement alerting for suspicious patterns
- Protect log integrity

**Checklist:**
- [ ] Login attempts logged (success/failure)
- [ ] Authorization failures logged
- [ ] High-value transactions logged
- [ ] Logs include sufficient context
- [ ] Alerting configured for anomalies

---

## Security Review Process

### Step 1: Identify Sensitive Operations

Look for code that handles:
- [ ] User authentication and authorization
- [ ] Password handling and storage
- [ ] Session management
- [ ] Sensitive data (PII, financial, health)
- [ ] File uploads and downloads
- [ ] Database queries
- [ ] External API calls
- [ ] Cryptographic operations

### Step 2: Input Validation Review

Check all user inputs:
- [ ] All inputs validated (type, length, format)
- [ ] Whitelist validation (not blacklist)
- [ ] Validation on server side (not just client)
- [ ] Proper encoding for context (HTML, SQL, JavaScript)
- [ ] File upload restrictions (type, size)

### Step 3: Authentication & Authorization Review

Verify security controls:
- [ ] Strong password requirements
- [ ] Passwords properly hashed (bcrypt, Argon2)
- [ ] Rate limiting on auth endpoints
- [ ] Session management secure (HTTP-only cookies)
- [ ] Authorization checked on every endpoint
- [ ] Resource ownership verified
- [ ] Proper role-based access control

### Step 4: Data Protection Review

Check data handling:
- [ ] Sensitive data encrypted at rest
- [ ] TLS/HTTPS for data in transit
- [ ] No sensitive data in logs
- [ ] Secrets in environment variables
- [ ] Data retention policies followed
- [ ] PII handling compliant with regulations

### Step 5: Dependency & Configuration Review

Verify environment security:
- [ ] Dependencies up to date
- [ ] No known vulnerabilities (run npm audit / equivalent)
- [ ] Security headers configured
- [ ] Error messages don't leak info
- [ ] Debug mode disabled in production
- [ ] CORS properly configured

### Step 6: Document Findings

Report using severity levels:
- 🔴 **Critical**: Immediate risk, must fix before deployment
- 🟠 **High**: Significant risk, fix ASAP
- 🟡 **Medium**: Moderate risk, should fix soon
- 🔵 **Low**: Minor risk, nice to have

---

## Common Vulnerability Patterns by Language

### JavaScript/Node.js

**Injection:**
```javascript
// ❌ Vulnerable
eval(userInput);
child_process.exec(`ls ${userInput}`);

// ✅ Secure
// Don't use eval at all
child_process.execFile('ls', [userInput]); // Parameterized
```

**XSS:**
```javascript
// ❌ Vulnerable
element.innerHTML = userInput;

// ✅ Secure
element.textContent = userInput; // Auto-escaped
```

**Secrets:**
```javascript
// ❌ Vulnerable
const API_KEY = "sk_live_abc123";

// ✅ Secure
const API_KEY = process.env.API_KEY;
```

### Python

**Injection:**
```python
# ❌ Vulnerable
cursor.execute(f"SELECT * FROM users WHERE id = {user_id}")

# ✅ Secure
cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
```

**Deserialization:**
```python
# ❌ Vulnerable
import pickle
obj = pickle.loads(untrusted_data)

# ✅ Secure
import json
obj = json.loads(untrusted_data) # Safer, but still validate
```

### Java

**Injection:**
```java
// ❌ Vulnerable
String query = "SELECT * FROM users WHERE email = '" + email + "'";

// ✅ Secure
PreparedStatement stmt = conn.prepareStatement("SELECT * FROM users WHERE email = ?");
stmt.setString(1, email);
```

---

## Severity Assessment

### Critical (🔴) - Fix Immediately

**Characteristics:**
- Allows unauthorized access to sensitive data
- Enables code execution
- Bypasses authentication
- Leaks credentials or secrets

**Examples:**
- Passwords stored in plain text
- SQL injection allowing data access
- Hardcoded API keys in source code
- Missing authentication on admin endpoints

**Action:** Block deployment, fix immediately

### High (🟠) - Fix ASAP

**Characteristics:**
- Significant security weakness
- Could lead to data breach with additional effort
- Affects multiple users
- Violates security policies

**Examples:**
- Missing input validation on critical endpoints
- Weak password policy (no requirements)
- No rate limiting on authentication
- Sensitive data in logs

**Action:** Fix within 1-2 days

### Medium (🟡) - Fix Soon

**Characteristics:**
- Moderate security weakness
- Requires specific conditions to exploit
- Limited impact or scope
- Defense in depth concern

**Examples:**
- Missing security headers
- Outdated dependencies (no known exploit)
- Overly permissive CORS
- Session timeout too long

**Action:** Fix within 1-2 weeks

### Low (🔵) - Nice to Have

**Characteristics:**
- Minor security concern
- Difficult to exploit
- Minimal impact
- Best practice improvement

**Examples:**
- Using older but secure crypto algorithms
- Verbose error messages (internal only)
- Missing CSRF protection on read-only endpoints
- Suboptimal logging

**Action:** Fix when convenient

---

## Security Review Report Format

```markdown
## Security Review: {Component/Feature Name}

**Reviewed:** {Date}
**Reviewer:** {Name}
**Scope:** {What was reviewed}
**Assessment:** Approved / Needs Fixes / Critical Issues

---

### Critical Issues (🔴) - Fix Immediately

1. **{File}:{Line} - {Issue}**
   - **Vulnerability:** {Type of vulnerability}
   - **Impact:** {What could happen}
   - **Fix:** {Specific remediation}
   - **Reference:** {OWASP, CWE, or standard reference}

---

### High Issues (🟠) - Fix ASAP

1. **{File}:{Line} - {Issue}**
   - **Vulnerability:** {Type}
   - **Impact:** {What could happen}
   - **Fix:** {Specific remediation}

---

### Medium Issues (🟡) - Fix Soon

1. **{File}:{Line} - {Issue}**
   - **Vulnerability:** {Type}
   - **Fix:** {Specific remediation}

---

### Low Issues (🔵) - Nice to Have

1. **{File}:{Line} - {Issue}**
   - **Improvement:** {What could be better}

---

### Positive Observations

- ✅ {Good security practice observed}
- ✅ {Another good practice}

---

### Recommendations

1. {Next steps}
2. {Additional improvements}
3. {Follow-up items}

**Overall Risk Level:** {Critical / High / Medium / Low}
```

---

## Security Checklist

### Authentication
- [ ] Passwords hashed with bcrypt/Argon2 (12+ rounds)
- [ ] Password requirements enforced (length, complexity)
- [ ] Rate limiting on login attempts (5 per 15 min)
- [ ] Account lockout after failed attempts
- [ ] Secure password reset flow (time-limited tokens)
- [ ] MFA available for sensitive accounts

### Authorization
- [ ] Authorization checked on every endpoint
- [ ] Users can only access their own resources
- [ ] Admin endpoints properly restricted
- [ ] Role-based access control implemented
- [ ] Principle of least privilege applied

### Input Validation
- [ ] All user inputs validated (type, length, format)
- [ ] Server-side validation (not just client-side)
- [ ] Whitelist validation where possible
- [ ] File uploads restricted (type, size)
- [ ] Input sanitized for context (HTML, SQL, JavaScript)

### Data Protection
- [ ] Sensitive data encrypted at rest (AES-256)
- [ ] All traffic uses HTTPS/TLS
- [ ] No sensitive data in logs or error messages
- [ ] Secrets stored in environment variables
- [ ] Data retention policies implemented
- [ ] PII handling compliant with regulations

### Session Management
- [ ] Session tokens are random and unpredictable
- [ ] HTTP-only and Secure flags on cookies
- [ ] SameSite cookie attribute set
- [ ] Session timeout after inactivity
- [ ] Logout properly invalidates sessions
- [ ] No session data in URLs

### Error Handling
- [ ] Generic error messages to users
- [ ] Detailed errors logged server-side only
- [ ] No stack traces in production
- [ ] No sensitive data in error messages

### Dependencies
- [ ] All dependencies up to date
- [ ] No critical/high CVEs in dependencies
- [ ] Dependency scanning automated
- [ ] Only necessary dependencies included

### Configuration
- [ ] All default credentials changed
- [ ] Debug mode disabled in production
- [ ] Security headers configured (CSP, HSTS, etc.)
- [ ] CORS properly restricted
- [ ] Unnecessary features disabled

### Logging & Monitoring
- [ ] Authentication events logged
- [ ] Authorization failures logged
- [ ] Input validation failures logged
- [ ] Logs protected from tampering
- [ ] Alerting configured for anomalies

---

## References

**Comprehensive security guidelines:** `skill:standards-security`

**OWASP Resources:**
- OWASP Top 10: https://owasp.org/www-project-top-ten/
- OWASP Cheat Sheets: https://cheatsheetseries.owasp.org/

**Security Standards:**
- CWE (Common Weakness Enumeration)
- CVE (Common Vulnerabilities and Exposures)
- NIST Cybersecurity Framework

---

## Integration with Other Skills

### With role-code-review
- role-code-review handles general quality and maintainability
- role-security-auditor handles deep security analysis
- Use both together for comprehensive review

### With role-qa-engineer
- role-qa-engineer designs test strategies
- role-security-auditor identifies security test cases
- Collaborate on security testing approach

---

## Quick Tips

**Always validate inputs** - Never trust user data  
**Hash, don't encrypt passwords** - Use bcrypt or Argon2  
**Use parameterized queries** - Prevent SQL injection  
**Keep dependencies updated** - Patch known vulnerabilities  
**Encrypt sensitive data** - At rest and in transit  
**Log security events** - But never log sensitive data  
**Implement rate limiting** - Prevent abuse and brute force  
**Use security headers** - Defense in depth  
**Principle of least privilege** - Minimal permissions needed  
**Fail securely** - Deny by default  
