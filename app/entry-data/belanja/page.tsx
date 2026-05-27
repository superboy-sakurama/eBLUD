"use client";

import React, { useState } from "react";
import useSWR from "swr";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { AlertCircle, CheckCircle2, Loader2, Plus, Receipt } from "lucide-react";

const fetcher = (url: string) => fetch(url).then((res) => {
  if (!res.ok) throw new Error("Failed to fetch");
  return res.json();
});

// Assuming API schemas return something like this:
type SumberDana = { kode: string; nama: string };
type SubSumberDana = { id: string; nama: string; kode_sumber: string };
type RencanaBelanja = { id: string; kode_rekening: string; uraian_belanja: string; sisa_pagu: number };
type Transaksi = { id: string; tanggal: string; uraian: string; nominal: number; rencanaBelanja: { RekeningBelanja: { uraian_belanja: string } } };

export default function EntryBelanjaPage() {
  // Form State
  const [tanggal, setTanggal] = useState(format(new Date(), "yyyy-MM-dd"));
  const [sumberDanaKode, setSumberDanaKode] = useState("");
  const [idSubSumber, setIdSubSumber] = useState("");
  const [idRencanaBelanja, setIdRencanaBelanja] = useState("");
  const [uraian, setUraian] = useState("");
  const [nominal, setNominal] = useState("");

  // UI State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorObj, setErrorObj] = useState<{ message: string } | null>(null);
  const [successMsg, setSuccessMsg] = useState("");

  // SWR Hooks
  // Note: These endpoints are assumed. You'll need to create the corresponding Next.js API Routes.
  const { data: sumberDanaList } = useSWR<SumberDana[]>("/api/sumber-dana", fetcher, { fallbackData: [] });
  const { data: subSumberDanaList } = useSWR<SubSumberDana[]>(sumberDanaKode ? `/api/sub-sumber-dana?kode=${sumberDanaKode}` : null, fetcher, { fallbackData: [] });
  const { data: rencanaBelanjaList } = useSWR<RencanaBelanja[]>(idSubSumber ? `/api/rencana-belanja?id_sub_sumber=${idSubSumber}` : null, fetcher, { fallbackData: [] });
  const { data: transaksiList, mutate: mutateTransaksi } = useSWR<Transaksi[]>("/api/transaksi?jenis=BELANJA", fetcher, { fallbackData: [] });

  const formatCurrency = (val: number | string) => {
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(Number(val) || 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorObj(null);
    setSuccessMsg("");

    try {
      const res = await fetch("/api/transaksi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id_rencana_belanja: idRencanaBelanja,
          tanggal: new Date(tanggal).toISOString(),
          jenis: "BELANJA",
          uraian,
          nominal: Number(nominal),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Gagal menyimpan transaksi");
      }

      setSuccessMsg("Transaksi berhasil disimpan.");
      setUraian("");
      setNominal("");
      setIdRencanaBelanja("");
      
      // Update datatable immediately
      mutateTransaksi();
      
      // Hide success after 3s
      setTimeout(() => setSuccessMsg(""), 3000);

    } catch (err: any) {
      setErrorObj({ message: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto py-10 px-4 sm:px-6 lg:px-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Entry Data Belanja</h1>
        <p className="text-slate-500 mt-2">Catat transaksi pengeluaran dan jaga batas pagu anggaran.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* FORM SECTION */}
        <div className="lg:col-span-1">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <div className="flex items-center space-x-2 mb-6 pb-4 border-b border-slate-100">
              <Receipt className="w-5 h-5 text-indigo-600" />
              <h2 className="text-lg font-semibold text-slate-800">Form Transaksi</h2>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Tanggal */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Tanggal Transaksi</label>
                <input
                  type="date"
                  required
                  value={tanggal}
                  onChange={(e) => setTanggal(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition sm:text-sm"
                />
              </div>

              {/* Sumber Dana */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Sumber Dana</label>
                <select
                  required
                  value={sumberDanaKode}
                  onChange={(e) => {
                    setSumberDanaKode(e.target.value);
                    setIdSubSumber("");
                    setIdRencanaBelanja("");
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white transition sm:text-sm"
                >
                  <option value="" disabled>Pilih Sumber Dana</option>
                  {(sumberDanaList || []).map((sd) => (
                    <option key={sd.kode} value={sd.kode}>{sd.nama}</option>
                  ))}
                  {/* Fallback for preview if API not ready */}
                  {sumberDanaList?.length === 0 && (
                    <>
                      <option value="KAPITASI">KAPITASI</option>
                      <option value="NON_KAPITASI">NON-KAPITASI</option>
                      <option value="RETRIBUSI">RETRIBUSI</option>
                    </>
                  )}
                </select>
              </div>

              {/* Sub Sumber Dana */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Sub Sumber Dana</label>
                <select
                  required
                  value={idSubSumber}
                  onChange={(e) => {
                    setIdSubSumber(e.target.value);
                    setIdRencanaBelanja("");
                  }}
                  disabled={!sumberDanaKode}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white transition disabled:bg-slate-50 disabled:text-slate-500 sm:text-sm"
                >
                  <option value="" disabled>Pilih Sub Sumber Dana</option>
                  {(subSumberDanaList || []).map((sub) => (
                    <option key={sub.id} value={sub.id}>{sub.nama}</option>
                  ))}
                  {/* Fallback if API empty */}
                  {subSumberDanaList?.length === 0 && sumberDanaKode === 'NON_KAPITASI' && (
                    <>
                      <option value="dummy-ritp">RITP</option>
                      <option value="dummy-ambulan">Ambulan</option>
                    </>
                  )}
                </select>
              </div>

              {/* Rencana Belanja (Rekening) */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Rekening Belanja</label>
                <select
                  required
                  value={idRencanaBelanja}
                  onChange={(e) => setIdRencanaBelanja(e.target.value)}
                  disabled={!idSubSumber}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white transition disabled:bg-slate-50 disabled:text-slate-500 sm:text-sm"
                >
                  <option value="" disabled>Pilih Rekening Belanja</option>
                  {(rencanaBelanjaList || []).map((rb) => (
                    <option key={rb.id} value={rb.id}>
                      [{rb.kode_rekening}] {rb.uraian_belanja} - Sisa: {formatCurrency(rb.sisa_pagu)}
                    </option>
                  ))}
                  {/* Fallback if API empty */}
                  {rencanaBelanjaList?.length === 0 && idSubSumber && (
                     <option value="dummy-budget-id">[1.0.0] ATK - Sisa: Rp 5.000.000</option>
                  )}
                </select>
              </div>

              {/* Uraian */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Uraian / Keterangan</label>
                <textarea
                  required
                  rows={3}
                  value={uraian}
                  onChange={(e) => setUraian(e.target.value)}
                  placeholder="Keterangan pengeluaran..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition sm:text-sm"
                />
              </div>

              {/* Nominal */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Nominal (Rp)</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={nominal}
                  onChange={(e) => setNominal(e.target.value)}
                  placeholder="0"
                  className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition sm:text-sm font-mono text-lg"
                />
              </div>

              {/* Status Messages */}
              {errorObj && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-md flex items-start text-sm">
                  <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0" />
                  <span>{errorObj.message}</span>
                </div>
              )}
              {successMsg && (
                <div className="p-3 bg-green-50 border border-green-200 text-green-700 rounded-md flex items-center text-sm">
                  <CheckCircle2 className="w-5 h-5 mr-2 flex-shrink-0" />
                  <span>{successMsg}</span>
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {isSubmitting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" />
                    Simpan Transaksi
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* DATA TABLE SECTION */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h2 className="text-lg font-semibold text-slate-800">Riwayat Transaksi Terakhir</h2>
            </div>
            
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Tanggal</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Rekening / Uraian</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Nominal</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                  {transaksiList && transaksiList.length > 0 ? (
                    transaksiList.slice(0, 10).map((trx) => (
                      <tr key={trx.id} className="hover:bg-slate-50 transition">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                          {format(new Date(trx.tanggal), "dd MMM yyyy")}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-900">
                          <div className="font-medium">{trx.uraian}</div>
                          <div className="text-slate-500 text-xs mt-0.5">
                            {/* Fallback if relation is mapped or not */}
                            {trx.rencanaBelanja?.RekeningBelanja?.uraian_belanja || "Rekening Belanja"}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-red-600 text-right font-mono">
                          - {formatCurrency(trx.nominal)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={3} className="px-6 py-12 text-center text-sm text-slate-500 flex-col items-center justify-center">
                        <Receipt className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                        Belum ada transaksi.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
