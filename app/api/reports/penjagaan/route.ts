import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import ExcelJS from 'exceljs';
import path from 'path';
import fs from 'fs';

export async function GET() {
  try {
    // 1. Query the InstitutionProfile to replace placeholders
    const profile = await prisma.institutionProfile.findFirst();
    if (!profile) {
      return NextResponse.json(
        { error: 'Institution Profile not found. Please set up the profile first.' },
        { status: 400 }
      );
    }

    // 2. Query aggregate budget (Pagu) vs actuals (Realisasi) per Rekening
    // Here we include the related RekeningBelanja and sum up the 'BELANJA' transactions
    const rencanaList = await prisma.rencanaBelanja.findMany({
      include: {
        rekeningBelanja: true,
        transaksi: {
          where: { jenis: 'BELANJA' }
        }
      }
    });

    // 3. Load the Excel template or create a base fallback if not uploaded yet
    const templatePath = path.join(process.cwd(), 'public', 'templates', 'Laporan_Penjagaan_Template.xlsx');
    const workbook = new ExcelJS.Workbook();
    
    if (fs.existsSync(templatePath)) {
      await workbook.xlsx.readFile(templatePath);
    } else {
      // Fallback: Create an in-memory template structure if the user hasn't uploaded one
      const sheet = workbook.addWorksheet('Laporan');
      sheet.getCell('A1').value = 'LAPORAN PENJAGAAN PAGU ANGGARAN';
      sheet.getCell('A1').font = { bold: true, size: 14 };
      
      // Placeholders
      sheet.getCell('A3').value = 'Instansi:';
      sheet.getCell('B3').value = '{{NAMA_INSTANSI}}';
      sheet.getCell('A4').value = 'Kepala:';
      sheet.getCell('B4').value = '{{NAMA_KEPALA}} / NIP. {{NIP_KEPALA}}';
      sheet.getCell('A5').value = 'Tahun:';
      sheet.getCell('B5').value = '{{TAHUN}}';

      // Table Headers
      const headers = ['Kode Rekening', 'Uraian Belanja', 'Pagu Anggaran', 'Realisasi', 'Sisa Pagu'];
      sheet.getRow(9).values = headers;
      sheet.getRow(9).font = { bold: true };
    }

    const worksheet = workbook.worksheets[0];

    // 4. Find & Replace Placeholders from the InstitutionProfile
    worksheet.eachRow((row) => {
      row.eachCell((cell) => {
        // Only process string cells that might contain placeholders
        if (cell.type === ExcelJS.ValueType.String && cell.value && typeof cell.value === 'string') {
          let newValue = cell.value;
          newValue = newValue.replace('{{NAMA_INSTANSI}}', profile.nama_instansi);
          newValue = newValue.replace('{{NAMA_KEPALA}}', profile.nama_kepala);
          newValue = newValue.replace('{{NIP_KEPALA}}', profile.nip_kepala);
          newValue = newValue.replace('{{TAHUN}}', profile.tahun_pembukuan.toString());
          
          if (newValue !== cell.value) {
            cell.value = newValue;
          }
        }
      });
    });

    // 5. Inject DB Rows starting at index 10
    const startRowIndex = 10;

    rencanaList.forEach((rencana, index) => {
      // Calculate Realisasi (total Belanja)
      const realisasi = rencana.transaksi.reduce((sum, tx) => sum + Number(tx.nominal), 0);
      const pagu = Number(rencana.pagu_anggaran);
      const sisa = pagu - realisasi;
      
      const rowIndex = startRowIndex + index;
      const row = worksheet.getRow(rowIndex);
      
      // Injecting data into columns A, B, C, D, E (1, 2, 3, 4, 5)
      row.getCell(1).value = rencana.kode_rekening;
      row.getCell(2).value = rencana.rekeningBelanja?.uraian_belanja || 'N/A';
      row.getCell(3).value = pagu;
      row.getCell(4).value = realisasi;
      row.getCell(5).value = sisa;
      
      // Provide Currency Formatting for monetary columns
      row.getCell(3).numFmt = '#,##0.00';
      row.getCell(4).numFmt = '#,##0.00';
      row.getCell(5).numFmt = '#,##0.00';

      row.commit();
    });

    // Adjust column widths for better UX if it's the fallback template
    if (!fs.existsSync(templatePath)) {
      worksheet.getColumn(1).width = 20;
      worksheet.getColumn(2).width = 40;
      worksheet.getColumn(3).width = 25;
      worksheet.getColumn(4).width = 25;
      worksheet.getColumn(5).width = 25;
    }

    // 6. Generate the Buffer and send as downloadable attachment
    const buffer = await workbook.xlsx.writeBuffer();

    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="Laporan_Penjagaan_Pagu.xlsx"',
      },
    });

  } catch (error: any) {
    console.error('Excel Generation Error:', error);
    return NextResponse.json(
      { error: 'Gagal membuat laporan Excel.', details: error.message },
      { status: 500 }
    );
  }
}
