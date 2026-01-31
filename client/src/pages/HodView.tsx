import { useState, useMemo } from "react";
import { usePersona } from "@/contexts/PersonaContext";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
  CheckCircle2,
  Package,
  Loader2,
  BarChart3,
  AlertTriangle,
  Eye,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { CATEGORY_COLORS } from "@shared/types";

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
  totalAmount: string;
  totalGst: string;
  status: string;
  createdAt: Date;
  receipts: Receipt[];
};

export default function HodView() {
  const { departmentId } = usePersona();
  const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null);
  const [rejectedIds, setRejectedIds] = useState<Set<number>>(new Set());
  const [viewingReceipt, setViewingReceipt] = useState<Receipt | null>(null);

  // Queries
  const { data: departments } = trpc.department.list.useQuery();
  const { data: pendingBatches, refetch: refetchBatches } =
    trpc.batch.getPendingHod.useQuery(
      { departmentId: departmentId! },
      { enabled: !!departmentId }
    );

  // Mutations
  const approveMutation = trpc.batch.hodApprove.useMutation();

  const currentDepartment = departments?.find((d) => d.id === departmentId);

  // Calculate category breakdown for selected batch
  const categoryBreakdown = useMemo(() => {
    if (!selectedBatch) return [];

    const breakdown: Record<string, number> = {};
    selectedBatch.receipts.forEach((r) => {
      if (r.category && !rejectedIds.has(r.id)) {
        const amount = parseFloat(r.amountTotal || "0");
        breakdown[r.category] = (breakdown[r.category] || 0) + amount;
      }
    });

    return Object.entries(breakdown)
      .map(([category, amount]) => ({
        category: category.length > 15 ? category.slice(0, 15) + "..." : category,
        fullCategory: category,
        amount,
        color: CATEGORY_COLORS[category as keyof typeof CATEGORY_COLORS] || "#6B7280",
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [selectedBatch, rejectedIds]);

  // Calculate adjusted totals
  const adjustedTotals = useMemo(() => {
    if (!selectedBatch) return { amount: 0, gst: 0 };

    let amount = 0;
    let gst = 0;

    selectedBatch.receipts.forEach((r) => {
      if (!rejectedIds.has(r.id)) {
        amount += parseFloat(r.amountTotal || "0");
        gst += parseFloat(r.amountGst || "0");
      }
    });

    return { amount, gst };
  }, [selectedBatch, rejectedIds]);

  const handleToggleReceipt = (receiptId: number) => {
    const newRejected = new Set(rejectedIds);
    if (newRejected.has(receiptId)) {
      newRejected.delete(receiptId);
    } else {
      newRejected.add(receiptId);
    }
    setRejectedIds(newRejected);
  };

  const handleApproveBatch = async () => {
    if (!selectedBatch) return;

    try {
      await approveMutation.mutateAsync({
        batchId: selectedBatch.id,
        rejectedReceiptIds: Array.from(rejectedIds),
      });
      toast.success("Batch approved and sent to Finance");
      setSelectedBatch(null);
      setRejectedIds(new Set());
      refetchBatches();
    } catch (error) {
      toast.error("Failed to approve batch");
    }
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Head of Department Dashboard</h1>
        <p className="text-muted-foreground">
          {currentDepartment?.name} - Review and approve top-up requests
        </p>
      </div>

      {/* Pending Batches */}
      <div className="grid gap-4">
        {pendingBatches?.map((batch) => (
          <Card
            key={batch.id}
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => {
              setSelectedBatch(batch);
              setRejectedIds(new Set());
            }}
          >
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Package className="w-5 h-5" />
                  Top-Up Request #{batch.id}
                </CardTitle>
                <Badge>Pending Your Approval</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Created</p>
                  <p className="font-medium">
                    {new Date(batch.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Items</p>
                  <p className="font-medium">{batch.receipts.length} receipts</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Total Amount</p>
                  <p className="font-medium text-lg">
                    ${parseFloat(batch.totalAmount).toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">GST</p>
                  <p className="font-medium">
                    ${parseFloat(batch.totalGst).toFixed(2)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {(!pendingBatches || pendingBatches.length === 0) && (
          <Card>
            <CardContent className="py-12 text-center">
              <CheckCircle2 className="w-12 h-12 mx-auto text-green-500 mb-3" />
              <p className="font-medium">All caught up!</p>
              <p className="text-sm text-muted-foreground">
                No pending top-up requests to review
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Batch Review Modal */}
      <Dialog
        open={!!selectedBatch}
        onOpenChange={() => {
          setSelectedBatch(null);
          setRejectedIds(new Set());
        }}
      >
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              Review Top-Up Request #{selectedBatch?.id}
            </DialogTitle>
          </DialogHeader>

          {selectedBatch && (
            <div className="space-y-6">
              {/* Summary Stats */}
              <div className="grid grid-cols-3 gap-4">
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-sm text-muted-foreground">Original Total</p>
                    <p className="text-2xl font-bold">
                      ${parseFloat(selectedBatch.totalAmount).toFixed(2)}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-sm text-muted-foreground">Adjusted Total</p>
                    <p className="text-2xl font-bold text-primary">
                      ${adjustedTotals.amount.toFixed(2)}
                    </p>
                    {rejectedIds.size > 0 && (
                      <p className="text-xs text-muted-foreground">
                        -{rejectedIds.size} item(s) rejected
                      </p>
                    )}
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-sm text-muted-foreground">GST Total</p>
                    <p className="text-2xl font-bold">
                      ${adjustedTotals.gst.toFixed(2)}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Category Breakdown Chart */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <BarChart3 className="w-5 h-5" />
                    Spend by Category
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={categoryBreakdown} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                        <XAxis type="number" tickFormatter={(v) => `$${v}`} />
                        <YAxis
                          type="category"
                          dataKey="category"
                          width={120}
                          tick={{ fontSize: 12 }}
                        />
                        <Tooltip
                          formatter={(value: number) => [`$${value.toFixed(2)}`, "Amount"]}
                          labelFormatter={(label) =>
                            categoryBreakdown.find((c) => c.category === label)
                              ?.fullCategory || label
                          }
                        />
                        <Bar dataKey="amount" radius={[0, 4, 4, 0]}>
                          {categoryBreakdown.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Line Items Table */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">
                    Line Items ({selectedBatch.receipts.length})
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Uncheck items to reject them from this batch
                  </p>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">Include</TableHead>
                        <TableHead>Merchant</TableHead>
                        <TableHead>Staff</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead className="text-right">GST</TableHead>
                        <TableHead className="w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedBatch.receipts.map((receipt) => {
                        const isRejected = rejectedIds.has(receipt.id);
                        return (
                          <TableRow
                            key={receipt.id}
                            className={isRejected ? "opacity-50 bg-red-50" : ""}
                          >
                            <TableCell>
                              <Checkbox
                                checked={!isRejected}
                                onCheckedChange={() =>
                                  handleToggleReceipt(receipt.id)
                                }
                              />
                            </TableCell>
                            <TableCell>
                              <div>
                                <p className="font-medium">
                                  {receipt.merchantName || "Unknown"}
                                </p>
                                {receipt.aiFlags && receipt.aiFlags.length > 0 && (
                                  <div className="flex gap-1 mt-1">
                                    {receipt.aiFlags.slice(0, 2).map((flag, i) => (
                                      <Badge
                                        key={i}
                                        variant="destructive"
                                        className="text-xs"
                                      >
                                        <AlertTriangle className="w-3 h-3 mr-1" />
                                        {flag}
                                      </Badge>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>{receipt.staffName}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                {receipt.category}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              ${parseFloat(receipt.amountTotal || "0").toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right">
                              ${parseFloat(receipt.amountGst || "0").toFixed(2)}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setViewingReceipt(receipt);
                                }}
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Actions */}
              <div className="flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedBatch(null);
                    setRejectedIds(new Set());
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleApproveBatch}
                  disabled={approveMutation.isPending}
                >
                  {approveMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                  )}
                  Approve Batch (${adjustedTotals.amount.toFixed(2)})
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
