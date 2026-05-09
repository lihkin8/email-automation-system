import React, { useEffect, useState } from "react";
import {
  AtSign,
  BarChart3,
  Building2,
  Eye,
  Mail,
  RefreshCcw,
} from "lucide-react";

import {
  fetchAnalytics,
  fetchCompanyAnalytics,
  fetchCompanies,
  fetchCompanyDetails,
  fetchCompanyEmails,
  getCampaignMetrics,
  getCampaignUnopened,
  listCampaigns,
} from "@/lib/api";
import CompanyAnalytics from "@/components/CompanyAnalytics";
import EmailTable from "@/components/EmailTable";

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const STAT_CARDS = [
  { id: "total", label: "Total emails", icon: Mail },
  { id: "opened", label: "Opened", icon: Eye },
  { id: "opens", label: "Total opens", icon: BarChart3 },
  { id: "extra", label: "Companies", icon: Building2 },
];

export default function Dashboard() {
  const [analytics, setAnalytics] = useState(null);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [viewMode, setViewMode] = useState("company");
  const [selectedCompany, setSelectedCompany] = useState("all");
  const [selectedCampaignId, setSelectedCampaignId] = useState("");
  const [companyDetails, setCompanyDetails] = useState(null);
  const [companyAnalytics, setCompanyAnalytics] = useState(null);
  const [campaignMetrics, setCampaignMetrics] = useState(null);
  const [pagination, setPagination] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoadingInitial(true);
        const [companiesData, analyticsData, campaignsData] = await Promise.all([
          fetchCompanies(),
          fetchCompanyAnalytics(),
          listCampaigns(),
        ]);
        if (cancelled) return;
        setCompanies(companiesData.companies ?? []);
        setCompanyAnalytics(analyticsData.company_analytics ?? []);
        setCampaigns(campaignsData ?? []);
        setSelectedCampaignId(campaignsData?.[0]?.id?.toString() ?? "");
      } catch (err) {
        if (cancelled) return;
        setError(err.message ?? "Failed to load dashboard");
      } finally {
        if (!cancelled) setLoadingInitial(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (loadingInitial) return;
    let cancelled = false;
    (async () => {
      try {
        setLoadingDetail(true);
        setError(null);
        if (viewMode === "campaign") {
          if (!selectedCampaignId) {
            setAnalytics([]);
            setCampaignMetrics(null);
            setPagination(null);
            setCompanyDetails(null);
            return;
          }
          const [metrics, unopened] = await Promise.all([
            getCampaignMetrics(selectedCampaignId),
            getCampaignUnopened(selectedCampaignId),
          ]);
          if (cancelled) return;
          setCampaignMetrics(metrics);
          setAnalytics(
            unopened.map((r) => ({
              email_id: r.email_id,
              recruiter_name: r.recruiter_name,
              company: r.company,
              email_type: "MAIN",
              status: "SENT",
              is_opened: false,
              open_count: 0,
              sent_date: r.sent_date,
            }))
          );
          setPagination(null);
          setCompanyDetails(null);
        } else if (selectedCompany === "all") {
          const data = await fetchAnalytics(currentPage);
          if (cancelled) return;
          setAnalytics(data.analytics);
          setPagination(data.pagination);
          setCompanyDetails(null);
        } else {
          const [details, emails] = await Promise.all([
            fetchCompanyDetails(selectedCompany),
            fetchCompanyEmails(selectedCompany),
          ]);
          if (cancelled) return;
          setCompanyDetails(details.company_details);
          setAnalytics(emails.company_emails);
          setPagination(null);
        }
      } catch (err) {
        if (cancelled) return;
        setError(err.message ?? "Failed to load detail data");
      } finally {
        if (!cancelled) setLoadingDetail(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadingInitial, viewMode, selectedCompany, selectedCampaignId, currentPage]);

  const stats = computeStats(analytics, viewMode, campaignMetrics, selectedCompany);

  if (loadingInitial) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {viewMode === "campaign"
              ? "Campaign tracking"
              : "Email analytics"}
          </h1>
          <p className="text-sm text-muted-foreground">
            Overview of your outreach activity and campaign performance.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Select value={viewMode} onValueChange={setViewMode}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="company">By company</SelectItem>
              <SelectItem value="campaign">By campaign</SelectItem>
            </SelectContent>
          </Select>

          {viewMode === "company" ? (
            <Select
              value={selectedCompany}
              onValueChange={(v) => {
                setSelectedCompany(v);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="w-56">
                <SelectValue placeholder="All companies" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All companies</SelectItem>
                {companies.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Select
              value={selectedCampaignId}
              onValueChange={setSelectedCampaignId}
            >
              <SelectTrigger className="w-72">
                <SelectValue placeholder="Select a campaign" />
              </SelectTrigger>
              <SelectContent>
                {campaigns.map((c) => (
                  <SelectItem key={c.id} value={c.id.toString()}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </header>

      {error ? (
        <Alert variant="destructive">
          <RefreshCcw className="h-4 w-4" />
          <AlertTitle>Couldn't load dashboard data</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STAT_CARDS.map(({ id, label, icon: Icon }) => (
          <StatCard
            key={id}
            label={statLabel(id, viewMode, label)}
            value={stats[id] ?? "—"}
            icon={Icon}
            loading={loadingDetail}
          />
        ))}
      </section>

      {viewMode === "company" && companyDetails ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{selectedCompany}</CardTitle>
            <CardDescription>Company snapshot</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <DetailStat label="Total emails" value={companyDetails.total_emails} />
            <DetailStat label="Opened" value={companyDetails.opened_emails} />
            <DetailStat label="Follow-ups" value={companyDetails.follow_ups} />
            <DetailStat label="Total opens" value={companyDetails.total_opens} />
            <DetailStat
              label="Last interaction"
              value={
                companyDetails.last_interaction
                  ? new Date(companyDetails.last_interaction).toLocaleString()
                  : "—"
              }
              wide
            />
          </CardContent>
        </Card>
      ) : null}

      {viewMode === "company" && selectedCompany === "all" ? (
        <section>
          <SectionHeading
            icon={AtSign}
            title="Company-wise analytics"
            subtitle="Aggregated metrics across all your outreach lists."
          />
          {loadingDetail ? (
            <Skeleton className="h-64 w-full rounded-lg" />
          ) : (
            <CompanyAnalytics analytics={companyAnalytics} />
          )}
        </section>
      ) : null}

      <section>
        <SectionHeading
          icon={Mail}
          title={
            viewMode === "campaign"
              ? "Unopened recipients (main email)"
              : selectedCompany === "all"
                ? "All email logs"
                : `${selectedCompany} email logs`
          }
          subtitle="Most recent activity from your outreach inbox."
        />
        {loadingDetail ? (
          <Skeleton className="h-72 w-full rounded-lg" />
        ) : (
          <EmailTable
            analytics={analytics}
            pagination={pagination}
            onPageChange={setCurrentPage}
          />
        )}
      </section>
    </div>
  );
}

function statLabel(id, viewMode, fallback) {
  if (id === "extra") return viewMode === "campaign" ? "Unopened" : "Companies";
  if (id === "opened") return viewMode === "campaign" ? "Opened (main)" : "Opened emails";
  return fallback;
}

function computeStats(rows, viewMode, campaignMetrics, selectedCompany) {
  if (!rows) {
    return { total: "—", opened: "—", opens: "—", extra: "—" };
  }
  const total = rows.length;
  const opened = rows.filter((r) => r.is_opened).length;
  const opens = rows.reduce((s, r) => s + (r.open_count ?? 0), 0);
  const uniqueCompanies =
    selectedCompany === "all" ? new Set(rows.map((r) => r.company)).size : 1;

  if (viewMode === "campaign") {
    const m = campaignMetrics;
    return {
      total: m?.sent_main_count ?? total,
      opened: m
        ? `${m.opened_main_count} (${Math.round(m.open_rate_pct ?? 0)}%)`
        : opened,
      opens,
      extra: total,
    };
  }
  return {
    total,
    opened: total
      ? `${opened} (${Math.round((opened / total) * 100)}%)`
      : opened,
    opens,
    extra: uniqueCompanies,
  };
}

function StatCard({ label, value, icon: Icon, loading }) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="flex items-center justify-between p-5">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          {loading ? (
            <Skeleton className="mt-2 h-7 w-20" />
          ) : (
            <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
          )}
        </div>
        <span className="grid h-10 w-10 place-items-center rounded-md border border-border bg-secondary text-muted-foreground">
          <Icon className="h-5 w-5" />
        </span>
      </CardContent>
    </Card>
  );
}

function DetailStat({ label, value, wide }) {
  return (
    <div className={cn(wide && "sm:col-span-2 lg:col-span-4")}>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-sm font-medium text-foreground">{value ?? "—"}</p>
    </div>
  );
}

function SectionHeading({ icon: Icon, title, subtitle }) {
  return (
    <div className="mb-3 flex items-end justify-between">
      <div>
        <h2 className="text-base font-semibold">{title}</h2>
        {subtitle ? (
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
      {Icon ? <Icon className="h-4 w-4 text-muted-foreground" /> : null}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-64" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-64 w-full rounded-lg" />
      <Skeleton className="h-72 w-full rounded-lg" />
    </div>
  );
}
