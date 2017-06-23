import type { BreakingChange, BreakingChangeType, GraphQLError } from 'graphql';

export type GhCommit = {
  files: Array<GhFile>,
};

export type GhFile = {
  filename: string,
  status: string,
  previous_filename?: string,
};

export type GroupedByTypeBreakingChanges = {
  [breakingChangeType: BreakingChangeType]: Array<BreakingChange>,
};

export type AnalysisResult = {
  file: string,
  url: string,
  parseError: ?GraphQLError,
  breakingChanges: ?GroupedByTypeBreakingChanges,
};
