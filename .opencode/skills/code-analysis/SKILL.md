# Code Analysis & Review

> Specialized skill for deep code analysis, dependency tracing, and architecture review.

## Triggers

- analyze code
- review architecture
- find dependencies
- trace calls
- code analysis
- grafo de conocimiento
- analizar código
- revisar arquitectura

## Instructions

When performing code analysis, follow these steps:

1. Use the graph memory to understand the project structure first (graph_overview)
2. Search for the specific component by name (graph_search)
3. Trace relationships with depth 2 (graph_related)
4. Read only the specific ranges needed (graph_read_range)
5. Summarize findings using compact representation (graph_compact)

Focus on:
- Entry points and public APIs
- Data flow between components
- Dependency direction and cycles
- Architectural patterns in use
- Potential refactoring opportunities

## Tools

- graph_search
- graph_related
- graph_compact
- graph_read_range
- graph_callers
- graph_dependencies
- graph_path
