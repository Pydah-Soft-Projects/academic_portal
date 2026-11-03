/**
 * Backward compatibility wrapper: re-exports from new structured modular AI package.
 * See: backend/src/ai/
 */
export {
  aiRouter,
  PORTAL_AI_TOOLS,
  SUPER_ADMIN_TOOLS,
  executeAiTool,
  logAi,
} from "../ai/index.js";
export type { ToolDefinition, ToolParameterProperty, ToolExecutionResult } from "../ai/index.js";
