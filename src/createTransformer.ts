import {
  ClassDeclaration,
  Node,
  SourceFile,
  Statement,
  SyntaxKind,
  TransformerFactory,
  TypeLiteralNode,
  VariableStatement,
  Visitor,
  createAsExpression,
  createBinary,
  createBlock,
  createGetAccessor,
  createIdentifier,
  createIntersectionTypeNode,
  createNodeArray,
  createObjectLiteral,
  createParen,
  createProperty,
  createPropertyAccess,
  createPropertySignature,
  createReturn,
  createStatement,
  createToken,
  createTypeLiteralNode,
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
  [name: string]: string;
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
      imports[importClause.name.text] = importClause.name.text;
    }

    if (importClause.namedBindings) {
      const { namedBindings } = importClause;
      if (isNamespaceImport(namedBindings) && namedBindings.name.text !== 'from') {
        imports[namedBindings.name.text] = namedBindings.name.text;
      } else if (isNamedImports(namedBindings)) {
        namedBindings.elements.forEach(importSpecifier => {
          imports[importSpecifier.name.text] = importSpecifier.name.text;
        });
      }
    }
  }

  return imports;
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
        variables[name.text] = name.text;
      } else if (isObjectBindingPattern(name)) {
        name.elements.forEach(({ name }) => {
          if (isIdentifier(name)) {
            variables[name.text] = name.text;
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
    return node.name.text;
  }

  return undefined;
}

/**
 * If class decalration then return class name
 * @param node
 */
function getClassName(node: Node) {
  if (isClassDeclaration(node) && node.name) {
    return node.name.text;
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
      dict[functionName] = functionName;
    }

    const className = getClassName(cbNode);
    if (className) {
      dict[className] = className;
    }

    dict = {
      ...dict,
      ...getImports(cbNode),
      ...getVariables(cbNode),
      ...getScope(node.parent),
    };
  });

  return dict;
}

/**
 * Creates types of the inner object:
 * {
 *     readonly A: typeof A;
 *     readonly B: typeof B;
 *     readonly C: typeof C;
 * }
 * @param jsxTags
 */
function createInnerType(jsxTags: Array<string>) {
  return createTypeLiteralNode(
    jsxTags.map(tag =>
      createPropertySignature(
        [createToken(SyntaxKind.ReadonlyKeyword)],
        tag,
        undefined,
        createTypeQueryNode(createIdentifier(tag)),
        undefined,
      ),
    ),
  );
}

/**
 * Creates an inner object from available jsx tags list:
 *
 * ComponentName.inner = {
 *     get A() { return A as typeof A; },
 *     get B() { return B as typeof B; },
 *     get C() { return C as typeof C; },
 * }
 *
 * @param jsxTags
 */
function createInnerValue(name: string, jsxTags: Array<string>) {
  return createStatement(
    createBinary(
      createPropertyAccess(createIdentifier(name), 'inner'),
      SyntaxKind.EqualsToken,
      createObjectLiteral(
        jsxTags.map(tag =>
          createGetAccessor(
            undefined,
            undefined,
            tag,
            [],
            undefined,
            createBlock([
              createReturn(createAsExpression(createIdentifier(tag), createTypeQueryNode(createIdentifier(tag)))),
            ]),
          ),
        ),
        true,
      ),
    ),
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
  result = new Map<Node, { [tag: string]: string }>(),
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
            [text]: text,
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
 *   static inner: { readonly InnerComponent: typeof InnerComponent }
 * }
 * @param statement
 * @param type
 */
function updateReactClassStatement(statement: ClassDeclaration, type: TypeLiteralNode) {
  const property = createProperty(
    undefined,
    [createToken(SyntaxKind.StaticKeyword)],
    'inner',
    undefined,
    type,
    undefined,
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
 * Moves type from variable decalration to "as"
 *
 * const Component: React.SFC<{}> = () => <InnerComponent />
 *
 * ↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓
 *
 * const Component = (() => <InnerComponent />) as React.SFC<{}> & { inner: { readonly InnerComponent: typeof InnerComponent } }
 * @param statement
 * @param type
 */
function updateReactVariableStatement(statement: VariableStatement, type: TypeLiteralNode) {
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
        createAsExpression(
          createParen(variableDeclaration.initializer),
          createIntersectionTypeNode([
            variableDeclaration.type,
            createTypeLiteralNode([createPropertySignature(undefined, 'inner', undefined, type, undefined)]),
          ]),
        ),
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
          const statements = node.statements.reduce<Array<Statement>>((statements, statement) => {
            if (jsxMap.has(statement)) {
              const jsxTags = Object.keys(jsxMap.get(statement) as {});
              if (jsxTags.length) {
                let name;
                const type = createInnerType(jsxTags);
                if (isReactClass(statement)) {
                  name = getClassName(statement);
                  statements.push(updateReactClassStatement(statement, type));
                } else if (isReactFunctionDeclaration(statement)) {
                  const variableDecalration = statement.declarationList.declarations[0];
                  if (isIdentifier(variableDecalration.name)) {
                    name = variableDecalration.name.text;
                  }
                  statements.push(updateReactVariableStatement(statement, type));
                }

                if (name) {
                  statements.push(createInnerValue(name, jsxTags));
                }
              } else {
                statements.push(statement);
              }
            } else {
              statements.push(statement);
            }
            return statements;
          }, []);

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
