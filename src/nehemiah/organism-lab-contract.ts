export const ORGANISM_STATUS_LABEL = 'BREATHING';

export interface LabCommandSurface {
  active: boolean;
  placeholder: string;
  helperText: string;
}

export const restingLabCommandSurface: LabCommandSurface = {
  active: false,
  placeholder: 'Ask Nehemiah anything…',
  helperText: 'The command surface wakes in a later milestone.',
};
