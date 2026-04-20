// =============================================================================
// F5 — Analytics handlers
// =============================================================================
// These handlers do DB + Meta API work — populating post_analytics with real
// Instagram Insights data, and recalculating content_categories weights.

import { registerHandler } from '../registry';
import { recomputeWeightsHandler } from '../analytics/recompute-weights';
import { syncPostMetricsHandler  } from '../analytics/sync-post-metrics';
import { scanTrendsHandler       } from '../analytics/scan-trends';

export function registerAnalyticsRecomputeHandlers(): void {
  registerHandler({ agent_type: 'analytics', action: 'recompute_weights'  }, recomputeWeightsHandler);
  registerHandler({ agent_type: 'analytics', action: 'sync_post_metrics' }, syncPostMetricsHandler);
  registerHandler({ agent_type: 'analytics', action: 'scan_trends'       }, scanTrendsHandler);
}
