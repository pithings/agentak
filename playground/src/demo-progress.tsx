/**
 * Playground fixtures for the progress elements (chain-of-thought, task, plan,
 * agent). Each is compound, so a transcript part — which carries plain data,
 * never a VNode — cannot pass the children itself. These wrappers do it.
 *
 * Demo only. Nothing here is part of the library surface.
 */
import {
  Agent,
  AgentContent,
  AgentHeader,
  AgentInstructions,
  AgentOutput,
  AgentTool,
  AgentTools,
} from "@/components/ai-elements/agent.tsx";
import {
  ChainOfThought,
  ChainOfThoughtContent,
  ChainOfThoughtHeader,
  ChainOfThoughtSearchResult,
  ChainOfThoughtSearchResults,
  ChainOfThoughtStep,
} from "@/components/_parked/ai-elements/chain-of-thought.tsx";
import {
  Plan,
  PlanAction,
  PlanContent,
  PlanDescription,
  PlanHeader,
  PlanSteps,
  PlanTitle,
  PlanTrigger,
} from "@/components/_parked/ai-elements/plan.tsx";
import {
  Task,
  TaskContent,
  TaskItem,
  TaskItemFile,
  TaskTrigger,
} from "@/components/ai-elements/task.tsx";
import type { ToolDefinition } from "@/types.ts";

export interface ChainOfThoughtDemoProps {
  title?: string;
  steps: {
    label: string;
    description?: string;
    status?: "complete" | "active" | "pending";
    results?: string[];
  }[];
}

export const ChainOfThoughtDemo = ({ title, steps }: ChainOfThoughtDemoProps) => (
  <ChainOfThought defaultOpen>
    <ChainOfThoughtHeader>{title}</ChainOfThoughtHeader>
    <ChainOfThoughtContent>
      {steps.map((step) => (
        <ChainOfThoughtStep
          description={step.description}
          key={step.label}
          label={step.label}
          status={step.status}
        >
          {step.results && (
            <ChainOfThoughtSearchResults>
              {step.results.map((result) => (
                <ChainOfThoughtSearchResult key={result}>{result}</ChainOfThoughtSearchResult>
              ))}
            </ChainOfThoughtSearchResults>
          )}
        </ChainOfThoughtStep>
      ))}
    </ChainOfThoughtContent>
  </ChainOfThought>
);

export interface TaskDemoProps {
  title: string;
  items: { text: string; files?: string[] }[];
}

export const TaskDemo = ({ title, items }: TaskDemoProps) => (
  <Task>
    <TaskTrigger title={title} />
    <TaskContent>
      {items.map((item) => (
        <TaskItem key={item.text}>
          {item.text}
          {item.files?.map((file) => (
            <TaskItemFile key={file}>{file}</TaskItemFile>
          ))}
        </TaskItem>
      ))}
    </TaskContent>
  </Task>
);

export interface PlanDemoProps {
  title: string;
  description: string;
  steps: string[];
  isStreaming?: boolean;
}

export const PlanDemo = ({ title, description, steps, isStreaming }: PlanDemoProps) => (
  <Plan defaultOpen isStreaming={isStreaming}>
    <PlanHeader>
      <PlanTitle>{title}</PlanTitle>
      <PlanDescription>{description}</PlanDescription>
      <PlanAction>
        <PlanTrigger />
      </PlanAction>
    </PlanHeader>
    <PlanContent>
      <PlanSteps>
        {steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </PlanSteps>
    </PlanContent>
  </Plan>
);

export interface AgentDemoProps {
  name: string;
  model?: string;
  instructions: string;
  tools: (ToolDefinition & { name: string })[];
  output?: string;
}

export const AgentDemo = ({ name, model, instructions, tools, output }: AgentDemoProps) => (
  <Agent>
    <AgentHeader model={model} name={name} />
    <AgentContent>
      <AgentInstructions>{instructions}</AgentInstructions>
      <AgentTools defaultValue={[tools[0]?.name ?? ""]}>
        {tools.map((tool) => (
          <AgentTool key={tool.name} schema tool={tool} value={tool.name} />
        ))}
      </AgentTools>
      {output && <AgentOutput schema={output} />}
    </AgentContent>
  </Agent>
);
