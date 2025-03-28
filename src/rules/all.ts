import { ESLintUtils } from "@typescript-eslint/experimental-utils";
import { createEslintRule } from "../utils/create-eslint-rule";
import { DiagnosticCategory } from "typescript";
import { posToLoc } from "../utils/pos-to-loc";

export const RULE_NAME = "all";
export type MessageIds = "typescriptError";
export type Options = [{
  includeErrorCodes?: number[];
  excludeErrorCodes?: number[];
}];

export default createEslintRule<Options, MessageIds>({
  name: RULE_NAME,
  meta: {
    type: "problem",
    docs: {
      description: "Turning tsc semantic errors into ESLint errors",
      recommended: "warn",
    },
    schema: [
      {
        type: "object",
        properties: {
          includeErrorCodes: {
            type: "array",
            items: {
              type: "number",
            }
          },
          excludeErrorCodes: {
            type: "array",
            items: {
              type: "number",
            }
          },
        },
        additionalProperties: false
      }
  ],
    messages: {
      typescriptError: "{{ errorMessage }}",
    },
  },
  defaultOptions: [{}],
  create: (context) => {
    const parserServices = ESLintUtils.getParserServices(context);

    const includeErrorCodes = context.options[0]?.includeErrorCodes;
    const excludeErrorCodes = context.options[0]?.excludeErrorCodes;

    const includeErrorCodesSet = includeErrorCodes ? new Set(includeErrorCodes) : null;
    const excludeErrorCodesSet = excludeErrorCodes ? new Set(excludeErrorCodes) : null;

    return {
      Program(astNode) {
        const tsNode = parserServices.esTreeNodeToTSNodeMap.get(astNode);
        const semErrors = parserServices.program.getSemanticDiagnostics(tsNode);
        const code = tsNode.text;

        semErrors.forEach((error) => {
          // Only report errors in the current file.
          if (!error.file || error.file.fileName !== tsNode.fileName) {
            return;
          }

          if (error.reportsUnnecessary) {
            return;
          }
          
          if (error.category !== DiagnosticCategory.Error) {
            return;
          }

          if (includeErrorCodesSet && !includeErrorCodesSet.has(error.code)) {
            return;
          }

          if(excludeErrorCodesSet && excludeErrorCodesSet.has(error.code)) {
            return;
          }

          const firstMessageInChain =
            typeof error.messageText === "string"
              ? error.messageText
              : error.messageText.messageText;

          context.report({
            messageId: "typescriptError",
            data: { errorMessage: `${firstMessageInChain} ts(${error.code})` },
            loc: posToLoc(code, error.start!, error.start! + error.length!),
          });
        });
      },
    };
  },
});
