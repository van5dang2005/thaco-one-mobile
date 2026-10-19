/** Mirrors thaco_be_ql_buu_pham Domain/Common/Enums and Application/DTOs. Enums are numeric on the wire. */

export enum ParcelStatus {
  Waiting = 1,
  Due = 2,
  Overdue = 3,
  Cancelled = 4,
  HandedOver = 5,
}

export enum EmailStatus {
  Skip = 0,
  Successful = 1,
  Failed = 2,
}

export type ParcelAttachment = { id: string; fileName: string; filePath: string; parcelId?: string | null };

export type ParcelLog = {
  id: string;
  parcelId?: string | null;
  action: string;
  description?: string | null;
  performedBy: string;
  performedName: string;
  performedCode: string;
  performedDepartment?: string | null;
  isEmailSent?: boolean | null;
  emailStatus?: EmailStatus | null;
  createdAt: string;
};

export type ParcelDto = {
  id: string;
  transactionCode: string;
  /** `{sequence}_{carrier code}`; the sequence prefix cannot be edited. */
  trackingNumber: string;
  senderFullName: string;
  senderCompanyName?: string | null;
  senderPhoneNumber?: string | null;
  senderAddress?: string | null;
  receiverId: string;
  receiverCode: string;
  receiverFullName: string;
  receiverPhoneNumber?: string | null;
  receiverAvatarUrl?: string | null;
  departmentId: string;
  departmentName?: string | null;
  description?: string | null;
  note?: string | null;
  receivedAt?: string | null;
  createdAt?: string | null;
  handOverAt?: string | null;
  cancelledAt?: string | null;
  cancellationReason?: string | null;
  actualReceiverCode?: string | null;
  status: ParcelStatus;
  attachments: ParcelAttachment[];
  logs: ParcelLog[];
};

/** Why a parcel is in "Bưu phẩm của tôi": mine, or one I collect for its receiver. */
export enum LookupMatchReason {
  Direct = 0,
  DetailedDelegation = 1,
  DefaultDelegation = 2,
}

/** Item of GET /api/parcels/my: no createdAt / cancelledAt. */
export type ParcelLookupDto = Omit<ParcelDto, 'createdAt' | 'cancelledAt' | 'cancellationReason'> & {
  createdAt?: string | null;
  matchReason?: LookupMatchReason | null;
};

export type ParcelStats = {
  total: number;
  /** Waiting + Due. */
  waiting: number;
  handedOver: number;
  overdue: number;
  cancelled: number;
};

export type ParcelDepartment = {
  id: string;
  name?: string | null;
  code?: string | null;
  parentId?: string | null;
  level?: number | null;
  isActive?: boolean | null;
  fullPathName?: string | null;
  departmentConfig?: { departmentId?: string | null; requireApproval: boolean; isReportEnabled: boolean } | null;
};
