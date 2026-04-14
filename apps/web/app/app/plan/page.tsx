import { TrainingPlanPage } from '../_components/training-plan-page';

export default async function PlanPage({
  searchParams,
}: {
  searchParams?: Promise<{ moveConflict?: string; moveConflictReason?: string; moveConflictSuggestedDate?: string; notice?: string }>;
}) {
  const params = (await searchParams) || {};
  return <TrainingPlanPage mode="plan" moveConflict={params.moveConflict} moveConflictReason={params.moveConflictReason} moveConflictSuggestedDate={params.moveConflictSuggestedDate} notice={params.notice} />;
}
