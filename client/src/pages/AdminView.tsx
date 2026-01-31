import { useState } from "react";
import { usePersona } from "@/contexts/PersonaContext";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  DollarSign,
  Package,
  Loader2,
  Eye,
  Sparkles,
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

export default function AdminView() {
  const { departmentId } = usePersona();
  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [isRejecting, setIsRejecting] = useState(false);

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

      {/* Kanban Board */}
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

      {/* Receipt Detail Modal */}
      <Dialog
        open={!!selectedReceipt}
        onOpenChange={() => setSelectedReceipt(null)}
      >
        <DialogContent className="max-w-3xl">
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
                <div className="grid grid-cols-2 gap-4">
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
                    <Badge variant="outline">{selectedReceipt.category}</Badge>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Date</p>
                    <p className="font-medium">
                      {selectedReceipt.transactionDate
                        ? new Date(selectedReceipt.transactionDate).toLocaleDateString()
                        : "Unknown"}
                    </p>
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
    </div>
  );
}
