---
name: standards-security
description: MUST load for auth, user input, or sensitive data handling; SHOULD load for security reviews or API design. Provides OWASP Top 10 and secure coding checklists.
license: MIT
compatibility: opencode
metadata:
  role: standards
  domain: security
  priority: critical
---

# Security Standards

**Provides:** OWASP Top 10 vulnerability protections, authentication/authorization patterns, input validation checklists, and data protection guidelines.

## Quick Reference

**Golden Rule**: Security by design - validate inputs, minimize privileges, encrypt sensitive data.

**Core Principles**: Defense in depth, least privilege, fail-safe defaults, zero trust.

**Checklist**: Input validated, auth checked, data encrypted, errors logged, dependencies scanned.

---

## Overview

Security is non-negotiable in software development. These standards ensure generated code follows security best practices to protect users and systems.

## Authentication & Authorization

### Authentication Patterns
```javascript
// ✅ Secure: Use established libraries, never roll your own
import { verifyToken } from 'jsonwebtoken';

function authenticateUser(token) {
  try {
    const decoded = verifyToken(token, process.env.JWT_SECRET);
    return { success: true, user: decoded };
  } catch (error) {
    return { success: false, error: 'Invalid token' };
  }
}

// ❌ Avoid: Custom crypto implementations
function customHash(password) {
  // Never implement your own crypto
}
```

### Authorization Checks
```javascript
// ✅ Check permissions at every access point
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }
  next();
}

// ✅ Use role-based access control (RBAC)
const PERMISSIONS = {
  read: ['user', 'admin'],
  write: ['admin'],
  delete: ['superadmin']
};

function hasPermission(user, action) {
  return PERMISSIONS[action]?.includes(user.role) || false;
}
```

## Input Validation & Sanitization

### Input Validation
```javascript
// ✅ Validate all inputs at boundaries
import { z } from 'zod';

const userSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/),
  age: z.number().min(13).max(120)
});

function createUser(input) {
  const validated = userSchema.parse(input);
  // Proceed with validated data
}
```

### SQL Injection Prevention
```javascript
// ✅ Use parameterized queries
const query = 'SELECT * FROM users WHERE id = ?';
db.query(query, [userId], callback);

// ❌ Never concatenate user input
const badQuery = `SELECT * FROM users WHERE id = ${userId}`; // Vulnerable!
```

### XSS Prevention
```javascript
// ✅ Escape output in templates
const safeHtml = `<div>${escapeHtml(userInput)}</div>`;

// ✅ Use CSP headers
app.use((req, res, next) => {
  res.setHeader('Content-Security-Policy', "default-src 'self'");
  next();
});
```

## Data Protection

### Sensitive Data Handling
```javascript
// ✅ Never log sensitive data
logger.info('User login', { userId: user.id }); // OK
logger.info('User login', { email: user.email }); // ❌ BAD

// ✅ Encrypt sensitive data at rest
import crypto from 'crypto';

function encryptData(data) {
  const cipher = crypto.createCipher('aes-256-cbc', process.env.ENCRYPTION_KEY);
  return cipher.update(data, 'utf8', 'hex') + cipher.final('hex');
}
```

### Environment Variables
```javascript
// ✅ Use environment variables for secrets
const dbPassword = process.env.DB_PASSWORD;

// ❌ Never hardcode secrets
const dbPassword = 'supersecretpassword123'; // ❌ BAD
```

### Password Security
```javascript
// ✅ Use strong hashing with salt
import bcrypt from 'bcrypt';

async function hashPassword(password) {
  const saltRounds = 12;
  return await bcrypt.hash(password, saltRounds);
}

async function verifyPassword(password, hash) {
  return await bcrypt.compare(password, hash);
}
```

## Common Vulnerabilities

### CSRF Protection
```javascript
// ✅ Include CSRF tokens
app.use(csurf());

// ✅ Verify tokens on state-changing requests
app.post('/transfer', (req, res) => {
  if (!req.csrfToken()) {
    return res.status(403).json({ error: 'CSRF token missing' });
  }
  // Process transfer
});
```

### Rate Limiting
```javascript
// ✅ Implement rate limiting
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

app.use('/api/', limiter);
```

### Secure Headers
```javascript
// ✅ Set security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000');
  next();
});
```

## API Security

### API Key Management
```javascript
// ✅ Validate API keys
function validateApiKey(key) {
  const validKeys = process.env.API_KEYS?.split(',') || [];
  return validKeys.includes(key);
}

// ✅ Use API key middleware
app.use('/api/', (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  if (!validateApiKey(apiKey)) {
    return res.status(401).json({ error: 'Invalid API key' });
  }
  next();
});
```

### CORS Configuration
```javascript
// ✅ Configure CORS properly
import cors from 'cors';

const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true
};

app.use(cors(corsOptions));
```

## Secure Coding Practices

### Error Handling
```javascript
// ✅ Don't leak sensitive information in errors
app.use((error, req, res, next) => {
  logger.error('Error occurred', { error: error.message, stack: error.stack });
  res.status(500).json({ error: 'Internal server error' }); // Generic message
});

// ❌ Avoid exposing stack traces
res.status(500).json({ error: error.stack }); // ❌ BAD
```

### Dependency Security
```javascript
// ✅ Audit dependencies regularly
# npm audit
# npm audit fix

// ✅ Use tools like Snyk or npm audit
# npx snyk test
```

### File Upload Security
```javascript
// ✅ Validate file uploads
const multer = require('multer');
const upload = multer({
  limits: { fileSize: 1024 * 1024 }, // 1MB limit
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only images allowed'));
    }
    cb(null, true);
  }
});
```

## Logging & Monitoring

### Security Event Logging
```javascript
// ✅ Log security events
function logSecurityEvent(event, details) {
  logger.warn('Security event', {
    event,
    details,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  });
}

// Examples of events to log:
logSecurityEvent('failed_login', { email: req.body.email });
logSecurityEvent('permission_denied', { userId, resource, action });
```

### Monitoring
```javascript
// ✅ Monitor for anomalies
// Use tools like DataDog, New Relic, or custom alerts
// Monitor failed authentications, unusual traffic patterns, etc.
```

## Security Testing

### Automated Security Testing
```javascript
// ✅ Include security tests
test('should prevent SQL injection', () => {
  const maliciousInput = "'; DROP TABLE users; --";
  expect(() => processInput(maliciousInput)).toThrow();
});

test('should validate input properly', () => {
  expect(validateEmail('invalid')).toBe(false);
  expect(validateEmail('user@example.com')).toBe(true);
});
```

### Security Tools
- **Static Analysis**: ESLint security plugins, SonarQube
- **Dependency Scanning**: npm audit, Snyk
- **Vulnerability Testing**: OWASP ZAP, Burp Suite
- **Container Security**: Clair, Trivy

## Implementation Checklist

- [ ] All user inputs validated and sanitized
- [ ] Authentication required for protected endpoints
- [ ] Authorization checks implemented
- [ ] Sensitive data encrypted
- [ ] Security headers configured
- [ ] Rate limiting implemented
- [ ] Dependencies audited for vulnerabilities
- [ ] Error messages don't leak sensitive information
- [ ] Security events logged
- [ ] Regular security testing performed

Security is everyone's responsibility. Always assume the worst-case scenario and design defenses accordingly.</content>
