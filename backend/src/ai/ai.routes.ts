import { Router } from "express";
import type { Request, Response } from "express";
import type { AuthedRequest } from "../middleware/auth.middleware.js";
import { PORTAL_AI_TOOLS } from "./ai.tools.js";
import { executeAiTool, logAi } from "./ai.executor.js";

export const aiRouter = Router();

function handleDiscovery(req: Request, res: Response) {
  const authedReq = req as AuthedRequest;
  const userName = authedReq.authUser?.name || "Anonymous";
  const userRole = authedReq.authz?.roles?.map((r) => r.label).join(", ") || "None";
  logAi("DISCOVERY", `GET /ai-tools from ${req.ip} | User: ${userName} | Roles: [${userRole}] | Offering ${PORTAL_AI_TOOLS.length} tools`);
  res.json({ tools: PORTAL_AI_TOOLS });
}

async function handleExecution(req: AuthedRequest, res: Response) {
  const startTime = Date.now();
  const rawToolName =
    (req.body?.tool_name as string) ||
    (req.body?.tool as string) ||
    (req.body?.function_name as string) ||
    (req.body?.name as string) ||
    "";
  const toolName = rawToolName.includes(":") ? rawToolName.split(":").pop()!.trim() : rawToolName.trim();
  const args =
    (req.body?.arguments as Record<string, unknown>) ||
    (req.body?.args as Record<string, unknown>) ||
    (req.body?.parameters as Record<string, unknown>) ||
    {};

  try {
    const result = await executeAiTool(toolName, args, req, startTime);
    res.status(result.status).json(result.data);
  } catch (error) {
    logAi("ERROR", `Tool '${toolName}' failed with exception: ${(error as Error).message}`);
    res.status(500).json({ error: (error as Error).message || "Failed to execute tool" });
  }
}

// Dynamic Tool Discovery endpoints
aiRouter.get("/", handleDiscovery);
aiRouter.get("/ai-tools", handleDiscovery);
aiRouter.get("/tools", handleDiscovery);

// Direct GET compatibility endpoints for user profile
aiRouter.get("/student-profile", (req, res) => {
  (req as Request).body = { tool_name: "get_user_profile" };
  return handleExecution(req as AuthedRequest, res);
});
aiRouter.get("/profile", (req, res) => {
  (req as Request).body = { tool_name: "get_user_profile" };
  return handleExecution(req as AuthedRequest, res);
});
aiRouter.get("/user-profile", (req, res) => {
  (req as Request).body = { tool_name: "get_user_profile" };
  return handleExecution(req as AuthedRequest, res);
});

// Dynamic Tool Execution endpoints
aiRouter.post("/", handleExecution);
aiRouter.post("/execute-tool", handleExecution);

