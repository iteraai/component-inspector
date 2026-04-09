import path from 'node:path';
import type * as TypeScriptCompiler from 'typescript';
import { ANGULAR_COMPONENT_SOURCE_METADATA_PROPERTY } from '../sourceMetadataContract';

type TypeScriptModule = typeof TypeScriptCompiler;

type AngularComponentDecoratorSymbols = Readonly<{
  identifierNames: ReadonlySet<string>;
  namespaceNames: ReadonlySet<string>;
}>;

type AngularComponentDeclaration = Readonly<{
  className: string;
  line: number;
  column: number;
}>;

type TransformAngularComponentSourceMetadataArgs = Readonly<{
  code: string;
  sourceFilePath: string;
  workspaceRoot: string;
  typeScript: TypeScriptModule;
}>;

type TransformAngularComponentSourceMetadataResult = Readonly<{
  changed: boolean;
  code: string;
  componentClassNames: string[];
}>;

const ANGULAR_CORE_MODULE_SPECIFIER = '@angular/core';
const SUPPORTED_SOURCE_FILE_EXTENSIONS = new Set(['.ts', '.tsx', '.mts', '.cts']);

const toPosixPath = (value: string) => {
  return value.replaceAll(path.sep, '/');
};

const toSerializableSourceFile = (sourceFilePath: string, workspaceRoot: string) => {
  const relativePath = path.relative(workspaceRoot, sourceFilePath);

  if (
    relativePath.length > 0 &&
    !relativePath.startsWith('..') &&
    !path.isAbsolute(relativePath)
  ) {
    return toPosixPath(relativePath);
  }

  return toPosixPath(sourceFilePath);
};

const getSourceFileScriptKind = (
  filePath: string,
  typeScript: TypeScriptModule,
) => {
  return path.extname(filePath) === '.tsx'
    ? typeScript.ScriptKind.TSX
    : typeScript.ScriptKind.TS;
};

const getDecorators = (
  node: TypeScriptCompiler.Node,
  typeScript: TypeScriptModule,
) => {
  if (typeof typeScript.canHaveDecorators === 'function') {
    return typeScript.canHaveDecorators(node)
      ? typeScript.getDecorators(node) ?? []
      : [];
  }

  return (node as TypeScriptCompiler.Node & {
    decorators?: readonly TypeScriptCompiler.Decorator[];
  }).decorators ?? [];
};

const collectAngularComponentDecoratorSymbols = (
  sourceFile: TypeScriptCompiler.SourceFile,
  typeScript: TypeScriptModule,
): AngularComponentDecoratorSymbols => {
  const identifierNames = new Set<string>();
  const namespaceNames = new Set<string>();

  sourceFile.statements.forEach((statement) => {
    if (
      !typeScript.isImportDeclaration(statement) ||
      !typeScript.isStringLiteralLike(statement.moduleSpecifier) ||
      statement.moduleSpecifier.text !== ANGULAR_CORE_MODULE_SPECIFIER ||
      statement.importClause?.namedBindings === undefined
    ) {
      return;
    }

    const { namedBindings } = statement.importClause;

    if (typeScript.isNamedImports(namedBindings)) {
      namedBindings.elements.forEach((element) => {
        const importedName = element.propertyName?.text ?? element.name.text;

        if (importedName === 'Component') {
          identifierNames.add(element.name.text);
        }
      });

      return;
    }

    if (typeScript.isNamespaceImport(namedBindings)) {
      namespaceNames.add(namedBindings.name.text);
    }
  });

  return {
    identifierNames,
    namespaceNames,
  };
};

const hasAngularComponentDecorator = (
  node: TypeScriptCompiler.ClassDeclaration,
  symbols: AngularComponentDecoratorSymbols,
  typeScript: TypeScriptModule,
) => {
  return getDecorators(node, typeScript).some((decorator) => {
    const decoratorExpression = typeScript.isCallExpression(decorator.expression)
      ? decorator.expression.expression
      : decorator.expression;

    if (typeScript.isIdentifier(decoratorExpression)) {
      return symbols.identifierNames.has(decoratorExpression.text);
    }

    return (
      typeScript.isPropertyAccessExpression(decoratorExpression) &&
      decoratorExpression.name.text === 'Component' &&
      typeScript.isIdentifier(decoratorExpression.expression) &&
      symbols.namespaceNames.has(decoratorExpression.expression.text)
    );
  });
};

const collectAngularComponentDeclarations = (
  sourceFile: TypeScriptCompiler.SourceFile,
  symbols: AngularComponentDecoratorSymbols,
  typeScript: TypeScriptModule,
) => {
  const declarations: AngularComponentDeclaration[] = [];

  const visit = (node: TypeScriptCompiler.Node) => {
    if (
      typeScript.isClassDeclaration(node) &&
      node.name !== undefined &&
      hasAngularComponentDecorator(node, symbols, typeScript)
    ) {
      const sourceLocation = sourceFile.getLineAndCharacterOfPosition(
        node.name.getStart(sourceFile),
      );

      declarations.push({
        className: node.name.text,
        line: sourceLocation.line + 1,
        column: sourceLocation.character + 1,
      });
    }

    typeScript.forEachChild(node, visit);
  };

  visit(sourceFile);

  return declarations;
};

const appendAngularComponentSourceMetadata = (
  code: string,
  sourceFilePath: string,
  workspaceRoot: string,
  declarations: readonly AngularComponentDeclaration[],
) => {
  const serializedFilePath = JSON.stringify(
    toSerializableSourceFile(sourceFilePath, workspaceRoot),
  );
  const metadataStatements = declarations.map((declaration) => {
    return `;Object.defineProperty(${declaration.className}, ${JSON.stringify(ANGULAR_COMPONENT_SOURCE_METADATA_PROPERTY)}, { configurable: true, value: { file: ${serializedFilePath}, line: ${declaration.line}, column: ${declaration.column} } });`;
  });

  return `${code}\n\n${metadataStatements.join('\n')}\n`;
};

export const isSupportedAngularSourceMetadataFile = (filePath: string) => {
  if (
    filePath.endsWith('.d.ts') ||
    filePath.includes('/node_modules/') ||
    filePath.includes('\\node_modules\\')
  ) {
    return false;
  }

  return SUPPORTED_SOURCE_FILE_EXTENSIONS.has(path.extname(filePath));
};

export const transformAngularComponentSourceMetadata = (
  args: TransformAngularComponentSourceMetadataArgs,
): TransformAngularComponentSourceMetadataResult => {
  if (
    !args.code.includes(ANGULAR_CORE_MODULE_SPECIFIER) ||
    !args.code.includes('Component')
  ) {
    return {
      changed: false,
      code: args.code,
      componentClassNames: [],
    };
  }

  const sourceFile = args.typeScript.createSourceFile(
    args.sourceFilePath,
    args.code,
    args.typeScript.ScriptTarget.Latest,
    true,
    getSourceFileScriptKind(args.sourceFilePath, args.typeScript),
  );
  const symbols = collectAngularComponentDecoratorSymbols(
    sourceFile,
    args.typeScript,
  );

  if (
    symbols.identifierNames.size === 0 &&
    symbols.namespaceNames.size === 0
  ) {
    return {
      changed: false,
      code: args.code,
      componentClassNames: [],
    };
  }

  const declarations = collectAngularComponentDeclarations(
    sourceFile,
    symbols,
    args.typeScript,
  );

  if (declarations.length === 0) {
    return {
      changed: false,
      code: args.code,
      componentClassNames: [],
    };
  }

  return {
    changed: true,
    code: appendAngularComponentSourceMetadata(
      args.code,
      args.sourceFilePath,
      args.workspaceRoot,
      declarations,
    ),
    componentClassNames: declarations.map((declaration) => declaration.className),
  };
};
