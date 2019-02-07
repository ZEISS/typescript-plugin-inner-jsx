# Typescript Inner JSX Plugin

[![Build Status](https://travis-ci.org/ZEISS/typescript-plugin-inner-jsx.svg?branch=master)](https://travis-ci.org/ZEISS/typescript-plugin-inner-jsx)
[![NPM](https://img.shields.io/npm/v/typescript-plugin-inner-jsx.svg)](https://www.npmjs.com/package/typescript-plugin-inner-jsx)
[![Node](https://img.shields.io/node/v/typescript-plugin-inner-jsx.svg)](https://www.npmjs.com/package/typescript-plugin-inner-jsx)
[![GitHub tag](https://img.shields.io/github/tag/ZEISS/typescript-plugin-inner-jsx.svg)](https://github.com/ZEISS/typescript-plugin-inner-jsx/releases)
[![GitHub issues](https://img.shields.io/github/issues/ZEISS/typescript-plugin-inner-jsx.svg)](https://github.com/ZEISS/typescript-plugin-inner-jsx/issues)
[![CLA assistant](https://cla-assistant.io/readme/badge/ZEISS/precise-ui)](https://cla-assistant.io/ZEISS/precise-ui)

TypeScript transformer to extract compile-time render information for runtime use. Available on npm as `typescript-plugin-inner-jsx`.

## Introduction

This is a TypeScript transformer that searches for JSX tags inside of React components and attaches them to the components declarations in which way exposes inner components structure to the consumer.

Example:

```js
// Before transform:
const SomeComponent: React.SFC<SomeComponentProps> = () => (
  <InnerComponent1>
    <div><InnerComponent2 /></div>
  </InnerComponent1>
)

// After transform:
const SomeComponent = (() => (
  <InnerComponent1>
    <div><InnerComponent2 /></div>
  </InnerComponent1>
)) as React.SFC<SomeComponentProps> & {
  inner: {
    readonly InnerComponent1: typeof InnerComponent1;
    readonly InnerComponent2 typeof InnerComponent2;
  }
}
SomeComponent.inner = {
  get InnerComponent1() {
    return InnerComponent1;
  },
  get InnerComponent2() {
    return InnerComponent1;
  },
}
```

## Installation

The following command adds the packages to the project as a development-time dependency:

`npm i typescript-plugin-inner-jsx --dev`

## Using the Transformer

Right now, one of the rough edges of TypeScript custom transforms is in how they are used ([hopefully to be resolved soon](https://github.com/Microsoft/TypeScript/issues/14419)). At least at the time of writing (December 2018), there are no compiler options (for command line or tsconfig.json) for specifying transforms, so typically the compiler API must be used to run transforms.

To build with transformer please use provided custom compiler `build-with-transform-jsx`.

Example:
```
build-with-transform-jsx -t es5 --outDir dist/es5 --declaration --inlineSourceMap --inlineSources --config ./tsconfig.json
```

## Integration with `Webpack`

This section describes how to integrate the plugin into the build/bundling process driven by [**Webpack**](https://webpack.js.org/) and its TypeScript loaders.

There are two popular TypeScript loaders that support specifying custom transformers:

- [**awesome-typescript-loader**](https://github.com/s-panferov/awesome-typescript-loader), supports custom transformers since v3.1.3
- [**ts-loader**](https://github.com/TypeStrong/ts-loader), supports custom transformers since v2.2.0

Both loaders use the same setting `getCustomTransformers` which is an optional function that returns `{ before?: Transformer[], after?: Transformer[] }`.
In order to inject the transformer into compilation, add it to `before` transformers array, like: `{ before: [innerJsxTransformer] }`.

### `awesome-typescript-loader`

In the `webpack.config.js` file in the section where **awesome-typescript-loader** is configured as a loader:

```js
// 1. import default from the plugin module
const createInnerJsxTransformer = require('typescript-plugin-inner-jsx').default;

// 2. create a transformer;
// the factory additionally accepts an options object which described below
const innerJsxTransformer = createInnerJsxTransformer();

// 3. add getCustomTransformer method to the loader config
var config = {
  ...
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        loader: 'awesome-typescript-loader',
        options: {
          ... // other loader's options
          getCustomTransformers: () => ({ before: [innerJsxTransformer] })
        }
      }
    ]
  }
  ...
};
```

Please note, that in the development mode, `awesome-typescript-loader` uses multiple separate processes to speed up compilation. In that mode the above configuration cannot work because functions, which `getCustomTransformers` is, are not transferrable between processes.
To solve this please refer to [Forked process configuration](#forked-process-configuration) section.

### `ts-loader`

In the `webpack.config.js` file in the section where **ts-loader** is configured as a loader:

```js
// 1. import default from the plugin module
const createInnerJsxTransformer = require('typescript-plugin-inner-jsx').default;

// 2. create a transformer;
// the factory additionally accepts an options object which described below
const innerJsxTransformer = createInnerJsxTransformer();

// 3. add getCustomTransformer method to the loader config
var config = {
  ...
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        loader: 'ts-loader',
        options: {
          ... // other loader's options
          getCustomTransformers: () => ({ before: [innerJsxTransformer] })
        }
      }
    ]
  }
  ...
};
```

Please note, when `awesome-typescript-loader` is used with `HappyPack` or `thread-loader`, they use multiple separate processes to speed up compilation. In that mode the above configuration cannot work because functions, which `getCustomTransformers` is, are not transferrable between processes.
To solve this please refer to [Forked process configuration](#forked-process-configuration) section.

## API

### `createTransformer`

```ts
function createTransformer(): TransformerFactory<SourceFile>;
```

## High order component

Package also imports a High order component which adds inner structure to the wrapped Component.

Example:
```ts
import { withInner } from 'typescript-plugin-inner-jsx/withInner';

const Parent = () => (
  <div>
    <Child1 />
    <Child2 />
  </div>
);

const ParentWithInner = withInner(Parent, { Child1, Child2 });

ParentWithInner.inner.Child1 === Child1; // true
```

A factory that creates an instance of a TypeScript transformer (which is a factory itself).

## License

Precise UI is released using the MIT license. For more information see the [license file](LICENSE).
