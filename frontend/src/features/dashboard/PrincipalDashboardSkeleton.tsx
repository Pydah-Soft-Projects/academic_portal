export function PrincipalDashboardSkeleton() {
  return (
    <div className="space-y-4 sm:space-y-5 pb-12 font-sans bg-[#f8fafc] -mx-4 sm:-mx-6 -mt-6 p-4 sm:p-6 min-h-screen animate-pulse">
      {/* 1. TOP METRIC CARDS ROW (6 CARDS) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-3.5">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="bg-white rounded-xl p-3.5 sm:p-4 border border-slate-200/80 shadow-2xs space-y-2.5">
            <div className="w-9 h-9 rounded-lg bg-slate-100" />
            <div className="h-3 w-20 bg-slate-100 rounded" />
            <div className="h-7 w-24 bg-slate-100 rounded" />
            <div className="h-2.5 w-28 bg-slate-100 rounded" />
          </div>
        ))}
      </div>

      {/* 2. MAIN SECTION: DEPARTMENT ACADEMIC OVERVIEW */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-slate-100" />
            <div className="space-y-1">
              <div className="h-4 w-48 bg-slate-100 rounded" />
              <div className="h-3 w-64 bg-slate-100 rounded" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-7 w-20 bg-slate-100 rounded-md" />
            <div className="h-7 w-36 bg-slate-100 rounded-lg" />
          </div>
        </div>

        {/* Table skeleton */}
        <div className="space-y-3 pt-1">
          <div className="h-8 bg-slate-50 rounded-lg w-full" />
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-10 bg-slate-50/60 rounded-lg w-full flex items-center justify-between px-3">
              <div className="h-3.5 w-32 bg-slate-100 rounded" />
              <div className="h-3.5 w-16 bg-slate-100 rounded" />
              <div className="h-3.5 w-16 bg-slate-100 rounded" />
              <div className="h-3.5 w-16 bg-slate-100 rounded" />
              <div className="h-3.5 w-12 bg-slate-100 rounded" />
            </div>
          ))}
        </div>
      </div>

      {/* 3. LOWER ROW 1: 3 CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Card 1: Student Attendance */}
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs p-4 sm:p-4.5 h-[285px] flex flex-col justify-between">
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-slate-100" />
              <div className="h-4 w-32 bg-slate-100 rounded" />
            </div>
            <div className="h-3 w-12 bg-slate-100 rounded" />
          </div>
          {/* Simulated Bar Chart */}
          <div className="h-44 w-full flex items-end justify-between gap-3 px-4 pt-4">
            {[45, 75, 30, 85, 60, 40, 70].map((h, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-2">
                <div className="w-full bg-slate-100 rounded-t" style={{ height: `${h}%` }} />
                <div className="h-2.5 w-4 bg-slate-100 rounded" />
              </div>
            ))}
          </div>
          <div className="h-2.5 w-36 bg-slate-100 rounded mx-auto mt-1" />
        </div>

        {/* Card 2: Students at Risk */}
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs p-4 sm:p-4.5 h-[285px] flex flex-col justify-between">
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-slate-100" />
              <div className="h-4 w-40 bg-slate-100 rounded" />
            </div>
            <div className="h-3 w-12 bg-slate-100 rounded" />
          </div>
          <div className="space-y-2.5 mt-2 flex-1">
            <div className="h-6 bg-slate-50 rounded w-full" />
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-7 bg-slate-50/60 rounded w-full" />
            ))}
          </div>
        </div>

        {/* Card 3: Subjects Behind Schedule */}
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs p-4 sm:p-4.5 h-[285px] flex flex-col justify-between">
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-slate-100" />
              <div className="h-4 w-40 bg-slate-100 rounded" />
            </div>
            <div className="h-3 w-12 bg-slate-100 rounded" />
          </div>
          <div className="space-y-2.5 mt-2 flex-1">
            <div className="h-6 bg-slate-50 rounded w-full" />
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-7 bg-slate-50/60 rounded w-full" />
            ))}
          </div>
        </div>
      </div>

      {/* 4. LOWER ROW 2: 3 CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Card 4: Faculty Attendance */}
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs p-4 sm:p-5 h-[270px] flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-slate-100" />
              <div className="h-4 w-44 bg-slate-100 rounded" />
            </div>
            <div className="h-3 w-12 bg-slate-100 rounded" />
          </div>
          <div className="grid grid-cols-5 gap-2 mt-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 bg-slate-50 rounded-lg" />
            ))}
          </div>
          <div className="h-14 bg-slate-50 rounded-xl mt-3" />
        </div>

        {/* Card 5: Fee Collection */}
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs p-4 sm:p-5 h-[270px] flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-slate-100" />
              <div className="h-4 w-36 bg-slate-100 rounded" />
            </div>
          </div>
          <div className="flex items-center gap-4 my-2">
            <div className="w-16 h-16 rounded-full bg-slate-100 shrink-0" />
            <div className="space-y-2 flex-1">
              <div className="h-3 w-20 bg-slate-100 rounded" />
              <div className="h-6 w-28 bg-slate-100 rounded" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 bg-slate-50 rounded-lg" />
            ))}
          </div>
        </div>

        {/* Card 6: Approvals & Deadlines */}
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs p-4 sm:p-5 h-[270px] flex flex-col justify-between">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-slate-100" />
              <div className="h-4 w-44 bg-slate-100 rounded" />
            </div>
            <div className="h-3 w-12 bg-slate-100 rounded" />
          </div>
          <div className="flex gap-4 border-b border-slate-100 pb-2">
            <div className="h-3 w-28 bg-slate-100 rounded" />
            <div className="h-3 w-28 bg-slate-100 rounded" />
          </div>
          <div className="space-y-2.5 mt-2 flex-1">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-8 bg-slate-50/60 rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
