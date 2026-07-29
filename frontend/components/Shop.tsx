// Coin-shop modal for buying/equipping guns with coins earned from zombie
// kills (see ZOMBIE.COINS_PER_KILL server-side). Purely presentational —
// all the actual state (coins, ownedWeapons, equippedWeapon) lives on the
// authoritative server and flows down through GameCanvas's self state;
// this component just renders it and fires MSG.BUY_WEAPON/EQUIP_WEAPON.
"use client";

import { WEAPONS } from "@blobwars/shared";

export function Shop({
  open,
  coins,
  ownedWeapons,
  equippedWeapon,
  onBuy,
  onEquip,
  onClose,
}: {
  open: boolean;
  coins: number;
  ownedWeapons: string[];
  equippedWeapon: string;
  onBuy: (weaponId: string) => void;
  onEquip: (weaponId: string) => void;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div
      className="absolute inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="w-[min(92vw,560px)] max-h-[80vh] overflow-y-auto rounded-2xl border border-white/10 bg-arena-panel p-5 animate-zoomIn"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white">Gun Shop</h2>
          <span className="flex items-center gap-1.5 text-yellow-400 font-semibold">
            🪙 {coins}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {WEAPONS.map((weapon) => {
            const owned = ownedWeapons.includes(weapon.id);
            const equipped = equippedWeapon === weapon.id;
            const canAfford = coins >= weapon.price;

            return (
              <div
                key={weapon.id}
                className={`rounded-xl border p-3 flex flex-col items-center gap-2 transition-colors ${
                  equipped ? "border-arena-accent bg-arena-accent/10" : "border-white/10 bg-black/20"
                }`}
              >
                <div className="w-16 h-16 flex items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={weapon.icon} alt={weapon.name} className="max-w-full max-h-full object-contain" />
                </div>
                <div className="text-xs font-semibold text-white text-center leading-tight">{weapon.name}</div>
                <div className="text-[11px] text-white/60">
                  DMG {weapon.damage} · {(1000 / weapon.cooldownMs).toFixed(1)}/s
                </div>

                {equipped ? (
                  <span className="mt-1 text-[11px] font-bold text-arena-accent uppercase tracking-wide">
                    Equipped
                  </span>
                ) : owned ? (
                  <button
                    onClick={() => onEquip(weapon.id)}
                    className="mt-1 w-full text-xs font-semibold py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
                  >
                    Equip
                  </button>
                ) : (
                  <button
                    onClick={() => canAfford && onBuy(weapon.id)}
                    disabled={!canAfford}
                    className={`mt-1 w-full text-xs font-semibold py-1.5 rounded-lg transition-colors ${
                      canAfford
                        ? "bg-yellow-500/90 hover:bg-yellow-400 text-black"
                        : "bg-white/5 text-white/30 cursor-not-allowed"
                    }`}
                  >
                    {weapon.price === 0 ? "Free" : `🪙 ${weapon.price}`}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <button
          onClick={onClose}
          className="mt-5 w-full py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 text-sm font-semibold transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
}
