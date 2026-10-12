import type { FinanceFundRequest } from '@/types/finance'

interface FundRequestHistoryBodyProps {
  historyRequest: FinanceFundRequest
}

export const FundRequestHistoryBody = ({ historyRequest }: FundRequestHistoryBodyProps) => {
  return (
    <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1 text-xs">
      <div className="relative border-l-2 border-indigo-100 pl-4 ml-2 space-y-5 py-2">
        {/* 1. Request submission */}
        <div className="relative">
          <div className="absolute -left-[22px] mt-0.5 w-3.5 h-3.5 rounded-full bg-blue-500 border-2 border-white shadow-sm"></div>
          <div className="text-xs font-bold text-gray-900">Request Submitted</div>
          <div className="text-[11px] text-gray-500 mt-0.5">
            Requested amount: <strong className="text-gray-800">₱{historyRequest.requestedAmount.toLocaleString()}</strong> by <strong className="text-gray-800">{historyRequest.requestedByName}</strong>
          </div>
        </div>

        {/* 2. Approval or Rejection */}
        {historyRequest.approvedByName && (
          <div className="relative">
            <div className="absolute -left-[22px] mt-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white shadow-sm"></div>
            <div className="text-xs font-bold text-emerald-700">Approved</div>
            <div className="text-[11px] text-gray-500 mt-0.5">
              Approved by <strong className="text-gray-800">{historyRequest.approvedByName}</strong> {historyRequest.approvalRemarks ? `("${historyRequest.approvalRemarks}")` : ''}
            </div>
          </div>
        )}

        {historyRequest.rejectedByName && (
          <div className="relative">
            <div className="absolute -left-[22px] mt-0.5 w-3.5 h-3.5 rounded-full bg-red-500 border-2 border-white shadow-sm"></div>
            <div className="text-xs font-bold text-red-600">Rejected</div>
            <div className="text-[11px] text-gray-500 mt-0.5">
              Rejected by <strong className="text-gray-800">{historyRequest.rejectedByName}</strong> {historyRequest.rejectionReason ? ` - Reason: "${historyRequest.rejectionReason}"` : ''}
            </div>
          </div>
        )}

        {/* 3. Funds Released */}
        {historyRequest.releasedByName && (
          <div className="relative">
            <div className="absolute -left-[22px] mt-0.5 w-3.5 h-3.5 rounded-full bg-amber-500 border-2 border-white shadow-sm"></div>
            <div className="text-xs font-bold text-amber-700">Funds Released</div>
            <div className="text-[11px] text-gray-500 mt-0.5">
              Disbursed <strong className="text-gray-800">₱{historyRequest.releasedAmount?.toLocaleString()}</strong> by <strong className="text-gray-800">{historyRequest.releasedByName}</strong> to <strong className="text-gray-800">{historyRequest.releasedToName || historyRequest.requestedByName}</strong> on {historyRequest.releasedDate} {historyRequest.releaseRemarks ? `("${historyRequest.releaseRemarks}")` : ''}
            </div>
          </div>
        )}

        {/* 4. Liquidation */}
        {historyRequest.liquidatedByName && (
          <div className="relative">
            <div className="absolute -left-[22px] mt-0.5 w-3.5 h-3.5 rounded-full bg-indigo-500 border-2 border-white shadow-sm"></div>
            <div className="text-xs font-bold text-indigo-700">Liquidation Submitted</div>
            <div className="text-[11px] text-gray-500 mt-0.5">
              Reported by <strong className="text-gray-800">{historyRequest.liquidatedByName}</strong> showing <strong className="text-gray-800">₱{historyRequest.totalSpent?.toLocaleString()}</strong> spent and <strong className="text-gray-800">₱{historyRequest.returnedAmount?.toLocaleString()}</strong> returned. {historyRequest.liquidationRemarks ? `("${historyRequest.liquidationRemarks}")` : ''}
            </div>
          </div>
        )}

        {/* 5. Closed */}
        {historyRequest.liquidationReviewedByName && (
          <div className="relative">
            <div className="absolute -left-[22px] mt-0.5 w-3.5 h-3.5 rounded-full bg-gray-500 border-2 border-white shadow-sm"></div>
            <div className="text-xs font-bold text-gray-700">Workflow Closed</div>
            <div className="text-[11px] text-gray-500 mt-0.5">
              Reviewed & verified closed by <strong className="text-gray-800">{historyRequest.liquidationReviewedByName}</strong> {historyRequest.liquidationReviewRemarks ? `("${historyRequest.liquidationReviewRemarks}")` : ''}
            </div>
          </div>
        )}

        {/* 5.1 Reopened for Review */}
        {historyRequest.liquidationReopenedByName && (
          <div className="relative">
            <div className="absolute -left-[22px] mt-0.5 w-3.5 h-3.5 rounded-full bg-amber-500 border-2 border-white shadow-sm"></div>
            <div className="text-xs font-bold text-amber-700">Reopened for Review</div>
            <div className="text-[11px] text-gray-500 mt-0.5">
              Reopened by <strong className="text-gray-800">{historyRequest.liquidationReopenedByName}</strong> {historyRequest.liquidationReopenReason ? ` - Reason: "${historyRequest.liquidationReopenReason}"` : ''}
            </div>
          </div>
        )}

        {/* 6. Cancelled */}
        {historyRequest.cancelledByName && (
          <div className="relative">
            <div className="absolute -left-[22px] mt-0.5 w-3.5 h-3.5 rounded-full bg-slate-500 border-2 border-white shadow-sm"></div>
            <div className="text-xs font-bold text-slate-700">Request Cancelled</div>
            <div className="text-[11px] text-gray-500 mt-0.5">
              Cancelled by <strong className="text-gray-800">{historyRequest.cancelledByName}</strong> {historyRequest.cancellationReason ? ` - Reason: "${historyRequest.cancellationReason}"` : ''}
            </div>
          </div>
        )}

        {/* 7. Voided */}
        {historyRequest.voidedByName && (
          <div className="relative">
            <div className="absolute -left-[22px] mt-0.5 w-3.5 h-3.5 rounded-full bg-rose-500 border-2 border-white shadow-sm"></div>
            <div className="text-xs font-bold text-rose-700">Request Voided</div>
            <div className="text-[11px] text-gray-500 mt-0.5">
              Voided by <strong className="text-gray-800">{historyRequest.voidedByName}</strong> {historyRequest.voidReason ? ` - Reason: "${historyRequest.voidReason}"` : ''}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
