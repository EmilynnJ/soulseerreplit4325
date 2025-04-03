import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Gift } from "@shared/schema";
import { formatCurrency } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";

import { 
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertTriangle, CheckCircle, DollarSign, Sparkles, Heart, Star, Diamond } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

// Define interface for the API response
interface ProcessGiftsResponse {
  success: boolean;
  processedCount: number;
  failedCount: number;
}

export function GiftManagement() {
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [processResult, setProcessResult] = useState<{
    success: boolean;
    message: string;
    processedCount: number;
    failedCount: number;
  } | null>(null);

  // Fetch unprocessed gifts
  const {
    data: unprocessedGifts,
    isLoading: isLoadingUnprocessed,
    error: unprocessedError,
    refetch: refetchUnprocessed
  } = useQuery<(Gift & { senderUsername: string; recipientUsername: string })[]>({
    queryKey: ["/api/admin/gifts/unprocessed"],
    refetchOnWindowFocus: false,
  });

  // Fetch all gifts (for history)
  const {
    data: allGifts,
    isLoading: isLoadingAll,
    error: allGiftsError,
    refetch: refetchAll
  } = useQuery<(Gift & { senderUsername: string; recipientUsername: string })[]>({
    queryKey: ["/api/admin/gifts"],
    refetchOnWindowFocus: false,
  });

  // Process gifts mutation
  const processGiftsMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/admin/gifts/process", {
        method: "POST"
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to process gifts');
      }
      
      return response.json() as Promise<ProcessGiftsResponse>;
    },
    onSuccess: (data) => {
      setProcessResult({
        success: data.success,
        message: data.processedCount > 0 
          ? `Successfully processed ${data.processedCount} gift${data.processedCount !== 1 ? 's' : ''}` 
          : "No gifts were processed",
        processedCount: data.processedCount,
        failedCount: data.failedCount || 0
      });

      // Refresh the gifts data
      refetchUnprocessed();
      refetchAll();

      toast({
        title: data.success ? "Gifts Processed" : "No Gifts to Process",
        description: data.processedCount > 0 
          ? `Successfully processed ${data.processedCount} gift${data.processedCount !== 1 ? 's' : ''}` 
          : "No unprocessed gifts were found",
        variant: data.success ? "default" : "destructive",
      });
    },
    onError: (error) => {
      setProcessResult({
        success: false,
        message: error instanceof Error ? error.message : "An error occurred while processing gifts",
        processedCount: 0,
        failedCount: 0
      });

      toast({
        title: "Failed to Process Gifts",
        description: error instanceof Error ? error.message : "An error occurred while processing gifts",
        variant: "destructive",
      });
    },
    onSettled: () => {
      setIsProcessing(false);
    }
  });

  // Handle processing gifts
  const handleProcessGifts = async () => {
    setIsProcessing(true);
    setProcessResult(null);
    await processGiftsMutation.mutateAsync();
  };

  // Get gift icon based on type
  const getGiftIcon = (giftType: string) => {
    switch (giftType) {
      case 'heart':
        return <Heart className="h-4 w-4 text-red-500" />;
      case 'star':
        return <Star className="h-4 w-4 text-yellow-400" />;
      case 'diamond':
        return <Diamond className="h-4 w-4 text-cyan-400" />;
      case 'custom':
        return <Sparkles className="h-4 w-4 text-purple-400" />;
      case 'applause':
      default:
        return <span className="text-base">👏</span>;
    }
  };

  // Helper function to format the date safely
  const formatDate = (dateStr: string | Date | null) => {
    if (!dateStr) return 'Unknown';
    try {
      return new Date(dateStr).toLocaleString();
    } catch (err) {
      return 'Invalid date';
    }
  };

  if (isLoadingUnprocessed || isLoadingAll) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (unprocessedError || allGiftsError) {
    return (
      <Alert variant="destructive" className="mb-4">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>
          Failed to load gift data. Please try again.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Unprocessed Gifts Section */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold">Unprocessed Gifts</h3>
          <Button 
            onClick={handleProcessGifts} 
            disabled={isProcessing || !unprocessedGifts || unprocessedGifts.length === 0}
            className="gap-2"
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <DollarSign className="h-4 w-4" />
                Process All Gifts
              </>
            )}
          </Button>
        </div>

        {processResult && (
          <Alert 
            variant={processResult.success && processResult.processedCount > 0 ? "default" : "destructive"}
            className="mb-4"
          >
            {processResult.success && processResult.processedCount > 0 ? (
              <CheckCircle className="h-4 w-4" />
            ) : (
              <AlertTriangle className="h-4 w-4" />
            )}
            <AlertTitle>
              {processResult.success && processResult.processedCount > 0 
                ? "Gifts Processed Successfully" 
                : "No Gifts Processed"}
            </AlertTitle>
            <AlertDescription>
              {processResult.message}
              {processResult.failedCount > 0 && (
                <p className="mt-1 text-red-500">
                  Warning: {processResult.failedCount} gift(s) failed to process.
                </p>
              )}
            </AlertDescription>
          </Alert>
        )}

        {unprocessedGifts && unprocessedGifts.length > 0 ? (
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">ID</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead>To</TableHead>
                  <TableHead>Gift Type</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Split</TableHead>
                  <TableHead className="text-right">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {unprocessedGifts.map((gift) => (
                  <TableRow key={gift.id}>
                    <TableCell className="font-mono text-xs">{gift.id}</TableCell>
                    <TableCell>{gift.senderUsername}</TableCell>
                    <TableCell>{gift.recipientUsername}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        {getGiftIcon(gift.giftType)}
                        <span className="capitalize">{gift.giftType}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-semibold">{formatCurrency(gift.amount)}</TableCell>
                    <TableCell>
                      <div className="text-xs">
                        <div>Reader: {formatCurrency(gift.readerAmount)} (70%)</div>
                        <div>Platform: {formatCurrency(gift.platformAmount)} (30%)</div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {formatDate(gift.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="bg-muted/30 rounded-lg p-8 text-center">
            <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p className="text-muted-foreground">No unprocessed gifts found.</p>
          </div>
        )}
      </div>
      
      {/* Gift History Section */}
      <div className="space-y-4 pt-6 border-t">
        <h3 className="text-lg font-semibold">Gift History</h3>
        
        {allGifts && allGifts.length > 0 ? (
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableCaption>History of all gifts on the platform.</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">ID</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead>To</TableHead>
                  <TableHead>Gift Type</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allGifts.map((gift) => (
                  <TableRow key={gift.id}>
                    <TableCell className="font-mono text-xs">{gift.id}</TableCell>
                    <TableCell>{gift.senderUsername}</TableCell>
                    <TableCell>{gift.recipientUsername}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        {getGiftIcon(gift.giftType)}
                        <span className="capitalize">{gift.giftType}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-semibold">{formatCurrency(gift.amount)}</TableCell>
                    <TableCell>
                      <Badge variant={gift.processed ? "default" : "secondary"} 
                        className={gift.processed ? "bg-green-500 hover:bg-green-600" : ""}>
                        {gift.processed ? "Processed" : "Pending"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {formatDate(gift.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="bg-muted/30 rounded-lg p-8 text-center">
            <DollarSign className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p className="text-muted-foreground">No gift history found.</p>
          </div>
        )}
      </div>
    </div>
  );
}