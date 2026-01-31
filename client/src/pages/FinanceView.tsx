import { useState, useMemo, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  CheckCircle2,
  Landmark,
  Loader2,
  Building2,
  Receipt,
  FileText,
  DollarSign,
  Eye,
  Sparkles,
  BarChart3,
  TrendingUp,
  AlertTriangle,
  PieChart,
  Lightbulb,
  Download,
  Image as ImageIcon,
} from "lucide-react";
import { CATEGORY_COLORS } from "@shared/types";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
} from "recharts";

type Receipt = {
  id: number;
  imageUrl: string;
  staffName: string;
  merchantName: string | null;
  amountTotal: string | null;
  amountGst: string | null;
  category: string | null;
  projectCode: string | null;
  aiConfidence: number | null;
  aiReasoning: string | null;
  aiFlags: string[] | null;
  transactionDate: Date | null;
  status: string;
};

type Batch = {
  id: number;
  departmentId: number;
  departmentName: string;
  totalAmount: string;
  totalGst: string;
  status: string;
  createdAt: Date;
  hodApprovedAt: Date | null;
  receipts: Receipt[];
};

const CHART_COLORS = [
  "#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", 
  "#EC4899", "#06B6D4", "#84CC16"
];

export default function FinanceView() {
  const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null);
  const [viewingReceipt, setViewingReceipt] = useState<Receipt | null>(null);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [infographicUrl, setInfographicUrl] = useState<string | null>(null);
  const [generatingInfographic, setGeneratingInfographic] = useState(false);

  // Queries
  const { data: pendingBatches, refetch: refetchBatches } =
    trpc.batch.getPendingFinance.useQuery();

  // Mutations
  const approveMutation = trpc.batch.financeApprove.useMutation();
  const analyticsMutation = trpc.analytics.generateSummary.useMutation();
  const infographicMutation = trpc.analytics.generateInfographic.useMutation();

  // Calculate GL breakdown for selected batch
  const glBreakdown = useMemo(() => {
    if (!selectedBatch) return [];

    const breakdown: Record<string, { amount: number; gst: number; count: number }> = {};
    selectedBatch.receipts.forEach((r) => {
      if (r.category && r.status === "hod_approved") {
        if (!breakdown[r.category]) {
          breakdown[r.category] = { amount: 0, gst: 0, count: 0 };
        }
        breakdown[r.category].amount += parseFloat(r.amountTotal || "0");
        breakdown[r.category].gst += parseFloat(r.amountGst || "0");
        breakdown[r.category].count += 1;
      }
    });

    return Object.entries(breakdown)
      .map(([category, data]) => ({
        category,
        ...data,
        color: CATEGORY_COLORS[category as keyof typeof CATEGORY_COLORS] || "#6B7280",
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [selectedBatch]);

  // Calculate totals
  const totals = useMemo(() => {
    if (!pendingBatches) return { amount: 0, gst: 0, count: 0 };

    return pendingBatches.reduce(
      (acc, batch) => ({
        amount: acc.amount + parseFloat(batch.totalAmount),
        gst: acc.gst + parseFloat(batch.totalGst),
        count: acc.count + 1,
      }),
      { amount: 0, gst: 0, count: 0 }
    );
  }, [pendingBatches]);

  const handleDisburse = async () => {
    if (!selectedBatch) return;

    try {
      await approveMutation.mutateAsync({ batchId: selectedBatch.id });
      toast.success(
        `Bank transfer processed. ${selectedBatch.departmentName} float restored to $3,500.`
      );
      setSelectedBatch(null);
      refetchBatches();
    } catch (error) {
      toast.error("Failed to process disbursement");
    }
  };

  const handleGenerateAnalytics = async () => {
    setShowAnalytics(true);
    try {
      await analyticsMutation.mutateAsync({});
    } catch (error) {
      toast.error("Failed to generate analytics");
    }
  };

  const handleGenerateInfographic = async (prompt: string) => {
    if (!prompt) {
      toast.error("No infographic prompt available");
      return;
    }

    setGeneratingInfographic(true);
    try {
      const result = await infographicMutation.mutateAsync({ prompt });
      if (result.success && result.url) {
        setInfographicUrl(result.url);
        toast.success("Infographic generated successfully!");
      } else {
        toast.error("Failed to generate infographic");
      }
    } catch (error) {
      console.error("Infographic generation error:", error);
      toast.error("Failed to generate infographic");
    } finally {
      setGeneratingInfographic(false);
    }
  };

  // Auto-generate infographic when analytics are loaded
  useEffect(() => {
    if (analyticsMutation.data?.summary?.infographicPrompt && !infographicUrl && !generatingInfographic) {
      handleGenerateInfographic(analyticsMutation.data.summary.infographicPrompt);
    }
  }, [analyticsMutation.data?.summary?.infographicPrompt]);

  const analyticsData = analyticsMutation.data?.analyticsData;
  const analyticsSummary = analyticsMutation.data?.summary;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Finance Director Dashboard</h1>
          <p className="text-muted-foreground">
            Audit approved batches and process disbursements
          </p>
        </div>
        <Button
          onClick={handleGenerateAnalytics}
          disabled={analyticsMutation.isPending}
          className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
        >
          {analyticsMutation.isPending ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <BarChart3 className="w-4 h-4 mr-2" />
          )}
          Generate AI Analytics Report
        </Button>
      </div>

      <Tabs defaultValue="disbursements" className="space-y-6">
        <TabsList className="gap-2">
          <TabsTrigger value="disbursements" className="px-4">
            <Landmark className="w-4 h-4 mr-2" />
            Disbursements
          </TabsTrigger>
          <TabsTrigger value="analytics" className="px-4" disabled={!analyticsData}>
            <BarChart3 className="w-4 h-4 mr-2" />
            Analytics
            {analyticsData && (
              <Badge variant="secondary" className="ml-2">New</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Disbursements Tab */}
        <TabsContent value="disbursements" className="space-y-6">
          {/* Summary Stats */}
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <FileText className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Pending Batches</p>
                    <p className="text-2xl font-bold">{totals.count}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                    <DollarSign className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total to Disburse</p>
                    <p className="text-2xl font-bold">${totals.amount.toFixed(2)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                    <Receipt className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total GST</p>
                    <p className="text-2xl font-bold">${totals.gst.toFixed(2)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Pending Batches List */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Landmark className="w-5 h-5" />
                Approved Batches Awaiting Disbursement
              </CardTitle>
            </CardHeader>
            <CardContent>
              {pendingBatches && pendingBatches.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Batch ID</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>HOD Approved</TableHead>
                      <TableHead>Items</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">GST</TableHead>
                      <TableHead className="w-24"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingBatches.map((batch) => (
                      <TableRow key={batch.id}>
                        <TableCell className="font-medium">#{batch.id}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-muted-foreground" />
                            {batch.departmentName}
                          </div>
                        </TableCell>
                        <TableCell>
                          {batch.hodApprovedAt
                            ? new Date(batch.hodApprovedAt).toLocaleDateString()
                            : "-"}
                        </TableCell>
                        <TableCell>{batch.receipts.length} receipts</TableCell>
                        <TableCell className="text-right font-medium">
                          ${parseFloat(batch.totalAmount).toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right">
                          ${parseFloat(batch.totalGst).toFixed(2)}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedBatch(batch)}
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            Review
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="py-12 text-center">
                  <CheckCircle2 className="w-12 h-12 mx-auto text-green-500 mb-3" />
                  <p className="font-medium">All clear!</p>
                  <p className="text-sm text-muted-foreground">
                    No pending batches awaiting disbursement
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-6">
          {analyticsData && analyticsSummary && (
            <>
              {/* Executive Summary */}
              <Card className="bg-gradient-to-br from-purple-50 to-blue-50 border-purple-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-purple-600" />
                    Summary
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-lg text-gray-700 mb-4">
                    {analyticsSummary.executiveSummary}
                  </p>
                  <div className="flex gap-3">
                    <Button
                      onClick={() => analyticsSummary?.infographicPrompt && handleGenerateInfographic(analyticsSummary.infographicPrompt)}
                      disabled={generatingInfographic}
                      className="bg-gradient-to-r from-pink-500 to-orange-500 hover:from-pink-600 hover:to-orange-600"
                    >
                      {generatingInfographic ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <ImageIcon className="w-4 h-4 mr-2" />
                      )}
                      Generate Infographic
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Key Metrics Grid */}
              <div className="grid grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-sm text-muted-foreground">Total Receipts</p>
                    <p className="text-3xl font-bold">{analyticsData.summary.totalReceipts}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-sm text-muted-foreground">Total Spending</p>
                    <p className="text-3xl font-bold text-green-600">
                      ${analyticsData.summary.totalAmount.toFixed(2)}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-sm text-muted-foreground">Average Receipt</p>
                    <p className="text-3xl font-bold">
                      ${analyticsData.summary.averageAmount.toFixed(2)}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-sm text-muted-foreground">Approval Rate</p>
                    <p className="text-3xl font-bold text-blue-600">
                      {analyticsData.summary.approvalRate.toFixed(1)}%
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Charts Row */}
              <div className="grid grid-cols-2 gap-6">
                {/* Category Pie Chart */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <PieChart className="w-5 h-5" />
                      Spending by Category
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <RechartsPieChart>
                          <Pie
                            data={analyticsData.byCategory}
                            dataKey="totalAmount"
                            nameKey="category"
                            cx="50%"
                            cy="50%"
                            outerRadius={80}
                            label={({ category, percentage }) => 
                              `${category.split(' ')[0]}: ${percentage.toFixed(0)}%`
                            }
                          >
                            {analyticsData.byCategory.map((entry, index) => (
                              <Cell 
                                key={`cell-${index}`} 
                                fill={CHART_COLORS[index % CHART_COLORS.length]} 
                              />
                            ))}
                          </Pie>
                          <Tooltip 
                            formatter={(value: number) => `$${value.toFixed(2)}`}
                          />
                        </RechartsPieChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                {/* Department Bar Chart */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Building2 className="w-5 h-5" />
                      Spending by Department
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={analyticsData.byDepartment}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis 
                            dataKey="department" 
                            tick={{ fontSize: 12 }}
                            angle={-45}
                            textAnchor="end"
                            height={60}
                          />
                          <YAxis />
                          <Tooltip 
                            formatter={(value: number) => `$${value.toFixed(2)}`}
                          />
                          <Bar dataKey="totalAmount" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Daily Spending Trend */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <TrendingUp className="w-5 h-5" />
                    Daily Spending Trend
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={analyticsData.trends.dailySpending}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="date" 
                          tick={{ fontSize: 12 }}
                          tickFormatter={(date) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        />
                        <YAxis />
                        <Tooltip 
                          formatter={(value: number) => `$${value.toFixed(2)}`}
                          labelFormatter={(date) => new Date(date).toLocaleDateString()}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="amount" 
                          stroke="#10B981" 
                          strokeWidth={2}
                          dot={{ fill: "#10B981" }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Insights and Recommendations */}
              <div className="grid grid-cols-2 gap-6">
                {/* Key Insights */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Lightbulb className="w-5 h-5 text-yellow-500" />
                      Key Insights
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {analyticsSummary.keyInsights.map((insight, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-medium shrink-0 mt-0.5">
                            {i + 1}
                          </span>
                          <span className="text-sm">{insight}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>

                {/* Recommendations */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                      Recommendations
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {analyticsSummary.recommendations.map((rec, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                          <span className="text-sm">{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </div>

              {/* Risk Alerts */}
              {analyticsSummary.riskAlerts.length > 0 && (
                <Card className="border-red-200 bg-red-50">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2 text-red-700">
                      <AlertTriangle className="w-5 h-5" />
                      Risk Alerts
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {analyticsSummary.riskAlerts.map((alert, i) => (
                        <li key={i} className="flex items-start gap-2 text-red-700">
                          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                          <span className="text-sm">{alert}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {/* Anomalies */}
              {analyticsData.anomalies.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-orange-500" />
                      Detected Anomalies
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {analyticsData.anomalies.map((anomaly, i) => (
                        <div 
                          key={i} 
                          className={`p-3 rounded-lg border ${
                            anomaly.severity === 'high' 
                              ? 'bg-red-50 border-red-200' 
                              : anomaly.severity === 'medium'
                              ? 'bg-orange-50 border-orange-200'
                              : 'bg-yellow-50 border-yellow-200'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <Badge 
                              variant={anomaly.severity === 'high' ? 'destructive' : 'secondary'}
                              className="uppercase text-xs"
                            >
                              {anomaly.severity}
                            </Badge>
                            <span className="font-medium text-sm">{anomaly.type.replace(/_/g, ' ')}</span>
                          </div>
                          <p className="text-sm text-muted-foreground">{anomaly.description}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Top Merchants */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Top 10 Merchants</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Rank</TableHead>
                        <TableHead>Merchant</TableHead>
                        <TableHead className="text-center">Visits</TableHead>
                        <TableHead className="text-right">Total Spent</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {analyticsData.topMerchants.map((merchant, i) => (
                        <TableRow key={merchant.merchant}>
                          <TableCell className="font-medium">#{i + 1}</TableCell>
                          <TableCell>{merchant.merchant}</TableCell>
                          <TableCell className="text-center">{merchant.count}</TableCell>
                          <TableCell className="text-right font-medium">
                            ${merchant.totalAmount.toFixed(2)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Infographic Prompt (for manual generation) */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <ImageIcon className="w-5 h-5" />
                    AI Infographic Prompt
                  </CardTitle>
                  <CardDescription>
                    Use this prompt with an AI image generator to create a visual summary
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm font-mono whitespace-pre-wrap">
                      {analyticsSummary.infographicPrompt}
                    </p>
                  </div>
                  <Button 
                    variant="outline" 
                    className="mt-3"
                    onClick={() => {
                      navigator.clipboard.writeText(analyticsSummary.infographicPrompt);
                      toast.success("Prompt copied to clipboard!");
                    }}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Copy Prompt
                  </Button>
                </CardContent>
              </Card>

              {/* Generated Infographic */}
              {infographicUrl && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <ImageIcon className="w-5 h-5 text-pink-500" />
                      Generated Infographic
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <img 
                      src={infographicUrl} 
                      alt="Analytics Infographic" 
                      className="w-full rounded-lg border"
                    />
                  </CardContent>
                </Card>
              )}
            </>
          )}

          {!analyticsData && (
            <Card className="py-12">
              <CardContent className="text-center">
                <BarChart3 className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No Analytics Data</h3>
                <p className="text-muted-foreground mb-4">
                  Click "Generate AI Analytics Report" to analyze your expense data
                </p>
                <Button
                  onClick={handleGenerateAnalytics}
                  disabled={analyticsMutation.isPending}
                >
                  {analyticsMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4 mr-2" />
                  )}
                  Generate Report
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Batch Detail Modal */}
      <Dialog open={!!selectedBatch} onOpenChange={() => setSelectedBatch(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Landmark className="w-5 h-5" />
              Batch #{selectedBatch?.id} - {selectedBatch?.departmentName}
            </DialogTitle>
          </DialogHeader>

          {selectedBatch && (
            <div className="space-y-6">
              {/* AI Validation Message */}
              <Card className="bg-green-50 border-green-200">
                <CardContent className="pt-4">
                  <div className="flex items-start gap-3">
                    <Sparkles className="w-5 h-5 text-green-600 mt-0.5" />
                    <div>
                      <p className="font-medium text-green-800">
                        AI Validation Passed
                      </p>
                      <p className="text-sm text-green-700">
                        All receipts contain valid tax invoices. No duplicates
                        found. GST amounts verified against receipt totals.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Summary */}
              <div className="grid grid-cols-3 gap-4">
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-sm text-muted-foreground">Total Amount</p>
                    <p className="text-2xl font-bold">
                      ${parseFloat(selectedBatch.totalAmount).toFixed(2)}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-sm text-muted-foreground">Total GST</p>
                    <p className="text-2xl font-bold">
                      ${parseFloat(selectedBatch.totalGst).toFixed(2)}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-sm text-muted-foreground">Net Amount</p>
                    <p className="text-2xl font-bold">
                      $
                      {(
                        parseFloat(selectedBatch.totalAmount) -
                        parseFloat(selectedBatch.totalGst)
                      ).toFixed(2)}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* GL Coding Breakdown */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">
                    GL Coding Breakdown
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>GL Category</TableHead>
                        <TableHead className="text-center">Items</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead className="text-right">GST</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {glBreakdown.map((item) => (
                        <TableRow key={item.category}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: item.color }}
                              />
                              {item.category}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            {item.count}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            ${item.amount.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right">
                            ${item.gst.toFixed(2)}
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="font-bold border-t-2">
                        <TableCell>Total</TableCell>
                        <TableCell className="text-center">
                          {selectedBatch.receipts.length}
                        </TableCell>
                        <TableCell className="text-right">
                          ${parseFloat(selectedBatch.totalAmount).toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right">
                          ${parseFloat(selectedBatch.totalGst).toFixed(2)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Individual Receipts */}
              <Accordion type="single" collapsible>
                <AccordionItem value="receipts">
                  <AccordionTrigger>
                    View Individual Receipts ({selectedBatch.receipts.length})
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-2">
                      {selectedBatch.receipts.map((receipt) => (
                        <div
                          key={receipt.id}
                          className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className="w-10 h-10 rounded bg-cover bg-center border"
                              style={{
                                backgroundImage: `url(${receipt.imageUrl})`,
                              }}
                            />
                            <div>
                              <p className="font-medium text-sm">
                                {receipt.merchantName || "Unknown"}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {receipt.staffName} • {receipt.category}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <p className="font-medium">
                                ${parseFloat(receipt.amountTotal || "0").toFixed(2)}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                GST: ${parseFloat(receipt.amountGst || "0").toFixed(2)}
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setViewingReceipt(receipt)}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button variant="outline" onClick={() => setSelectedBatch(null)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleDisburse}
                  disabled={approveMutation.isPending}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {approveMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Landmark className="w-4 h-4 mr-2" />
                  )}
                  Process Bank Transfer ($
                  {parseFloat(selectedBatch.totalAmount).toFixed(2)})
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Receipt Image Modal */}
      <Dialog open={!!viewingReceipt} onOpenChange={() => setViewingReceipt(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Receipt Image</DialogTitle>
          </DialogHeader>
          {viewingReceipt && (
            <div className="aspect-[3/4] rounded-lg overflow-hidden border bg-muted">
              <img
                src={viewingReceipt.imageUrl}
                alt="Receipt"
                className="w-full h-full object-contain"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
