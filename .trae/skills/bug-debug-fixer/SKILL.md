---
name: "bug-debug-fixer"
description: "Systematic methodology for elegantly locating bugs, precisely fixing them, and applying fixes broadly across the codebase (举一反三). Invoke when user encounters errors/bugs, asks for debugging help, or wants to fix issues systematically."
---

# Bug Debug Fixer — 优雅锁定报错、精准修复、举一反三

This skill provides a **complete systematic methodology** for debugging: from error localization to precise fixing to broad application of the fix pattern across the entire project.

## When to Invoke

- User reports an error/bug/crash and needs help fixing it
- User asks how to debug a specific issue
- User wants to fix bugs in a systematic way (not just patching one spot)
- User mentions "举一反三" or applying a fix pattern broadly
- Code shows error-prone patterns that need proactive fixing

## Phase 1: Lock Down the Error (五层递进定位法)

### Layer 1: Quick Localization via Stack Trace

**Core Principle**: Never look only at the last line of the traceback. Read the FULL stack.

```
Traceback (most recent call last):
  File "app.py", line 23, in main
    data = process_data(get_user())     # ← Cause: passed None
  File "app.py", line 45, in process_data
    result = user['name']               # ← Symptom: crash point
  File "db.py", line 89, in get_user
    return db.query(...)[0]             # ← Root Cause: returns None on no result
TypeError: 'NoneType' object is not subscriptable
```

**Key Techniques**:
- Read stack **bottom-up**, asking "where did this value come from" at each layer
- Distinguish **Symptom** (crash site) vs **Root Cause** (origin of bad value)
- Follow exception chains (`raise ... from e`) for full context

### Layer 2: Reproduction — Minimize Problem Space

| Dimension | Action |
|-----------|--------|
| **Input** | Reduce to minimal reproducible input (remove irrelevant fields) |
| **Environment** | Eliminate version/config/dependency differences |
| **Steps** | Record every step precisely as an executable script |
| **Frequency** | Determine if it's 100% reproducible or intermittent |

> Intermittent bugs usually involve concurrency, timing, or resource races

### Layer 3: Root Cause Analysis — 5 Whys Method

```
Phenomenon: User login fails
  ↓ Why 1? → Returns HTTP 403
  ↓ Why 2? → Token validation fails
  ↓ Why 3? → Token expiry time calculated wrong
  ↓ Why 4? → Used milliseconds instead of seconds
  ↓ Why 5? → Copy-paste unit confusion    ← 🔑 ROOT CAUSE!
```

**Rules**:
- Every "Why" must be backed by **code/log evidence**
- Don't stop at surface causes ("returned None") — ask "WHY did it return None"
- Sometimes root cause is at the **design level**, not code level

### Layer 4: Impact Assessment — Prevent New Bugs from Fix

Before fixing, MUST answer:
- ✅ **Same-pattern code**: Are there identical patterns elsewhere?
- ✅ **Upstream/downstream dependencies**: Does fix break caller contracts?
- ✅ **Edge cases**: Null, overflow, extreme inputs covered?
- ✅ **Performance impact**: Does fix introduce regression?

### Layer 5: Classify & Archive — Prepare for Broad Application

| Bug Type | Characteristics | Examples |
|----------|-----------------|---------|
| 🔴 **Logic Error** | Condition/algorithm defect | `>` vs `>=` off-by-one |
| 🟡 **Boundary Omission** | Null/unbound/concurrent | Unwrap on `None`, array OOB |
| 🟢 **Type/State Mismatch** | Wrong type / invalid state | Expected `str` got `int` |
| 🔵 **Environment/Dependency** | Config/version/external | Third-party API change |

---

## Phase 2: Precise Fixing Core Principles

### Principle 1: Minimal Change (最小改动原则)

```python
# ❌ Over-refactoring — too much change, uncontrollable risk
def process_order(order):
    # Rewrote entire function... 50 lines changed
    pass

# ✅ Precise fix — change ONLY the problematic line
def process_order(order):
    if order is None:          # NEW: defensive check (only change)
        raise ValueError("Order cannot be None")
    # All other logic unchanged
```

### Principle 2: Three-Stage Fix Strategy

```
┌─────────────────────────────────────────────┐
│ Stage 1: Hotfix (应急修复)                   │
│   → Add defensive check / fallback logic     │
│   → Restore service availability quickly     │
│   → Goal: Stop bleeding                      │
├─────────────────────────────────────────────┤
│ Stage 2: Root Fix (根治修复)                  │
│   → Find true cause and correct design       │
│   → Add unit tests to prevent regression     │
│   Goal: Cure the disease                     │
├─────────────────────────────────────────────┤
│ Stage 3: Systematic Fix (举一反三)            │
│   → Search entire project for same pattern   │
│   → Unified fix + comprehensive tests        │
│   Goal: Prevent same class of bug forever    │
└─────────────────────────────────────────────┘
```

### Principle 3: Fix Must Come With Test (修复即测试)

```python
# EVERY fix MUST be accompanied by test case(s)

# Step 1: Write failing test first (reproduce the bug)
def test_empty_user_should_not_crash():
    """Reproduces bug — should FAIL before fix"""
    result = process_user(None)
    assert result == "default_value"

# Step 2: Apply the fix
def process_user(user):
    if user is None:
        return "default_value"
    return user.name

# Step 3: Test passes = bug is truly fixed
```

---

## Phase 3: Broad Application — 举一反三 (The Most Critical Step)

### Method 1: Global Search for Same Pattern

After finding ONE bug, **immediately search for the SAME anti-pattern project-wide**:

```bash
# Example: after finding one "== None" issue
grep -rn "== None" --include="*.py" .
grep -rn "\.get(\)\[" --include="*.py" .      # Potential KeyError
grep -rn "\.unwrap()" --include="*.rs" .       # Potential panic in Rust
grep -rn "TODO\|FIXME\|HACK" --include="*.rs" . # Technical debt markers
```

Use language-appropriate search tools:
- **Rust**: `cargo clippy -- -W clippy::unwrap_used`
- **Python**: `mypy --strict`, `pylint`
- **TypeScript**: `eslint`, `tsc --noImplicitAny`
- **General**: `ripgrep`, IDE's "Find in Files"

### Method 2: Build Bug Pattern Knowledge Base

| Bug Pattern | Trigger Condition | Universal Fix | Prevention |
|-------------|-------------------|---------------|------------|
| **Null/None Crash** | Function may return null | Optional type + defensive check | Type annotations + static analysis |
| **KeyError/IndexError** | Container access without validation | `.get()` / `get_or_default` | Unified container access wrapper |
| **Data Race** | Shared state without lock protection | Mutex/RwLock / atomic ops | Code Review Checklist |
| **Resource Leak** | Unclosed connections/files | Context Manager (`with`/RAII) | Linter rules + Drop checker |
| **Integer Overflow** | Unbounded arithmetic | saturating/checked operations | Safe math libraries |
| **Unhandled Enum Variant** | Incomplete match/if-else | `_ => unreachable!()` or fallback | `#[non_exhaustive]` + exhaustive matching |

### Method 3: Single-to-Broad Fix Flowchart

```
Discover Single Bug
       │
       ▼
┌───────────────────┐
│ ① Locate root cause code │
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐     ┌────────────────────┐
│ ② Extract Bug Pattern │────▶│ ③ Global search for same pattern │
└─────────┬─────────┘     └─────────┬──────────┘
          │                         │
          ▼                         ▼
┌───────────────────┐     ┌────────────────────┐
│ ④ Write precise patch │     │ ⑤ List all affected points │
└─────────┬─────────┘     └─────────┬──────────┘
          │                         │
          └──────────┬──────────────┘
                     ▼
          ┌──────────────────────────┐
          │ ⑥ Unified fix + add tests │
          └────────────┬─────────────┘
                     ▼
          ┌──────────────────────────┐
          │ ⑦ Update CR rules / Lint rules │ ← 举一反三: prevent recurrence
          └──────────────────────────┘
```

### Method 4: Practical Case Study

**Scenario: Database query unwrap causing Option panic**

```rust
// ❌ Buggy code: Option not handled
fn get_user_info(conn: &Connection, user_id: i64) -> UserInfo {
    let row = conn.query_row(
        "SELECT name, email FROM users WHERE id = ?1",
        params![user_id],
        |row| Ok((row.get(0)?, row.get(1)?))
    ); // query_row returns Result<Option<...>>
    let (name, email) = row.unwrap(); // PANIC when no result!
    UserInfo { name, email }
}

// ✅ Stage 1 - Hotfix (stop bleeding): Add defense
fn get_user_info(conn: &Connection, user_id: i64) -> Option<UserInfo> {
    conn.query_row(
        "SELECT name, email FROM users WHERE id = ?1",
        params![user_id],
        |row| Ok(UserInfo {
            name: row.get(0)?,
            email: row.get(1)?,
        })
    ).ok() // Safe conversion: Err/None → None
}

// ✅ Stage 2-3 - 举一反三: After global search, extract into utility trait
trait QueryExt {
    fn query_one<T, F>(&self, sql: &str, params: &[&dyn ToSql], mapper: F) -> Option<T>
    where F: FnOnce(&Row) -> rusqlite::Result<T>;
}

impl QueryExt for Connection {
    fn query_one<T, F>(&self, sql: &str, params: &[&dyn ToSql], mapper: F) -> Option<T>
    where F: FnOnce(&Row) -> rusqlite::Result<T> {
        self.query_row(sql, params, mapper).ok()
    }
}

// All call sites now use unified safe method — no more bare unwrap()
let user = conn.query_one("SELECT name, email FROM users WHERE id = ?1",
    params![user_id],
    |row| Ok(UserInfo { name: row.get(0)?, email: row.get(1)? })
);
```

---

## Debugging Toolchain Recommendations

| Tool | Best For | When to Use |
|------|----------|-------------|
| **Structured logging + error codes** | Production troubleshooting | During service operation |
| **Debugger (breakpoint)** | Local complex logic tracing | Development phase reproduction |
| **Static analysis (clippy/mypy/eslint)** | Proactive anti-pattern detection | CI/CD pipeline |
| **Unit + boundary + property tests** | Regression prevention | After EVERY fix |
| **Git Bisect** | Locate first bad commit | Hard-to-reproduce historical bugs |
| **Sanitizer (ASan/TSan)** | Memory/thread issue detection | C/C++/Rust projects |

## Response Format

When invoked, follow this structure:

1. **Error Analysis**: Apply 5-layer method to locate root cause
2. **Fix Proposal**: Present minimal-change fix following 3-stage strategy
3. **Broad Application**: Search project-wide for same pattern, propose unified solution
4. **Test Plan**: Specify what tests to write to prevent regression
5. **Prevention Measures**: Suggest lint rules/code review checks to prevent recurrence

## Mnemonic Summary

> **一看堆栈二复现，五问根因找本源**
> **最小改动先止血，修复务必配测试**
> **全局搜索同类项，抽象提取防再犯**
> **知识沉淀成规范，举一反三是终点**

Translation:
> 1. Read stack trace fully, then reproduce reliably; ask "why" 5 times to find true root cause
> 2. Change as little as possible to stop bleeding first; always pair fix with test
> 3. Search globally for same anti-pattern; abstract into reusable solution to prevent recurrence
> 4. Solidify knowledge into standards/rules; broad application is the ultimate goal
