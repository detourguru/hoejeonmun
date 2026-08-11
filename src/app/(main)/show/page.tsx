import { getKopis } from "@/lib/kopis";
import { AREA_GROUP_MAP, AREA_MAP, Show, STATE_MAP } from "@/type/show";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ShowCard } from "@/components/card/ShowCard";

const toKopisDate = (date: Date) =>
  `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(
    date.getDate(),
  ).padStart(2, "0")}`;

/** KOPIS 필수 파라미터 — 없으면 INVALID REQUEST PARAMETER ERROR가 반환된다 */
function withRequiredParams(params: URLSearchParams) {
  const today = new Date();
  const oneYearLater = new Date(today);
  oneYearLater.setFullYear(today.getFullYear() + 1);

  const defaults = {
    stdate: toKopisDate(today),
    eddate: toKopisDate(oneYearLater),
    cpage: "1",
    rows: "30",
  };

  Object.entries(defaults).forEach(([key, value]) => {
    if (!params.has(key)) params.set(key, value);
  });

  return params;
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const queryParams = withRequiredParams(
    new URLSearchParams(params as Record<string, string>),
  );

  const data: Show[] = await getKopis("/pblprfr", queryParams);

  return (
    <div>
      <Input placeholder="공연명 | 배우 이름으로 검색" />

      <div className="flex overflow-x-scroll items-center gap-2 py-2 justify-between">
        <ToggleGroup
          multiple
          aria-label="진행 상태"
          defaultValue={["02"]}
          className="flex gap-2 cursor-pointer"
        >
          {Object.entries(STATE_MAP).map(([code, name]) => (
            <ToggleGroupItem key={code} value={code}>
              {name}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        <Select>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="정렬 선택" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem key="openDate" value="개막일순">
              개막일순
            </SelectItem>
            <SelectItem key="closeDate" value="종료일순">
              종료일순
            </SelectItem>
          </SelectContent>
        </Select>

        <Select>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="지역 선택" />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(AREA_GROUP_MAP).map(([code, name]) => (
              <SelectItem key={code} value={name}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="규모 선택" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem key="" value="전체">
              전체
            </SelectItem>
            <SelectItem key="bigScale" value="대극장">
              대극장
            </SelectItem>
            <SelectItem key="mdScale" value="중소극장">
              중소극장
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {data.map((show) => (
        <ShowCard key={show.mt20id} show={show} />
      ))}
    </div>
  );
}
