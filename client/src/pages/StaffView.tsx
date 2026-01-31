import { useState, useRef } from "react";
import { usePersona } from "@/contexts/PersonaContext";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Camera,
  Upload,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Receipt,
  Sparkles,
} from "lucide-react";
import { EXPENSE_CATEGORIES, STATUS_LABELS, STATUS_COLORS } from "@shared/types";

type ExtractionResult = {
  imageUrl: string;
  imageKey: string;
  extraction: {
    merchantName: string | null;
    transactionDate: string | null;
    amountTotal: number | null;
    amountGst: number | null;
    category: string;
    confidence: number;
    reasoning: string;
    flags: string[];
    lineItems: Array<{ description: string; amount: number }>;
  };
};

export default function StaffView() {
  const { departmentId, staffName, setStaffName } = usePersona();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [isUploading, setIsUploading] = useState(false);
  const [extraction, setExtraction] = useState<ExtractionResult | null>(null);
  const [formData, setFormData] = useState({
    merchantName: "",
    transactionDate: "",
    amountTotal: "",
    amountGst: "",
    category: "",
    projectCode: "",
  });

  // Queries
  const { data: departments } = trpc.department.list.useQuery();
  const { data: staffList } = trpc.staff.listByDepartment.useQuery(
    { departmentId: departmentId! },
    { enabled: !!departmentId }
  );
  const { data: recentReceipts, refetch: refetchReceipts } =
    trpc.receipt.listByDepartment.useQuery(
      { departmentId: departmentId! },
      { enabled: !!departmentId }
    );

  // Mutations
  const uploadMutation = trpc.receipt.uploadAndExtract.useMutation();
  const createReceiptMutation = trpc.receipt.create.useMutation();
  const getOrCreateStaff = trpc.staff.getOrCreate.useMutation();

  const currentDepartment = departments?.find((d) => d.id === departmentId);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !departmentId || !staffName) {
      if (!staffName) {
        toast.error("Please enter your name first");
      }
      return;
    }

    setIsUploading(true);
    setExtraction(null);

    try {
      // Get or create staff
      const staffMember = await getOrCreateStaff.mutateAsync({
        name: staffName,
        departmentId,
      });

      // Convert file to base64
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(",")[1];

        try {
          const result = await uploadMutation.mutateAsync({
            imageBase64: base64,
            mimeType: file.type,
            staffId: staffMember.id,
            staffName: staffMember.name,
            departmentId,
            departmentName: currentDepartment?.name || "",
          });

          setExtraction(result);

          // Pre-fill form with extracted data
          setFormData({
            merchantName: result.extraction.merchantName || "",
            transactionDate: result.extraction.transactionDate || "",
            amountTotal: result.extraction.amountTotal?.toString() || "",
            amountGst: result.extraction.amountGst?.toString() || "",
            category: result.extraction.category || "",
            projectCode: "",
          });

          toast.success("Receipt analyzed successfully!");
        } catch (error) {
          console.error("Upload error:", error);
          toast.error("Failed to analyze receipt. Please try again.");
        } finally {
          setIsUploading(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error("Staff creation error:", error);
      toast.error("Failed to process request");
      setIsUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (!extraction || !departmentId || !staffName) return;

    try {
      const staffMember = await getOrCreateStaff.mutateAsync({
        name: staffName,
        departmentId,
      });

      await createReceiptMutation.mutateAsync({
        imageUrl: extraction.imageUrl,
        imageKey: extraction.imageKey,
        staffId: staffMember.id,
        staffName: staffMember.name,
        departmentId,
        departmentName: currentDepartment?.name || "",
        merchantName: formData.merchantName || null,
        transactionDate: formData.transactionDate || null,
        amountTotal: formData.amountTotal ? parseFloat(formData.amountTotal) : null,
        amountGst: formData.amountGst ? parseFloat(formData.amountGst) : null,
        category: formData.category as any,
        projectCode: formData.projectCode || null,
        aiConfidence: extraction.extraction.confidence,
        aiReasoning: extraction.extraction.reasoning,
        aiFlags: extraction.extraction.flags,
      });

      toast.success("Claim submitted successfully!");
      setExtraction(null);
      setFormData({
        merchantName: "",
        transactionDate: "",
        amountTotal: "",
        amountGst: "",
        category: "",
        projectCode: "",
      });
      refetchReceipts();
    } catch (error) {
      console.error("Submit error:", error);
      toast.error("Failed to submit claim");
    }
  };

  const myReceipts = recentReceipts?.filter(
    (r) => r.staffName.toLowerCase() === staffName.toLowerCase()
  ).slice(0, 5);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Submit Expense Claim</h1>
        <p className="text-muted-foreground">
          Upload your receipt and we'll extract the details automatically
        </p>
      </div>

      {/* Identity Section */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Your Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm">Department</Label>
              <p className="text-sm font-medium mt-1">
                {currentDepartment?.name || "Select a department"}
              </p>
            </div>
            <div>
              <Label htmlFor="staffName" className="text-sm">
                Your Name
              </Label>
              <Input
                id="staffName"
                placeholder="Enter your name"
                value={staffName}
                onChange={(e) => setStaffName(e.target.value)}
                list="staff-names"
                className="mt-1"
              />
              <datalist id="staff-names">
                {staffList?.map((s) => (
                  <option key={s.id} value={s.name} />
                ))}
              </datalist>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Upload Section */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Camera className="w-5 h-5" />
            Capture Receipt
          </CardTitle>
        </CardHeader>
        <CardContent>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileSelect}
            className="hidden"
          />

          {!extraction && !isUploading && (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary hover:bg-accent/50 transition-colors"
            >
              <Upload className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
              <p className="font-medium">Click to upload or take photo</p>
              <p className="text-sm text-muted-foreground mt-1">
                Supports JPG, PNG, HEIC
              </p>
            </div>
          )}

          {isUploading && (
            <div className="border rounded-lg p-8 text-center">
              <Loader2 className="w-12 h-12 mx-auto text-primary animate-spin mb-3" />
              <p className="font-medium">Analyzing receipt with AI...</p>
              <p className="text-sm text-muted-foreground mt-1">
                Extracting merchant, date, amount, and category
              </p>
            </div>
          )}

          {extraction && (
            <div className="space-y-4">
              {/* Receipt Preview */}
              <div className="flex gap-4">
                <div className="w-32 h-40 rounded-lg overflow-hidden border bg-muted flex-shrink-0">
                  <img
                    src={extraction.imageUrl}
                    alt="Receipt"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium">AI Analysis</span>
                    <Badge variant="outline">
                      {extraction.extraction.confidence}% confidence
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">
                    {extraction.extraction.reasoning}
                  </p>
                  {extraction.extraction.flags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {extraction.extraction.flags.map((flag, i) => (
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
              </div>

              {/* Verification Form */}
              <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                <div>
                  <Label htmlFor="merchant">Merchant</Label>
                  <Input
                    id="merchant"
                    value={formData.merchantName}
                    onChange={(e) =>
                      setFormData({ ...formData, merchantName: e.target.value })
                    }
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="date">Date</Label>
                  <Input
                    id="date"
                    type="date"
                    value={formData.transactionDate}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        transactionDate: e.target.value,
                      })
                    }
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="amount">Total Amount (SGD)</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    value={formData.amountTotal}
                    onChange={(e) =>
                      setFormData({ ...formData, amountTotal: e.target.value })
                    }
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="gst">GST Amount (SGD)</Label>
                  <Input
                    id="gst"
                    type="number"
                    step="0.01"
                    value={formData.amountGst}
                    onChange={(e) =>
                      setFormData({ ...formData, amountGst: e.target.value })
                    }
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="category">Category</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(v) =>
                      setFormData({ ...formData, category: v })
                    }
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {EXPENSE_CATEGORIES.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="project">Project Code / Purpose</Label>
                  <Input
                    id="project"
                    placeholder="e.g., Jurong Port Team Lunch"
                    value={formData.projectCode}
                    onChange={(e) =>
                      setFormData({ ...formData, projectCode: e.target.value })
                    }
                    className="mt-1"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setExtraction(null);
                    setFormData({
                      merchantName: "",
                      transactionDate: "",
                      amountTotal: "",
                      amountGst: "",
                      category: "",
                      projectCode: "",
                    });
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={
                    createReceiptMutation.isPending ||
                    !formData.amountTotal ||
                    !formData.category
                  }
                  className="flex-1"
                >
                  {createReceiptMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                  )}
                  Submit Claim
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Submissions */}
      {myReceipts && myReceipts.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Receipt className="w-5 h-5" />
              Your Recent Submissions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {myReceipts.map((receipt) => (
                <div
                  key={receipt.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                      <Receipt className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">
                        {receipt.merchantName || "Unknown Merchant"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        ${parseFloat(receipt.amountTotal?.toString() || "0").toFixed(2)} •{" "}
                        {receipt.category}
                      </p>
                    </div>
                  </div>
                  <Badge
                    className={STATUS_COLORS[receipt.status as keyof typeof STATUS_COLORS]}
                  >
                    {STATUS_LABELS[receipt.status as keyof typeof STATUS_LABELS]}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
