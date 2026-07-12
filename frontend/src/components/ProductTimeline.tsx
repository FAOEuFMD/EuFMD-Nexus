import React, { useMemo } from 'react';

interface TimelineProcurement {
  id: number;
  product: string;
  quantity: number;
  delivery_date: string;
  name_un?: string;
  country_id?: number;
}

interface ProductTimelineProps {
  procurements: TimelineProcurement[];
  productColors: Record<string, string>;
}

interface TimelineGroup {
  key: string;
  date: Date | null;
  timestamp: number;
  countryName: string;
  products: { product: string; quantity: number }[];
  totalQuantity: number;
  shipmentCount: number;
}

const UNDISPLAYED_DATE_LABEL = 'Date not recorded';

/** Parse API dates (YYYY-MM-DD) in local time — avoids UTC timezone shifts. */
function parseDeliveryDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const trimmed = String(value).trim();
  if (!trimmed || trimmed.toLowerCase() === 'null' || trimmed.toLowerCase() === 'n/a') {
    return null;
  }

  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]) - 1;
    const day = Number(isoMatch[3]);
    const local = new Date(year, month, day);
    return Number.isNaN(local.getTime()) ? null : local;
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatTimelineDate(date: Date): string {
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function localDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addProductToGroup(group: TimelineGroup, product: string, quantity: number) {
  const existing = group.products.find((item) => item.product === product);
  if (existing) {
    existing.quantity += quantity;
  } else {
    group.products.push({ product, quantity });
  }
  group.totalQuantity += quantity;
  group.shipmentCount += 1;
}

const ProductTimeline: React.FC<ProductTimelineProps> = ({ procurements, productColors }) => {
  const { groups, undatedCount } = useMemo(() => {
    const byDateAndCountry = new Map<string, TimelineGroup>();
    let undated = 0;

    procurements.forEach((proc) => {
      const date = parseDeliveryDate(proc.delivery_date);
      const countryName = proc.name_un?.trim() || `Country ${proc.country_id ?? 'unknown'}`;
      const quantity = Number(proc.quantity) || 0;

      if (!date) {
        undated += 1;
        const key = `undated|${countryName}|${proc.id}`;
        byDateAndCountry.set(key, {
          key,
          date: null,
          timestamp: Number.MAX_SAFE_INTEGER,
          countryName,
          products: [{ product: proc.product, quantity }],
          totalQuantity: quantity,
          shipmentCount: 1,
        });
        return;
      }

      const key = `${localDateKey(date)}|${countryName}`;

      if (!byDateAndCountry.has(key)) {
        byDateAndCountry.set(key, {
          key,
          date,
          timestamp: date.getTime(),
          countryName,
          products: [],
          totalQuantity: 0,
          shipmentCount: 0,
        });
      }

      addProductToGroup(byDateAndCountry.get(key)!, proc.product, quantity);
    });

    const sorted = Array.from(byDateAndCountry.values())
      .map((group) => ({
        ...group,
        products: [...group.products].sort((a, b) => a.product.localeCompare(b.product)),
      }))
      .sort((a, b) => {
        const aUndated = a.date === null;
        const bUndated = b.date === null;
        if (aUndated !== bUndated) return aUndated ? 1 : -1;
        if (a.timestamp !== b.timestamp) return a.timestamp - b.timestamp;
        return a.countryName.localeCompare(b.countryName);
      });

    return { groups: sorted, undatedCount: undated };
  }, [procurements]);

  if (groups.length === 0) {
    return (
      <div className="flex h-full min-h-[10rem] items-center justify-center text-sm text-gray-500 px-3 text-center">
        No procurement data for timeline.
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="mb-2 shrink-0 px-1">
        <h3 className="text-sm font-bold text-gray-800">Products over time</h3>
        <p className="text-[10px] text-gray-500 mt-0.5">
          {procurements.length} shipment{procurements.length === 1 ? '' : 's'}
          {undatedCount > 0 ? ` · ${undatedCount} without date` : ''}
          {' · '}earliest first
        </p>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain pr-1 pb-1">
        <ol className="relative border-l-2 border-[#72aba7] ml-3 space-y-4">
          {groups.map((group) => (
            <li key={group.key} className="relative pl-4">
              <span className="absolute -left-[7px] top-1.5 h-3 w-3 rounded-full border-2 border-white bg-[#15736d] shadow-sm" />
              <time className="block text-[11px] font-semibold text-gray-500">
                {group.date ? formatTimelineDate(group.date) : UNDISPLAYED_DATE_LABEL}
              </time>
              <p className="text-xs font-bold text-[#15736d] mt-0.5">{group.countryName}</p>
              <ul className="mt-1 space-y-1">
                {group.products.map((item) => (
                  <li
                    key={`${group.key}-${item.product}`}
                    className="flex items-start gap-1.5 text-[11px] text-gray-700"
                  >
                    <span
                      className="mt-1 h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: productColors[item.product] || '#6b7280' }}
                      title={item.product}
                    />
                    <span className="leading-snug break-words">
                      <span className="font-medium" title={item.product}>
                        {item.product}
                      </span>{' '}
                      <span className="text-gray-500">({item.quantity})</span>
                    </span>
                  </li>
                ))}
              </ul>
              <p className="text-[10px] text-gray-500 mt-1">
                Total: {group.totalQuantity}
                {group.shipmentCount > 1 ? ` · ${group.shipmentCount} lines` : ''}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
};

export default ProductTimeline;
