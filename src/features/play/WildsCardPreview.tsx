"use client";

import { memo } from "react";
import type { AdventureCardCondition } from "./adventure/card-condition";
import type { PortableCardAsset } from "./portable-card";
import { WildsCard } from "./WildsCard";

export const WildsCardPreview = memo(function WildsCardPreview({
  asset,
  condition
}: {
  asset: PortableCardAsset;
  condition?: AdventureCardCondition | null;
}) {
  return <WildsCard asset={asset} compact condition={condition} />;
});
