export const requestBriefing = async (_input: unknown) => {
  return {
    ok: false as const,
    error: "AI briefing is only available in the hosted Meridian app.",
  };
};
