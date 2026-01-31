import { useState } from "react";
import { usePersona } from "@/contexts/PersonaContext";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  DollarSign,
  Package,
  Loader2,
  Sparkles,
  History,
  Clock,
  FileText,
} from "lucide-react";
import { FLOAT_AMOUNT } from "@shared/types";

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
  createdAt: Date;
};

type ActivityLog = {
  id: number;
  entityType: string;
  entityId: number;
  action: string;
  actorRole: string;
  actorName: string | null;
  description: string;
  createdAt: Date;
};

type BatchWithReceipts = {
  id: number;
  departmentId: number;
  totalAmount: string;
  totalGst: string;
  status: string;
  createdAt: Date;
  hodApprovedAt: Date | null;
  financeApprovedAt: Date | null;
  paidAt: Date | null;
  receipts: Receipt[];
};

export default function AdminView() {
  const { departmentId } = usePersona();
  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [isRejecting, setIsRejecting] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<BatchWithReceipts | null>(null);

  // Queries
  const { data: departments } = trpc.department.list.useQuery();
  const { data: floatData, refetch: refetchFloat } =
    trpc.department.getFloat.useQuery(
      { departmentId: departmentId! },
      { enabled: !!departmentId }
    );
  const { data: submittedReceipts, refetch: refetchSubmitted } =
    trpc.receipt.getSubmitted.useQuery(
      { departmentId: departmentId! },
      { enabled: !!departmentId }
    );
  const { data: approvedReceipts, refetch: refetchApproved } =
    trpc.receipt.getAdminApproved.useQuery(
      { departmentId: departmentId! },
      { enabled: !!departmentId }
    );
  const { data: allBatches } = trpc.batch.listByDepartment.useQuery(
    { departmentId: departmentId! },
    { enabled: !!departmentId }
  );
  const { data: activityLogs } = trpc.activity.listByDepartment.useQuery(
    { departmentId: departmentId!, limit: 50 },
    { enabled: !!departmentId }
  );

  // Mutations
  const approveMutation = trpc.receipt.adminApprove.useMutation();
  const rejectMutation = trpc.receipt.reject.useMutation();
  const createBatchMutation = trpc.batch.create.useMutation();

  const currentDepartment = departments?.find((d) => d.id === departmentId);

  // Split submitted receipts into flagged vs clean
  const flaggedReceipts =
    submittedReceipts?.filter(
      (r) => (r.aiFlags && r.aiFlags.length > 0) || (r.aiConfidence && r.aiConfidence < 80)
    ) || [];
  const cleanReceipts =
    submittedReceipts?.filter(
      (r) => (!r.aiFlags || r.aiFlags.length === 0) && (!r.aiConfidence || r.aiConfidence >= 80)
    ) || [];

  const handleApprove = async (receipt: Receipt) => {
    try {
      await approveMutation.mutateAsync({ id: receipt.id });
      toast.success("Receipt approved");
      refetchSubmitted();
      refetchApproved();
      refetchFloat();
      setSelectedReceipt(null);
    } catch (error) {
      toast.error("Failed to approve receipt");
    }
  };

  const handleReject = async () => {
    if (!selectedReceipt || !rejectReason) return;

    setIsRejecting(true);
    try {
      await rejectMutation.mutateAsync({
        id: selectedReceipt.id,
        rejectedBy: "Admin",
        reason: rejectReason,
      });
      toast.success("Receipt rejected");
      refetchSubmitted();
      setSelectedReceipt(null);
      setRejectReason("");
    } catch (error) {
      toast.error("Failed to reject receipt");
    } finally {
      setIsRejecting(false);
    }
  };

  const handleCreateBatch = async () => {
    if (!approvedReceipts || approvedReceipts.length === 0 || !departmentId)
      return;

    try {
      const receiptIds = approvedReceipts.map((r) => r.id);
      await createBatchMutation.mutateAsync({
        departmentId,
        receiptIds,
      });
      toast.success("Top-up request created and sent to HOD");
      refetchApproved();
      refetchFloat();
    } catch (error) {
      toast.error("Failed to create batch");
    }
  };

  const floatPercentage = floatData
    ? (floatData.remainingFloat / floatData.totalFloat) * 100
    : 100;

  const getFloatColor = () => {
    if (floatPercentage > 50) return "bg-green-500";
    if (floatPercentage > 25) return "bg-yellow-500";
    return "bg-red-500";
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending_hod":
        return <Badge className="bg-purple-100 text-purple-800">Pending HOD</Badge>;
      case "pending_finance":
        return <Badge className="bg-amber-100 text-amber-800">Pending Finance</Badge>;
      case "paid":
        return <Badge className="bg-green-100 text-green-800">Paid</Badge>;
      case "rejected":
        return <Badge variant="destructive">Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getActionIcon = (action: string) => {
    if (action.includes("rejected")) return <XCircle className="w-4 h-4 text-red-500" />;
    if (action.includes("approved") || action === "paid") return <CheckCircle2 className="w-4 h-4 text-green-500" />;
    if (action.includes("batch") || action.includes("created")) return <Package className="w-4 h-4 text-blue-500" />;
    return <FileText className="w-4 h-4 text-gray-500" />;
  };

  const ReceiptCard = ({
    receipt,
    showFlags = true,
  }: {
    receipt: Receipt;
    showFlags?: boolean;
  }) => (
    <div
      onClick={() => setSelectedReceipt(receipt)}
      className="receipt-card"
    >
      <div className="flex justify-between items-start mb-2">
        <div>
          <p className="font-medium text-sm truncate">
            {receipt.merchantName || "Unknown Merchant"}
          </p>
          <p className="text-xs text-muted-foreground">{receipt.staffName}</p>
        </div>
        <p className="font-semibold text-sm">
          ${parseFloat(receipt.amountTotal || "0").toFixed(2)}
        </p>
      </div>
      <div className="flex items-center justify-between">
        <Badge variant="outline" className="text-xs">
          {receipt.category}
        </Badge>
        {showFlags && receipt.aiFlags && receipt.aiFlags.length > 0 && (
          <Badge variant="destructive" className="text-xs">
            <AlertTriangle className="w-3 h-3 mr-1" />
            {receipt.aiFlags.length} flag{receipt.aiFlags.length > 1 ? "s" : ""}
          </Badge>
        )}
        {!showFlags && receipt.aiConfidence && (
          <Badge
            variant="outline"
            className={
              receipt.aiConfidence >= 90
                ? "bg-green-100 text-green-800"
                : "bg-blue-100 text-blue-800"
            }
          >
            <Sparkles className="w-3 h-3 mr-1" />
            {receipt.aiConfidence}%
          </Badge>
        )}
      </div>
    </div>
  );

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Department Admin Dashboard</h1>
        <p className="text-muted-foreground">
          {currentDepartment?.name} - Review and approve expense claims
        </p>
      </div>

      {/* Float Status */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            Cash Float Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span>Remaining Cash</span>
              <span className="font-semibold">
                ${floatData?.remainingFloat.toFixed(2) || "0.00"} / $
                {FLOAT_AMOUNT.toFixed(2)}
              </span>
            </div>
            <div className="float-bar">
              <div
                className={`float-bar-fill ${getFloatColor()}`}
                style={{ width: `${floatPercentage}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Used: ${floatData?.usedFloat.toFixed(2) || "0.00"}</span>
              <span>
                {floatPercentage < 30 && (
                  <span className="text-red-600 font-medium">
                    Low float! Consider creating a top-up request.
                  </span>
                )}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Content Tabs */}
      <Tabs defaultValue="receipts" className="space-y-4">
        <TabsList className="gap-2">
          <TabsTrigger value="receipts" className="flex items-center gap-2 px-4">
            <FileText className="w-4 h-4" />
            Receipts
          </TabsTrigger>
          <TabsTrigger value="requests" className="flex items-center gap-2 px-4">
            <Package className="w-4 h-4" />
            Top-Up Requests
            {allBatches && allBatches.length > 0 && (
              <Badge variant="secondary" className="ml-1">{allBatches.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="activity" className="flex items-center gap-2 px-4">
            <History className="w-4 h-4" />
            Activity Log
          </TabsTrigger>
        </TabsList>

        {/* Receipts Tab - Kanban Board */}
        <TabsContent value="receipts">
          <div className="grid grid-cols-3 gap-4">
            {/* Column 1: To Review (Flagged) */}
            <div className="kanban-column">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  To Review
                </h3>
                <Badge variant="secondary">{flaggedReceipts.length}</Badge>
              </div>
              <div className="space-y-3">
                {flaggedReceipts.map((receipt) => (
                  <ReceiptCard key={receipt.id} receipt={receipt} />
                ))}
                {flaggedReceipts.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No flagged receipts
                  </p>
                )}
              </div>
            </div>

            {/* Column 2: Auto-Sorted (Clean) */}
            <div className="kanban-column">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-blue-500" />
                  AI Verified
                </h3>
                <Badge variant="secondary">{cleanReceipts.length}</Badge>
              </div>
              <div className="space-y-3">
                {cleanReceipts.map((receipt) => (
                  <ReceiptCard
                    key={receipt.id}
                    receipt={receipt}
                    showFlags={false}
                  />
                ))}
                {cleanReceipts.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No clean receipts pending
                  </p>
                )}
              </div>
            </div>

            {/* Column 3: Approved */}
            <div className="kanban-column">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  Approved
                </h3>
                <Badge variant="secondary">{approvedReceipts?.length || 0}</Badge>
              </div>
              <div className="space-y-3">
                {approvedReceipts?.map((receipt) => (
                  <ReceiptCard
                    key={receipt.id}
                    receipt={receipt}
                    showFlags={false}
                  />
                ))}
                {(!approvedReceipts || approvedReceipts.length === 0) && (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No approved receipts
                  </p>
                )}
              </div>

              {/* Create Batch Button */}
              {approvedReceipts && approvedReceipts.length > 0 && (
                <Button
                  onClick={handleCreateBatch}
                  disabled={createBatchMutation.isPending}
                  className="w-full mt-4"
                >
                  {createBatchMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Package className="w-4 h-4 mr-2" />
                  )}
                  Create Top-Up Request
                </Button>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Top-Up Requests Tab */}
        <TabsContent value="requests">
          <div className="space-y-4">
            {allBatches && allBatches.length > 0 ? (
              allBatches.map((batch) => (
                <Card 
                  key={batch.id} 
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => setSelectedBatch(batch)}
                >
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <Package className="w-5 h-5 text-muted-foreground" />
                        <div>
                          <p className="font-semibold">Top-Up Request #{batch.id}</p>
                          <p className="text-sm text-muted-foreground">
                            Created {new Date(batch.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      {getStatusBadge(batch.status)}
                    </div>
                    <div className="grid grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Items</p>
                        <p className="font-medium">{batch.receipts.length} receipts</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Total</p>
                        <p className="font-medium">${parseFloat(batch.totalAmount).toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">GST</p>
                        <p className="font-medium">${parseFloat(batch.totalGst).toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Last Update</p>
                        <p className="font-medium">
                          {batch.paidAt 
                            ? `Paid ${new Date(batch.paidAt).toLocaleDateString()}`
                            : batch.financeApprovedAt 
                            ? `Finance ${new Date(batch.financeApprovedAt).toLocaleDateString()}`
                            : batch.hodApprovedAt 
                            ? `HOD ${new Date(batch.hodApprovedAt).toLocaleDateString()}`
                            : "Pending"}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <Package className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                  <p className="font-medium">No top-up requests yet</p>
                  <p className="text-sm text-muted-foreground">
                    Approve receipts and create a top-up request to see them here
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Activity Log Tab */}
        <TabsContent value="activity">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <History className="w-5 h-5" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                {activityLogs && activityLogs.length > 0 ? (
                  <div className="space-y-3">
                    {activityLogs.map((log) => (
                      <div 
                        key={log.id} 
                        className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 border"
                      >
                        <div className="mt-0.5">
                          {getActionIcon(log.action)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm">{log.description}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-xs">
                              {log.actorRole}
                            </Badge>
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {new Date(log.createdAt).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <History className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                    <p className="font-medium">No activity yet</p>
                    <p className="text-sm text-muted-foreground">
                      Activity will appear here as receipts are processed
                    </p>
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Receipt Detail Modal */}
      <Dialog
        open={!!selectedReceipt}
        onOpenChange={() => setSelectedReceipt(null)}
      >
        <DialogContent className="max-w-7xl w-[95vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Receipt Details</DialogTitle>
          </DialogHeader>

          {selectedReceipt && (
            <div className="grid grid-cols-2 gap-6">
              {/* Left: Image */}
              <div className="space-y-4">
                <div className="aspect-[3/4] rounded-lg overflow-hidden border bg-muted">
                  <img
                    src={selectedReceipt.imageUrl}
                    alt="Receipt"
                    className="w-full h-full object-contain"
                  />
                </div>
              </div>

              {/* Right: Details */}
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Merchant</p>
                    <p className="font-medium">
                      {selectedReceipt.merchantName || "Unknown"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Staff</p>
                    <p className="font-medium">{selectedReceipt.staffName}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Date</p>
                    <p className="font-medium">
                      {selectedReceipt.transactionDate
                        ? new Date(selectedReceipt.transactionDate).toLocaleDateString()
                        : "Unknown"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Amount</p>
                    <p className="font-medium text-lg">
                      ${parseFloat(selectedReceipt.amountTotal || "0").toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">GST</p>
                    <p className="font-medium">
                      ${parseFloat(selectedReceipt.amountGst || "0").toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Category</p>
                    <Badge variant="outline" className="whitespace-nowrap">{selectedReceipt.category}</Badge>
                  </div>
                </div>

                {selectedReceipt.projectCode && (
                  <div>
                    <p className="text-xs text-muted-foreground">Project/Purpose</p>
                    <p className="font-medium">{selectedReceipt.projectCode}</p>
                  </div>
                )}

                {/* AI Insights */}
                <div className="p-3 rounded-lg bg-muted/50 border">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium">AI Analysis</span>
                    <Badge variant="outline">
                      {selectedReceipt.aiConfidence}% confidence
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {selectedReceipt.aiReasoning}
                  </p>
                  {selectedReceipt.aiFlags && selectedReceipt.aiFlags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {selectedReceipt.aiFlags.map((flag, i) => (
                        <Badge key={i} variant="destructive" className="text-xs">
                          <AlertTriangle className="w-3 h-3 mr-1" />
                          {flag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                {/* Float Impact */}
                <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
                  <p className="text-sm text-blue-800">
                    <strong>Impact:</strong> Approving this will deduct $
                    {parseFloat(selectedReceipt.amountTotal || "0").toFixed(2)} from the
                    float.
                  </p>
                </div>

                {/* Actions */}
                {selectedReceipt.status === "submitted" && (
                  <div className="space-y-3 pt-2">
                    <div className="flex gap-3">
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => setIsRejecting(true)}
                      >
                        <XCircle className="w-4 h-4 mr-2" />
                        Reject
                      </Button>
                      <Button
                        className="flex-1"
                        onClick={() => handleApprove(selectedReceipt)}
                        disabled={approveMutation.isPending}
                      >
                        {approveMutation.isPending ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4 mr-2" />
                        )}
                        Approve
                      </Button>
                    </div>

                    {isRejecting && (
                      <div className="space-y-2">
                        <Textarea
                          placeholder="Enter rejection reason..."
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                        />
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setIsRejecting(false);
                              setRejectReason("");
                            }}
                          >
                            Cancel
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={handleReject}
                            disabled={!rejectReason || rejectMutation.isPending}
                          >
                            {rejectMutation.isPending && (
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            )}
                            Confirm Reject
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Batch Detail Modal */}
      <Dialog
        open={!!selectedBatch}
        onOpenChange={() => setSelectedBatch(null)}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              Top-Up Request #{selectedBatch?.id}
            </DialogTitle>
          </DialogHeader>

          {selectedBatch && (
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-sm text-muted-foreground">Status</p>
                    <div className="mt-1">{getStatusBadge(selectedBatch.status)}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-sm text-muted-foreground">Total Amount</p>
                    <p className="text-xl font-bold">${parseFloat(selectedBatch.totalAmount).toFixed(2)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-sm text-muted-foreground">GST</p>
                    <p className="text-xl font-bold">${parseFloat(selectedBatch.totalGst).toFixed(2)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-sm text-muted-foreground">Items</p>
                    <p className="text-xl font-bold">{selectedBatch.receipts.length}</p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Receipts in this batch</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {selectedBatch.receipts.map((receipt) => (
                      <div 
                        key={receipt.id} 
                        className={`flex items-center justify-between p-3 rounded-lg border ${
                          receipt.status === "rejected" ? "bg-red-50 border-red-200" : "bg-muted/50"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {receipt.status === "rejected" ? (
                            <XCircle className="w-5 h-5 text-red-500" />
                          ) : (
                            <CheckCircle2 className="w-5 h-5 text-green-500" />
                          )}
                          <div>
                            <p className="font-medium">{receipt.merchantName || "Unknown"}</p>
                            <p className="text-sm text-muted-foreground">{receipt.staffName}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">${parseFloat(receipt.amountTotal || "0").toFixed(2)}</p>
                          <Badge 
                            variant={receipt.status === "rejected" ? "destructive" : "outline"} 
                            className="text-xs"
                          >
                            {receipt.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
