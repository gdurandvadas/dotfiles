---
name: standards-surrealdb
description: MUST load when designing SurrealDB schemas, writing SurrealQL, or implementing permissions; SHOULD load for SurrealDB reviews. Provides security patterns, graph modeling, indexing, LIVE subscriptions, and RBAC.
license: MIT
compatibility: opencode
metadata:
  role: standards
  domain: surrealdb
  priority: high
---

# SurrealDB Standards

**Provides:** SurrealQL security patterns (parameterized queries, row-level PERMISSIONS, RBAC), graph relations with typed edges, schema design with SCHEMAFULL and ASSERT, indexing strategies, LIVE subscriptions with cleanup, connection pooling, and real-time subscriptions.

**Primary references:**

- [SurrealDB Documentation](https://surrealdb.com/docs)
- [SurrealQL Reference](https://surrealdb.com/docs/surrealdb/surrealql)
- [Security Best Practices](https://surrealdb.com/docs/surrealdb/reference-guide/security-best-practices)
- [Security Advisories](https://github.com/surrealdb/surrealdb/security)

## Quick Reference

**Golden Rule**: Security by default — explicit PERMISSIONS on every table, parameterized queries only, hashed passwords, row-level security with `$auth`.

**Style principles (priority order):**

| Principle | Key question |
| --------- | ------------ |
| Security | Are PERMISSIONS explicit? Queries parameterized? Passwords hashed? |
| Correctness | Does the schema enforce invariants with ASSERT and TYPE? |
| Performance | Are queried fields indexed? N+1 avoided with FETCH/graph traversal? |
| Resource management | Are LIVE subscriptions and connections cleaned up? |

**Do:**

- Define explicit PERMISSIONS on every table (FOR select/update/delete/create with WHERE clauses)
- Use parameterized queries with `$variable` — never string concatenation
- Hash passwords with `crypto::argon2::generate()` or `crypto::bcrypt`
- Use SCHEMAFULL with ASSERT validation for critical tables
- Create indexes on frequently queried fields
- Use FETCH or graph traversal to avoid N+1 queries
- Call `db.kill(uuid)` for every LIVE subscription before disconnect
- Use connection pooling — never create a new connection per request
- Restrict network access with `--allow-net` and `--deny-net`
- Set SESSION expiration on DEFINE SCOPE (≤2h for record users)
- Limit graph traversal depth and filter during traversal

**Don't:**

- Use string concatenation or interpolation in queries
- Store passwords in plain text
- Define tables without explicit PERMISSIONS
- Use `--allow-all` in production
- Leave LIVE subscriptions without cleanup
- Query fields without indexes (full table scan)
- Use N+1 pattern — use FETCH or graph traversal instead
- Expose root credentials to client applications
- Use schemaless without security review

**Key commands:**

```sh
surreal start --allow-net example.com --deny-net 10.0.0.0/8  # restrict network
pytest tests/test_surrealdb/ -v --asyncio-mode=auto          # run tests
pytest tests/test_surrealdb/ --cov=src/repositories         # coverage
```

---

## Security Vulnerabilities (Reference)

**Known advisories (review before implementation):**

| Advisory | Issue | Fixed in |
|----------|-------|----------|
| GHSA-gh9f-6xm2-c4j2 | Improper auth when changing databases | v1.5.4+ |
| GHSA-7vm2-j586-vcvc | Unauthorized data via LIVE queries | v2.3.8+ |
| GHSA-64f8-pjgr-9wmr | Untrusted query evaluation in RPC API | — |
| GHSA-x5fr-7hhj-34j3 | Full table permissions by default | v1.0.1+ |
| GHSA-5q9x-554g-9jgg | SSRF via redirect bypass of deny-net | — |

**OWASP Top 10 2025 mapping:**

| OWASP | Risk | Mitigation |
|-------|------|------------|
| A01 Broken Access Control | Critical | Row-level PERMISSIONS, RBAC |
| A02 Cryptographic Failures | High | crypto::argon2 for passwords |
| A03 Injection | Critical | Parameterized queries, $variables |
| A05 Security Misconfiguration | Critical | Explicit PERMISSIONS, --allow-net |
| A07 Auth & Session Failures | Critical | SCOPE SESSION expiry, RBAC |
| A10 SSRF | High | --allow-net, --deny-net flags |

---

## Secure Table Definition

```surreal
-- ✅ SECURE: Explicit permissions with row-level security
DEFINE TABLE user SCHEMAFULL
    PERMISSIONS
        FOR select, update, delete WHERE id = $auth.id
        FOR create WHERE $auth.role = 'admin';

DEFINE FIELD email ON TABLE user TYPE string ASSERT string::is::email($value);
DEFINE FIELD password ON TABLE user TYPE string VALUE crypto::argon2::generate($value);
DEFINE FIELD role ON TABLE user TYPE string DEFAULT 'user' ASSERT $value IN ['user', 'admin'];
DEFINE FIELD created ON TABLE user TYPE datetime DEFAULT time::now();

DEFINE INDEX unique_email ON TABLE user COLUMNS email UNIQUE;

-- ❌ UNSAFE: No permissions, plain password
DEFINE TABLE user SCHEMAFULL;
DEFINE FIELD password ON TABLE user TYPE string;
```

---

## Parameterized Queries

```surreal
-- ✅ SAFE: Parameterized
SELECT * FROM user WHERE email = $email;

CREATE user CONTENT {
    email: $email,
    password: crypto::argon2::generate($password),
    name: $name
};
```

```javascript
// ✅ SAFE: SDK parameters
const result = await db.query('SELECT * FROM user WHERE email = $email', { email });

// ❌ UNSAFE: String interpolation
await db.query(`SELECT * FROM user WHERE email = "${userInput}"`);
```

---

## Graph Relations

```surreal
DEFINE TABLE user SCHEMAFULL;
DEFINE TABLE post SCHEMAFULL;

DEFINE TABLE authored SCHEMAFULL
    PERMISSIONS FOR select WHERE in = $auth.id OR out.public = true;
DEFINE FIELD in ON TABLE authored TYPE record<user>;
DEFINE FIELD out ON TABLE authored TYPE record<post>;
DEFINE FIELD created_at ON TABLE authored TYPE datetime DEFAULT time::now();

RELATE user:john->authored->post:123 SET created_at = time::now();

-- Traversals
SELECT ->authored->post.* FROM user:john;
SELECT <-authored<-user.* FROM post:123;
SELECT ->authored->post[WHERE published = true].* FROM user:john;

-- Limit depth and filter
SELECT ->follows->user[0:10].name FROM user:john;
```

---

## Schema Validation

```surreal
DEFINE FIELD name ON TABLE product
    TYPE string
    ASSERT string::length($value) >= 3 AND string::length($value) <= 100;

DEFINE FIELD price ON TABLE product TYPE decimal ASSERT $value > 0;
DEFINE FIELD category ON TABLE product TYPE string ASSERT $value IN ['electronics', 'clothing', 'food'];
```

---

## LIVE Queries

```javascript
// ✅ With cleanup
const queryUuid = await db.live('user', (action, result) => {
    switch (action) {
        case 'CREATE': handleNewUser(result); break;
        case 'UPDATE': handleUserUpdate(result); break;
        case 'DELETE': handleUserDelete(result); break;
    }
});

// Clean up on unmount
return () => { db.kill(queryUuid); db.close(); };
```

```surreal
-- ✅ With permission filter
LIVE SELECT * FROM post WHERE author = $auth.id OR public = true;
```

---

## RBAC

```surreal
DEFINE USER admin ON ROOT PASSWORD 'secure' ROLES OWNER;
DEFINE USER editor ON DATABASE app PASSWORD 'secure' ROLES EDITOR;
DEFINE USER viewer ON DATABASE app PASSWORD 'secure' ROLES VIEWER;

DEFINE SCOPE user_scope
    SESSION 2h
    SIGNUP (CREATE user CONTENT {
        email: $email,
        password: crypto::argon2::generate($password),
        created_at: time::now()
    })
    SIGNIN (SELECT * FROM user WHERE email = $email
        AND crypto::argon2::compare(password, $password));

DEFINE TABLE document SCHEMAFULL
    PERMISSIONS
        FOR select WHERE public = true OR owner = $auth.id
        FOR create WHERE $auth.id != NONE
        FOR update, delete WHERE owner = $auth.id;
```

---

## Indexing

```surreal
DEFINE INDEX email_idx ON TABLE user COLUMNS email UNIQUE;
DEFINE INDEX user_created_idx ON TABLE post COLUMNS user, created_at;
DEFINE INDEX search_idx ON TABLE post COLUMNS title, content SEARCH ANALYZER simple BM25;

SELECT * FROM post WHERE title @@ 'database';
SELECT * FROM post ORDER BY created_at DESC START 0 LIMIT 20;
```

---

## Query Optimization

```surreal
-- ✅ Single query with FETCH (avoids N+1)
SELECT * FROM user FETCH ->authored->post;

-- ✅ Pagination
SELECT * FROM post WHERE created_at < $cursor ORDER BY created_at DESC LIMIT 20;

-- ✅ Select only needed fields
SELECT id, email, name FROM user WHERE active = true;

-- ❌ N+1
FOR $user IN (SELECT * FROM user) {
    SELECT * FROM post WHERE author = $user.id;
}
```

---

## Graph Traversal

```surreal
-- Limit depth
SELECT ->follows->user[0:10].name FROM user:john;

-- Filter during traversal
SELECT ->authored->post[WHERE published = true AND created_at > $date].* FROM user:john;

-- Aggregate
SELECT count(->authored->post) AS post_count FROM user:john;
```

---

## Batch Operations

```surreal
BEGIN TRANSACTION;
CREATE product:1 CONTENT { name: 'Product 1', price: 10 };
CREATE product:2 CONTENT { name: 'Product 2', price: 20 };
COMMIT TRANSACTION;

UPDATE product SET discount = 0.1 WHERE category = 'electronics';
DELETE post WHERE created_at < time::now() - 1y AND archived = true;
```

---

## Connection Pooling

Use a pool — never create a new connection per request. Example pattern:

```python
@asynccontextmanager
async def connection(pool):
    conn = await pool.acquire()
    try:
        yield conn
    finally:
        await pool.release(conn)
```

---

## Testing

Test schema, permissions, and queries. Use a test namespace/database. Verify:
- Password hashing (no plain text in responses)
- Row-level security (user A cannot access user B's data)
- Index performance (query with/without index)

```python
@pytest.mark.asyncio
async def test_create_user_hashes_password(db):
    result = await db.query(
        "CREATE user CONTENT { email: $email, password: crypto::argon2::generate($password) } RETURN id, email, password",
        {"email": "test@example.com", "password": "secret123"}
    )
    user = result[0]["result"][0]
    assert user["password"] != "secret123"
    assert user["password"].startswith("$argon2")
```

```bash
pytest tests/test_surrealdb/ -v --asyncio-mode=auto
pytest tests/test_surrealdb/ --cov=src/repositories --cov-report=html
```

---

## Skill Loading Triggers

| Situation | Also load |
|-----------|-----------|
| SurrealDB schema or SurrealQL | `standards-security` |
| Writing SurrealDB tests | `standards-testing` |
| Implementing SurrealDB features | `role-developer` |
| Database/schema design | `role-architect` |
| SurrealDB PR review | `role-code-review` |

## Verification Checklist

- [ ] All tables have explicit PERMISSIONS (not relying on defaults)
- [ ] All queries use parameterized `$variables` (no string concatenation)
- [ ] Passwords hashed with `crypto::argon2::generate()`
- [ ] SCHEMAFULL used for tables with sensitive data
- [ ] ASSERT validation on critical fields
- [ ] Indexes on frequently queried fields
- [ ] Graph traversals have depth limits and filters
- [ ] LIVE queries include permission WHERE clauses
- [ ] Connection pooling (no new connection per request)
- [ ] All LIVE subscriptions have cleanup (`db.kill(uuid)`)
- [ ] SESSION expiration ≤2h for record users
- [ ] Network restricted: `--allow-net`, `--deny-net`
- [ ] No credentials in code (environment variables)
- [ ] Tests pass; RBAC and row-level security tested
- [ ] Security advisories reviewed for current version

**Resources:** [Security Advisories](https://github.com/surrealdb/surrealdb/security) | [Docs](https://surrealdb.com/docs/surrealdb/security)
