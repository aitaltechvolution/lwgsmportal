import { ReactNode } from "react";
import { Link } from "react-router-dom";

export default function AuthCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-navy flex items-center justify-center font-black text-amber-400 text-sm">
              LW
            </div>
            <div>
              <div className="text-navy font-black text-base leading-none">LWGSM</div>
              <div className="text-gray-400 text-[10px] uppercase tracking-widest">School of Ministry</div>
            </div>
          </Link>
          <h1 className="mt-6 text-xl font-bold text-gray-800">{title}</h1>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          {children}
        </div>
      </div>
    </section>
  );
}
