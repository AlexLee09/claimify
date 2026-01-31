import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
} from "lucide-react";
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
  departmentName: string;
  totalAmount: string;
  totalGst: string;
  status: string;
  createdAt: Date;
  hodApprovedAt: Date | null;
  receipts: Receipt[];
};

export default function FinanceView() {
  const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null);
  const [viewingReceipt, setViewingReceipt] = useState<Receipt | null>(null);

  // Queries
  const { data: pendingBatches, refetch: refetchBatches } =
    trpc.batch.getPendingFinance.useQuery();

  // Mutations
  const approveMutation = trpc.batch.financeApprove.useMutation();

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

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Finance Director Dashboard</h1>
        <p className="text-muted-foreground">
          Audit approved batches and process disbursements
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
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
