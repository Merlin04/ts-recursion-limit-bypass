/* TODOs
 * - Add webapp
 * - Add comment at the top of the file
 * - Add recursion limit option that adds an additional type parameter and will return a fallback if it reacher that limit
 * - Fix exponential limit issue
 */

import { tsquery } from '@phenomnomnominal/tsquery';
import ts from 'typescript';
import { } from "ts-expose-internals";
import { cloneNode } from "ts-clone-node";

const code = `

type ToString<T extends any> = T extends number ? \`\${T}\` : never;

type StringToNumber<T extends string, TTup extends readonly unknown[] = []> 
= T extends ToString<TTup["length"]>
    ? TTup["length"]
    : StringToNumber<T, [number, ...TTup]>;


`;

const ast = tsquery.ast(code);
// console.log(ast);
/*const idNode = tsquery(ast, 'TypeAliasDeclaration > Identifier');
if (idNode.length === 0) {
    throw new Error('No type alias declaration found in source code');
}
const typeIdentifier = (idNode[0] as ts.Identifier).escapedText;
console.log(typeIdentifier);

// Find references
const references = tsquery(ast, `TypeAliasDeclaration TypeReference:has(Identifier[escapedText=${typeIdentifier}])`);
console.log(references);

// Regenerate source
const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
const result = printer.printNode(ts.EmitHint.Unspecified, ast, ast);
console.log(result);*/

const declarations = tsquery(ast, 'TypeAliasDeclaration');

declarations.forEach(declaration => patchDeclaration(declaration as ts.TypeAliasDeclaration, 3));

function getNodeIdentifier(node: ts.Node): string {
    const identifier = node.getChildren().filter(child => ts.isIdentifier(child))[0] as ts.Identifier;
    if (!identifier) {
        throw new Error("Node does not have identifier");
    }
    return identifier.escapedText.toString();
}

/*function patchDeclaration(declaration: ts.TypeAliasDeclaration) {
    patchDeclarationRecursive(declaration, getNodeIdentifier(declaration));
}*/

// Janky way of doing this
function replaceNode(oldNode: ts.Node, newNode: ts.Node) {
    // Not entirely sure what the difference is between these - maybe the underscore version is created by cloneNode?
    //@ts-expect-error
    const parent: ts.Node = oldNode.parent ?? oldNode._parent;
    let done = false;
    // Try to find what property in the parent has the usage
    for (const property of Object.keys(parent)) {
        //@ts-expect-error
        if (Array.isArray(parent[property])) {
            //@ts-expect-error
            parent[property].forEach((child: ts.Node, index) => {
                if (child === oldNode) {
                    //@ts-expect-error
                    parent[property][index] = newNode;
                    done = true;
                    // Can't break because it's a .forEach loop, oh well
                }
            });
            //@ts-expect-error
        } else if (parent[property] === oldNode) {
            // Replace the usage with the actual parameter value
            //@ts-expect-error
            parent[property] = newNode;
            done = true;
            break;
        }
    }

    return done;
}

function patchDeclaration(declaration: ts.TypeAliasDeclaration, recursionCount: number = 1) {
    // Get the actual definition part of the declaration
    //const definition = declaration.getChildren().filter(child => !ts.isIdentifier(child) && !ts.isTypeParameterDeclaration(child))[0];
    const definition = declaration.type;
    // Get the alias' type parameters
    //const typeParameterDefinitions = declaration.getChildren().filter(child => ts.isTypeParameterDeclaration(child));
    const typeParameterDefinitions = declaration.typeParameters ?? [];
    // Get the alias' type parameters' names
    const typeParameterNames = typeParameterDefinitions?.map(def => def.name.escapedText.toString()) ?? [];

    // Replace the usages (references) of the type alias with the actual definition however many times recursionCount says to
    for (let i = 0; i < recursionCount; i++) {
        // Find references to the type alias in the definition
        const references = tsquery(declaration, `TypeReference:has(Identifier[escapedText=${getNodeIdentifier(declaration)}])`);

        // Replace each reference of the type alias with the actual definition
        //@ts-expect-error
        references.forEach((reference: ts.TypeReferenceNode) => {
            // Copy type alias definition to replace the reference
            const newNode = cloneNode(definition);
            // Get type parameter values being passed to the type alias
            //const typeParameters = reference.getChildren().filter(child => !ts.isIdentifier(child) && child.kind !== ts.SyntaxKind.LessThanToken);
            const typeParameters = reference.typeArguments ?? ([] as ts.TypeNode[]);
            //const typeParameterNames = typeParameters.map(p => getNodeIdentifier(p));
            // Replace type parameter usages in newNode with the ones from the usage of the alias
            //@ts-expect-error
            const typeParameterUsages: ts.TypeReferenceNode[] = tsquery(newNode, 'TypeReference').filter(ref => typeParameterNames.includes(ref.typeName.escapedText.toString()));
            typeParameterUsages.forEach((typeParameterUsage, index) => {
                // Replace the reference with a clone of the type parameter
                //@ts-expect-error
                const parameterIndex = typeParameterNames.indexOf(typeParameterUsage.typeName.escapedText.toString());
                // TODO
                let typeParameter: ts.Node = typeParameters[parameterIndex];
                if (typeParameter === undefined) {
                    // Check if there's a default value for the parameter
                    const defaultValue = typeParameterDefinitions[parameterIndex].getChildren().filter(child => !ts.isIdentifier(child))[0];
                    if (defaultValue === undefined) {
                        throw new Error(`Type parameter ${getNodeIdentifier(typeParameterDefinitions[parameterIndex])} is not being passed a value and there is no default`);
                    }
                    else {
                        typeParameter = defaultValue;
                    }
                }

                /*//@ts-expect-error
                const parent: ts.Node = typeParameterUsage._parent;
                let done = false;
                // Try to find what property in the parent has the usage
                for (const property of Object.keys(parent)) {
                    //@ts-expect-error
                    if(Array.isArray(parent[property])) {
                        //@ts-expect-error
                        parent[property].forEach((child: ts.Node, index) => {
                            if (child === typeParameterUsage) {
                                //@ts-expect-error
                                parent[property][index] = cloneNode(typeParameter);
                                done = true;
                                // Can't break because it's a .forEach loop, oh well
                            }
                        });
                    //@ts-expect-error
                    } else if (parent[property] === typeParameterUsage) {
                        // Replace the usage with the actual parameter value
                        //@ts-expect-error
                        parent[property] = cloneNode(typeParameter);
                        done = true;
                        break;
                    }
                }*/

                if (!replaceNode(typeParameterUsage, cloneNode(typeParameter))) {
                    // Word salad
                    throw new Error(`Usage of type parameter ${typeParameterNames[parameterIndex]} cannot be found in any property of its parent node`);
                }
                //console.log(JSON.stringify(typeParameterUsage._parent));
                //ts.factory.createTypeLiteralNode

                //typeParameterUsage.parent.[typeParameterUsage.parent.indexOf(typeParameterUsage)] = typeParameter;

                //const typeParameter = typeParameters.filter(p => getNodeIdentifier(p) === getNodeIdentifier(typeParameterReference))[0];
            });

            //const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
            //const result = printer.printNode(ts.EmitHint.Unspecified, newNode, ast);
            //console.log(result);

            // Replace the reference with the newNode (the definition)
            replaceNode(reference, newNode);
        });
    }

    const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
    const result = printer.printNode(ts.EmitHint.Unspecified, declaration, ast);
    console.log(result);
}