import { getStateContent } from './state-content.ts';
import type { NehemiahState } from './state-machine.ts';

export interface ShellModel {
  state: NehemiahState;
  prompt: string;
  organismState: NehemiahState;
  showFocus: boolean;
  showDecision: boolean;
  showAction: boolean;
  showProof: boolean;
  permanentStatusStrip: false;
  focus?: ReturnType<typeof getStateContent>['focus'];
  decision?: ReturnType<typeof getStateContent>['decision'];
  actionMessage?: string;
  proofMessage?: string;
}

export function buildShellModel(state: NehemiahState): ShellModel {
  const content = getStateContent(state);

  return {
    state,
    prompt: content.primaryPrompt,
    organismState: state,
    showFocus: content.visibleRegions.includes('focus'),
    showDecision: content.visibleRegions.includes('decision'),
    showAction: content.visibleRegions.includes('action'),
    showProof: content.visibleRegions.includes('proof'),
    permanentStatusStrip: false,
    focus: content.focus,
    decision: content.decision,
    actionMessage: content.actionMessage,
    proofMessage: content.proofMessage,
  };
}
