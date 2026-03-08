---
name: standards-observability
description: MUST load for logging, metrics, error tracking, or performance monitoring; SHOULD load for debugging strategies or system health design. Provides structured logging, telemetry, and visibility checklists.
license: MIT
compatibility: opencode
metadata:
  role: standards
  domain: observability
  priority: high
---

# Observability Standards

**Provides:** Structured logging patterns, metrics design, error tracking, performance monitoring, and debugging strategies.

## Quick Reference

**Core Philosophy**: Observable, Debuggable, Measurable  
**Golden Rule**: If you can't see it in production, you can't fix it

**Critical Patterns** (use these):
- ✅ Structured logging (JSON, contextual data)
- ✅ Meaningful error messages (context, not just "failed")
- ✅ Business metrics (what matters to users/ops)
- ✅ Tracing across services (request IDs, correlation)
- ✅ Alerts on patterns (thresholds, anomalies)

**Anti-Patterns** (avoid these):
- ❌ Silent failures (no logging, no monitoring)
- ❌ Generic error messages ("Error" or "Failed")
- ❌ Logging everything (noise hides signals)
- ❌ Metrics with no context (raw numbers)
- ❌ No correlation between requests (can't trace issues)

---

## Core Philosophy

**Observable**: Every significant action is logged and measurable  
**Debuggable**: Logs contain enough context to diagnose issues  
**Measurable**: Metrics track what matters for users and operations  

## Logging Standards

### Structured Logging

**✅ DO: Use structured (JSON) logging**
```javascript
// ✅ Good - Structured, contextual
logger.info({
  event: 'user_created',
  userId: user.id,
  email: user.email,
  timestamp: new Date().toISOString(),
  duration: performance.now(),
  environment: process.env.NODE_ENV
});

// ✅ Good - Template with context
logger.info('User created', {
  userId: user.id,
  email: user.email,
  source: 'signup_form'
});
```

**❌ DON'T: Use free-form text logging**
```javascript
// ❌ Bad - No context, unstructured
console.log('Created user');

// ❌ Bad - Unstructured concatenation
logger.log('User ' + user.id + ' was created at ' + new Date());

// ❌ Bad - No actionable information
logger.error('Something went wrong');
```

### Log Levels

Use appropriate log levels to control noise:

- **ERROR**: Actionable errors requiring investigation or manual intervention
  ```javascript
  logger.error('Database connection failed', {
    database: 'users-db',
    error: error.message,
    retry: 3,
    nextRetry: '5s'
  });
  ```

- **WARN**: Degraded performance, approaching limits, recoverable issues
  ```javascript
  logger.warn('Cache miss rate high', {
    hitRate: 0.45,
    threshold: 0.8,
    action: 'check_cache_configuration'
  });
  ```

- **INFO**: Important business events (user actions, deployments, config changes)
  ```javascript
  logger.info('Deployment started', {
    version: '1.2.3',
    environment: 'production',
    deployedBy: 'ci/cd'
  });
  ```

- **DEBUG**: Detailed information for troubleshooting (not in production by default)
  ```javascript
  logger.debug('Processing payment', {
    orderId: '12345',
    amount: 99.99,
    processor: 'stripe'
  });
  ```

### Log Context & Correlation

**✅ DO: Include correlation IDs for request tracing**
```javascript
// Middleware: Add correlation ID to all logs in request
function requestContextMiddleware(req, res, next) {
  const requestId = req.headers['x-request-id'] || generateId();
  
  // Add to logger context (all logs will include this)
  logger.setContext({ requestId, userId: req.user?.id });
  
  res.setHeader('x-request-id', requestId);
  next();
}

// In application code - requestId automatically included
logger.info('Processing order', { orderId: '123' });
// Output includes: { requestId: 'abc123', userId: 'user456', orderId: '123' }
```

**✅ DO: Include relevant context for debugging**
```javascript
logger.error('Payment processing failed', {
  orderId: order.id,
  customerId: customer.id,
  amount: order.total,
  paymentGateway: 'stripe',
  errorCode: error.code,
  errorMessage: error.message,
  retryable: error.retryable,
  attempt: attempt,
  maxAttempts: MAX_RETRIES
});
```

### What to Log

**✅ DO log:**
- User actions (login, signup, purchase, upload)
- State transitions (order created → paid → shipped)
- Errors with context (not just the error, but what was being done)
- Performance thresholds (slow queries, timeouts)
- Configuration changes and deployments
- Security events (auth failures, permission denials)

**❌ DON'T log:**
- Sensitive data (passwords, API keys, PII without redaction)
- Internal implementation details (loop counters, temp variables)
- Every function call (use DEBUG level, disable in production)
- Duplicate information (already in metrics)

---

## Error Tracking Standards

### Structured Error Messages

**✅ DO: Provide actionable error context**
```javascript
// ✅ Good - Clear, actionable, contextual
class PaymentError extends Error {
  constructor(message, context) {
    super(message);
    this.name = 'PaymentError';
    this.code = context.code;
    this.orderId = context.orderId;
    this.retryable = context.retryable;
    this.timestamp = new Date();
  }
}

throw new PaymentError(
  'Card declined: Insufficient funds',
  {
    code: 'card_declined',
    orderId: '12345',
    retryable: true
  }
);
```

**❌ DON'T: Use vague error messages**
```javascript
// ❌ Bad - No context
throw new Error('Failed');

// ❌ Bad - Implementation detail, not user action
throw new Error('JSON.parse failed');

// ❌ Bad - No code or recovery info
throw new Error('Database error');
```

### Error Handling Pattern

```javascript
// ✅ Good - Clear separation of concerns
async function processPayment(order) {
  try {
    const result = await paymentGateway.charge(order);
    
    logger.info('Payment successful', {
      orderId: order.id,
      amount: order.total,
      transactionId: result.id
    });
    
    return { success: true, transactionId: result.id };
    
  } catch (error) {
    // Categorize error for monitoring
    const isRetryable = error.code === 'network_error' || error.code === 'timeout';
    const isFatal = error.code === 'card_declined' || error.code === 'invalid_card';
    
    logger.error('Payment failed', {
      orderId: order.id,
      amount: order.total,
      errorCode: error.code,
      errorMessage: error.message,
      isRetryable,
      isFatal,
      stack: error.stack
    });
    
    // Return structured error instead of throwing
    return {
      success: false,
      code: error.code,
      message: error.message,
      retryable: isRetryable,
      fatal: isFatal
    };
  }
}
```

---

## Metrics Standards

### Business Metrics (What Matters)

Track metrics that indicate user value and business health:

**✅ DO: Track business outcomes**
```javascript
// User engagement
metrics.increment('users.signup', 1);
metrics.increment('users.login', 1);
metrics.increment('orders.created', 1);
metrics.gauge('active_users', activeUserCount);

// Conversion metrics
metrics.gauge('conversion_rate', (purchased / visited) * 100);

// Quality metrics
metrics.gauge('error_rate', (errors / requests) * 100);
metrics.gauge('payment_success_rate', (succeeded / total) * 100);
```

**❌ DON'T: Track only technical metrics**
```javascript
// ❌ Not actionable
metrics.increment('function_calls');
metrics.increment('loop_iterations');

// ❌ Too granular
metrics.increment('variable_assignments');
```

### Performance Metrics

**✅ DO: Measure operations that affect users**
```javascript
// ✅ Good - Meaningful performance metrics
const timer = metrics.startTimer('database.query.duration');
const results = await db.query('SELECT * FROM users WHERE active = true');
timer.end({ operation: 'select_active_users' });

// ✅ Good - API response times by endpoint
const apiTimer = metrics.startTimer('api.request.duration');
await handleRequest();
apiTimer.end({ method: req.method, path: req.path, status: res.status });

// ✅ Good - Queue depth and processing time
metrics.gauge('job_queue.depth', queue.length);
const jobTimer = metrics.startTimer('job.processing.duration');
await processJob(job);
jobTimer.end({ jobType: job.type });
```

### Metric Guidelines

- **Count**: How many times (requests, errors, conversions)
- **Gauge**: Current value (queue length, memory, active connections)
- **Histogram**: Distribution (response times, payload sizes)
- **Counter**: Cumulative (total requests served)

**Pattern:**
```javascript
// ✅ Good - Clear metric names with tags
metrics.timing('api.request', duration, {
  method: 'POST',
  path: '/api/users',
  status: 201
});

metrics.gauge('cache.memory', bytes, {
  cache: 'user_sessions'
});

metrics.increment('errors', 1, {
  type: 'validation_error',
  field: 'email'
});
```

---

## Distributed Tracing

### Request Correlation

**✅ DO: Trace requests across services**
```javascript
// 1. Entry point: Generate or extract trace ID
app.use((req, res, next) => {
  const traceId = req.headers['x-trace-id'] || generateId();
  const spanId = generateId();
  
  res.setHeader('x-trace-id', traceId);
  req.traceId = traceId;
  req.spanId = spanId;
  
  next();
});

// 2. Service calls: Propagate trace ID
async function callUserService(userId) {
  const result = await fetch('http://user-service/users/' + userId, {
    headers: {
      'x-trace-id': req.traceId,
      'x-span-id': generateId() // New span for this service
    }
  });
  return result;
}

// 3. Logs include trace context
logger.info('User retrieved', {
  traceId: req.traceId,
  spanId: req.spanId,
  userId,
  duration
});
```

---

## Performance Profiling

### Checklist: Production Observability

- [ ] All errors logged with context (not silent failures)
- [ ] Business metrics tracked (not just technical metrics)
- [ ] Request correlation/tracing (can follow requests across services)
- [ ] Performance thresholds monitored (slow queries, timeouts)
- [ ] Log levels appropriate (no over-logging in production)
- [ ] Sensitive data redacted from logs
- [ ] Error messages actionable (help debugging/fixing)
- [ ] Metrics have meaningful names and tags
- [ ] Alerts configured on key metrics
- [ ] Dashboards show user-visible metrics

### Debugging Checklist

- [ ] Logs contain request IDs for correlation
- [ ] Error stack traces preserved (not swallowed)
- [ ] Contextual data included (what was being done when error occurred)
- [ ] Log level appropriate to severity
- [ ] Metrics show anomalies (unusual patterns)
- [ ] Performance profiling tools accessible (flame graphs, traces)
- [ ] Database query logs available (with execution time)

---

## Alerts & Monitoring

### Alert Guidelines

**✅ DO: Alert on problems, not noise**
```javascript
// ✅ Good - Alert on user-impacting issues
{
  name: 'High Error Rate',
  condition: 'error_rate > 0.05', // >5% errors
  severity: 'critical',
  action: 'page_oncall'
}

{
  name: 'Payment Processing Slow',
  condition: 'payment_processing_time_p99 > 5000ms', // >5s
  severity: 'warning',
  action: 'notify_team'
}

// ✅ Good - Alert on system health
{
  name: 'High Memory Usage',
  condition: 'memory_usage > 0.85', // >85%
  severity: 'warning',
  action: 'auto_scale'
}
```

**❌ DON'T: Alert on every metric**
```javascript
// ❌ Bad - Creates alert fatigue
{
  condition: 'requests_total > 0',
  action: 'page_oncall'
}

// ❌ Bad - Not actionable
{
  condition: 'some_metric_changed',
  action: 'notify_team'
}
```

---

## Best Practices

✅ **Structured logging** - JSON format with context  
✅ **Meaningful metrics** - Track business outcomes, not implementation  
✅ **Request correlation** - Trace across services  
✅ **Actionable errors** - Errors include context and recovery options  
✅ **Appropriate log levels** - Control production noise  
✅ **Sensitive data handling** - Redact PII, credentials, secrets  
✅ **Performance visibility** - Monitor user-impacting operations  
✅ **Alert precision** - Alert on problems, not noise  
✅ **Consistent naming** - Predictable metric/log names  
✅ **Regular reviews** - Adjust observability based on actual issues  

---

## Example: Complete Observability Integration

```javascript
// Set up structured logger with context
const logger = createLogger({
  format: 'json',
  defaultContext: {
    service: 'order-service',
    environment: process.env.NODE_ENV
  }
});

// Add request context middleware
app.use((req, res, next) => {
  const traceId = req.headers['x-trace-id'] || generateId();
  logger.setContext({ traceId, userId: req.user?.id });
  res.setHeader('x-trace-id', traceId);
  next();
});

// Track API performance
app.use((req, res, next) => {
  const timer = metrics.startTimer('api.request.duration');
  
  res.on('finish', () => {
    timer.end({
      method: req.method,
      path: req.path,
      status: res.status
    });
    
    if (res.status >= 400) {
      metrics.increment('api.errors', 1, {
        status: res.status,
        path: req.path
      });
    }
  });
  
  next();
});

// Example: Observable business operation
async function createOrder(customerId, items) {
  try {
    logger.info('Creating order', { customerId, itemCount: items.length });
    
    const timer = metrics.startTimer('order.creation.duration');
    const order = await database.orders.create({
      customerId,
      items,
      createdAt: new Date()
    });
    timer.end();
    
    metrics.increment('orders.created', 1, {
      itemCount: items.length
    });
    
    logger.info('Order created successfully', {
      orderId: order.id,
      customerId,
      total: order.total
    });
    
    return { success: true, order };
    
  } catch (error) {
    metrics.increment('order.creation.errors', 1);
    
    logger.error('Order creation failed', {
      customerId,
      errorCode: error.code,
      errorMessage: error.message,
      stack: error.stack
    });
    
    return {
      success: false,
      error: error.message,
      code: error.code
    };
  }
}
```

---

## Summary

Observability enables you to:
- **See**: What's happening in production
- **Understand**: Why things are happening
- **Act**: Fix problems before users notice

**Golden Rule**: If you can't see it in production, you can't fix it.
