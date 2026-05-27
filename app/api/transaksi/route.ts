import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { JenisTransaksi, Prisma } from '@prisma/client';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { id_rencana_belanja, tanggal, jenis, uraian, nominal, bukti } = body;

    // 1. Basic validation
    if (!id_rencana_belanja || !tanggal || !jenis || !uraian || nominal === undefined) {
      return NextResponse.json(
        { error: 'Incomplete transaction data. Required fields: id_rencana_belanja, tanggal, jenis, uraian, nominal.' },
        { status: 400 }
      );
    }

    const numericNominal = Number(nominal);
    if (isNaN(numericNominal) || numericNominal <= 0) {
      return NextResponse.json(
        { error: 'Nominal must be a valid positive number.' },
        { status: 400 }
      );
    }

    if (jenis !== JenisTransaksi.PENDAPATAN && jenis !== JenisTransaksi.BELANJA) {
      return NextResponse.json(
        { error: 'Invalid transaction type (jenis). Must be PENDAPATAN or BELANJA.' },
        { status: 400 }
      );
    }

    // 2. Process BELANJA (Expense) with Penjagaan Pagu
    if (jenis === JenisTransaksi.BELANJA) {
      // Using Serializable transaction isolation to prevent race conditions during concurrent budget checks
      const result = await prisma.$transaction(async (tx) => {
        // Fetch the budget plan (Rencana Belanja)
        const rencana = await tx.rencanaBelanja.findUnique({
          where: { id: id_rencana_belanja },
        });

        if (!rencana) {
          throw new Error('BUDGET_NOT_FOUND');
        }

        // Calculate total existing expenses for this budget plan
        const aggregations = await tx.transaksi.aggregate({
          where: {
            id_rencana_belanja: id_rencana_belanja,
            jenis: JenisTransaksi.BELANJA,
          },
          _sum: {
            nominal: true,
          },
        });

        const paguAnggaran = Number(rencana.pagu_anggaran);
        const totalUsed = Number(aggregations._sum.nominal || 0);
        const sisaPagu = paguAnggaran - totalUsed;

        // CRITICAL: Penjagaan Pagu
        if (numericNominal > sisaPagu) {
          throw new Error('INSUFFICIENT_BUDGET');
        }

        // Insert actual transaction
        const transaksi = await tx.transaksi.create({
          data: {
            id_rencana_belanja,
            tanggal: new Date(tanggal),
            jenis,
            uraian,
            nominal: numericNominal,
            bukti: bukti || null,
          },
        });

        return { transaksi, sisaPagu: sisaPagu - numericNominal };
      }, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });

      return NextResponse.json(
        { 
          message: 'Transaction successfully recorded.', 
          data: result.transaksi,
          meta: { sisa_pagu_baru: result.sisaPagu }
        },
        { status: 201 }
      );
    } 
    
    // 3. Process PENDAPATAN (Income)
    else {
      // Incomes do not reduce the expense budget
      const transaksi = await prisma.transaksi.create({
        data: {
          id_rencana_belanja,
          tanggal: new Date(tanggal),
          jenis,
          uraian,
          nominal: numericNominal,
          bukti: bukti || null,
        },
      });

      return NextResponse.json(
        { message: 'Income successfully recorded.', data: transaksi },
        { status: 201 }
      );
    }

  } catch (error: any) {
    console.error('Transaction Error:', error);

    // Business Logic Constraints
    if (error.message === 'INSUFFICIENT_BUDGET') {
      return NextResponse.json(
        { error: 'Transaksi ditolak: Sisa pagu tidak mencukupi.' },
        { status: 400 }
      );
    }

    if (error.message === 'BUDGET_NOT_FOUND') {
      return NextResponse.json(
        { error: 'Rencana Belanja (Budget Plan) not found.' },
        { status: 404 }
      );
    }

    // Handle standard server errors
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
