import Link from "next/link";
import { ArrowRight, Wallet } from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full text-center space-y-8">
        <div className="mx-auto flex justify-center items-center w-16 h-16 rounded-full bg-indigo-100 mb-6">
          <Wallet className="w-8 h-8 text-indigo-600" />
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-gray-900">Financial ERP</h1>
        <p className="text-lg text-gray-500">Sistem Penjagaan Pagu Anggaran ketat untuk manajemen keuangan faskes.</p>
        
        <Link 
          href="/entry-data/belanja" 
          className="inline-flex items-center justify-center px-5 py-3 border border-transparent text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 mt-8"
        >
          Buka Form Entry Belanja
          <ArrowRight className="ml-2 w-5 h-5" />
        </Link>
      </div>
    </div>
  );
}
