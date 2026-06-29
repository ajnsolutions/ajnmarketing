import type { MarketingPlanCalendarDay } from "@/lib/marketing-planner/types";
import type {
  CommandCenterBusinessHealth,
  CommandCenterCalendarItem,
  CommandCenterWeeklyWins,
} from "@/lib/command-center/types";
import type { loadCommandCenterContext } from "@/lib/command-center/context";

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function computeBusinessHealthScores(
  context: NonNullable<Awaited<ReturnType<typeof loadCommandCenterContext>>>
): CommandCenterBusinessHealth {
  const seo = context.analysisMeta.seoScore ?? context.analysisMeta.score ?? 0;

  let google = 0;
  if (context.gbpData.connected) {
    google += 40;
    if (context.gbpData.location) google += 20;
    if (context.gbpData.lastSyncedAt) google += 20;
    if (context.gbpData.insights.searchViews + context.gbpData.insights.mapsViews > 0) {
      google += 20;
    }
  }

  let reviews = 0;
  if (context.gbpData.connected) {
    const rating = context.gbpData.reviewSummary.averageRating;
    if (rating != null) reviews += Math.min(60, (rating / 5) * 60);
    if (context.gbpData.reviewSummary.reviewCount > 0) reviews += 20;
    if (context.gbpData.reviewSummary.unansweredCount === 0) reviews += 20;
    else reviews += Math.max(0, 20 - context.gbpData.reviewSummary.unansweredCount * 5);
  }

  let content = 0;
  if (context.analysisMeta.isComplete) content += 25;
  if (context.planData.plan?.status === "active") content += 25;
  if (context.approvalStats.approvedThisMonth > 0) content += 25;
  if (context.publishingStats.scheduled + context.publishingStats.ready > 0) content += 25;

  let consistency = 0;
  if (context.taskData.stats.dueToday > 0) consistency += 20;
  if (context.taskData.stats.completedToday > 0) consistency += 30;
  if (context.planData.plan?.status === "active") consistency += 25;
  if (context.publishingStats.published > 0) consistency += 25;

  const scores = {
    seo: clampScore(seo),
    google: clampScore(google),
    reviews: clampScore(reviews),
    content: clampScore(content),
    consistency: clampScore(consistency),
  };

  const overall = clampScore(
    (scores.seo + scores.google + scores.reviews + scores.content + scores.consistency) / 5
  );

  return { overall, ...scores };
}

export function buildUpcomingCalendar(
  calendar: MarketingPlanCalendarDay[] | undefined,
  referenceDate = new Date()
): CommandCenterCalendarItem[] {
  if (!calendar?.length) return [];

  const today = referenceDate.getDate();
  const month = referenceDate.getMonth();
  const year = referenceDate.getFullYear();

  return calendar
    .filter((item) => item.day >= today)
    .slice(0, 30)
    .map((item) => {
      const date = new Date(year, month, item.day);
      return {
        day: item.day,
        dateLabel: new Intl.DateTimeFormat("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
        }).format(date),
        title: item.title,
        channel: item.channel,
        contentType: item.contentType,
        note: item.note,
      };
    });
}

export function computeWeeklyWins(
  context: NonNullable<Awaited<ReturnType<typeof loadCommandCenterContext>>>
): CommandCenterWeeklyWins {
  return {
    reviews: context.gbpData.reviewSummary.newReviewsThisMonth,
    views: context.gbpData.insights.searchViews + context.gbpData.insights.mapsViews,
    calls: context.gbpData.insights.phoneCalls,
    clicks: context.gbpData.insights.websiteClicks,
    posts:
      context.gbpData.posts.published.length + context.publishingStats.published,
    tasksCompleted: context.taskData.stats.completedToday,
  };
}

export function buildTaskPriorities(
  context: NonNullable<Awaited<ReturnType<typeof loadCommandCenterContext>>>
) {
  const activeTasks = context.taskData.tasks.filter(
    (task) => task.status === "pending" || task.status === "in_progress"
  );

  const mapTask = (task: (typeof activeTasks)[number]) => ({
    id: task.id,
    title: task.title,
    description: task.description,
    estimatedMinutes: task.meta?.estimated_minutes ?? null,
  });

  return {
    high: activeTasks.filter((task) => task.priority === "high").map(mapTask),
    medium: activeTasks.filter((task) => task.priority === "medium").map(mapTask),
    low: activeTasks.filter((task) => task.priority === "low").map(mapTask),
  };
}
