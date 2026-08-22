import { useQuery } from "@tanstack/react-query";
import { fetchLeaderboard } from "../net/leaderboard";

/** Monthly standings for the big screen — refetches whenever the Host lobby mounts. */
export function Leaderboard() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["leaderboard"],
    queryFn: () => fetchLeaderboard(),
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
  const entries = data?.entries ?? [];

  return (
    <div className="panel w-full max-w-[980px]">
      <p className="panel__title">
        <span>🏆 อันดับเดือนนี้</span>
        {entries.length > 0 && <span className="muted">{entries.length} คน</span>}
      </p>

      {isLoading ? (
        <p className="muted py-4 text-center">กำลังโหลดอันดับ…</p>
      ) : isError ? (
        <p className="muted py-4 text-center">โหลดอันดับไม่ได้ (เซิร์ฟเวอร์ออฟไลน์?)</p>
      ) : entries.length === 0 ? (
        <p className="muted py-4 text-center">ยังไม่มีสถิติเดือนนี้ — เล่นแมตช์แรกกันเลย!</p>
      ) : (
        <ol className="flex flex-col gap-1">
          {entries.slice(0, 10).map((e, i) => (
            <li
              key={e.name}
              className={"flex items-center gap-3 rounded-field border-2 px-3 py-2 " + (i === 0 ? "border-yellow bg-[#fff7e0]" : "border-line bg-surface-2")}
            >
              <span className="w-7 text-center font-display text-lg font-extrabold text-blue-d">
                {i === 0 ? "👑" : i + 1}
              </span>
              <span className="chip__name flex-1 font-display font-bold text-ink">{e.name}</span>
              <span className="text-[12px] font-semibold whitespace-nowrap text-ink-soft">
                ชนะ {e.wins} · คิล {e.kills} · {e.matches} แมตช์
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
