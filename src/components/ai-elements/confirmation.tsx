import type { ComponentChildren, ComponentProps } from "preact";
import { createContext } from "preact";
import { useContext, useMemo } from "preact/hooks";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button, type ButtonProps } from "@/components/ui/button";
import type { ToolApproval, ToolState } from "@/types";
import { sx, type Sx, type WithSx } from "@/styles/sx";

const S = {
  confirmation: {
    display: "flex",
    flexDirection: "column",
    // rowGap, not gap: this is a column, and `gap` would also write column-gap,
    // which Alert sets for itself once it has a leading icon (`alertColumns`).
    rowGap: "0.5rem",
  },
  confirmationTitle: {
    display: "inline",
  },
  confirmationActions: {
    display: "flex",
    alignSelf: "flex-end",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: "0.5rem",
  },
} satisfies Record<string, Sx>;

interface ConfirmationContextValue {
  approval: ToolApproval | undefined;
  state: ToolState;
}

const ConfirmationContext = createContext<ConfirmationContextValue | null>(null);

const useConfirmation = () => {
  const context = useContext(ConfirmationContext);
  if (!context) {
    throw new Error("Confirmation components must be used within Confirmation");
  }
  return context;
};

/** The states that carry an answer, so the outcome can be shown. */
const RESPONDED: ToolState[] = ["approval-responded", "output-denied", "output-available"];

export type ConfirmationProps = ComponentProps<typeof Alert> & {
  approval?: ToolApproval;
  state: ToolState;
};

export const Confirmation = ({ style, approval, state, ...props }: ConfirmationProps) => {
  const contextValue = useMemo(() => ({ approval, state }), [approval, state]);

  if (!approval || state === "input-streaming" || state === "input-available") {
    return null;
  }

  return (
    <ConfirmationContext.Provider value={contextValue}>
      <Alert style={sx(S.confirmation, style)} {...props} />
    </ConfirmationContext.Provider>
  );
};

export type ConfirmationTitleProps = ComponentProps<typeof AlertDescription>;

export const ConfirmationTitle = ({ style, ...props }: ConfirmationTitleProps) => (
  <AlertDescription style={sx(S.confirmationTitle, style)} {...props} />
);

export interface ConfirmationSlotProps {
  children?: ComponentChildren;
}

/** Shown only while the answer is pending. */
export const ConfirmationRequest = ({ children }: ConfirmationSlotProps) => {
  const { state } = useConfirmation();
  if (state !== "approval-requested") return null;

  return <>{children}</>;
};

export const ConfirmationAccepted = ({ children }: ConfirmationSlotProps) => {
  const { approval, state } = useConfirmation();
  if (!approval?.approved || !RESPONDED.includes(state)) return null;

  return <>{children}</>;
};

export const ConfirmationRejected = ({ children }: ConfirmationSlotProps) => {
  const { approval, state } = useConfirmation();
  if (approval?.approved !== false || !RESPONDED.includes(state)) return null;

  return <>{children}</>;
};

export type ConfirmationActionsProps = WithSx<ComponentProps<"div">>;

export const ConfirmationActions = ({ style, ...props }: ConfirmationActionsProps) => {
  const { state } = useConfirmation();
  if (state !== "approval-requested") return null;

  return <div style={sx(S.confirmationActions, style)} {...props} />;
};

export type ConfirmationActionProps = ButtonProps;

export const ConfirmationAction = ({ size = "sm", ...props }: ConfirmationActionProps) => (
  <Button size={size} type="button" {...props} />
);
