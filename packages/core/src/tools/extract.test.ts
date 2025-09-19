/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ExtractTool, type ExtractToolParams } from './extract.js';
import type { Config } from '../config/config.js';
import { makeFakeConfig } from '../test-utils/config.js';
import {
  extractComments,
  extractFunctions,
  extractClasses,
  extractImports,
  extractVariables,
  extractTypes,
} from './extract.js';

describe('ExtractTool', () => {
  let config: Config;
  let tool: ExtractTool;

  beforeEach(() => {
    config = makeFakeConfig();
    tool = new ExtractTool(config);
  });

  it('should have correct name', () => {
    expect(tool.name).toBe('extract');
  });

  it('should validate required type parameter', () => {
    // @ts-expect-error - We're intentionally creating invalid params for testing
    const result = tool.validateToolParams({});
    expect(result).toBe("params must have required property 'type'");
  });

  it('should validate valid type parameter', () => {
    const result = tool.validateToolParams({
      type: 'comments',
      file: 'test.js',
    });
    expect(result).toBeNull();
  });

  it('should reject invalid type parameter', () => {
    const result = tool.validateToolParams({
      type: 'invalid' as ExtractToolParams['type'],
      file: 'test.js',
    });
    expect(result).toBe(
      'params/type must be equal to one of the allowed values',
    );
  });

  it('should require either file or files parameter', () => {
    const result = tool.validateToolParams({ type: 'comments' });
    expect(result).toBe("Either 'file' or 'files' parameter must be specified");
  });

  it('should accept file parameter', () => {
    const result = tool.validateToolParams({
      type: 'comments',
      file: 'test.js',
    });
    expect(result).toBeNull();
  });

  it('should accept files parameter', () => {
    const result = tool.validateToolParams({
      type: 'comments',
      files: ['test.js'],
    });
    expect(result).toBeNull();
  });

  it('should validate format parameter', () => {
    const result = tool.validateToolParams({
      type: 'comments',
      file: 'test.js',
      format: 'invalid' as ExtractToolParams['format'],
    });
    expect(result).toBe(
      'params/format must be equal to one of the allowed values',
    );
  });

  it('should validate language parameter', () => {
    const result = tool.validateToolParams({
      type: 'comments',
      file: 'test.js',
      language: 'invalid' as ExtractToolParams['language'],
    });
    expect(result).toBe(
      'params/language must be equal to one of the allowed values',
    );
  });

  // Test the comment extraction logic directly
  describe('extractComments', () => {
    it('should extract single-line and multi-line comments from JavaScript', () => {
      const content = `// This is a single line comment
function helloWorld() {
  /*
   * This is a multi-line comment
   * It spans multiple lines
   */
  console.log("Hello, World!");
  
  // Another single line comment
  return true;
}

/*
 * This is another multi-line comment
 * At the end of the file
 */`;

      const comments = extractComments(content, 'javascript');

      // Check that we found the right number of comments
      expect(comments).toHaveLength(4);

      // Check single-line comments
      expect(comments[0].type).toBe('single-line-comment');
      expect(comments[0].content).toBe('This is a single line comment');

      expect(comments[2].type).toBe('single-line-comment');
      expect(comments[2].content).toBe('Another single line comment');

      // Check multi-line comments
      expect(comments[1].type).toBe('multi-line-comment');
      expect(comments[1].content).toContain('This is a multi-line comment');
      expect(comments[1].content).toContain('It spans multiple lines');

      expect(comments[3].type).toBe('multi-line-comment');
      expect(comments[3].content).toContain(
        'This is another multi-line comment',
      );
      expect(comments[3].content).toContain('At the end of the file');
    });
  });

  // Test the function extraction logic directly
  describe('extractFunctions', () => {
    it('should extract functions from JavaScript', () => {
      const content = `function helloWorld() {
  console.log("Hello, World!");
}

const add = function(a, b) {
  return a + b;
};

const multiply = (a, b) => {
  return a * b;
};

class Calculator {
  subtract(a, b) {
    return a - b;
  }
}`;

      const functions = extractFunctions(content, 'javascript');

      // Check that we found the right number of functions
      expect(functions).toHaveLength(4);

      // Check function names
      const functionNames = functions.map((f) => f.name);
      expect(functionNames).toContain('helloWorld');
      expect(functionNames).toContain('add');
      expect(functionNames).toContain('multiply');
      expect(functionNames).toContain('subtract');
    });
  });

  // Test the class extraction logic directly
  describe('extractClasses', () => {
    it('should extract classes from JavaScript', () => {
      const content = `class Animal {
  constructor(name) {
    this.name = name;
  }
}

class Dog extends Animal {
  bark() {
    return "Woof!";
  }
}

const Cat = class {
  meow() {
    return "Meow!";
  }
}`;

      const classes = extractClasses(content, 'javascript');

      // Check that we found the right number of classes
      expect(classes).toHaveLength(2);

      // Check class names
      const classNames = classes.map((c) => c.name);
      expect(classNames).toContain('Animal');
      expect(classNames).toContain('Dog');
    });
  });

  // Test the import extraction logic directly
  describe('extractImports', () => {
    it('should extract imports from JavaScript', () => {
      const content = `import React from 'react';
import { useState, useEffect } from 'react';
import './App.css';
const fs = require('fs');
export default function App() {
  return <div>Hello</div>;
}
export { Component };`;

      const imports = extractImports(content, 'javascript');

      // Check that we found some imports
      expect(imports.length).toBeGreaterThan(0);

      // Check that we found the React import
      const importContents = imports.map((i) => i.content);
      expect(importContents).toContain("import React from 'react';");
      expect(importContents).toContain(
        "import { useState, useEffect } from 'react';",
      );
    });
  });

  // Test the variable extraction logic directly
  describe('extractVariables', () => {
    it('should extract variables from JavaScript', () => {
      const content = `const name = "John";
let age = 30;
var isStudent = true;
const numbers = [1, 2, 3];
let person = {
  name: "Jane",
  age: 25
};`;

      const variables = extractVariables(content, 'javascript');

      // Check that we found some variables
      expect(variables.length).toBeGreaterThan(0);

      // Check variable names
      const variableNames = variables.map((v) => v.name);
      expect(variableNames).toContain('name');
      expect(variableNames).toContain('age');
      expect(variableNames).toContain('isStudent');
      expect(variableNames).toContain('numbers');
      expect(variableNames).toContain('person');
    });
  });

  // Test the type extraction logic directly
  describe('extractTypes', () => {
    it('should extract types from TypeScript', () => {
      const content = `interface User {
  name: string;
  age: number;
}

type ID = string | number;

enum Status {
  Active,
  Inactive
}`;

      const types = extractTypes(content, 'typescript');

      // Check that we found some types
      expect(types.length).toBeGreaterThan(0);

      // Check type names
      const typeNames = types.map((t) => t.name);
      expect(typeNames).toContain('User');
      expect(typeNames).toContain('ID');
      expect(typeNames).toContain('Status');
    });
  });
});
