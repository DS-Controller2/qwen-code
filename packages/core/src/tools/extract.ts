/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import path from 'node:path';
import type { ToolInvocation, ToolResult } from './tools.js';
import { BaseDeclarativeTool, BaseToolInvocation, Kind } from './tools.js';
import { makeRelative, shortenPath } from '../utils/paths.js';
import type { Config } from '../config/config.js';
import { ToolErrorType } from './tool-error.js';
import { processSingleFileContent } from '../utils/fileUtils.js';

/**
 * Parameters for the ExtractTool
 */
export interface ExtractToolParams {
  /**
   * The type of element to extract
   */
  type:
    | 'comments'
    | 'functions'
    | 'classes'
    | 'imports'
    | 'variables'
    | 'types';

  /**
   * The path to the source file
   */
  file?: string;

  /**
   * Optional: multiple files
   */
  files?: string[];

  /**
   * Output format
   */
  format?: 'list' | 'tree' | 'json' | 'summary';

  /**
   * Language of the source file (auto-detected if omitted)
   */
  language?: 'javascript' | 'python' | 'typescript' | 'java' | 'go';

  /**
   * Include docstrings in the output
   */
  includeDocstrings?: boolean;

  /**
   * Include function signatures with parameters
   */
  includeSignatures?: boolean;
}

interface ExtractedElement {
  type: string;
  name: string;
  line: number;
  content: string;
  [key: string]: string | number | boolean; // For additional properties
}

// Export all extraction functions for testing
export {
  extractComments,
  extractFunctions,
  extractClasses,
  extractImports,
  extractVariables,
  extractTypes,
};

// Simple language detection based on file extension
function detectLanguage(filePath: string): string | null {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.js':
    case '.jsx':
      return 'javascript';
    case '.ts':
    case '.tsx':
      return 'typescript';
    case '.py':
      return 'python';
    case '.java':
      return 'java';
    case '.go':
      return 'go';
    default:
      return null;
  }
}

// Extract comments from source code
function extractComments(
  content: string,
  language: string,
): ExtractedElement[] {
  const comments: ExtractedElement[] = [];
  const lines = content.split('\n');

  // Simple regex patterns for different languages
  let singleLineComment: RegExp;
  let multiLineCommentStart: RegExp;
  let multiLineCommentEnd: RegExp;

  switch (language) {
    case 'javascript':
    case 'typescript':
      singleLineComment = /\/\/(.*)/;
      multiLineCommentStart = /\/\*(.*)/;
      multiLineCommentEnd = /(.*?)\*\//;
      break;
    case 'python':
      singleLineComment = /#(.*)/;
      multiLineCommentStart = /('''|""")(.*)/;
      multiLineCommentEnd = /(.*?)('''|""")/;
      break;
    case 'java':
      singleLineComment = /\/\/(.*)/;
      multiLineCommentStart = /\/\*(.*)/;
      multiLineCommentEnd = /(.*?)\*\//;
      break;
    case 'go':
      singleLineComment = /\/\/(.*)/;
      multiLineCommentStart = /\/\*(.*)/;
      multiLineCommentEnd = /(.*?)\*\//;
      break;
    default:
      return [];
  }

  let inMultiLineComment = false;
  let multiLineContent = '';
  let multiLineStartLine = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNumber = i + 1;

    if (inMultiLineComment) {
      multiLineContent += '\n' + line;
      const multiLineEndMatch = line.match(multiLineCommentEnd);
      if (multiLineEndMatch) {
        inMultiLineComment = false;
        comments.push({
          type: 'multi-line-comment',
          name: `Comment at line ${multiLineStartLine}`,
          line: multiLineStartLine,
          content: multiLineContent,
        });
        multiLineContent = '';
      }
    } else {
      // Check for single line comments
      const singleLineMatch = line.match(singleLineComment);
      if (singleLineMatch) {
        comments.push({
          type: 'single-line-comment',
          name: `Comment at line ${lineNumber}`,
          line: lineNumber,
          content: singleLineMatch[1].trim(),
        });
      }

      // Check for multi-line comment start
      const multiLineStartMatch = line.match(multiLineCommentStart);
      if (multiLineStartMatch) {
        inMultiLineComment = true;
        multiLineStartLine = lineNumber;
        multiLineContent = multiLineStartMatch[1] || '';

        // Check if it ends on the same line
        const multiLineEndMatch = line.match(multiLineCommentEnd);
        if (multiLineEndMatch) {
          inMultiLineComment = false;
          comments.push({
            type: 'multi-line-comment',
            name: `Comment at line ${multiLineStartLine}`,
            line: multiLineStartLine,
            content: multiLineContent,
          });
          multiLineContent = '';
        }
      }
    }
  }

  return comments;
}

// Extract functions from source code
function extractFunctions(
  content: string,
  language: string,
): ExtractedElement[] {
  const functions: ExtractedElement[] = [];
  const lines = content.split('\n');

  // Regex patterns for function definitions in different languages
  let functionPatterns: RegExp[] = [];

  switch (language) {
    case 'javascript':
    case 'typescript':
      // Match function declarations, arrow functions, and methods
      functionPatterns = [
        /function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\([^)]*\)\s*\{/, // function name() {}
        /([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*function\s*\([^)]*\)\s*\{/, // name = function() {}
        /([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*\([^)]*\)\s*=>/, // name = () => {}
        /([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\([^)]*\)\s*\{/, // name() {} (method)
        /\b([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:\s*function\s*\([^)]*\)\s*\{/, // name: function() {}
      ];
      break;
    case 'python':
      // Match function and method definitions
      functionPatterns = [
        /def\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\([^)]*\)\s*:/, // def name():
      ];
      break;
    case 'java':
      // Match method definitions (simplified)
      functionPatterns = [
        /(public|private|protected)?\s*(static)?\s*\w+\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\([^)]*\)\s*\{/,
      ];
      break;
    case 'go':
      // Match function definitions
      functionPatterns = [
        /func\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\([^)]*\)\s*\w*/, // func name()
      ];
      break;
    default:
      return [];
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNumber = i + 1;

    for (const pattern of functionPatterns) {
      const match = line.match(pattern);
      if (match) {
        // Extract function name (depends on the pattern)
        let functionName = '';
        if (language === 'javascript' || language === 'typescript') {
          if (match[1] && match[1] !== 'function') {
            functionName = match[1];
          } else if (match[2]) {
            functionName = match[2];
          } else if (match[3]) {
            functionName = match[3];
          }
        } else if (language === 'python' || language === 'go') {
          functionName = match[1];
        } else if (language === 'java') {
          functionName = match[3];
        }

        if (functionName) {
          functions.push({
            type: 'function',
            name: functionName,
            line: lineNumber,
            content: line.trim(),
          });
        }
        break; // Only match the first pattern that fits
      }
    }
  }

  return functions;
}

// Extract classes from source code
function extractClasses(content: string, language: string): ExtractedElement[] {
  const classes: ExtractedElement[] = [];
  const lines = content.split('\n');

  // Regex patterns for class definitions in different languages
  let classPatterns: RegExp[] = [];

  switch (language) {
    case 'javascript':
    case 'typescript':
      // Match class declarations
      classPatterns = [/class\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/];
      break;
    case 'python':
      // Match class definitions
      classPatterns = [/class\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(?.*\)?\s*:/];
      break;
    case 'java':
      // Match class definitions
      classPatterns = [
        /(public|private)?\s*class\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/,
      ];
      break;
    case 'go':
      // Go doesn't have classes in the traditional sense, but we can match struct definitions
      classPatterns = [/type\s+([a-zA-Z_][a-zA-Z0-9_]*)\s+struct\s*\{/];
      break;
    default:
      return [];
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNumber = i + 1;

    for (const pattern of classPatterns) {
      const match = line.match(pattern);
      if (match) {
        // Extract class name (depends on the pattern)
        let className = '';
        if (
          language === 'javascript' ||
          language === 'typescript' ||
          language === 'python' ||
          language === 'java'
        ) {
          className = match[1] || match[2];
        } else if (language === 'go') {
          className = match[1];
        }

        if (className) {
          classes.push({
            type: 'class',
            name: className,
            line: lineNumber,
            content: line.trim(),
          });
        }
        break; // Only match the first pattern that fits
      }
    }
  }

  return classes;
}

// Extract imports/exports from source code
function extractImports(content: string, language: string): ExtractedElement[] {
  const imports: ExtractedElement[] = [];
  const lines = content.split('\n');

  // Regex patterns for import/export statements in different languages
  let importPatterns: RegExp[] = [];

  switch (language) {
    case 'javascript':
    case 'typescript':
      // Match import and export statements
      importPatterns = [
        /import\s+.*from\s+['"](.*)['"]/,
        /import\s+['"](.*)['"]/,
        /export\s+(default\s+)?(class|function|const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/,
        /export\s+{.*}/,
        /require\(['"](.*)['"]\)/,
      ];
      break;
    case 'python':
      // Match import statements
      importPatterns = [
        /import\s+([a-zA-Z_][a-zA-Z0-9_.]*)/,
        /from\s+([a-zA-Z_][a-zA-Z0-9_.]*)\s+import\s+.*/,
      ];
      break;
    case 'java':
      // Match import statements
      importPatterns = [/import\s+([a-zA-Z0-9_.*]+)/];
      break;
    case 'go':
      // Match import statements
      importPatterns = [
        /import\s+['"](.*)['"]/,
        /import\s+\([^)]*\)/s, // Multi-line import block
      ];
      break;
    default:
      return [];
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNumber = i + 1;

    for (const pattern of importPatterns) {
      const match = line.match(pattern);
      if (match) {
        // Extract import name/module (depends on the pattern)
        let importName = '';
        if (match[1]) {
          importName = match[1];
        } else if (match[3]) {
          importName = match[3];
        }

        // If we didn't get a specific name, use the whole line
        if (!importName) {
          importName = line.trim();
        }

        imports.push({
          type: 'import',
          name: importName,
          line: lineNumber,
          content: line.trim(),
        });
        break; // Only match the first pattern that fits
      }
    }
  }

  return imports;
}

// Extract variables from source code
function extractVariables(
  content: string,
  language: string,
): ExtractedElement[] {
  const variables: ExtractedElement[] = [];
  const lines = content.split('\n');

  // Regex patterns for variable declarations in different languages
  let variablePatterns: RegExp[] = [];

  switch (language) {
    case 'javascript':
    case 'typescript':
      // Match variable declarations
      variablePatterns = [/(const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/];
      break;
    case 'python':
      // Match variable assignments
      variablePatterns = [/^([a-zA-Z_][a-zA-Z0-9_]*)\s*=/];
      break;
    case 'java':
      // Match variable declarations
      variablePatterns = [
        /(final)?\s*(public|private|protected)?\s*\w+\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*(=|;)/,
      ];
      break;
    case 'go':
      // Match variable declarations
      variablePatterns = [
        /(var|const)\s+([a-zA-Z_][a-zA-Z0-9_]*)/,
        /([a-zA-Z_][a-zA-Z0-9_]*)\s*:=/,
      ];
      break;
    default:
      return [];
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNumber = i + 1;

    // Skip lines that are likely not variable declarations
    if (
      line.trim().startsWith('import') ||
      line.trim().startsWith('function') ||
      line.trim().startsWith('class') ||
      line.trim().startsWith('export')
    ) {
      continue;
    }

    for (const pattern of variablePatterns) {
      const match = line.match(pattern);
      if (match) {
        // Extract variable name (depends on the pattern)
        let variableName = '';
        if (language === 'javascript' || language === 'typescript') {
          variableName = match[2];
        } else if (language === 'python' || language === 'go') {
          variableName = match[2] || match[1];
        } else if (language === 'java') {
          variableName = match[3];
        }

        if (variableName) {
          variables.push({
            type: 'variable',
            name: variableName,
            line: lineNumber,
            content: line.trim(),
          });
        }
        break; // Only match the first pattern that fits
      }
    }
  }

  return variables;
}

// Extract types from source code
function extractTypes(content: string, language: string): ExtractedElement[] {
  const types: ExtractedElement[] = [];
  const lines = content.split('\n');

  // Regex patterns for type definitions in different languages
  let typePatterns: RegExp[] = [];

  switch (language) {
    case 'javascript':
      // JavaScript doesn't have explicit type definitions, but we can match JSDoc types
      typePatterns = [
        /@typedef\s+\{[^}]+\}\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/,
        /@param\s+\{[^}]+\}\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/,
      ];
      break;
    case 'typescript':
      // Match interface, type, and enum definitions
      typePatterns = [
        /interface\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/,
        /type\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=/,
        /enum\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/,
      ];
      break;
    case 'python':
      // Match type hints and class definitions (Python classes are types)
      typePatterns = [
        /class\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(?.*\)?\s*:/,
        /from\s+typing\s+import\s+.*/,
        /import\s+typing/,
      ];
      break;
    case 'java':
      // Match interface and enum definitions
      typePatterns = [
        /interface\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/,
        /enum\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/,
      ];
      break;
    case 'go':
      // Match type definitions
      typePatterns = [/type\s+([a-zA-Z_][a-zA-Z0-9_]*)\s+(interface|struct)/];
      break;
    default:
      return [];
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNumber = i + 1;

    for (const pattern of typePatterns) {
      const match = line.match(pattern);
      if (match) {
        // Extract type name (depends on the pattern)
        let typeName = '';
        if (match[1]) {
          typeName = match[1];
        } else {
          // For some patterns, we use the whole line
          typeName = line.trim();
        }

        if (typeName) {
          types.push({
            type: 'type',
            name: typeName,
            line: lineNumber,
            content: line.trim(),
          });
        }
        break; // Only match the first pattern that fits
      }
    }
  }

  return types;
}

class ExtractToolInvocation extends BaseToolInvocation<
  ExtractToolParams,
  ToolResult
> {
  constructor(
    private config: Config,
    params: ExtractToolParams,
  ) {
    super(params);
  }

  getDescription(): string {
    const files =
      this.params.files || (this.params.file ? [this.params.file] : []);
    const fileCount = files.length;
    const fileDescription =
      fileCount > 1
        ? `${fileCount} files`
        : files[0]
          ? shortenPath(makeRelative(files[0], this.config.getTargetDir()))
          : 'unknown file';

    return `Extracting ${this.params.type} from ${fileDescription}`;
  }

  async execute(_signal: AbortSignal): Promise<ToolResult> {
    try {
      // Validate files
      const files =
        this.params.files || (this.params.file ? [this.params.file] : []);
      if (files.length === 0) {
        return {
          llmContent: 'No files specified for extraction',
          returnDisplay: 'No files specified',
          error: {
            message: 'No files specified for extraction',
            type: ToolErrorType.INVALID_TOOL_PARAMS,
          },
        };
      }

      // Validate and resolve file paths
      const resolvedFiles: string[] = [];
      for (const file of files) {
        const absolutePath = path.resolve(this.config.getTargetDir(), file);
        if (
          !this.config.getWorkspaceContext().isPathWithinWorkspace(absolutePath)
        ) {
          return {
            llmContent: `File path "${file}" is not within workspace`,
            returnDisplay: 'File not in workspace',
            error: {
              message: `File path "${file}" is not within workspace`,
              type: ToolErrorType.PATH_NOT_IN_WORKSPACE,
            },
          };
        }
        resolvedFiles.push(absolutePath);
      }

      // Process each file
      const results: Array<{ filePath: string; elements: ExtractedElement[] }> =
        [];

      for (const filePath of resolvedFiles) {
        // Read the file content
        const result = await processSingleFileContent(
          filePath,
          this.config.getTargetDir(),
          this.config.getFileSystemService(),
        );

        if (result.error) {
          return {
            llmContent: result.llmContent,
            returnDisplay: result.returnDisplay || 'Error reading file',
            error: {
              message: result.error,
              type: result.errorType,
            },
          };
        }

        const content =
          typeof result.llmContent === 'string' ? result.llmContent : '';

        // Detect language if not provided
        const language =
          this.params.language || detectLanguage(filePath) || 'javascript';

        // Extract elements based on type
        let elements: ExtractedElement[] = [];
        switch (this.params.type) {
          case 'comments':
            elements = extractComments(content, language);
            break;
          case 'functions':
            elements = extractFunctions(content, language);
            break;
          case 'classes':
            elements = extractClasses(content, language);
            break;
          case 'imports':
            elements = extractImports(content, language);
            break;
          case 'variables':
            elements = extractVariables(content, language);
            break;
          case 'types':
            elements = extractTypes(content, language);
            break;
          default:
            elements = [];
        }

        results.push({ filePath, elements });
      }

      // Format output based on requested format
      let output: string;
      const format = this.params.format || 'list';

      switch (format) {
        case 'json':
          output = JSON.stringify(results, null, 2);
          break;
        case 'tree':
          output = this.formatAsTree(results);
          break;
        case 'summary':
          output = this.formatAsSummary(results);
          break;
        case 'list':
        default:
          output = this.formatAsList(results);
          break;
      }

      return {
        llmContent: output,
        returnDisplay: `Extracted ${this.params.type} from ${resolvedFiles.length} file(s)`,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const rawError = `Error during extraction: ${errorMessage}`;
      return {
        llmContent: rawError,
        returnDisplay: 'Error during extraction',
        error: {
          message: rawError,
          type: ToolErrorType.UNKNOWN,
        },
      };
    }
  }

  private formatAsList(
    results: Array<{ filePath: string; elements: ExtractedElement[] }>,
  ): string {
    let output = '';

    for (const result of results) {
      const relativePath = makeRelative(
        result.filePath,
        this.config.getTargetDir(),
      );
      output += `--- ${relativePath} ---\n`;

      if (result.elements.length === 0) {
        output += 'No elements found\n';
      } else {
        for (const element of result.elements) {
          output += `${element.type}: ${element.name} (line ${element.line})\n`;
          if (element.content) {
            output += `  ${element.content}\n`;
          }
        }
      }
      output += '\n';
    }

    return output.trim();
  }

  private formatAsTree(
    results: Array<{ filePath: string; elements: ExtractedElement[] }>,
  ): string {
    let output = '';

    for (const result of results) {
      const relativePath = makeRelative(
        result.filePath,
        this.config.getTargetDir(),
      );
      output += `${relativePath}\n`;

      if (result.elements.length === 0) {
        output += '  (No elements found)\n';
      } else {
        // Group elements by type
        const elementsByType: Record<string, ExtractedElement[]> = {};
        for (const element of result.elements) {
          if (!elementsByType[element.type]) {
            elementsByType[element.type] = [];
          }
          elementsByType[element.type].push(element);
        }

        for (const [type, elements] of Object.entries(elementsByType)) {
          output += `  ${type} (${elements.length})\n`;
          for (const element of elements) {
            output += `    ${element.name} (line ${element.line})\n`;
          }
        }
      }
      output += '\n';
    }

    return output.trim();
  }

  private formatAsSummary(
    results: Array<{ filePath: string; elements: ExtractedElement[] }>,
  ): string {
    let totalElements = 0;
    let output = '';

    for (const result of results) {
      const relativePath = makeRelative(
        result.filePath,
        this.config.getTargetDir(),
      );
      output += `${relativePath}: ${result.elements.length} elements\n`;
      totalElements += result.elements.length;
    }

    output = `Total elements extracted: ${totalElements}\n\n` + output;
    return output.trim();
  }
}

/**
 * Implementation of the Extract tool
 */
export class ExtractTool extends BaseDeclarativeTool<
  ExtractToolParams,
  ToolResult
> {
  static readonly Name = 'extract';

  constructor(private config: Config) {
    super(
      ExtractTool.Name,
      'ExtractCodeElements',
      'Extracts specific elements (comments, functions, classes, imports, variables, types) from source code files without requiring users to read entire files or write complex regex patterns.',
      Kind.Read,
      {
        properties: {
          type: {
            description:
              'The type of element to extract: comments, functions, classes, imports, variables, or types',
            type: 'string',
            enum: [
              'comments',
              'functions',
              'classes',
              'imports',
              'variables',
              'types',
            ],
          },
          file: {
            description: 'The path to the source file',
            type: 'string',
          },
          files: {
            description: 'Optional: multiple files to extract from',
            type: 'array',
            items: {
              type: 'string',
            },
          },
          format: {
            description: 'Output format: list, tree, json, or summary',
            type: 'string',
            enum: ['list', 'tree', 'json', 'summary'],
          },
          language: {
            description:
              'Language of the source file (auto-detected if omitted)',
            type: 'string',
            enum: ['javascript', 'python', 'typescript', 'java', 'go'],
          },
          includeDocstrings: {
            description: 'Include docstrings in the output',
            type: 'boolean',
          },
          includeSignatures: {
            description: 'Include function signatures with parameters',
            type: 'boolean',
          },
        },
        required: ['type'],
        type: 'object',
      },
    );
  }

  protected override validateToolParamValues(
    params: ExtractToolParams,
  ): string | null {
    // Check if either file or files is provided
    if (!params.file && (!params.files || params.files.length === 0)) {
      return "Either 'file' or 'files' parameter must be specified";
    }

    return null;
  }

  protected createInvocation(
    params: ExtractToolParams,
  ): ToolInvocation<ExtractToolParams, ToolResult> {
    return new ExtractToolInvocation(this.config, params);
  }
}
