import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ── Helpers ────────────────────────────────────────────────────────────────────
const resolveOwnerId = (req) =>
  req.user.role === "staff" ? req.user.ownerId : req.user.id;

// ── GET /api/v1/properties/wallet ─────────────────────────────────────────────
export const getWallet = async (req, res) => {
  try {
    const ownerId = resolveOwnerId(req);

    const properties = await prisma.property.findMany({
      where: { userId: ownerId },
      select: { id: true },
    });
    const propertyIds = properties.map((p) => p.id);

    const wallet = await prisma.wallet.findUnique({
      where: { userId: ownerId },
      include: {
        transactions: { orderBy: { createdAt: "desc" }, take: 50 },
        withdrawals:  { orderBy: { createdAt: "desc" }, take: 50 },
      },
    });

    const availableBalance = wallet ? parseFloat(wallet.balance) : 0;

    // Pending balance: confirmed bookings with future check-in (net of commission)
    const pendingBookings = await prisma.booking.findMany({
      where: {
        propertyId: { in: propertyIds },
        status: "CONFIRMED",
        paymentStatus: "PAID",
        checkInDate: { gte: new Date() },
      },
      select: { totalAmount: true, commissionAmount: true },
    });
    const pendingBalance = pendingBookings.reduce((sum, b) => {
      return sum + parseFloat(b.totalAmount) - parseFloat(b.commissionAmount || 0);
    }, 0);

    const commissionAgg = await prisma.booking.aggregate({
      where: {
        propertyId: { in: propertyIds },
        status: "CONFIRMED",
        paymentStatus: "PAID",
      },
      _sum: { commissionAmount: true, totalAmount: true },
    });

    const totalCommissionDeducted = parseFloat(commissionAgg._sum.commissionAmount || 0);
    const totalRevenue = parseFloat(commissionAgg._sum.totalAmount || 0);
    const totalEarnings = wallet
      ? wallet.transactions
          .filter((t) => t.type === "BOOKING_EARNING")
          .reduce((s, t) => s + parseFloat(t.amount), 0)
      : 0;

    // Bank details saved in wallet
    const bankDetails = wallet
      ? {
          accountNumber: wallet.accountNumber,
          accountHolder: wallet.accountHolder,
          ifscCode: wallet.ifscCode,
          bankName: wallet.bankName,
          upiId: wallet.upiId,
          hasBankDetails: !!(wallet.accountNumber && wallet.ifscCode),
          hasUpiDetails: !!wallet.upiId,
        }
      : { hasBankDetails: false, hasUpiDetails: false };

    return res.status(200).json({
      success: true,
      data: {
        availableBalance,
        pendingBalance: parseFloat(pendingBalance.toFixed(2)),
        totalEarnings: parseFloat(totalEarnings.toFixed(2)),
        totalRevenue: parseFloat(totalRevenue.toFixed(2)),
        totalCommissionDeducted: parseFloat(totalCommissionDeducted.toFixed(2)),
        bankDetails,
        transactions: wallet
          ? wallet.transactions.map((t) => ({
              id: t.id,
              amount: parseFloat(t.amount),
              type: t.type,
              bookingId: t.bookingId,
              description: t.description,
              createdAt: t.createdAt,
            }))
          : [],
        withdrawals: wallet
          ? wallet.withdrawals.map((w) => ({
              id: w.id,
              amount: parseFloat(w.amount),
              payoutMethod: w.payoutMethod,
              status: w.status,
              adminNote: w.adminNote,
              transferRef: w.transferRef,
              transferredAt: w.transferredAt,
              createdAt: w.createdAt,
            }))
          : [],
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ── PUT /api/v1/properties/wallet/bank-details ────────────────────────────────
export const saveBankDetails = async (req, res) => {
  try {
    const ownerId = resolveOwnerId(req);
    const { accountNumber, accountHolder, ifscCode, bankName, upiId } = req.body;

    // Must provide either bank details OR UPI
    if (!upiId && !(accountNumber && accountHolder && ifscCode)) {
      return res.status(400).json({
        success: false,
        message: "Provide either UPI ID or complete bank details (account number, account holder, IFSC code).",
      });
    }

    const wallet = await prisma.wallet.upsert({
      where: { userId: ownerId },
      update: {
        accountNumber: accountNumber || null,
        accountHolder: accountHolder || null,
        ifscCode: ifscCode || null,
        bankName: bankName || null,
        upiId: upiId || null,
      },
      create: {
        userId: ownerId,
        balance: 0,
        accountNumber: accountNumber || null,
        accountHolder: accountHolder || null,
        ifscCode: ifscCode || null,
        bankName: bankName || null,
        upiId: upiId || null,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Bank/UPI details saved successfully.",
      data: {
        accountNumber: wallet.accountNumber,
        accountHolder: wallet.accountHolder,
        ifscCode: wallet.ifscCode,
        bankName: wallet.bankName,
        upiId: wallet.upiId,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ── POST /api/v1/properties/wallet/withdraw ───────────────────────────────────
export const requestWithdrawal = async (req, res) => {
  try {
    const ownerId = resolveOwnerId(req);
    const { amount } = req.body;

    const withdrawalAmount = parseFloat(amount);
    if (!withdrawalAmount || withdrawalAmount <= 0) {
      return res.status(400).json({ success: false, message: "Invalid withdrawal amount." });
    }

    const wallet = await prisma.wallet.findUnique({ where: { userId: ownerId } });

    if (!wallet) {
      return res.status(400).json({ success: false, message: "No wallet found. Make a booking first." });
    }

    // Check bank/UPI details
    const hasBankDetails = !!(wallet.accountNumber && wallet.ifscCode);
    const hasUpiDetails = !!wallet.upiId;
    if (!hasBankDetails && !hasUpiDetails) {
      return res.status(400).json({
        success: false,
        message: "Please save your bank or UPI details before requesting a withdrawal.",
      });
    }

    const currentBalance = parseFloat(wallet.balance);
    if (withdrawalAmount > currentBalance) {
      return res.status(400).json({
        success: false,
        message: `Insufficient balance. Available: ₹${currentBalance.toFixed(2)}`,
      });
    }

    // Check no pending withdrawal already exists
    const existingPending = await prisma.withdrawalRequest.findFirst({
      where: { walletId: wallet.id, status: "PENDING" },
    });
    if (existingPending) {
      return res.status(400).json({
        success: false,
        message: "You already have a pending withdrawal request. Please wait for it to be processed.",
      });
    }

    // Determine payout method
    const payoutMethod = hasUpiDetails ? "UPI" : "BANK";

    // Create request + deduct from balance in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const withdrawal = await tx.withdrawalRequest.create({
        data: {
          walletId: wallet.id,
          amount: withdrawalAmount,
          payoutMethod,
          accountNumber: wallet.accountNumber,
          accountHolder: wallet.accountHolder,
          ifscCode: wallet.ifscCode,
          bankName: wallet.bankName,
          upiId: wallet.upiId,
          status: "PENDING",
        },
      });

      // Hold balance: deduct immediately, refund if rejected
      await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: { decrement: withdrawalAmount } },
      });

      // Record debit transaction
      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          amount: withdrawalAmount,
          type: "WITHDRAWAL",
          description: `Withdrawal request #${withdrawal.id} submitted for ₹${withdrawalAmount}`,
        },
      });

      return withdrawal;
    });

    return res.status(201).json({
      success: true,
      message: "Withdrawal request submitted. Admin will process it within 2–3 business days.",
      data: { id: result.id, amount: withdrawalAmount, status: result.status },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ── Admin: GET /api/v1/admin/withdrawals ──────────────────────────────────────
export const adminListWithdrawals = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = status ? { status } : {};

    const [withdrawals, total] = await Promise.all([
      prisma.withdrawalRequest.findMany({
        where,
        include: {
          wallet: { include: { user: { select: { id: true, fullName: true, email: true } } } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: parseInt(limit),
      }),
      prisma.withdrawalRequest.count({ where }),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        withdrawals: withdrawals.map((w) => ({
          id: w.id,
          amount: parseFloat(w.amount),
          payoutMethod: w.payoutMethod,
          status: w.status,
          accountNumber: w.accountNumber,
          accountHolder: w.accountHolder,
          ifscCode: w.ifscCode,
          bankName: w.bankName,
          upiId: w.upiId,
          adminNote: w.adminNote,
          transferRef: w.transferRef,
          transferredAt: w.transferredAt,
          reviewedAt: w.reviewedAt,
          createdAt: w.createdAt,
          owner: w.wallet?.user || null,
        })),
        total,
        page: parseInt(page),
        limit: parseInt(limit),
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ── Admin: PATCH /api/v1/admin/withdrawals/:id ────────────────────────────────
export const adminUpdateWithdrawal = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, adminNote, transferRef } = req.body;
    // action: "APPROVE" | "REJECT" | "TRANSFER"

    const withdrawal = await prisma.withdrawalRequest.findUnique({
      where: { id: parseInt(id) },
      include: { wallet: true },
    });

    if (!withdrawal) {
      return res.status(404).json({ success: false, message: "Withdrawal request not found." });
    }

    let updateData = { adminNote: adminNote || withdrawal.adminNote, reviewedBy: req.admin?.id };

    if (action === "APPROVE") {
      if (withdrawal.status !== "PENDING") {
        return res.status(400).json({ success: false, message: "Only PENDING requests can be approved." });
      }
      updateData.status = "APPROVED";
      updateData.reviewedAt = new Date();
    } else if (action === "REJECT") {
      if (!["PENDING", "APPROVED"].includes(withdrawal.status)) {
        return res.status(400).json({ success: false, message: "Only PENDING or APPROVED requests can be rejected." });
      }
      updateData.status = "REJECTED";
      updateData.reviewedAt = new Date();

      // Refund balance back to wallet
      await prisma.$transaction([
        prisma.wallet.update({
          where: { id: withdrawal.walletId },
          data: { balance: { increment: parseFloat(withdrawal.amount) } },
        }),
        prisma.walletTransaction.create({
          data: {
            walletId: withdrawal.walletId,
            amount: parseFloat(withdrawal.amount),
            type: "WITHDRAWAL_REFUND",
            description: `Withdrawal request #${withdrawal.id} rejected — ₹${parseFloat(withdrawal.amount)} refunded`,
          },
        }),
      ]);
    } else if (action === "TRANSFER") {
      if (withdrawal.status !== "APPROVED") {
        return res.status(400).json({ success: false, message: "Only APPROVED requests can be marked as transferred." });
      }
      updateData.status = "TRANSFERRED";
      updateData.transferRef = transferRef || null;
      updateData.transferredAt = new Date();
    } else {
      return res.status(400).json({ success: false, message: "Invalid action. Use APPROVE, REJECT, or TRANSFER." });
    }

    const updated = await prisma.withdrawalRequest.update({
      where: { id: parseInt(id) },
      data: updateData,
    });

    return res.status(200).json({
      success: true,
      message: `Withdrawal request ${action}D successfully.`,
      data: { id: updated.id, status: updated.status },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
