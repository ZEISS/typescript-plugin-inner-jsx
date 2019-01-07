import {
  ClassDeclaration,
  Expression,
  Identifier,
  Node,
  SourceFile,
  Statement,
  SyntaxKind,
  TransformerFactory,
  VariableStatement,
  Visitor,
  createAsExpression,
  createBlock,
  createCall,
  createGetAccessor,
  createIdentifier,
  createNodeArray,
  createObjectLiteral,
  createParen,
  createProperty,
  createPropertyAccess,
  createPropertyAssignment,
  createReturn,
  createToken,
  createTypeQueryNode,
  isArrowFunction,
  isBlock,
  isClassDeclaration,
  isDefaultClause,
  isFunctionDeclaration,
  isFunctionExpression,
  isIdentifier,
  isImportDeclaration,
  isJsxOpeningElement,
  isJsxSelfClosingElement,
  isModuleBlock,
  isNamedImports,
  isNamespaceImport,
  isObjectBindingPattern,
  isPropertyAccessExpression,
  isQualifiedName,
  isSourceFile,
  isTypeReferenceNode,
  isVariableStatement,
  updateBlock,
  updateClassDeclaration,
  updateDefaultClause,
  updateModuleBlock,
  updateSourceFileNode,
  updateVariableDeclaration,
  updateVariableDeclarationList,
  updateVariableStatement,
  visitEachChild,
  visitNode,
} from 'typescript';

interface Dict {
  [name: string]: Identifier;
}

/**
 * Gets import names if node is an import declaration.
 * Checks for the patterns:
 * import { var1, var2 as var3 } from 'somewhere';
 * import * as all from 'all';
 * import defaultVariable from 'somelib';
 * @param node
 */
function getImports(node: Node) {
  const imports: Dict = {};
  if (isImportDeclaration(node) && node.importClause) {
    const { importClause } = node;
    if (importClause.name) {
      imports[importClause.name.text] = importClause.name;
    }

    if (importClause.namedBindings) {
      const { namedBindings } = importClause;
      if (isNamespaceImport(namedBindings) && namedBindings.name.text !== 'from') {
        imports[namedBindings.name.text] = namedBindings.name;
      } else if (isNamedImports(namedBindings)) {
        namedBindings.elements.forEach(importSpecifier => {
          imports[importSpecifier.name.text] = importSpecifier.name;
        });
      }
    }
  }

  return imports;
}

/**
 * Gets function parameters
 * @param node
 */
function getFunctionParameters(node: Node) {
  const parameters: Dict = {};
  if (node && (isFunctionExpression(node) || isArrowFunction(node))) {
    node.parameters.forEach(parameter => {
      if (isIdentifier(parameter.name)) {
        parameters[parameter.name.text] = parameter.name;
      }
    });
  }

  return parameters;
}

/**
 * Gets all node's variable names
 * @param node
 */
function getVariables(node: Node): Dict {
  const variables: Dict = {};
  if (isVariableStatement(node)) {
    node.declarationList.declarations.forEach(({ name }) => {
      if (isIdentifier(name)) {
        variables[name.text] = name;
      } else if (isObjectBindingPattern(name)) {
        name.elements.forEach(({ name }) => {
          if (isIdentifier(name)) {
            variables[name.text] = name;
          }
        });
      }
    });
  }

  return variables;
}

/**
 * If function declaration then reutrns function name
 * @param node
 */
function getFunctionName(node: Node) {
  if (isFunctionDeclaration(node) && node.name) {
    return node.name;
  }

  return undefined;
}

/**
 * If class decalration then return class name
 * @param node
 */
function getClassName(node: Node) {
  if (isClassDeclaration(node) && node.name) {
    return node.name;
  }

  return undefined;
}

/**
 * Checks for the pattern:
 * class SomeComponentName extends React.* {
 *   ...
 * }
 * @param node
 */
function isReactClass(node: Node): node is ClassDeclaration {
  if (
    isClassDeclaration(node) &&
    node.heritageClauses &&
    node.heritageClauses[0].types &&
    node.heritageClauses[0].types[0].expression &&
    isPropertyAccessExpression(node.heritageClauses[0].types[0].expression) &&
    isIdentifier(node.heritageClauses[0].types[0].expression.expression) &&
    node.heritageClauses[0].types[0].expression.expression.text === 'React'
  ) {
    return true;
  }

  return false;
}

/**
 * Checks for the patterns:
 * const SomeComponent: React.* = () => ....
 * let SomeComponent2: React.* = function() {}
 * @param node
 */
function isReactFunctionDeclaration(node: Node): node is VariableStatement {
  if (
    isVariableStatement(node) &&
    node.declarationList &&
    node.declarationList.declarations &&
    node.declarationList.declarations.length === 1
  ) {
    const declaration = node.declarationList.declarations[0];
    const { type, initializer } = declaration;

    if (
      type &&
      initializer &&
      (isArrowFunction(initializer) || isFunctionExpression(initializer)) &&
      isTypeReferenceNode(type) &&
      isQualifiedName(type.typeName) &&
      isIdentifier(type.typeName.left) &&
      type.typeName.left.text === 'React'
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Gets all variable, function, class declaration names
 * which are in the same or higher scope of the node.
 * @param node
 */
function getScope(node: Node) {
  let dict: Dict = {};
  if (!node.parent) {
    return dict;
  }

  node.parent.forEachChild(cbNode => {
    if (cbNode === node) {
      return;
    }

    const functionName = getFunctionName(cbNode);
    if (functionName) {
      dict[functionName.text] = functionName;
    }

    const className = getClassName(cbNode);
    if (className) {
      dict[className.text] = className;
    }

    dict = {
      ...dict,
      ...getImports(cbNode),
      ...getVariables(cbNode),
      ...getFunctionParameters(cbNode.parent),
    };
  });

  dict = { ...dict, ...getScope(node.parent) };

  return dict;
}

/**
 * Creates an inner object from available jsx tags list:
 *
 * {
 *     get A() { return A as typeof A; },
 *     get B() { return B as typeof B; },
 *     get C() { return C as typeof C; },
 * }
 *
 * @param jsxTags
 */
function createInner(jsxTags: Array<Identifier>) {
  return createObjectLiteral(
    jsxTags.map(tag =>
      createGetAccessor(
        undefined,
        undefined,
        tag.text,
        [],
        undefined,
        createBlock([createReturn(createAsExpression(tag, createTypeQueryNode(tag)))]),
      ),
    ),
    true,
  );
}

/**
 * Identifies if node is react class or variable statement.
 * @param node
 */
function isReactStatement(node: Node) {
  if (isClassDeclaration(node)) {
    return isReactClass(node);
  } else if (isVariableStatement(node)) {
    return isReactFunctionDeclaration(node);
  }

  return false;
}

/**
 * Visits each node and finds JSX tags. Then assigns them to Map() where keys are references to
 * React class/variable declarations which contain these JSX tags. Assigns only those tags which lay
 * in the same or higher scope as React class/variable declaration.
 * @param node
 * @param reactStatement
 * @param scopeVariables
 * @param result
 */
function buildJsxMap(
  node: Node,
  reactStatement?: Node,
  scopeVariables?: Dict,
  result = new Map<Node, { [tag: string]: Identifier }>(),
) {
  node.forEachChild(child => {
    if (!child.parent) {
      child.parent = node;
    }

    if (scopeVariables && reactStatement && (isJsxOpeningElement(child) || isJsxSelfClosingElement(child))) {
      const tagName = child.tagName;
      if (isIdentifier(tagName)) {
        const { text } = tagName;
        if (scopeVariables[text]) {
          result.set(reactStatement, {
            ...result.get(reactStatement),
            [text]: scopeVariables[text],
          });
        }
      }
    } else if (isReactStatement(child)) {
      buildJsxMap(child, child, getScope(child), result);
    } else {
      buildJsxMap(child, reactStatement, scopeVariables, result);
    }
  });

  return result;
}

/**
 * Adds static inner object to React class.
 *
 * class Component extends React.Component {
 *   render() {
 *       return <InnerComponent />
 *   }
 * }
 *
 * ↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓
 *
 * class Component extends React.Component {
 *   render() {
 *       return <InnerComponent />
 *   }
 *
 *   static inner = {
 *       get Component(){ return Component; }
 *   }
 * }
 * @param statement
 * @param type
 */
function updateReactClassStatement(statement: ClassDeclaration, inner: Expression) {
  const property = createProperty(
    undefined,
    [createToken(SyntaxKind.StaticKeyword)],
    'inner',
    undefined,
    undefined,
    inner,
  );

  const members = createNodeArray([...statement.members, property]);
  return updateClassDeclaration(
    statement,
    statement.decorators,
    statement.modifiers,
    statement.name,
    statement.typeParameters,
    statement.heritageClauses,
    members,
  );
}

/**
 * Updates React variable decalration
 *
 * const Component: React.SFC<{}> = () => <InnerComponent />
 *
 * ↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓
 *
 * const Component = Object.assign(() => <InnerComponent />) as React.SFC<{}>, { inner: { get Component(){ return Component; } } } }
 * @param statement
 * @param type
 */
function updateReactVariableStatement(statement: VariableStatement, inner: Expression) {
  const { declarationList, modifiers } = statement;
  const variableDeclaration = declarationList.declarations[0];

  if (
    (declarationList.declarations && declarationList.declarations.length !== 1) ||
    !variableDeclaration.initializer ||
    !variableDeclaration.type
  ) {
    return statement;
  }

  return updateVariableStatement(
    statement,
    modifiers,
    updateVariableDeclarationList(declarationList, [
      updateVariableDeclaration(
        variableDeclaration,
        variableDeclaration.name,
        undefined,
        createCall(createPropertyAccess(createIdentifier('Object'), createIdentifier('assign')), undefined, [
          createAsExpression(createParen(variableDeclaration.initializer), variableDeclaration.type),
          createObjectLiteral([createPropertyAssignment('inner', inner)]),
        ]),
      ),
    ]),
  );
}

export function createTransformer(): TransformerFactory<SourceFile> {
  const transformer: TransformerFactory<SourceFile> = context => {
    return sourceFile => {
      const jsxMap = buildJsxMap(sourceFile);
      const visitor: Visitor = node => {
        node.forEachChild(n => {
          if (!n.parent) {
            n.parent = node;
          }
        });

        let updatedNode = node;
        if (isBlock(node) || isDefaultClause(node) || isModuleBlock(node) || isSourceFile(node)) {
          const statements = node.statements.map<Statement>(statement => {
            if (jsxMap.has(statement)) {
              const jsxTags = Object.keys(jsxMap.get(statement) as any).map<Identifier>(
                key => (jsxMap.get(statement) as any)[key],
              );

              if (jsxTags.length) {
                const inner = createInner(jsxTags);
                if (isReactClass(statement)) {
                  return updateReactClassStatement(statement, inner);
                } else if (isReactFunctionDeclaration(statement)) {
                  return updateReactVariableStatement(statement, inner);
                }
              }
            }

            return statement;
          });

          if (isBlock(node)) {
            updatedNode = updateBlock(node, statements);
          } else if (isDefaultClause(node)) {
            updatedNode = updateDefaultClause(node, statements);
          } else if (isModuleBlock(node)) {
            updatedNode = updateModuleBlock(node, statements);
          } else if (isSourceFile(node)) {
            updatedNode = updateSourceFileNode(node, statements);
          }
        }

        return visitEachChild(updatedNode, visitor, context);
      };

      return visitNode(sourceFile, visitor);
    };
  };

  return transformer;
}

export default createTransformer;
