# Agent Dataflow Analysis Enhancement Proposal

> **Status**: ✅ CodeQL Integration Implemented (2026-01-29)

## Current Limitations

### Semgrep OSS
- ❌ No inter-procedural analysis
- ❌ No cross-file taint tracking
- ❌ No dataflow across function calls
- ❌ `--dataflow-traces` flag is **Pro-only** (does not work with OSS)
- ✅ Pattern matching only
- ✅ Single-file taint (limited)

### What We Need
- ✅ Full taint analysis: source → sink tracking
- ✅ Inter-procedural: track data through function calls
- ✅ Cross-file: track data across imports/requires
- ✅ Custom sources/sinks definition
- ✅ Dataflow path visualization

---

## Implemented Solution

### Solution 1: CodeQL Integration ✅ IMPLEMENTED

**Why CodeQL:**
- Free for open source
- Full interprocedural dataflow
- Supports PHP, JS, Go, Python, Java, C++
- GitHub native integration
- Custom query language

**Implementation:**

```yaml
# .github/workflows/codeql.yml
name: CodeQL Analysis
on: [push, pull_request]

jobs:
  analyze:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: github/codeql-action/init@v3
        with:
          languages: php, javascript
          queries: security-extended
      - uses: github/codeql-action/analyze@v3
```

**Custom Taint Query Example (PHP):**

```ql
// queries/sql-injection.ql
import php
import semmle.code.php.security.SqlInjectionQuery

from SqlInjection::Sink sink, SqlInjection::Source source, DataFlow::PathNode sourceNode, DataFlow::PathNode sinkNode
where SqlInjection::flowPath(source, sourceNode, sink, sinkNode)
select sink, sourceNode, sinkNode,
  "SQL injection from $@ to $@.",
  source, source.toString(),
  sink, sink.toString()
```

**SDK Integration (Implemented):**

```go
import "github.com/openctemio/sdk-go/pkg/scanners"

// Use language-specific preset
scanner := scanners.CodeQLGo()
scanner.Verbose = true

// Or configure manually
scanner := scanners.CodeQLWithConfig(scanners.CodeQLOptions{
    Language:    codeql.LanguageGo,
    QueryPack:   "codeql/go-queries:security-extended",
    CreateDB:    true,
    DatabaseDir: "/tmp/codeql-db",
})

// Scan and get findings with full dataflow
result, err := scanner.Scan(ctx, "/path/to/code", nil)

// Each finding includes DataFlow with:
// - Sources (taint entry points)
// - Intermediates (propagation steps)
// - Sinks (vulnerable function calls)
// - CallPath (function call chain)
// - CrossFile/Interprocedural flags
```

**Supported Languages:**

| Language | Preset Function | Query Pack |
|----------|-----------------|------------|
| Go | `scanners.CodeQLGo()` | `codeql/go-queries` |
| Java | `scanners.CodeQLJava()` | `codeql/java-queries` |
| JavaScript/TypeScript | `scanners.CodeQLJavaScript()` | `codeql/javascript-queries` |
| Python | `scanners.CodeQLPython()` | `codeql/python-queries` |
| C/C++ | `scanners.CodeQLCPP()` | `codeql/cpp-queries` |

**Implementation Files:**

| File | Purpose |
|------|---------|
| `sdk/pkg/scanners/codeql/types.go` | SARIF types for CodeQL output |
| `sdk/pkg/scanners/codeql/scanner.go` | Scanner with DB creation and analysis |
| `sdk/pkg/scanners/codeql/parser.go` | Parser with full dataflow extraction |
| `sdk/pkg/scanners/registry.go` | CodeQL presets registration |

---

## Alternative Solutions (Not Yet Implemented)

### Solution 2: Joern (Open Source)

**Why Joern:**
- Fully open source
- Code Property Graph (CPG)
- Supports C/C++, Java, PHP, JS, Python, Go
- Powerful query language (Scala)

**Setup:**

```bash
# Install Joern
curl -L "https://github.com/joernio/joern/releases/latest/download/joern-install.sh" | bash

# Create CPG
joern-parse /path/to/code --language php

# Query for dataflow
joern> def source = cpg.call.name(".*input.*")
joern> def sink = cpg.call.name(".*query.*|.*exec.*")
joern> sink.reachableBy(source).l
```

**Agent Integration:**

```go
// internal/agents/joern/agent.go
type JoernAgent struct {
    JoernPath string
}

func (a *JoernAgent) FindDataflows(target string, sources, sinks []string) ([]DataflowPath, error) {
    // 1. Generate CPG
    cpgPath := a.generateCPG(target)

    // 2. Run dataflow query
    query := fmt.Sprintf(`
        def sources = cpg.call.name("%s")
        def sinks = cpg.call.name("%s")
        sinks.reachableBy(sources).path.l
    `, strings.Join(sources, "|"), strings.Join(sinks, "|"))

    return a.executeQuery(cpgPath, query)
}
```

---

### Solution 3: Hybrid Approach (Semgrep + Custom Taint Engine)

Build custom taint tracker on top of Semgrep:

```go
// internal/agents/taint/engine.go
package taint

type TaintEngine struct {
    Sources   []SourcePattern
    Sinks     []SinkPattern
    Sanitizers []SanitizerPattern
}

type DataflowPath struct {
    Source    Location
    Sink      Location
    Path      []Location
    Variables []string
    Tainted   bool
}

// PHP-specific taint sources
var PHPSources = []SourcePattern{
    {Pattern: `\$_GET\[`, Name: "GET parameter"},
    {Pattern: `\$_POST\[`, Name: "POST parameter"},
    {Pattern: `\$_REQUEST\[`, Name: "REQUEST parameter"},
    {Pattern: `\$request->input\(`, Name: "Laravel input"},
    {Pattern: `\$request->get\(`, Name: "Laravel get"},
    {Pattern: `\$request->all\(`, Name: "Laravel all"},
    {Pattern: `\$request->header\(`, Name: "HTTP header"},
}

// PHP-specific sinks
var PHPSinks = []SinkPattern{
    {Pattern: `->whereRaw\(`, Name: "SQL injection", CWE: "CWE-89"},
    {Pattern: `DB::raw\(`, Name: "SQL injection", CWE: "CWE-89"},
    {Pattern: `mysqli_query\(`, Name: "SQL injection", CWE: "CWE-89"},
    {Pattern: `->query\(`, Name: "SQL injection", CWE: "CWE-89"},
    {Pattern: `eval\(`, Name: "Code injection", CWE: "CWE-94"},
    {Pattern: `exec\(`, Name: "Command injection", CWE: "CWE-78"},
    {Pattern: `system\(`, Name: "Command injection", CWE: "CWE-78"},
    {Pattern: `shell_exec\(`, Name: "Command injection", CWE: "CWE-78"},
    {Pattern: `file_get_contents\(`, Name: "SSRF", CWE: "CWE-918"},
    {Pattern: `include\(`, Name: "File inclusion", CWE: "CWE-98"},
    {Pattern: `unserialize\(`, Name: "Deserialization", CWE: "CWE-502"},
}

func (e *TaintEngine) Analyze(files []string) ([]DataflowPath, error) {
    var paths []DataflowPath

    for _, file := range files {
        ast := parseFile(file)
        cfg := buildCFG(ast)

        // Forward taint propagation
        taintedVars := e.findSources(ast)

        // Track through assignments and function calls
        for _, tvar := range taintedVars {
            propagated := e.propagateTaint(cfg, tvar)

            // Check if tainted data reaches sinks
            for _, sink := range e.findSinks(ast) {
                if e.reaches(propagated, sink) {
                    paths = append(paths, DataflowPath{
                        Source: tvar.Location,
                        Sink:   sink.Location,
                        Path:   e.buildPath(cfg, tvar, sink),
                    })
                }
            }
        }
    }

    return paths, nil
}
```

---

### Solution 4: Semgrep Pro API

If budget allows:

```go
// internal/agents/semgrep/pro.go
type SemgrepProAgent struct {
    APIToken string
    OrgSlug  string
}

func (a *SemgrepProAgent) ScanWithDataflow(target string) (*Report, error) {
    // Upload to Semgrep Cloud
    // Returns full dataflow analysis
    resp, _ := http.Post("https://semgrep.dev/api/v1/deployments/"+a.OrgSlug+"/scans", ...)

    // Poll for results with dataflow paths
    return a.pollResults(resp.ScanID)
}
```

---

## Recommended Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Security Agent                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │   Semgrep   │  │   CodeQL    │  │   Custom Taint      │ │
│  │   (OSS)     │  │   (Free)    │  │   Engine            │ │
│  │             │  │             │  │                     │ │
│  │ - Patterns  │  │ - Full DF   │  │ - PHP/JS specific   │ │
│  │ - Secrets   │  │ - SARIF     │  │ - Fast              │ │
│  │ - Config    │  │ - CI/CD     │  │ - Customizable      │ │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘ │
│         │                │                     │            │
│         └────────────────┼─────────────────────┘            │
│                          ▼                                  │
│              ┌───────────────────────┐                      │
│              │   Result Aggregator   │                      │
│              │   - Deduplicate       │                      │
│              │   - Correlate paths   │                      │
│              │   - Enrich findings   │                      │
│              └───────────┬───────────┘                      │
│                          ▼                                  │
│              ┌───────────────────────┐                      │
│              │   CTIS Report Output   │                      │
│              │   (with dataflow)     │                      │
│              └───────────────────────┘                      │
└─────────────────────────────────────────────────────────────┘
```

---

## Implementation Priority

| Priority | Solution | Effort | Coverage | Cost | Status |
|----------|----------|--------|----------|------|--------|
| 1 | CodeQL Integration | Medium | High | Free | ✅ **DONE** |
| 2 | Custom Taint Engine | High | Medium | Free | ⏳ Future |
| 3 | Joern Integration | Medium | High | Free | ⏳ Future |
| 4 | Semgrep Pro | Low | Very High | Paid | ⏳ Future |

---

## CTIS Schema Extension for Dataflow

```go
// pkg/parsers/ctis/finding.go
type Finding struct {
    // ... existing fields ...

    // New dataflow fields
    Dataflow *Dataflow `json:"dataflow,omitempty"`
}

type Dataflow struct {
    Source      DataflowNode   `json:"source"`
    Sink        DataflowNode   `json:"sink"`
    Path        []DataflowNode `json:"path"`
    Tainted     bool           `json:"tainted"`
    Sanitizers  []DataflowNode `json:"sanitizers,omitempty"`
}

type DataflowNode struct {
    File     string `json:"file"`
    Line     int    `json:"line"`
    Column   int    `json:"column"`
    Code     string `json:"code"`
    Variable string `json:"variable,omitempty"`
    Type     string `json:"type"` // source, sink, propagator, sanitizer
}
```

---

## Quick Win: CodeQL Setup Script

```bash
#!/bin/bash
# scripts/setup-codeql.sh

# Download CodeQL CLI
wget https://github.com/github/codeql-cli-binaries/releases/latest/download/codeql-linux64.zip
unzip codeql-linux64.zip

# Download CodeQL queries
git clone --depth 1 https://github.com/github/codeql.git codeql-queries

# Add to PATH
export PATH="$PWD/codeql:$PATH"

# Create database for PHP project
codeql database create php-db --language=php --source-root=/path/to/code

# Run security queries
codeql database analyze php-db \
    codeql-queries/php/ql/src/Security \
    --format=sarif-latest \
    --output=results.sarif
```

---

## Next Steps

1. ~~**Immediate**: Set up CodeQL in CI/CD~~ ✅ SDK scanner available
2. ~~**Short-term**: Build CTIS adapter for CodeQL SARIF output~~ ✅ Parser implemented
3. **Medium-term**: Develop custom taint engine for unsupported languages
4. **Long-term**: Consider Semgrep Pro if budget allows

---

## Implementation History

### 2026-01-29: CodeQL Integration Complete

**What was implemented:**
- Full CodeQL scanner with database creation and analysis
- SARIF parser with complete dataflow extraction from `codeFlows`
- Language-specific presets (Go, Java, JavaScript, Python, C++)
- Integration with CTIS schema for dataflow storage

**Key features:**
- Inter-procedural taint tracking
- Cross-file dataflow analysis
- Call path extraction
- Source/sink/sanitizer categorization
- Automatic ThreadFlow parsing

**Related documentation:**
- [Data Flow Tracking Feature](features/data-flow-tracking.md)
- [Data Flow Analysis Guide](guides/data-flow-analysis.md)
