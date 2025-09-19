# Extract Tool Example

This directory contains an example of how to use the extract tool.

## Files

- `calculator.js`: A sample JavaScript file with classes, functions, and comments
- `package.json`: Package configuration

## Example Usage

Once the extract tool is available, you can use it to analyze the calculator.js file:

```javascript
// Extract all comments
extract({
  type: 'comments',
  file: 'calculator.js',
  format: 'list',
});

// Extract all classes
extract({
  type: 'classes',
  file: 'calculator.js',
  format: 'json',
});

// Extract all functions
extract({
  type: 'functions',
  file: 'calculator.js',
  format: 'tree',
});
```
