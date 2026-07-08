import { AIInsightBlock } from "@/components/AICoachPanel";
import { RiskMatrix } from "@/components/RiskMatrix";
import { PageContainer, PageHeader } from "@/components/ui";
import {
  burndownInsight,
  dailyInsight,
  homeInsight,
  products,
  velocityInsight,
} from "@/lib/data";

export default function AICoachPage() {
  const portfolioInsights = [homeInsight, dailyInsight, burndownInsight, velocityInsight];
  const productInsights = products
    .filter((p) => p.risk !== "low")
    .map((p) => ({ product: p.name, insight: p.aiInsight }));

  return (
    <PageContainer>
      <PageHeader
        eyebrow="AI Coach"
        title="Delivery Intelligence"
        description="AI gives recommendations — humans make the decisions. Every insight shows its reasoning and confidence, and can be applied, dismissed, or edited."
      />

      <section className="mt-12">
        <h2 className="label">Risk Matrix</h2>
        <div className="mt-4 max-w-2xl">
          <RiskMatrix compact />
        </div>
      </section>

      <section id="portfolio" className="mt-12 scroll-mt-8">
        <h2 className="label">Portfolio Insights</h2>
        <div className="mt-4 grid gap-6 md:grid-cols-2">
          {portfolioInsights.map((insight, i) => (
            <AIInsightBlock key={i} insight={insight} />
          ))}
        </div>
      </section>

      <section id="products" className="mt-12 scroll-mt-8">
        <h2 className="label">Product Insights</h2>
        <div className="mt-4 grid gap-6 md:grid-cols-2">
          {productInsights.map(({ product, insight }) => (
            <div key={product}>
              <div className="mb-2 text-sm font-semibold text-ink">{product}</div>
              <AIInsightBlock insight={insight} />
            </div>
          ))}
        </div>
      </section>
    </PageContainer>
  );
}
