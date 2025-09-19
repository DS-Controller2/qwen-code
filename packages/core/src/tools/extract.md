# Extract Tool

The extract tool is a versatile codebase analysis utility designed to parse and extract specific elements from source code files without requiring users to read entire files or write complex regex patterns.

## Usage

```
extract({
  type: "comments" | "functions" | "classes" | "imports" | "variables" | "types",
  file: "path/to/source/file.js",
  files: ["path/to/file1.js", "path/to/file2.js"], // Optional: multiple files
  format: "list" | "tree" | "json" | "summary", // Output format
  language: "javascript" | "python" | "typescript" | "java" | "go", // Auto-detect if omitted
  includeDocstrings: true | false, // For languages that support them
  includeSignatures: true | false, // Include function signatures with parameters
})
```

## Parameters

- `type` (required): The type of element to extract
  - `comments`: Extracts single-line and multi-line comments
  - `functions`: Extracts function and method definitions
  - `classes`: Extracts class definitions
  - `imports`: Extracts import and export statements
  - `variables`: Extracts variable declarations
  - `types`: Extracts type, interface, and enum definitions

- `file`: Path to a single source file to extract from

- `files`: Array of paths to multiple source files to extract from

- `format`: Output format for the extracted elements
  - `list` (default): Simple array of extracted elements
  - `tree`: Hierarchical representation showing relationships
  - `json`: Structured data with metadata (line numbers, types, etc.)
  - `summary`: High-level overview with counts and key information

- `language`: Programming language of the source file
  - `javascript`
  - `python`
  - `typescript`
  - `java`
  - `go`
  - If omitted, the language is auto-detected based on file extension

- `includeDocstrings`: Include docstrings in the output (for languages that support them)

- `includeSignatures`: Include function signatures with parameters

## Examples

### Extract comments from a JavaScript file

```
extract({
  type: "comments",
  file: "src/index.js"
})
```

### Extract functions from multiple TypeScript files in JSON format

```
extract({
  type: "functions",
  files: ["src/utils.ts", "src/helpers.ts"],
  format: "json",
  language: "typescript"
})
```

### Extract classes from a Python file with docstrings

```
extract({
  type: "classes",
  file: "models.py",
  includeDocstrings: true
})
```

## Supported Languages

- JavaScript
- TypeScript
- Python
- Java
- Go

## Output Formats

### List Format

Simple list of extracted elements with their names and line numbers.

### Tree Format

Hierarchical representation showing relationships between elements.

### JSON Format

Structured data with metadata including line numbers, types, and content.

### Summary Format

High-level overview with counts and key information about extracted elements.

## Benefits

- More efficient than reading full files
- More reliable than regex pattern matching
- Provides structured data for further analysis
- Language-aware parsing for accuracy
- Reduces boilerplate code for common analysis tasks
